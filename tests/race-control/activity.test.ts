import { describe, expect, it } from "vitest";
import { activityExpired, activityNeedsAttention, activityStorageKey, mergeActivityRecords, type ActivityRecord } from "@/lib/race-control/activity";

const activity = (overrides: Partial<ActivityRecord> = {}): ActivityRecord => ({
  id: "booking:test-operation",
  category: "booking",
  action: "create",
  state: "succeeded",
  actorId: "public:website",
  createdAt: "2026-09-26T10:00:00.000Z",
  updatedAt: "2026-09-26T10:00:01.000Z",
  ...overrides,
});

describe("Race Control activity history", () => {
  it("sorts storage keys newest first and rejects invalid cursors", () => {
    const older = activityStorageKey("2026-09-26T09:00:00.000Z", "action:older");
    const newer = activityStorageKey("2026-09-26T10:00:00.000Z", "action:newer");
    expect(newer.localeCompare(older)).toBeLessThan(0);
    expect(() => activityStorageKey("not-a-date", "bad")).toThrow("Invalid activity identity");
    expect(() => activityStorageKey("2026-09-26T10:00:00Z", "../bad")).toThrow("Invalid activity identity");
  });

  it("flags unresolved and stale running activity for attention", () => {
    const now = Date.parse("2026-09-26T10:10:00.000Z");
    expect(activityNeedsAttention(activity({ state: "needs_review" }), now)).toBe(true);
    expect(activityNeedsAttention(activity({ state: "failed" }), now)).toBe(true);
    expect(activityNeedsAttention(activity({ state: "running", updatedAt: "2026-09-26T10:00:00.000Z" }), now)).toBe(true);
    expect(activityNeedsAttention(activity({ state: "running", updatedAt: "2026-09-26T10:09:00.000Z" }), now)).toBe(false);
    expect(activityNeedsAttention(activity({ state: "succeeded" }), now)).toBe(false);
  });

  it("expires only completed or failed operation summaries after 30 days", () => {
    const now = Date.parse("2026-11-10T00:00:00.000Z");
    const old = "2026-10-01T00:00:00.000Z";
    expect(activityExpired(activity({ state: "succeeded", createdAt: old }), now)).toBe(true);
    expect(activityExpired(activity({ state: "failed", createdAt: old }), now)).toBe(true);
    expect(activityExpired(activity({ state: "needs_review", createdAt: old }), now)).toBe(false);
    expect(activityExpired(activity({ state: "running", createdAt: old }), now)).toBe(false);
  });

  it("deduplicates published revisions when the journal and R2 chain both contain one", () => {
    const journal = activity({ id: "config:publish-operation", category: "settings", action: "publish", actorId: "access:owner", revisionId: "rev-1", updatedAt: "2026-09-26T10:01:00.000Z" });
    const revision = activity({ id: "revision:rev-1", category: "settings", action: "Configuration published", actorId: "access:owner", revisionId: "rev-1", updatedAt: "2026-09-26T10:00:00.000Z" });
    const booking = activity({ id: "booking:another-operation", updatedAt: "2026-09-26T10:02:00.000Z" });
    expect(mergeActivityRecords([revision, journal, booking])).toEqual([booking, journal]);
  });
});
