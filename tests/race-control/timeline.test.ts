import { describe, expect, it } from "vitest";
import { assignTimelineLanes } from "@/lib/race-control/timeline";

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
