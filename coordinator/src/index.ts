import { DurableObject } from "cloudflare:workers";
import { bookingRequestSchema } from "../../src/lib/booking/schema";
import { validateBookingWindow, overlaps } from "../../src/lib/booking/time";
import { calendarGroups, allCalendarIds } from "../../src/lib/booking/resources";
import { queryFreeBusy, insertEvent, deleteEvent } from "../../src/lib/google/calendar";
import { calculateTotal } from "../../src/lib/booking/pricing";
import { createBookingId, hashPayload } from "../../src/lib/booking/id";
import { serviceCore, type ServiceId } from "../../src/config/service-core";
import { sanitizeCalendarText } from "../../src/lib/booking/text";

type Env = CloudflareEnv & { BOOKING_COORDINATOR: DurableObjectNamespace<BookingCoordinator> };
type Attempt = { hash: string; status: "pending" | "complete" | "failed"; response?: unknown; createdEvents?: Array<{ calendarId: string; eventId: string }> };

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export class BookingCoordinator extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
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
        let resourceIndex = 0;
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
                resourceId: String(resourceIndex++),
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
}

export default {
  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
