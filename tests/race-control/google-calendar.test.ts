import { afterEach, describe, expect, it, vi } from "vitest";
import { insertEventWithToken, listCalendarEventsWithToken, queryFreeBusyWithToken, type CalendarEventInput } from "@/lib/google/calendar";

afterEach(() => vi.unstubAllGlobals());

const event: CalendarEventInput = {
  calendarId: "fixture-calendar",
  eventId: "deterministic-event-id",
  summary: "Fixture",
  description: "Fixture only",
  start: "2026-09-16T20:00:00+08:00",
  end: "2026-09-16T21:00:00+08:00",
  privateProperties: { bookingId: "fixture-booking", attemptHash: "fixture-hash", resourceId: "regular-01" },
};

describe("Google Calendar fail-closed adapters", () => {
  it("rejects missing FreeBusy calendar entries instead of treating them as free", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ calendars: {} })));
    await expect(queryFreeBusyWithToken("token", ["fixture-calendar"], event.start, event.end)).rejects.toThrow("could not be read");
  });

  it("accepts a 409 only after verifying the existing deterministic event", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(Response.json({
        id: event.eventId,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
        visibility: "private",
        transparency: "opaque",
        extendedProperties: { private: event.privateProperties },
      }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(insertEventWithToken("token", event)).resolves.toBe(event.eventId);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a mismatched event on deterministic-ID conflict", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValueOnce(Response.json({
        id: event.eventId,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
        visibility: "private",
        transparency: "opaque",
        extendedProperties: { private: { ...event.privateProperties, bookingId: "different-booking" } },
      })));
    await expect(insertEventWithToken("token", event)).rejects.toThrow("did not match");
  });

  it("lists paginated events with private booking metadata", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ items: [{ id: "event-1", etag: "etag-1", summary: "XR-FIXTURE", start: { dateTime: event.start }, end: { dateTime: event.end }, status: "confirmed", transparency: "opaque", extendedProperties: { private: { bookingId: "fixture-booking" } } }], nextPageToken: "next" }))
      .mockResolvedValueOnce(Response.json({ items: [{ id: "event-2", summary: "Manual block", start: { dateTime: event.end }, end: { dateTime: "2026-09-16T22:00:00+08:00" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const events = await listCalendarEventsWithToken("token", "fixture-calendar", event.start, "2026-09-17T02:00:00+08:00");
    expect(events).toHaveLength(2);
    expect(events[0].privateProperties.bookingId).toBe("fixture-booking");
    expect(events[1]).toMatchObject({ summary: "Manual block", transparency: "opaque" });
    expect(fetchMock.mock.calls[1][0]).toContain("pageToken=next");
  });
});
