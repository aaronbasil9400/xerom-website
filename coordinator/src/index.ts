import { DurableObject } from "cloudflare:workers";
import { bookingRequestSchema } from "../../src/lib/booking/schema";
import { overlaps } from "../../src/lib/booking/time";
import { allCalendarIds, resourceIdForCalendar, calendarIdForResource, runtimeCalendarGroups, runtimeResourceIdForCalendar, runtimeCalendarIdForResource } from "../../src/lib/booking/resources";
import { CalendarMutationUncertainError, queryFreeBusy, insertEvent, deleteEvent, listCalendarEvents, patchCalendarEvent, type CalendarEventPatch, type CalendarEventRecord } from "../../src/lib/google/calendar";
import { createBookingId, hashPayload } from "../../src/lib/booking/id";
import { serviceCore, type ServiceId } from "../../src/config/service-core";
import { sanitizeCalendarText } from "../../src/lib/booking/text";
import { blockTimeRequestSchema, blockRemovalRequestSchema, bookingActionSchema } from "../../src/lib/race-control/contracts";
import { applyGroupedMutation, GroupedMutationError, lifecycleTransitionAllowed, type GroupedMutationStep } from "./grouped-mutation";
import { NO_SHOW_GRACE_MINUTES, noShowGraceElapsed } from "../../src/lib/race-control/no-show";
import { SerializedExecutor } from "./serialized-executor";
import { operationCommandSchema } from "../../src/lib/race-control/contracts";
import { R2ConfigRepository, ConfigConflictError, ConfigUnavailableError } from "../../src/lib/config/repository";
import { reviewConfigDraft } from "../../src/lib/race-control/config-review";
import { createSeedConfig } from "../../src/lib/config/seed";
import { resolveRuntimeConfig } from "../../src/lib/config/runtime";
import { validateRuntimeBookingWindow } from "../../src/lib/booking/runtime-time";
import { calculateRuntimeQuote } from "../../src/lib/race-control/pricing";
import { ConfigPublicationRejectedError, executeConfigPublication, recoverActivatedConfigPublication } from "../../src/lib/race-control/config-publication";
import { activityExpired, activityStorageKey, type ActivityRecord, type ActivityState } from "../../src/lib/race-control/activity";

type Env = CloudflareEnv & { BOOKING_COORDINATOR: DurableObjectNamespace<BookingCoordinator> };
type Attempt = { hash: string; status: "pending" | "complete" | "failed"; response?: unknown; createdEvents?: Array<{ calendarId: string; eventId: string }> };
type MutationStatus = "running" | "complete" | "failed" | "needs_review";
type ActionAttempt = { hash: string; status: MutationStatus; response?: unknown; eventIds?: Array<{ calendarId: string; eventId: string }> };
type BlockAttempt = { hash: string; status: MutationStatus; response?: unknown; eventIds?: Array<{ calendarId: string; eventId: string }> };
type RecoveryFence = { operationId: string; resourceId: string; start: string; end: string; reason: string; createdAt: string };
type ConfigAttempt = { hash: string; status: MutationStatus; response?: unknown; revisionId?: string; publishedAt?: string; activityKey?: string };

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export class BookingCoordinator extends DurableObject<Env> {
  private readonly mutations = new SerializedExecutor();

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    if (request.headers.get("x-xerom-command") === "activity-history") return this.handleActivityHistory(request);
    if (request.headers.get("x-xerom-command") === "recovery-fences") return this.handleRecoveryFences(request);
    if (request.headers.get("x-xerom-command") === "booking-action") return this.handleBookingAction(request);
    if (request.headers.get("x-xerom-command") === "block-time") return this.handleBlockTime(request);
    if (request.headers.get("x-xerom-command") === "remove-block") return this.handleRemoveBlock(request);
    if (request.headers.get("x-xerom-command") === "activate-config") return this.handleActivateConfig(request);
    const parsed = bookingRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return reply({ error: "Invalid booking command." }, 400);
    const booking = parsed.data;
    const bookingSource = request.headers.get("x-xerom-source") === "race-control-owner" ? "race-control-owner" : "xerom.my";
    return this.mutations.run(async () => {
      const hash = await hashPayload(booking);
      const key = `attempt:${booking.idempotencyKey}`;
      const prior = await this.ctx.storage.get<Attempt>(key);
      if (prior) {
        if (prior.hash !== hash) return reply({ error: "This booking attempt was already used with different details." }, 409);
        if (prior.status === "complete") return reply({ ...(prior.response as object), replayed: true }, 200);
        return reply({ error: "This booking attempt needs staff review before retrying." }, 503);
      }
      await this.ctx.storage.put(key, { hash, status: "pending" } satisfies Attempt);

      const env = this.env;
      const { config, compiledFallback } = await resolveRuntimeConfig(env);
      const ownerBooking = bookingSource === "race-control-owner";
      if (!ownerBooking && ((!booking.configRevision && !compiledFallback) || (booking.configRevision && booking.configRevision !== config.revisionId))) {
        await this.ctx.storage.delete(key);
        return reply({ error: "Booking settings changed while you were choosing. Reload the booking page and review the latest prices and availability." }, 409);
      }
      const windowError = validateRuntimeBookingWindow(config, booking.start, booking.durationMinutes, new Date(), ownerBooking);
      if (windowError) { await this.ctx.storage.delete(key); return reply({ error: windowError }, 400); }
      const groups = runtimeCalendarGroups(config);
      const end = new Date(Date.parse(booking.start) + booking.durationMinutes * 60_000).toISOString();
      const requested = Object.fromEntries((Object.keys(serviceCore) as ServiceId[]).map((id) => [id, booking.items.find((item) => item.serviceId === id)?.quantity ?? 0])) as Record<ServiceId, number>;
      if (Object.values(requested).reduce((total, quantity) => total + quantity, 0) > config.bookingRules.totalGroupLimit
        || (Object.keys(requested) as ServiceId[]).some((serviceId) => requested[serviceId] > groups[serviceId].length || requested[serviceId] > config.bookingRules.perServiceGroupLimits[serviceId])
        || (!config.bookingRules.mixedServiceAllowed && Object.values(requested).filter((quantity) => quantity > 0).length > 1)) {
        await this.ctx.storage.delete(key);
        return reply({ error: "The requested resource quantities are not allowed by current settings." }, 409);
      }
      const createdEvents: Array<{ calendarId: string; eventId: string }> = [];
      let activityKey: string | undefined;
      const customerName = sanitizeCalendarText(booking.customer.name);
      const customerPhone = sanitizeCalendarText(booking.customer.phone);
      const customerEmail = booking.customer.email ? sanitizeCalendarText(booking.customer.email) : "";
      const customerNotes = booking.customer.notes ? sanitizeCalendarText(booking.customer.notes) : "";

      try {
        const ids = [...Object.values(groups).flat(), env.BOOKING_CONTROL_CALENDAR_ID].filter((value): value is string => Boolean(value));
        const bufferMs = config.bookingRules.bufferMinutes * 60_000;
        const bufferedStart = new Date(Date.parse(booking.start) - bufferMs).toISOString();
        const bufferedEnd = new Date(Date.parse(end) + bufferMs).toISOString();
        const busy = await queryFreeBusy(env, ids, bufferedStart, bufferedEnd);
        const fencedResources = await this.activeFenceResourceIds(bufferedStart, bufferedEnd);
        if (fencedResources.has("booking-control")) {
          await this.ctx.storage.delete(key);
          return reply({ error: "That time is temporarily unavailable while a previous operation is reconciled." }, 409);
        }
        if (env.BOOKING_CONTROL_CALENDAR_ID && (busy[env.BOOKING_CONTROL_CALENDAR_ID] ?? []).some((interval) => overlaps(bufferedStart, bufferedEnd, interval.start, interval.end))) {
          await this.ctx.storage.delete(key);
          return reply({ error: "That time is not available. Please choose another slot." }, 409);
        }

        const allocations = new Map<ServiceId, string[]>();
        for (const serviceId of Object.keys(groups) as ServiceId[]) {
          const available = groups[serviceId].filter((calendarId) => {
            const resourceId = runtimeResourceIdForCalendar(config, calendarId);
            return !resourceId || (!fencedResources.has(resourceId) && !(busy[calendarId] ?? []).some((interval) => overlaps(bufferedStart, bufferedEnd, interval.start, interval.end)));
          });
          if (available.length < requested[serviceId]) {
            await this.ctx.storage.delete(key);
            return reply({ error: "That slot was just taken. Please choose another available time." }, 409);
          }
          allocations.set(serviceId, available.slice(0, requested[serviceId]));
        }

        const bookingId = createBookingId();
        activityKey = await this.beginActivity({ id: `booking:${booking.idempotencyKey}`, category: "booking", action: "create", actorId: ownerBooking ? request.headers.get("x-xerom-actor-id")?.slice(0, 256) || "owner:unknown" : "public:website", resourceIds: [...allocations.values()].flat().map((calendarId) => runtimeResourceIdForCalendar(config, calendarId)).filter((resourceId): resourceId is string => Boolean(resourceId)), start: booking.start, end });
        const price = calculateRuntimeQuote(config, { items: booking.items.filter((item) => item.quantity > 0), start: booking.start, durationMinutes: booking.durationMinutes, channel: ownerBooking ? "owner" : "public" });
        for (const [serviceId, calendarIds] of allocations) {
          const selectedItem = booking.items.find((item) => item.serviceId === serviceId);
          const configuredService = config.services.find((service) => service.serviceId === serviceId)!;
          const includedControllers = serviceId === "ps5" ? config.controllers.includedQuantity * requested[serviceId] : 0;
          const additionalControllers = serviceId === "ps5" ? selectedItem?.additionalControllers ?? 0 : 0;
          for (const calendarId of calendarIds) {
            const eventId = (await hashPayload({ attempt: booking.idempotencyKey, calendarId })).slice(0, 28);
            const event = {
              calendarId,
              eventId,
              summary: `${bookingId} | ${configuredService.shortName.toUpperCase()} | ${customerName} | ${booking.durationMinutes}m`,
              description: [
                `Customer: ${customerName}`,
                `Phone: ${customerPhone}`,
                customerEmail ? `Email: ${customerEmail}` : "",
                `Service: ${configuredService.name}`,
                `Duration: ${booking.durationMinutes} minutes`,
                serviceId === "ps5" ? `Included controllers: ${includedControllers}` : "",
                serviceId === "ps5" ? `Additional controllers: ${additionalControllers}` : "",
                serviceId === "ps5" ? `Total controllers: ${includedControllers + additionalControllers}` : "",
                `Booking ID: ${bookingId}`,
                `Total booking price: RM${(price.totalSen / 100).toFixed(2)}`,
                customerNotes ? `Notes: ${customerNotes}` : "",
              ].filter(Boolean).join("\n"),
              start: booking.start,
              end,
              privateProperties: {
                bookingId,
                attemptHash: hash.slice(0, 40),
                source: bookingSource,
                serviceType: serviceId,
                resourceId: runtimeResourceIdForCalendar(config, calendarId) ?? calendarId,
                groupVersion: "0",
                durationMinutes: String(booking.durationMinutes),
                quantity: String(requested[serviceId]),
                status: "confirmed",
                createdAt: new Date().toISOString(),
                 pricingVersion: price.pricingEngineVersion,
                 configRevision: price.configRevision,
                 customerName,
                 customerPhone,
                 ...(customerEmail ? { customerEmail } : {}),
                  priceTotalSen: String(price.totalSen),
                 ...(serviceId === "ps5" ? {
                  includedControllers: String(includedControllers),
                  additionalControllers: String(additionalControllers),
                  totalControllers: String(includedControllers + additionalControllers),
                } : {}),
              },
            };
            await insertEvent(env, event);
            createdEvents.push({ calendarId, eventId });
            await this.ctx.storage.put(key, { hash, status: "pending", createdEvents } satisfies Attempt);
          }
        }

        const confirmation = {
          bookingId,
          start: booking.start,
          end,
          durationMinutes: booking.durationMinutes,
          items: booking.items.filter((item) => item.quantity > 0),
          customerName: booking.customer.name,
          total: price.totalSen / 100,
          currency: "MYR",
        };
        await this.ctx.storage.put(key, { hash, status: "complete", response: confirmation, createdEvents } satisfies Attempt);
        if (activityKey) await this.finishActivity(activityKey, "succeeded", { bookingId });
        return reply(confirmation, 201);
      } catch (error) {
        const rollback = await Promise.allSettled(createdEvents.map((event) => deleteEvent(env, event.calendarId, event.eventId)));
        const rollbackFailed = error instanceof CalendarMutationUncertainError || rollback.some((result) => result.status === "rejected");
        await this.ctx.storage.put(key, { hash, status: rollbackFailed ? "failed" : "pending", createdEvents: rollbackFailed ? createdEvents : [] } satisfies Attempt);
        if (!rollbackFailed) await this.ctx.storage.delete(key);
        if (activityKey) await this.finishActivity(activityKey, rollbackFailed ? "needs_review" : "failed");
        console.error(JSON.stringify({ message: "booking_create_failed", attempt: booking.idempotencyKey, createdCount: createdEvents.length, rollbackFailed, error: error instanceof Error ? error.message : "unknown" }));
        return reply({ error: rollbackFailed ? "Booking could not be completed and needs staff review. Please contact Xerom." : "Booking could not be completed. Please try again." }, 503);
      }
    });
  }

  private async handleActivateConfig(request: Request): Promise<Response> {
    const parsed = operationCommandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || parsed.data.type !== "activate-config") return reply({ error: "Invalid configuration publication command." }, 400);
    const command = parsed.data;
    const actorId = request.headers.get("x-xerom-actor-id")?.slice(0, 256);
    if (!actorId) return reply({ error: "Owner identity is required." }, 403);
    return this.mutations.run(async () => {
      const key = `config-attempt:${command.opId}`;
      const prior = await this.ctx.storage.get<ConfigAttempt>(key);
      let intendedRevisionId = prior?.revisionId;
      let intendedPublishedAt = prior?.publishedAt;
      if (prior) {
        if (prior.hash !== command.payloadHash) return reply({ error: "This publication operation was already used with different details." }, 409);
        if (prior.status === "complete") return reply({ ...(prior.response as object), replayed: true }, 200);
      }
      const activityKey = prior?.activityKey ?? await this.beginActivity({ id: `config:${command.opId}`, category: "settings", action: "publish", actorId });
      await this.ctx.storage.put(key, { hash: command.payloadHash, status: "running", revisionId: prior?.revisionId, publishedAt: prior?.publishedAt, activityKey } satisfies ConfigAttempt);
      try {
        if (!this.env.RACE_CONTROL_CONFIG_BUCKET || !this.env.RACE_CONTROL_TOKEN_ENCRYPTION_KEY) throw new ConfigUnavailableError("Configuration publication is not configured.");
        const repository = new R2ConfigRepository(this.env.RACE_CONTROL_CONFIG_BUCKET);
        const recovered = prior?.revisionId ? await recoverActivatedConfigPublication(repository, prior.revisionId) : null;
        if (prior?.revisionId && recovered) {
          const published = await repository.readRevision(prior.revisionId);
          if (!published) throw new ConfigUnavailableError("The activated configuration revision is unavailable.");
          await this.rollPublishedDraft(repository, published, command.draftEtag);
          const response = recovered;
          await this.ctx.storage.put(key, { hash: command.payloadHash, status: "complete", response, revisionId: prior.revisionId, publishedAt: prior.publishedAt, activityKey } satisfies ConfigAttempt);
          await this.finishActivity(activityKey, "succeeded", { revisionId: prior.revisionId });
          return reply(response, 200);
        }
        const publishedAt = intendedPublishedAt ?? new Date().toISOString();
        const seed = createSeedConfig({ resources: {
          "regular-01": this.env.REGULAR_SIM_01_CALENDAR_ID,
          "regular-02": this.env.REGULAR_SIM_02_CALENDAR_ID,
          "regular-03": this.env.REGULAR_SIM_03_CALENDAR_ID,
          "pro-01": this.env.PRO_SIM_01_CALENDAR_ID,
          "ps5-01": this.env.PS5_01_CALENDAR_ID,
          "ps5-02": this.env.PS5_02_CALENDAR_ID,
        } }, publishedAt);
        const { revision, pointer } = await executeConfigPublication({
          repository,
          command,
          actorId,
          reviewSecret: this.env.RACE_CONTROL_TOKEN_ENCRYPTION_KEY,
          seedConfig: seed,
          publishedAt,
          review: (current, proposed, now) => reviewConfigDraft(this.env, current, proposed, now),
          onIntent: async (revisionId, intentPublishedAt) => {
            intendedRevisionId = revisionId;
            intendedPublishedAt = intentPublishedAt;
            await this.ctx.storage.put(key, { hash: command.payloadHash, status: "running", revisionId, publishedAt: intentPublishedAt, activityKey } satisfies ConfigAttempt);
          },
        });
        const revisionId = revision.revisionId;
        await this.rollPublishedDraft(repository, revision, command.draftEtag);
        const response = { revisionId, activatedAt: pointer.activatedAt };
        await this.ctx.storage.put(key, { hash: command.payloadHash, status: "complete", response, revisionId, publishedAt, activityKey } satisfies ConfigAttempt);
        await this.finishActivity(activityKey, "succeeded", { revisionId });
        return reply(response, 201);
      } catch (error) {
        if (error instanceof ConfigPublicationRejectedError) {
          const response = { error: error.message, ...(error.conflicts ? { conflicts: error.conflicts } : {}) };
          await this.ctx.storage.put(key, { hash: command.payloadHash, status: "failed", response, revisionId: intendedRevisionId, publishedAt: intendedPublishedAt, activityKey } satisfies ConfigAttempt);
          await this.finishActivity(activityKey, "failed");
          return reply(response, 409);
        }
        const uncertain = error instanceof ConfigConflictError || error instanceof ConfigUnavailableError;
        await this.ctx.storage.put(key, { hash: command.payloadHash, status: uncertain ? "needs_review" : "failed", revisionId: intendedRevisionId, publishedAt: intendedPublishedAt, activityKey } satisfies ConfigAttempt);
        await this.finishActivity(activityKey, uncertain ? "needs_review" : "failed");
        console.error(JSON.stringify({ message: "config_activation_failed", operationId: command.opId, error: error instanceof Error ? error.message : "unknown" }));
        return reply({ error: uncertain ? "Configuration publication needs review before retrying." : "Configuration publication failed." }, 503);
      }
    });
  }

  private async rollPublishedDraft(repository: R2ConfigRepository, published: Parameters<R2ConfigRepository["saveDraft"]>[0], reviewedDraftEtag: string): Promise<void> {
    try {
      const currentDraft = await repository.readDraft();
      if (currentDraft?.value.parentRevision === published.revisionId && currentDraft.value.publishedAt === null) return;
      if (!currentDraft || currentDraft.etag !== reviewedDraftEtag) {
        console.error(JSON.stringify({ message: "published_config_draft_rollover_conflict", revisionId: published.revisionId }));
        return;
      }
      const draftRevisionId = `draft-${published.revisionId.replace(/^rev-/, "").slice(0, 42)}`;
      await repository.saveDraft({ ...published, revisionId: draftRevisionId, parentRevision: published.revisionId, publishedAt: null }, reviewedDraftEtag);
    } catch (error) {
      console.error(JSON.stringify({ message: "published_config_draft_rollover_failed", revisionId: published.revisionId, error: error instanceof Error ? error.message : "unknown" }));
    }
  }

  private async handleBookingAction(request: Request): Promise<Response> {
    const incoming = await request.json().catch(() => null) as { action?: unknown; idempotencyKey?: unknown } | null;
    const actionParsed = bookingActionSchema.safeParse(incoming?.action);
    const idempotencyKey = typeof incoming?.idempotencyKey === "string" ? incoming.idempotencyKey : "";
    if (!actionParsed.success || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) return reply({ error: "Invalid booking action." }, 400);
    const action = actionParsed.data;
    return this.mutations.run(async () => {
      const hash = await hashPayload({ action, idempotencyKey });
      const key = `action:${idempotencyKey}`;
      const prior = await this.ctx.storage.get<ActionAttempt>(key);
      if (prior) {
        if (prior.hash !== hash) return reply({ error: "This action attempt was already used with different details." }, 409);
        if (prior.status === "complete") return reply({ ...(prior.response as object), replayed: true }, 200);
        return reply({ error: "This action needs staff review before retrying." }, 503);
      }
      const env = this.env;
      let activityKey: string | undefined;
      try {
        const { config } = await resolveRuntimeConfig(env);
        const searchableCalendarIds = [...new Set([...allCalendarIds(env), ...config.resources.flatMap((resource) => resource.calendarRef ? [resource.calendarRef] : [])])].filter((calendarId) => calendarId !== env.BOOKING_CONTROL_CALENDAR_ID);
        const events = (await Promise.all(searchableCalendarIds.map(async (calendarId) => ({ calendarId, events: await listCalendarEvents(env, calendarId, "1970-01-01T00:00:00Z", "2100-01-01T00:00:00Z", `bookingId=${action.expected.bookingId}`) })))).flatMap(({ calendarId, events }) => events.map((event) => ({ calendarId, event, resourceId: runtimeResourceIdForCalendar(config, calendarId) ?? resourceIdForCalendar(env, calendarId) ?? event.privateProperties.resourceId ?? calendarId })));
        if (events.length === 0) return reply({ error: "Booking could not be found in the private calendars." }, 404);
        const versions = new Set(events.map(({ event }) => Number(event.privateProperties.groupVersion ?? "0")));
        const version = versions.size === 1 ? [...versions][0] : -1;
        const statuses = new Set(events.map(({ event }) => event.privateProperties.status ?? "confirmed"));
        const currentStatus = statuses.size === 1 ? [...statuses][0] : null;
        const starts = new Set(events.map(({ event }) => event.start));
        const ends = new Set(events.map(({ event }) => event.end));
        if (!Number.isFinite(version) || version < 0 || version !== action.expected.version || !currentStatus || starts.size !== 1 || ends.size !== 1) {
          return reply({ error: "Booking changed outside Race Control. Review it before retrying." }, 409);
        }
        if (!lifecycleTransitionAllowed(currentStatus, action.action)) return reply({ error: `The ${action.action} action is not valid while this booking is ${currentStatus}.` }, 409);

        const nextVersion = String(version + 1);
        const targetStatus = action.action === "check-in" ? "checked_in" : action.action === "complete" ? "completed" : action.action === "no-show" ? "no_show" : action.action === "cancel" ? "cancelled" : undefined;
        const currentStart = events[0].event.start;
        const currentEnd = events[0].event.end;
        if (action.action === "no-show" && !noShowGraceElapsed(currentStart)) {
          return reply({ error: `A no-show may be recorded after the ${NO_SHOW_GRACE_MINUTES}-minute grace period.` }, 409);
        }
        const currentResourceIds = events.map(({ resourceId }) => resourceId).sort();
        let fenceStart = currentStart;
        let fenceEnd = currentEnd;
        let response: Record<string, unknown>;
        let steps: GroupedMutationStep[];

        if (action.action === "reschedule") {
          const requestedResources = action.resourceIds.slice().sort();
          if (JSON.stringify(currentResourceIds) !== JSON.stringify(requestedResources)) return reply({ error: "Changing resources requires a fresh owner quote and review." }, 409);
          const durationMinutes = (Date.parse(currentEnd) - Date.parse(currentStart)) / 60_000;
          const windowError = validateRuntimeBookingWindow(config, action.start, durationMinutes, new Date(), true);
          if (windowError) return reply({ error: windowError }, 409);
          const newEnd = new Date(Date.parse(action.start) + durationMinutes * 60_000).toISOString();
          const targetCalendarIds = events.map(({ calendarId }) => calendarId);
          const bufferedStart = new Date(Date.parse(action.start) - config.bookingRules.bufferMinutes * 60_000).toISOString();
          const bufferedEnd = new Date(Date.parse(newEnd) + config.bookingRules.bufferMinutes * 60_000).toISOString();
          const busy = await this.listBlockingEvents(targetCalendarIds, bufferedStart, bufferedEnd, events);
          if (env.BOOKING_CONTROL_CALENDAR_ID) busy.push(...await this.listBlockingEvents([env.BOOKING_CONTROL_CALENDAR_ID], bufferedStart, bufferedEnd));
          if (busy.length > 0) return reply({ error: "The new time overlaps another Calendar block or venue closure." }, 409);
          fenceStart = Date.parse(action.start) < Date.parse(currentStart) ? action.start : currentStart;
          fenceEnd = Date.parse(newEnd) > Date.parse(currentEnd) ? newEnd : currentEnd;
          steps = events.map(({ calendarId, event }) => ({
            calendarId,
            event,
            patch: { start: action.start, end: newEnd, privateProperties: updatedPrivateProperties(event, nextVersion) },
            restore: restorePatch(event, ["start", "end", "privateProperties"]),
          }));
          response = { bookingId: action.expected.bookingId, status: currentStatus, version: version + 1, start: action.start, end: newEnd, eventCount: events.length, pricePreserved: true };
        } else if (action.action === "extend") {
          if (Date.parse(currentEnd) <= Date.now()) return reply({ error: "An ended booking cannot be extended." }, 409);
          const additionalEnd = new Date(Date.parse(currentEnd) + action.durationMinutes * 60_000).toISOString();
          const totalDurationMinutes = (Date.parse(additionalEnd) - Date.parse(currentStart)) / 60_000;
          const windowError = validateRuntimeBookingWindow(config, currentStart, totalDurationMinutes, new Date(Date.parse(currentStart) - 1), true);
          if (windowError) return reply({ error: windowError }, 409);
          const targetCalendarIds = events.map(({ calendarId }) => calendarId);
          const bufferedStart = new Date(Date.parse(currentEnd) - config.bookingRules.bufferMinutes * 60_000).toISOString();
          const bufferedEnd = new Date(Date.parse(additionalEnd) + config.bookingRules.bufferMinutes * 60_000).toISOString();
          const busy = await this.listBlockingEvents(targetCalendarIds, bufferedStart, bufferedEnd, events);
          if (env.BOOKING_CONTROL_CALENDAR_ID) busy.push(...await this.listBlockingEvents([env.BOOKING_CONTROL_CALENDAR_ID], bufferedStart, bufferedEnd));
          if (busy.length > 0) return reply({ error: "The extension overlaps another Calendar block or venue closure." }, 409);
          fenceEnd = additionalEnd;
          steps = events.map(({ calendarId, event }) => ({
            calendarId,
            event,
            patch: { end: additionalEnd, privateProperties: updatedPrivateProperties(event, nextVersion) },
            restore: restorePatch(event, ["end", "privateProperties"]),
          }));
          response = { bookingId: action.expected.bookingId, status: currentStatus, version: version + 1, end: additionalEnd, eventCount: events.length, priceReviewRequired: true };
        } else {
          if (!targetStatus) return reply({ error: "Unsupported booking action." }, 400);
          const now = new Date();
          if (action.action === "complete" && now.getTime() <= Date.parse(currentStart)) return reply({ error: "A booking cannot be completed before it starts." }, 409);
          const reason = "reason" in action && action.reason ? sanitizeCalendarText(action.reason) : undefined;
          steps = events.map(({ calendarId, event }) => {
            const end = action.action === "complete" && action.releaseRemainingTime && Date.parse(event.end) > now.getTime() ? now.toISOString() : undefined;
            const privateProperties = updatedPrivateProperties(event, nextVersion, targetStatus, reason);
            return {
              calendarId,
              event,
              patch: { privateProperties, transparency: targetStatus === "cancelled" ? "transparent" : "opaque", ...(end ? { end } : {}) },
              restore: restorePatch(event, ["end", "transparency", "privateProperties"]),
            };
          });
          response = { bookingId: action.expected.bookingId, status: targetStatus, version: version + 1, eventCount: events.length };
        }

        const existingFences = await this.activeFenceResourceIds(fenceStart, fenceEnd);
        if (currentResourceIds.some((resourceId) => existingFences.has(resourceId)) || existingFences.has("booking-control")) {
          return reply({ error: "A previous operation affecting this time needs staff review." }, 409);
        }

        activityKey = await this.beginActivity({ id: `action:${idempotencyKey}`, category: "booking", action: action.action, actorId: request.headers.get("x-xerom-actor-id")?.slice(0, 256) || "owner:unknown", bookingId: action.expected.bookingId, resourceIds: currentResourceIds, start: fenceStart, end: fenceEnd });
        await this.ctx.storage.put(key, { hash, status: "running", eventIds: events.map(({ calendarId, event }) => ({ calendarId, eventId: event.id })) } satisfies ActionAttempt);
        await this.putRecoveryFences(idempotencyKey, currentResourceIds, fenceStart, fenceEnd, action.action);
        try {
          const changed = await applyGroupedMutation(steps, (calendarId, eventId, patch, etag) => patchCalendarEvent(env, calendarId, eventId, patch, etag));
          await this.clearRecoveryFences(idempotencyKey, currentResourceIds);
          await this.ctx.storage.put(key, { hash, status: "complete", response, eventIds: changed.map((event, index) => ({ calendarId: steps[index].calendarId, eventId: event.id })) } satisfies ActionAttempt);
          await this.finishActivity(activityKey, "succeeded");
          return reply(response, 200);
        } catch (error) {
          const compensationFailed = error instanceof GroupedMutationError && error.compensationFailed;
          if (!compensationFailed) await this.clearRecoveryFences(idempotencyKey, currentResourceIds);
          await this.ctx.storage.put(key, { hash, status: compensationFailed ? "needs_review" : "failed", eventIds: events.map(({ calendarId, event }) => ({ calendarId, eventId: event.id })) } satisfies ActionAttempt);
          await this.finishActivity(activityKey, compensationFailed ? "needs_review" : "failed");
          console.error(JSON.stringify({ message: "booking_action_failed", bookingId: action.expected.bookingId, action: action.action, compensationFailed, error: error instanceof Error ? error.message : "unknown" }));
          return reply({ error: compensationFailed ? "Booking action partially changed Calendar and needs staff review." : "Booking action failed; any Calendar changes were rolled back." }, 503);
        }
      } catch (error) {
        if (activityKey) await this.finishActivity(activityKey, "needs_review");
        console.error(JSON.stringify({ message: "booking_action_failed", bookingId: action.expected.bookingId, action: action.action, error: error instanceof Error ? error.message : "unknown" }));
        return reply({ error: "Booking action could not be completed and needs staff review." }, 503);
      }
    });
  }

  private async handleBlockTime(request: Request): Promise<Response> {
    const parsed = blockTimeRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return reply({ error: "Invalid block command." }, 400);
    const block = parsed.data;
    return this.mutations.run(async () => {
      const hash = await hashPayload(block);
      const key = `block:${block.idempotencyKey}`;
      const prior = await this.ctx.storage.get<BlockAttempt>(key);
      if (prior) {
        if (prior.hash !== hash) return reply({ error: "This block attempt was already used with different details." }, 409);
        if (prior.status === "complete") return reply({ ...(prior.response as object), replayed: true }, 200);
        return reply({ error: "This block needs staff review before retrying." }, 503);
      }
      const env = this.env;
      const { config } = await resolveRuntimeConfig(env);
      const calendarIds = block.resourceIds.map((resourceId) => resourceId === "booking-control" ? env.BOOKING_CONTROL_CALENDAR_ID ?? null : runtimeCalendarIdForResource(config, resourceId) ?? calendarIdForResource(env, resourceId));
      if (calendarIds.some((calendarId): calendarId is null => calendarId === null)) return reply({ error: "A requested resource is not configured." }, 409);
      const createdEvents: Array<{ calendarId: string; eventId: string }> = [];
      let activityKey: string | undefined;
      try {
        const overlapsExisting = await this.listBlockingEvents(calendarIds as string[], block.start, block.end);
        const existingFences = await this.activeFenceResourceIds(block.start, block.end);
        if (overlapsExisting.length > 0 || block.resourceIds.some((resourceId) => existingFences.has(resourceId)) || existingFences.has("booking-control")) {
          return reply({ error: "The block overlaps an existing Calendar reservation or recovery hold." }, 409);
        }
        activityKey = await this.beginActivity({ id: `block:${block.idempotencyKey}`, category: "block", action: block.blockType, actorId: request.headers.get("x-xerom-actor-id")?.slice(0, 256) || "owner:unknown", resourceIds: block.resourceIds, start: block.start, end: block.end });
        await this.ctx.storage.put(key, { hash, status: "running" } satisfies BlockAttempt);
        await this.putRecoveryFences(block.idempotencyKey, block.resourceIds, block.start, block.end, block.blockType);
        for (const calendarId of calendarIds) {
          const resourceId = resourceIdForCalendar(env, calendarId!) ?? "booking-control";
          const eventId = (await hashPayload({ block: block.idempotencyKey, calendarId })).slice(0, 28);
          await insertEvent(env, {
            calendarId: calendarId!,
            eventId,
            summary: `${block.blockType === "venue-closure" ? "VENUE CLOSURE" : "MAINTENANCE"} | ${sanitizeCalendarText(block.reason)}`,
            description: `Race Control ${block.blockType}\nReason: ${sanitizeCalendarText(block.reason)}`,
            start: block.start,
            end: block.end,
            privateProperties: { source: "race-control-owner", blockType: block.blockType, blockId: block.idempotencyKey, resourceId, status: "blocked", createdAt: new Date().toISOString() },
          });
          createdEvents.push({ calendarId: calendarId!, eventId });
        }
        const response = { blockType: block.blockType, start: block.start, end: block.end, resourceIds: block.resourceIds, eventCount: createdEvents.length };
        await this.clearRecoveryFences(block.idempotencyKey, block.resourceIds);
        await this.ctx.storage.put(key, { hash, status: "complete", response, eventIds: createdEvents } satisfies BlockAttempt);
        await this.finishActivity(activityKey, "succeeded");
        return reply(response, 201);
      } catch (error) {
        const rollback = await Promise.allSettled(createdEvents.map((event) => deleteEvent(env, event.calendarId, event.eventId)));
        const rollbackFailed = error instanceof CalendarMutationUncertainError || rollback.some((result) => result.status === "rejected");
        if (!rollbackFailed) await this.clearRecoveryFences(block.idempotencyKey, block.resourceIds);
        await this.ctx.storage.put(key, { hash, status: rollbackFailed ? "needs_review" : "failed", eventIds: createdEvents } satisfies BlockAttempt);
        if (activityKey) await this.finishActivity(activityKey, rollbackFailed ? "needs_review" : "failed");
        console.error(JSON.stringify({ message: "block_time_failed", blockType: block.blockType, createdCount: createdEvents.length, rollbackFailed, error: error instanceof Error ? error.message : "unknown" }));
        return reply({ error: rollbackFailed ? "The block failed and needs staff review." : "The block could not be created." }, 503);
      }
    });
  }

  private async handleRemoveBlock(request: Request): Promise<Response> {
    const parsed = blockRemovalRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return reply({ error: "Invalid block removal command." }, 400);
    const removal = parsed.data;
    return this.mutations.run(async () => {
      const hash = await hashPayload(removal);
      const key = `block-removal:${removal.idempotencyKey}`;
      const prior = await this.ctx.storage.get<BlockAttempt>(key);
      if (prior) {
        if (prior.hash !== hash) return reply({ error: "This removal attempt was already used with different details." }, 409);
        if (prior.status === "complete") return reply({ ...(prior.response as object), replayed: true }, 200);
        return reply({ error: "This block removal needs staff review before retrying." }, 503);
      }
      const env = this.env;
      const { config } = await resolveRuntimeConfig(env);
      // Search every resource calendar so a multi-resource block is removed in full, regardless of which row was opened.
      const searchableCalendarIds = [...new Set([...allCalendarIds(env), ...config.resources.flatMap((resource) => resource.calendarRef ? [resource.calendarRef] : [])])];
      const startMs = Date.parse(removal.start);
      const endMs = Date.parse(removal.end);
      let activityKey: string | undefined;
      const removedEvents: Array<{ calendarId: string; eventId: string }> = [];
      try {
        const candidates = (await Promise.all(searchableCalendarIds.map(async (calendarId) => {
          const events = await listCalendarEvents(env, calendarId, new Date(startMs - 60_000).toISOString(), new Date(endMs + 60_000).toISOString());
          const matched = events.filter((event) =>
            event.status !== "cancelled"
            && event.privateProperties.source === "race-control-owner"
            && event.privateProperties.blockType === removal.blockType
            && Date.parse(event.start) === startMs
            && Date.parse(event.end) === endMs
            && (removal.blockId ? event.privateProperties.blockId === removal.blockId : true));
          return matched.map((event) => ({ calendarId, eventId: event.id, resourceId: event.privateProperties.resourceId ?? null }));
        }))).flat();
        if (candidates.length === 0) return reply({ error: "The block could not be found. Refresh the schedule and try again." }, 404);
        activityKey = await this.beginActivity({ id: `block-removal:${removal.idempotencyKey}`, category: "block", action: removal.blockType, actorId: request.headers.get("x-xerom-actor-id")?.slice(0, 256) || "owner:unknown", resourceIds: removal.resourceIds, start: removal.start, end: removal.end });
        await this.ctx.storage.put(key, { hash, status: "running" } satisfies BlockAttempt);
        for (const candidate of candidates) {
          await deleteEvent(env, candidate.calendarId, candidate.eventId);
          removedEvents.push({ calendarId: candidate.calendarId, eventId: candidate.eventId });
        }
        const response = { blockType: removal.blockType, start: removal.start, end: removal.end, resourceIds: removal.resourceIds, eventCount: removedEvents.length };
        await this.ctx.storage.put(key, { hash, status: "complete", response, eventIds: removedEvents } satisfies BlockAttempt);
        await this.finishActivity(activityKey, "succeeded", { resourceIds: removal.resourceIds });
        return reply(response, 200);
      } catch (error) {
        const uncertain = error instanceof CalendarMutationUncertainError;
        await this.ctx.storage.put(key, { hash, status: uncertain ? "needs_review" : "failed", eventIds: removedEvents } satisfies BlockAttempt);
        if (activityKey) await this.finishActivity(activityKey, uncertain ? "needs_review" : "failed");
        console.error(JSON.stringify({ message: "block_removal_failed", blockType: removal.blockType, removedCount: removedEvents.length, error: error instanceof Error ? error.message : "unknown" }));
        return reply({ error: uncertain ? "The block removal outcome is uncertain and needs staff review." : "The block could not be removed." }, 503);
      }
    });
  }

  private async handleRecoveryFences(request: Request): Promise<Response> {
    const body = await request.json().catch(() => null) as { start?: unknown; end?: unknown } | null;
    const start = typeof body?.start === "string" ? body.start : "";
    const end = typeof body?.end === "string" ? body.end : "";
    if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) {
      return reply({ error: "Invalid recovery-fence interval." }, 400);
    }
    const fences = await this.activeRecoveryFences(start, end);
    return reply({ fences: fences.map(({ resourceId, start: fenceStart, end: fenceEnd }) => ({ resourceId, start: fenceStart, end: fenceEnd })) });
  }

  private async beginActivity(input: Pick<ActivityRecord, "id" | "category" | "action" | "actorId"> & Pick<ActivityRecord, "bookingId" | "resourceIds" | "start" | "end">): Promise<string> {
    const now = new Date().toISOString();
    const key = activityStorageKey(now, input.id);
    await this.ctx.storage.put(key, { ...input, state: "running", createdAt: now, updatedAt: now } satisfies ActivityRecord);
    return key;
  }

  private async finishActivity(key: string, state: ActivityState, details: Pick<ActivityRecord, "bookingId" | "resourceIds" | "revisionId"> = {}): Promise<void> {
    try {
      const record = await this.ctx.storage.get<ActivityRecord>(key);
      if (!record) return;
      await this.ctx.storage.put(key, { ...record, ...details, state, updatedAt: new Date().toISOString() } satisfies ActivityRecord);
    } catch {
      // A running record remains visible for owner review if its final audit update cannot be verified.
      console.error(JSON.stringify({ message: "activity_record_update_failed", state }));
    }
  }

  private async handleActivityHistory(request: Request): Promise<Response> {
    const input = await request.json().catch(() => null) as { cursor?: unknown; limit?: unknown } | null;
    const limit = typeof input?.limit === "number" && Number.isInteger(input.limit) ? Math.max(1, Math.min(input.limit, 100)) : 50;
    const cursor = typeof input?.cursor === "string" && /^activity:\d{13}:[A-Za-z0-9:_-]{1,180}$/.test(input.cursor) ? input.cursor : undefined;
    if (input?.cursor && !cursor) return reply({ error: "Invalid activity cursor." }, 400);
    await this.pruneActivityHistory();
    const rows = await this.ctx.storage.list<ActivityRecord>({ prefix: "activity:", limit: limit + 1, ...(cursor ? { startAfter: cursor } : {}) });
    const entries = [...rows.entries()];
    const page = entries.slice(0, limit);
    const fences = await this.ctx.storage.list<RecoveryFence>({ prefix: "recovery-fence:", limit: 501 });
    const grouped = new Map<string, { operationId: string; resourceIds: string[]; start: string; end: string; createdAt: string }>();
    for (const fence of [...fences.values()].slice(0, 500)) {
      const item = grouped.get(fence.operationId) ?? { operationId: fence.operationId, resourceIds: [], start: fence.start, end: fence.end, createdAt: fence.createdAt };
      item.resourceIds.push(fence.resourceId);
      if (fence.start < item.start) item.start = fence.start;
      if (fence.end > item.end) item.end = fence.end;
      grouped.set(fence.operationId, item);
    }
    return reply({ data: page.map(([, record]) => record), nextCursor: entries.length > limit ? page.at(-1)?.[0] : null, recoveryHolds: [...grouped.values()], recoveryHoldsTruncated: fences.size > 500 });
  }

  private async pruneActivityHistory(now = Date.now()): Promise<void> {
    const cutoff = now - 30 * 24 * 60 * 60_000;
    const start = `activity:${String(9_999_999_999_999 - cutoff).padStart(13, "0")}:`;
    const expired = await this.ctx.storage.list<ActivityRecord>({ prefix: "activity:", start, limit: 1_000 });
    const keys = [...expired.entries()].filter(([, record]) => activityExpired(record, now)).map(([key]) => key);
    if (keys.length) await Promise.all(keys.map((key) => this.ctx.storage.delete(key)));
  }

  private async listBlockingEvents(
    calendarIds: string[],
    start: string,
    end: string,
    excluded: Array<{ calendarId: string; event: CalendarEventRecord }> = [],
  ): Promise<Array<{ calendarId: string; event: CalendarEventRecord }>> {
    return (await Promise.all(calendarIds.map(async (calendarId) => ({ calendarId, events: await listCalendarEvents(this.env, calendarId, start, end) }))))
      .flatMap(({ calendarId, events }) => events
        .filter((event) => isBlockingEvent(event)
          && overlaps(start, end, event.start, event.end)
          && !excluded.some((current) => current.calendarId === calendarId && current.event.id === event.id))
        .map((event) => ({ calendarId, event })));
  }

  private async putRecoveryFences(operationId: string, resourceIds: string[], start: string, end: string, reason: string): Promise<void> {
    const createdAt = new Date().toISOString();
    for (const resourceId of resourceIds) {
      await this.ctx.storage.put(`recovery-fence:${resourceId}:${operationId}`, { operationId, resourceId, start, end, reason, createdAt } satisfies RecoveryFence);
    }
  }

  private async clearRecoveryFences(operationId: string, resourceIds: string[]): Promise<void> {
    for (const resourceId of resourceIds) {
      const key = `recovery-fence:${resourceId}:${operationId}`;
      const fence = await this.ctx.storage.get<RecoveryFence>(key);
      if (fence?.operationId === operationId) await this.ctx.storage.delete(key);
    }
  }

  private async activeFenceResourceIds(start: string, end: string): Promise<Set<string>> {
    return new Set((await this.activeRecoveryFences(start, end)).map((fence) => fence.resourceId));
  }

  private async activeRecoveryFences(start: string, end: string): Promise<RecoveryFence[]> {
    const fences = await this.ctx.storage.list<RecoveryFence>({ prefix: "recovery-fence:" });
    return [...fences.values()].filter((fence) => overlaps(start, end, fence.start, fence.end));
  }
}

function isBlockingEvent(event: CalendarEventRecord): boolean {
  return event.status !== "cancelled" && event.transparency !== "transparent" && event.privateProperties.status !== "cancelled";
}

function updatedPrivateProperties(event: CalendarEventRecord, groupVersion: string, status?: string, reason?: string): Record<string, string> {
  return {
    ...event.privateProperties,
    ...(status ? { status } : {}),
    ...(reason ? { lastActionReason: reason } : {}),
    groupVersion,
    updatedAt: new Date().toISOString(),
  };
}

function restorePatch(event: CalendarEventRecord, fields: Array<keyof CalendarEventPatch>): CalendarEventPatch {
  const patch: CalendarEventPatch = {};
  if (fields.includes("start")) patch.start = event.start;
  if (fields.includes("end")) patch.end = event.end;
  if (fields.includes("transparency")) patch.transparency = event.transparency === "transparent" ? "transparent" : "opaque";
  if (fields.includes("privateProperties")) patch.privateProperties = event.privateProperties;
  return patch;
}

export default {
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
