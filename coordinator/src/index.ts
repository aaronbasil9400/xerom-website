import { DurableObject } from "cloudflare:workers";
import { bookingRequestSchema } from "../../src/lib/booking/schema";
import { validateBookingWindow, overlaps } from "../../src/lib/booking/time";
import { calendarGroups, allCalendarIds, resourceIdForCalendar, calendarIdForResource } from "../../src/lib/booking/resources";
import { queryFreeBusy, insertEvent, deleteEvent, listCalendarEvents, patchCalendarEvent } from "../../src/lib/google/calendar";
import { calculateTotal } from "../../src/lib/booking/pricing";
import { createBookingId, hashPayload } from "../../src/lib/booking/id";
import { serviceCore, type ServiceId } from "../../src/config/service-core";
import { sanitizeCalendarText } from "../../src/lib/booking/text";
import { blockTimeRequestSchema, bookingActionSchema } from "../../src/lib/race-control/contracts";

type Env = CloudflareEnv & { BOOKING_COORDINATOR: DurableObjectNamespace<BookingCoordinator> };
type Attempt = { hash: string; status: "pending" | "complete" | "failed"; response?: unknown; createdEvents?: Array<{ calendarId: string; eventId: string }> };
type ActionAttempt = { hash: string; status: "complete" | "failed"; response?: unknown; eventIds?: Array<{ calendarId: string; eventId: string }> };
type BlockAttempt = { hash: string; status: "complete" | "failed"; response?: unknown; eventIds?: Array<{ calendarId: string; eventId: string }> };

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export class BookingCoordinator extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    if (request.headers.get("x-xerom-command") === "booking-action") return this.handleBookingAction(request);
    if (request.headers.get("x-xerom-command") === "block-time") return this.handleBlockTime(request);
    const parsed = bookingRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return reply({ error: "Invalid booking command." }, 400);
    const booking = parsed.data;
    const bookingSource = request.headers.get("x-xerom-source") === "race-control-owner" ? "race-control-owner" : "xerom.my";
    const windowError = validateBookingWindow(booking.start, booking.durationMinutes);
    if (windowError) return reply({ error: windowError }, 400);
    return this.ctx.blockConcurrencyWhile(async () => {
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
      const customerNotes = booking.customer.notes ? sanitizeCalendarText(booking.customer.notes) : "";

      try {
        const ids = allCalendarIds(env);
        const busy = await queryFreeBusy(env, ids, booking.start, end);
        if (env.BOOKING_CONTROL_CALENDAR_ID && (busy[env.BOOKING_CONTROL_CALENDAR_ID] ?? []).some((interval) => overlaps(booking.start, end, interval.start, interval.end))) {
          await this.ctx.storage.delete(key);
          return reply({ error: "That time is not available. Please choose another slot." }, 409);
        }

        const allocations = new Map<ServiceId, string[]>();
        for (const serviceId of Object.keys(groups) as ServiceId[]) {
          const available = groups[serviceId].filter((calendarId) => !(busy[calendarId] ?? []).some((interval) => overlaps(booking.start, end, interval.start, interval.end)));
          if (available.length < requested[serviceId]) {
            await this.ctx.storage.delete(key);
            return reply({ error: "That slot was just taken. Please choose another available time." }, 409);
          }
          allocations.set(serviceId, available.slice(0, requested[serviceId]));
        }

        const bookingId = createBookingId();
        const price = calculateTotal(booking.items, booking.durationMinutes);
        for (const [serviceId, calendarIds] of allocations) {
          for (const calendarId of calendarIds) {
            const eventId = (await hashPayload({ attempt: booking.idempotencyKey, calendarId })).slice(0, 28);
            const event = {
              calendarId,
              eventId,
              summary: `${bookingId} | ${serviceCore[serviceId].shortName.toUpperCase()} | ${customerName} | ${booking.durationMinutes}m`,
              description: [
                `Customer: ${customerName}`,
                `Phone: ${customerPhone}`,
                `Service: ${serviceCore[serviceId].name}`,
                `Duration: ${booking.durationMinutes} minutes`,
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
        const rollbackFailed = rollback.some((result) => result.status === "rejected");
        await this.ctx.storage.put(key, { hash, status: rollbackFailed ? "failed" : "pending", createdEvents: rollbackFailed ? createdEvents : [] } satisfies Attempt);
        if (!rollbackFailed) await this.ctx.storage.delete(key);
        console.error("booking_create_failed", { attempt: booking.idempotencyKey, createdCount: createdEvents.length, rollbackFailed, message: error instanceof Error ? error.message : "unknown" });
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
    return this.ctx.blockConcurrencyWhile(async () => {
      const hash = await hashPayload({ action, idempotencyKey });
      const key = `action:${idempotencyKey}`;
      const prior = await this.ctx.storage.get<ActionAttempt>(key);
      if (prior) {
        if (prior.hash !== hash) return reply({ error: "This action attempt was already used with different details." }, 409);
        if (prior.status === "complete") return reply({ ...(prior.response as object), replayed: true }, 200);
        return reply({ error: "This action needs staff review before retrying." }, 503);
      }
      await this.ctx.storage.put(key, { hash, status: "failed" } satisfies ActionAttempt);
      const env = this.env;
      try {
        const events = (await Promise.all(allCalendarIds(env).filter((calendarId) => calendarId !== env.BOOKING_CONTROL_CALENDAR_ID).map(async (calendarId) => ({ calendarId, events: await listCalendarEvents(env, calendarId, "1970-01-01T00:00:00Z", "2100-01-01T00:00:00Z", `bookingId=${action.expected.bookingId}`) })))).flatMap(({ calendarId, events }) => events.map((event) => ({ calendarId, event, resourceId: resourceIdForCalendar(env, calendarId) ?? event.privateProperties.resourceId ?? calendarId })));
        if (events.length === 0) return reply({ error: "Booking could not be found in the private calendars." }, 404);
        const versions = new Set(events.map(({ event }) => Number(event.privateProperties.groupVersion ?? "0")));
        const version = versions.size === 1 ? [...versions][0] : -1;
        if (version < 0 || version !== action.expected.version) return reply({ error: "Booking changed outside Race Control. Review it before retrying." }, 409);
        const nextVersion = String(version + 1);
        const targetStatus = action.action === "check-in" ? "checked_in" : action.action === "complete" ? "completed" : action.action === "no-show" ? "no_show" : action.action === "cancel" ? "cancelled" : undefined;
        if (action.action === "reschedule") {
          const currentResources = events.map(({ resourceId }) => resourceId).sort();
          const requestedResources = action.resourceIds.slice().sort();
          if (JSON.stringify(currentResources) !== JSON.stringify(requestedResources)) return reply({ error: "Changing resources requires a fresh owner quote and review." }, 409);
          const newEnd = new Date(Date.parse(action.start) + (Date.parse(events[0].event.end) - Date.parse(events[0].event.start))).toISOString();
          const targetCalendarIds = events.map(({ calendarId }) => calendarId);
          const busy = (await Promise.all(targetCalendarIds.map(async (calendarId) => ({ calendarId, events: await listCalendarEvents(env, calendarId, action.start, newEnd) })))).flatMap(({ calendarId, events: listed }) => listed.filter((event) => !events.some((current) => current.calendarId === calendarId && current.event.id === event.id)).map((event) => ({ calendarId, event })));
          if (busy.some(({ event }) => overlaps(action.start, newEnd, event.start, event.end))) return reply({ error: "The new time overlaps another Calendar block." }, 409);
          const changed: Array<{ calendarId: string; eventId: string }> = [];
          for (const { calendarId, event } of events) {
            await patchCalendarEvent(env, calendarId, event.id, { start: action.start, end: newEnd, privateProperties: { ...event.privateProperties, groupVersion: nextVersion, updatedAt: new Date().toISOString() } }, event.etag);
            changed.push({ calendarId, eventId: event.id });
          }
          const response = { bookingId: action.expected.bookingId, status: eventStatus(events), version: version + 1, start: action.start, end: newEnd, eventCount: changed.length, pricePreserved: true };
          await this.ctx.storage.put(key, { hash, status: "complete", response, eventIds: changed } satisfies ActionAttempt);
          return reply(response, 200);
        }
        if (action.action === "extend") {
          const additionalEnd = new Date(Math.max(...events.map(({ event }) => Date.parse(event.end))) + action.durationMinutes * 60_000).toISOString();
          const currentEnd = new Date(Math.max(...events.map(({ event }) => Date.parse(event.end)))).toISOString();
          const busy = (await Promise.all(events.map(async ({ calendarId }) => ({ calendarId, events: await listCalendarEvents(env, calendarId, currentEnd, additionalEnd) })))).flatMap(({ calendarId, events: listed }) => listed.filter((event) => !events.some((current) => current.calendarId === calendarId && current.event.id === event.id)).map((event) => ({ calendarId, event })));
          if (busy.some(({ event }) => overlaps(currentEnd, additionalEnd, event.start, event.end))) return reply({ error: "The extension overlaps another Calendar block." }, 409);
          const changed: Array<{ calendarId: string; eventId: string }> = [];
          for (const { calendarId, event } of events) {
            const eventEnd = new Date(Date.parse(event.end) + action.durationMinutes * 60_000).toISOString();
            await patchCalendarEvent(env, calendarId, event.id, { end: eventEnd, privateProperties: { ...event.privateProperties, groupVersion: nextVersion, updatedAt: new Date().toISOString() } }, event.etag);
            changed.push({ calendarId, eventId: event.id });
          }
          const response = { bookingId: action.expected.bookingId, status: eventStatus(events), version: version + 1, end: additionalEnd, eventCount: changed.length, priceReviewRequired: true };
          await this.ctx.storage.put(key, { hash, status: "complete", response, eventIds: changed } satisfies ActionAttempt);
          return reply(response, 200);
        }
        if (!targetStatus) return reply({ error: "Unsupported booking action." }, 400);
        const changed: Array<{ calendarId: string; eventId: string }> = [];
        for (const { calendarId, event } of events) {
          const privateProperties = { ...event.privateProperties, status: targetStatus, groupVersion: nextVersion, updatedAt: new Date().toISOString() };
          const end = action.action === "complete" && action.releaseRemainingTime && Date.parse(event.end) > Date.now() ? new Date().toISOString() : undefined;
          await patchCalendarEvent(env, calendarId, event.id, { privateProperties, transparency: targetStatus === "cancelled" ? "transparent" : "opaque", end }, event.etag);
          changed.push({ calendarId, eventId: event.id });
        }
        const response = { bookingId: action.expected.bookingId, status: targetStatus, version: version + 1, eventCount: changed.length };
        await this.ctx.storage.put(key, { hash, status: "complete", response, eventIds: changed } satisfies ActionAttempt);
        return reply(response, 200);
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
    return this.ctx.blockConcurrencyWhile(async () => {
      const hash = await hashPayload(block);
      const key = `block:${block.idempotencyKey}`;
      const prior = await this.ctx.storage.get<BlockAttempt>(key);
      if (prior) {
        if (prior.hash !== hash) return reply({ error: "This block attempt was already used with different details." }, 409);
        if (prior.status === "complete") return reply({ ...(prior.response as object), replayed: true }, 200);
        return reply({ error: "This block needs staff review before retrying." }, 503);
      }
      await this.ctx.storage.put(key, { hash, status: "failed" } satisfies BlockAttempt);
      const env = this.env;
      const calendarIds = block.resourceIds.map((resourceId) => calendarIdForResource(env, resourceId));
      if (calendarIds.some((calendarId): calendarId is null => calendarId === null)) return reply({ error: "A requested resource is not configured." }, 409);
      const overlapsExisting = (await Promise.all(calendarIds.map(async (calendarId) => ({ calendarId, events: await listCalendarEvents(env, calendarId!, block.start, block.end) })))).flatMap(({ calendarId, events }) => events.filter((event) => event.status !== "cancelled" && event.transparency !== "transparent" && overlaps(block.start, block.end, event.start, event.end)).map((event) => ({ calendarId, eventId: event.id })));
      if (overlapsExisting.length > 0) {
        await this.ctx.storage.delete(key);
        return reply({ error: "The block overlaps an existing Calendar reservation." }, 409);
      }
      const createdEvents: Array<{ calendarId: string; eventId: string }> = [];
      try {
        for (const calendarId of calendarIds) {
          const resourceId = resourceIdForCalendar(env, calendarId! ) ?? "booking-control";
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
        await this.ctx.storage.put(key, { hash, status: "complete", response, eventIds: createdEvents } satisfies BlockAttempt);
        return reply(response, 201);
      } catch (error) {
        const rollback = await Promise.allSettled(createdEvents.map((event) => deleteEvent(env, event.calendarId, event.eventId)));
        const rollbackFailed = rollback.some((result) => result.status === "rejected");
        await this.ctx.storage.put(key, { hash, status: "failed", eventIds: createdEvents } satisfies BlockAttempt);
        console.error(JSON.stringify({ message: "block_time_failed", blockType: block.blockType, createdCount: createdEvents.length, rollbackFailed, error: error instanceof Error ? error.message : "unknown" }));
        return reply({ error: rollbackFailed ? "The block failed and needs staff review." : "The block could not be created." }, 503);
      }
    });
  }
}

function eventStatus(events: Array<{ event: { privateProperties: Record<string, string> } }>): string {
  return events[0]?.event.privateProperties.status ?? "confirmed";
}

export default {
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
