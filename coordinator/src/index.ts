import { DurableObject } from "cloudflare:workers";
import { bookingRequestSchema } from "../../src/lib/booking/schema";
import { validateBookingOperatingWindow, validateBookingWindow, overlaps } from "../../src/lib/booking/time";
import { manualBookingRules } from "../../src/config/booking";
import { pricing } from "../../src/config/pricing";
import { calendarGroups, allCalendarIds, resourceIdForCalendar, calendarIdForResource } from "../../src/lib/booking/resources";
import { CalendarMutationUncertainError, queryFreeBusy, insertEvent, deleteEvent, listCalendarEvents, patchCalendarEvent, type CalendarEventPatch, type CalendarEventRecord } from "../../src/lib/google/calendar";
import { calculateTotal } from "../../src/lib/booking/pricing";
import { createBookingId, hashPayload } from "../../src/lib/booking/id";
import { serviceCore, type ServiceId } from "../../src/config/service-core";
import { sanitizeCalendarText } from "../../src/lib/booking/text";
import { blockTimeRequestSchema, bookingActionSchema } from "../../src/lib/race-control/contracts";
import { applyGroupedMutation, GroupedMutationError, lifecycleTransitionAllowed, type GroupedMutationStep } from "./grouped-mutation";
import { SerializedExecutor } from "./serialized-executor";

type Env = CloudflareEnv & { BOOKING_COORDINATOR: DurableObjectNamespace<BookingCoordinator> };
type Attempt = { hash: string; status: "pending" | "complete" | "failed"; response?: unknown; createdEvents?: Array<{ calendarId: string; eventId: string }> };
type MutationStatus = "running" | "complete" | "failed" | "needs_review";
type ActionAttempt = { hash: string; status: MutationStatus; response?: unknown; eventIds?: Array<{ calendarId: string; eventId: string }> };
type BlockAttempt = { hash: string; status: MutationStatus; response?: unknown; eventIds?: Array<{ calendarId: string; eventId: string }> };
type RecoveryFence = { operationId: string; resourceId: string; start: string; end: string; reason: string; createdAt: string };

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export class BookingCoordinator extends DurableObject<Env> {
  private readonly mutations = new SerializedExecutor();

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    if (request.headers.get("x-xerom-command") === "recovery-fences") return this.handleRecoveryFences(request);
    if (request.headers.get("x-xerom-command") === "booking-action") return this.handleBookingAction(request);
    if (request.headers.get("x-xerom-command") === "block-time") return this.handleBlockTime(request);
    const parsed = bookingRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return reply({ error: "Invalid booking command." }, 400);
    const booking = parsed.data;
    const bookingSource = request.headers.get("x-xerom-source") === "race-control-owner" ? "race-control-owner" : "xerom.my";
    const windowError = validateBookingWindow(booking.start, booking.durationMinutes, new Date(), bookingSource === "race-control-owner" ? manualBookingRules : undefined);
    if (windowError) return reply({ error: windowError }, 400);
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
      const groups = calendarGroups(env);
      const end = new Date(Date.parse(booking.start) + booking.durationMinutes * 60_000).toISOString();
      const requested = Object.fromEntries((Object.keys(serviceCore) as ServiceId[]).map((id) => [id, booking.items.find((item) => item.serviceId === id)?.quantity ?? 0])) as Record<ServiceId, number>;
      const createdEvents: Array<{ calendarId: string; eventId: string }> = [];
      const customerName = sanitizeCalendarText(booking.customer.name);
      const customerPhone = sanitizeCalendarText(booking.customer.phone);
      const customerEmail = booking.customer.email ? sanitizeCalendarText(booking.customer.email) : "";
      const customerNotes = booking.customer.notes ? sanitizeCalendarText(booking.customer.notes) : "";

      try {
        const ids = allCalendarIds(env);
        const busy = await queryFreeBusy(env, ids, booking.start, end);
        const fencedResources = await this.activeFenceResourceIds(booking.start, end);
        if (fencedResources.has("booking-control")) {
          await this.ctx.storage.delete(key);
          return reply({ error: "That time is temporarily unavailable while a previous operation is reconciled." }, 409);
        }
        if (env.BOOKING_CONTROL_CALENDAR_ID && (busy[env.BOOKING_CONTROL_CALENDAR_ID] ?? []).some((interval) => overlaps(booking.start, end, interval.start, interval.end))) {
          await this.ctx.storage.delete(key);
          return reply({ error: "That time is not available. Please choose another slot." }, 409);
        }

        const allocations = new Map<ServiceId, string[]>();
        for (const serviceId of Object.keys(groups) as ServiceId[]) {
          const available = groups[serviceId].filter((calendarId) => {
            const resourceId = resourceIdForCalendar(env, calendarId);
            return !resourceId || (!fencedResources.has(resourceId) && !(busy[calendarId] ?? []).some((interval) => overlaps(booking.start, end, interval.start, interval.end)));
          });
          if (available.length < requested[serviceId]) {
            await this.ctx.storage.delete(key);
            return reply({ error: "That slot was just taken. Please choose another available time." }, 409);
          }
          allocations.set(serviceId, available.slice(0, requested[serviceId]));
        }

        const bookingId = createBookingId();
        const price = calculateTotal(booking.items, booking.durationMinutes);
        for (const [serviceId, calendarIds] of allocations) {
          const selectedItem = booking.items.find((item) => item.serviceId === serviceId);
          const includedControllers = serviceId === "ps5" ? pricing.services.ps5.includedControllers * requested[serviceId] : 0;
          const additionalControllers = serviceId === "ps5" ? selectedItem?.additionalControllers ?? 0 : 0;
          for (const calendarId of calendarIds) {
            const eventId = (await hashPayload({ attempt: booking.idempotencyKey, calendarId })).slice(0, 28);
            const event = {
              calendarId,
              eventId,
              summary: `${bookingId} | ${serviceCore[serviceId].shortName.toUpperCase()} | ${customerName} | ${booking.durationMinutes}m`,
              description: [
                `Customer: ${customerName}`,
                `Phone: ${customerPhone}`,
                customerEmail ? `Email: ${customerEmail}` : "",
                `Service: ${serviceCore[serviceId].name}`,
                `Duration: ${booking.durationMinutes} minutes`,
                serviceId === "ps5" ? `Included controllers: ${includedControllers}` : "",
                serviceId === "ps5" ? `Additional controllers: ${additionalControllers}` : "",
                serviceId === "ps5" ? `Total controllers: ${includedControllers + additionalControllers}` : "",
                `Booking ID: ${bookingId}`,
                `Total booking price: RM${price.total}`,
                customerNotes ? `Notes: ${customerNotes}` : "",
              ].filter(Boolean).join("\n"),
              start: booking.start,
              end,
              privateProperties: {
                bookingId,
                attemptHash: hash.slice(0, 40),
                source: bookingSource,
                serviceType: serviceId,
                resourceId: resourceIdForCalendar(env, calendarId) ?? calendarId,
                groupVersion: "0",
                durationMinutes: String(booking.durationMinutes),
                quantity: String(requested[serviceId]),
                status: "confirmed",
                createdAt: new Date().toISOString(),
                 pricingVersion: price.version,
                 customerName,
                 customerPhone,
                 ...(customerEmail ? { customerEmail } : {}),
                 priceTotal: String(price.total),
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
          total: price.total,
          currency: "MYR",
        };
        await this.ctx.storage.put(key, { hash, status: "complete", response: confirmation, createdEvents } satisfies Attempt);
        return reply(confirmation, 201);
      } catch (error) {
        const rollback = await Promise.allSettled(createdEvents.map((event) => deleteEvent(env, event.calendarId, event.eventId)));
        const rollbackFailed = error instanceof CalendarMutationUncertainError || rollback.some((result) => result.status === "rejected");
        await this.ctx.storage.put(key, { hash, status: rollbackFailed ? "failed" : "pending", createdEvents: rollbackFailed ? createdEvents : [] } satisfies Attempt);
        if (!rollbackFailed) await this.ctx.storage.delete(key);
        console.error(JSON.stringify({ message: "booking_create_failed", attempt: booking.idempotencyKey, createdCount: createdEvents.length, rollbackFailed, error: error instanceof Error ? error.message : "unknown" }));
        return reply({ error: rollbackFailed ? "Booking could not be completed and needs staff review. Please contact Xerom." : "Booking could not be completed. Please try again." }, 503);
      }
    });
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
      try {
        const events = (await Promise.all(allCalendarIds(env).filter((calendarId) => calendarId !== env.BOOKING_CONTROL_CALENDAR_ID).map(async (calendarId) => ({ calendarId, events: await listCalendarEvents(env, calendarId, "1970-01-01T00:00:00Z", "2100-01-01T00:00:00Z", `bookingId=${action.expected.bookingId}`) })))).flatMap(({ calendarId, events }) => events.map((event) => ({ calendarId, event, resourceId: resourceIdForCalendar(env, calendarId) ?? event.privateProperties.resourceId ?? calendarId })));
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
        const currentResourceIds = events.map(({ resourceId }) => resourceId).sort();
        let fenceStart = currentStart;
        let fenceEnd = currentEnd;
        let response: Record<string, unknown>;
        let steps: GroupedMutationStep[];

        if (action.action === "reschedule") {
          const requestedResources = action.resourceIds.slice().sort();
          if (JSON.stringify(currentResourceIds) !== JSON.stringify(requestedResources)) return reply({ error: "Changing resources requires a fresh owner quote and review." }, 409);
          const durationMinutes = (Date.parse(currentEnd) - Date.parse(currentStart)) / 60_000;
          const windowError = validateBookingWindow(action.start, durationMinutes, new Date(), { ...manualBookingRules, allowedDurationsMinutes: [durationMinutes] });
          if (windowError) return reply({ error: windowError }, 409);
          const newEnd = new Date(Date.parse(action.start) + durationMinutes * 60_000).toISOString();
          const targetCalendarIds = events.map(({ calendarId }) => calendarId);
          const busy = await this.listBlockingEvents(targetCalendarIds, action.start, newEnd, events);
          if (env.BOOKING_CONTROL_CALENDAR_ID) busy.push(...await this.listBlockingEvents([env.BOOKING_CONTROL_CALENDAR_ID], action.start, newEnd));
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
          const windowError = validateBookingOperatingWindow(currentStart, additionalEnd, false);
          if (windowError) return reply({ error: windowError }, 409);
          const targetCalendarIds = events.map(({ calendarId }) => calendarId);
          const busy = await this.listBlockingEvents(targetCalendarIds, currentEnd, additionalEnd, events);
          if (env.BOOKING_CONTROL_CALENDAR_ID) busy.push(...await this.listBlockingEvents([env.BOOKING_CONTROL_CALENDAR_ID], currentEnd, additionalEnd));
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

        await this.ctx.storage.put(key, { hash, status: "running", eventIds: events.map(({ calendarId, event }) => ({ calendarId, eventId: event.id })) } satisfies ActionAttempt);
        await this.putRecoveryFences(idempotencyKey, currentResourceIds, fenceStart, fenceEnd, action.action);
        try {
          const changed = await applyGroupedMutation(steps, (calendarId, eventId, patch, etag) => patchCalendarEvent(env, calendarId, eventId, patch, etag));
          await this.clearRecoveryFences(idempotencyKey, currentResourceIds);
          await this.ctx.storage.put(key, { hash, status: "complete", response, eventIds: changed.map((event, index) => ({ calendarId: steps[index].calendarId, eventId: event.id })) } satisfies ActionAttempt);
          return reply(response, 200);
        } catch (error) {
          const compensationFailed = error instanceof GroupedMutationError && error.compensationFailed;
          if (!compensationFailed) await this.clearRecoveryFences(idempotencyKey, currentResourceIds);
          await this.ctx.storage.put(key, { hash, status: compensationFailed ? "needs_review" : "failed", eventIds: events.map(({ calendarId, event }) => ({ calendarId, eventId: event.id })) } satisfies ActionAttempt);
          console.error(JSON.stringify({ message: "booking_action_failed", bookingId: action.expected.bookingId, action: action.action, compensationFailed, error: error instanceof Error ? error.message : "unknown" }));
          return reply({ error: compensationFailed ? "Booking action partially changed Calendar and needs staff review." : "Booking action failed; any Calendar changes were rolled back." }, 503);
        }
      } catch (error) {
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
      const calendarIds = block.resourceIds.map((resourceId) => calendarIdForResource(env, resourceId));
      if (calendarIds.some((calendarId): calendarId is null => calendarId === null)) return reply({ error: "A requested resource is not configured." }, 409);
      const createdEvents: Array<{ calendarId: string; eventId: string }> = [];
      try {
        const overlapsExisting = await this.listBlockingEvents(calendarIds as string[], block.start, block.end);
        const existingFences = await this.activeFenceResourceIds(block.start, block.end);
        if (overlapsExisting.length > 0 || block.resourceIds.some((resourceId) => existingFences.has(resourceId)) || existingFences.has("booking-control")) {
          return reply({ error: "The block overlaps an existing Calendar reservation or recovery hold." }, 409);
        }
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
            privateProperties: { source: "race-control-owner", blockType: block.blockType, resourceId, status: "blocked", createdAt: new Date().toISOString() },
          });
          createdEvents.push({ calendarId: calendarId!, eventId });
        }
        const response = { blockType: block.blockType, start: block.start, end: block.end, resourceIds: block.resourceIds, eventCount: createdEvents.length };
        await this.clearRecoveryFences(block.idempotencyKey, block.resourceIds);
        await this.ctx.storage.put(key, { hash, status: "complete", response, eventIds: createdEvents } satisfies BlockAttempt);
        return reply(response, 201);
      } catch (error) {
        const rollback = await Promise.allSettled(createdEvents.map((event) => deleteEvent(env, event.calendarId, event.eventId)));
        const rollbackFailed = error instanceof CalendarMutationUncertainError || rollback.some((result) => result.status === "rejected");
        if (!rollbackFailed) await this.clearRecoveryFences(block.idempotencyKey, block.resourceIds);
        await this.ctx.storage.put(key, { hash, status: rollbackFailed ? "needs_review" : "failed", eventIds: createdEvents } satisfies BlockAttempt);
        console.error(JSON.stringify({ message: "block_time_failed", blockType: block.blockType, createdCount: createdEvents.length, rollbackFailed, error: error instanceof Error ? error.message : "unknown" }));
        return reply({ error: rollbackFailed ? "The block failed and needs staff review." : "The block could not be created." }, 503);
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
