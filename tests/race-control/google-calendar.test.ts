import { afterEach, describe, expect, it, vi } from "vitest";
import { insertEventWithToken, listCalendarEventsWithToken, listCalendarReviewInventoryWithToken, patchCalendarEventWithToken, queryFreeBusyWithToken, CalendarMutationUncertainError, CalendarVersionConflictError, type CalendarEventInput } from "@/lib/google/calendar";

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

  it("reconciles a lost insert response through the deterministic event ID", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(Response.json({
        id: event.eventId,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
        visibility: "private",
        transparency: "opaque",
        extendedProperties: { private: event.privateProperties },
      })));
    await expect(insertEventWithToken("token", event)).resolves.toBe(event.eventId);
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

  it("keeps all-day events as blocking Malaysia-local intervals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({
      items: [{ id: "all-day-closure", summary: "Venue closure", start: { date: "2026-09-16" }, end: { date: "2026-09-17" } }],
    })));
    const events = await listCalendarEventsWithToken("token", "fixture-calendar", "2026-09-16T00:00:00+08:00", "2026-09-17T00:00:00+08:00");
    expect(events[0]).toMatchObject({
      start: "2026-09-16T00:00:00+08:00",
      end: "2026-09-17T00:00:00+08:00",
      allDay: true,
      transparency: "opaque",
    });
  });

  it("bounds review inventory to future occurrences and flags open-ended series", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ items: [
        { id: "finite-instance", recurringEventId: "finite", start: { dateTime: event.start }, end: { dateTime: event.end } },
        { id: "open-instance", recurringEventId: "open", start: { dateTime: event.start }, end: { dateTime: event.end } },
        { id: "one-off", start: { dateTime: event.start }, end: { dateTime: event.end } },
      ] }))
      .mockResolvedValueOnce(Response.json({ id: "finite", start: { dateTime: event.start }, end: { dateTime: event.end }, recurrence: ["RRULE:FREQ=WEEKLY;COUNT=2"] }))
      .mockResolvedValueOnce(Response.json({ id: "open", start: { dateTime: event.start }, end: { dateTime: event.end }, recurrence: ["RRULE:FREQ=WEEKLY"] }));
    vi.stubGlobal("fetch", fetchMock);
    const events = await listCalendarReviewInventoryWithToken("token", "fixture-calendar", "2026-09-16T00:00:00Z");
    expect(fetchMock.mock.calls[0][0]).toContain("singleEvents=true");
    expect(fetchMock.mock.calls[0][0]).toContain("timeMin=");
    expect(fetchMock.mock.calls[0][0]).not.toContain("timeMax=");
    expect(events.map((candidate) => candidate.id)).toEqual(["finite-instance", "open-instance", "one-off", "open"]);
    expect(events.find((candidate) => candidate.id === "open")?.recurrence).toEqual(["RRULE:FREQ=WEEKLY"]);
    expect(events.find((candidate) => candidate.id === "open-instance")?.recurrence).toEqual([]);
  });

  it("patches only owned fields with If-Match and exposes external edits as 412", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ id: event.eventId, etag: "etag-2", summary: "Cancelled", start: { dateTime: event.start }, end: { dateTime: event.end }, transparency: "transparent", extendedProperties: { private: { ...event.privateProperties, status: "cancelled" } } }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await patchCalendarEventWithToken("token", event.calendarId, event.eventId, { transparency: "transparent", privateProperties: { ...event.privateProperties, status: "cancelled" } }, "etag-1");
    expect(result.privateProperties.status).toBe("cancelled");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PATCH", headers: expect.objectContaining({ "if-match": "etag-1" }) });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 412 })));
    await expect(patchCalendarEventWithToken("token", event.calendarId, event.eventId, { transparency: "opaque" }, "etag-1")).rejects.toBeInstanceOf(CalendarVersionConflictError);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("connection reset")));
    await expect(patchCalendarEventWithToken("token", event.calendarId, event.eventId, { transparency: "opaque" }, "etag-1")).rejects.toBeInstanceOf(CalendarMutationUncertainError);
  });
});
