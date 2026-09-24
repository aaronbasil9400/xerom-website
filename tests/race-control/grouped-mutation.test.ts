import { describe, expect, it, vi } from "vitest";
import { applyGroupedMutation, GroupedMutationError, lifecycleTransitionAllowed, type GroupedMutationStep } from "../../coordinator/src/grouped-mutation";
import { noShowGraceElapsed } from "@/lib/race-control/no-show";
import type { CalendarEventRecord } from "@/lib/google/calendar";
import { CalendarMutationUncertainError } from "@/lib/google/calendar";

function calendarEvent(id: string, etag: string): CalendarEventRecord {
  return {
    id,
    etag,
    summary: id,
    description: "",
    start: "2026-09-20T18:00:00+08:00",
    end: "2026-09-20T19:00:00+08:00",
    status: "confirmed",
    transparency: "opaque",
    privateProperties: { bookingId: "XR-FIXTURE", groupVersion: "0", status: "confirmed" },
    allDay: false,
  };
}

function steps(): GroupedMutationStep[] {
  return ["event-1", "event-2"].map((id, index) => {
    const event = calendarEvent(id, `etag-${index}`);
    return {
      calendarId: `calendar-${index}`,
      event,
      patch: { transparency: "transparent", privateProperties: { ...event.privateProperties, status: "cancelled", groupVersion: "1" } },
      restore: { transparency: "opaque", privateProperties: event.privateProperties },
    };
  });
}

describe("grouped Calendar mutation compensation", () => {
  it("enforces the published no-show grace at the coordinator boundary", () => {
    const start = "2026-09-20T18:00:00+08:00";
    const startMs = Date.parse(start);
    expect(noShowGraceElapsed(start, startMs + 14 * 60_000 + 59_999)).toBe(false);
    expect(noShowGraceElapsed(start, startMs + 15 * 60_000)).toBe(true);
    expect(noShowGraceElapsed("invalid", startMs + 60 * 60_000)).toBe(false);
  });

  it("enforces lifecycle transitions on the coordinator side", () => {
    expect(lifecycleTransitionAllowed("confirmed", "check-in")).toBe(true);
    expect(lifecycleTransitionAllowed("cancelled", "check-in")).toBe(false);
    expect(lifecycleTransitionAllowed("confirmed", "complete")).toBe(false);
    expect(lifecycleTransitionAllowed("checked_in", "complete")).toBe(true);
    expect(lifecycleTransitionAllowed("confirmed", "no-show")).toBe(true);
    expect(lifecycleTransitionAllowed("checked_in", "no-show")).toBe(false);
    expect(lifecycleTransitionAllowed("completed", "cancel")).toBe(false);
  });

  it("rolls back earlier event changes if a later patch fails", async () => {
    const patch = vi.fn()
      .mockResolvedValueOnce({ ...calendarEvent("event-1", "etag-after"), transparency: "transparent" })
      .mockRejectedValueOnce(new Error("second event failed"))
      .mockResolvedValueOnce(calendarEvent("event-1", "etag-restored"));

    await expect(applyGroupedMutation(steps(), patch)).rejects.toMatchObject({ compensationFailed: false, appliedCount: 1 });
    expect(patch).toHaveBeenNthCalledWith(3, "calendar-0", "event-1", expect.objectContaining({ transparency: "opaque" }), "etag-after");
  });

  it("reports an unsafe partial update when compensation also fails", async () => {
    const patch = vi.fn()
      .mockResolvedValueOnce({ ...calendarEvent("event-1", "etag-after"), transparency: "transparent" })
      .mockRejectedValueOnce(new Error("second event failed"))
      .mockRejectedValueOnce(new Error("rollback failed"));

    const error = await applyGroupedMutation(steps(), patch).catch((caught) => caught);
    expect(error).toBeInstanceOf(GroupedMutationError);
    expect(error).toMatchObject({ compensationFailed: true, appliedCount: 1 });
  });

  it("keeps recovery required when the failed patch has an uncertain remote outcome", async () => {
    const patch = vi.fn().mockRejectedValueOnce(new CalendarMutationUncertainError("lost response"));
    const error = await applyGroupedMutation(steps(), patch).catch((caught) => caught);
    expect(error).toMatchObject({ compensationFailed: true, appliedCount: 0 });
  });
});
