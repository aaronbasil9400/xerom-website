import { describe, expect, it } from "vitest";
import { assignTimelineLanes, orderScheduleResources } from "@/lib/race-control/timeline";

describe("Race Control schedule timeline lanes", () => {
  it("keeps sequential bookings on one resource in one compact row", () => {
    const result = assignTimelineLanes([
      { start: "2026-09-16T15:45:00+08:00", end: "2026-09-16T16:45:00+08:00" },
      { start: "2026-09-16T17:00:00+08:00", end: "2026-09-16T18:00:00+08:00" },
      { start: "2026-09-16T20:00:00+08:00", end: "2026-09-16T22:00:00+08:00" },
    ]);
    expect(result.laneCount).toBe(1);
    expect(result.items.map((item) => item.lane)).toEqual([0, 0, 0]);
  });

  it("stacks true same-hour overlaps on one resource", () => {
    const result = assignTimelineLanes([
      { start: "2026-09-16T20:00:00+08:00", end: "2026-09-16T21:00:00+08:00" },
      { start: "2026-09-16T20:15:00+08:00", end: "2026-09-16T21:15:00+08:00" },
      { start: "2026-09-16T20:30:00+08:00", end: "2026-09-16T21:30:00+08:00" },
    ]);
    expect(result.laneCount).toBe(3);
    expect(result.items.map((item) => item.lane)).toEqual([0, 1, 2]);
  });

  it("allows back-to-back bookings to reuse a lane", () => {
    const result = assignTimelineLanes([
      { start: "2026-09-16T18:00:00+08:00", end: "2026-09-16T19:00:00+08:00" },
      { start: "2026-09-16T19:00:00+08:00", end: "2026-09-16T20:00:00+08:00" },
    ]);
    expect(result.laneCount).toBe(1);
    expect(result.items.map((item) => item.lane)).toEqual([0, 0]);
  });

  it("keeps a same-hour group compact on each separate resource row", () => {
    const regularOne = assignTimelineLanes([
      { start: "2026-09-16T20:00:00+08:00", end: "2026-09-16T22:00:00+08:00" },
    ]);
    const regularTwo = assignTimelineLanes([
      { start: "2026-09-16T20:00:00+08:00", end: "2026-09-16T22:00:00+08:00" },
    ]);
    expect(regularOne.laneCount).toBe(1);
    expect(regularTwo.laneCount).toBe(1);
  });
});

describe("Race Control schedule resource ordering", () => {
  it("lists rigs and lounges alphabetically instead of in config order", () => {
    const ordered = orderScheduleResources([
      { resourceId: "regular-01", displayName: "Regular Rig 01" },
      { resourceId: "regular-02", displayName: "Regular Rig 02" },
      { resourceId: "regular-03", displayName: "Regular Rig 03" },
      { resourceId: "pro-01", displayName: "Pro Rig 01" },
      { resourceId: "ps5-01", displayName: "PS5 Lounge 01" },
      { resourceId: "ps5-02", displayName: "PS5 Lounge 02" },
      { resourceId: "regular-04", displayName: "Regular Rig 04" },
    ]);
    expect(ordered.map((resource) => resource.resourceId)).toEqual([
      "pro-01",
      "ps5-01",
      "ps5-02",
      "regular-01",
      "regular-02",
      "regular-03",
      "regular-04",
    ]);
  });

  it("orders numeric resource names naturally rather than lexically", () => {
    const ordered = orderScheduleResources([
      { resourceId: "regular-10", displayName: "Regular Rig 10" },
      { resourceId: "regular-09", displayName: "Regular Rig 09" },
      { resourceId: "regular-02", displayName: "Regular Rig 02" },
    ]);
    expect(ordered.map((resource) => resource.displayName)).toEqual([
      "Regular Rig 02",
      "Regular Rig 09",
      "Regular Rig 10",
    ]);
  });

  it("hides the internal venue-control calendar from the schedule grid", () => {
    const ordered = orderScheduleResources([
      { resourceId: "booking-control", displayName: "Venue control" },
      { resourceId: "regular-01", displayName: "Regular Rig 01" },
    ]);
    expect(ordered.map((resource) => resource.resourceId)).toEqual(["regular-01"]);
  });

  it("does not mutate the input collection", () => {
    const input = [
      { resourceId: "regular-02", displayName: "Regular Rig 02" },
      { resourceId: "regular-01", displayName: "Regular Rig 01" },
    ];
    orderScheduleResources(input);
    expect(input.map((resource) => resource.resourceId)).toEqual(["regular-02", "regular-01"]);
  });
});
