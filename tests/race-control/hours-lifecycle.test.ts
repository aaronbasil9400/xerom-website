import { describe, expect, it } from "vitest";
import { reviewHoursImpact } from "@/lib/race-control/hours-impact";
import { canDeleteResourceCalendar, canRetireResource } from "@/lib/race-control/resource-lifecycle";

describe("hours impact and resource lifecycle guards", () => {
  it("blocks bookings outside proposed windows and open-ended recurring series", () => {
    const result = reviewHoursImpact({ "2026-09-18": [{ start: "2026-09-18T14:00:00+08:00", end: "2026-09-19T01:00:00+08:00" }] }, [
      { eventId: "event-1", resourceId: "regular-01", start: "2026-09-18T12:00:00+08:00", end: "2026-09-18T13:00:00+08:00", bookingId: "XR-1", recurring: false, recurrenceHasNoEnd: false },
      { eventId: "series-1", resourceId: "regular-02", start: "2026-09-18T16:00:00+08:00", end: "2026-09-18T17:00:00+08:00", bookingId: "XR-2", recurring: true, recurrenceHasNoEnd: true },
    ]);
    expect(result.blocking).toBe(true);
    expect(result.conflicts.map((conflict) => conflict.reason)).toEqual(["outside-proposed-hours", "recurring-series-needs-review"]);
  });

  it("allows retirement only when future capacity is resolved", () => {
    expect(canRetireResource({ resourceId: "regular-01", lifecycle: "active", isPrimary: false, isControl: false, historyEventCount: 3, futureEventCount: 0, hasRecurringEvents: false })).toEqual({ allowed: true, action: "retire" });
    expect(canRetireResource({ resourceId: "regular-01", lifecycle: "active", isPrimary: false, isControl: false, historyEventCount: 0, futureEventCount: 1, hasRecurringEvents: false }).allowed).toBe(false);
  });

  it("only permits permanent deletion for an empty retired non-control calendar", () => {
    const base = { resourceId: "test-01", lifecycle: "retired" as const, isPrimary: false, isControl: false, historyEventCount: 0, futureEventCount: 0, hasRecurringEvents: false };
    expect(canDeleteResourceCalendar(base, true)).toEqual({ allowed: true, action: "delete" });
    expect(canDeleteResourceCalendar({ ...base, historyEventCount: 1 }, true).allowed).toBe(false);
    expect(canDeleteResourceCalendar({ ...base, isControl: true }, true).allowed).toBe(false);
  });
});
