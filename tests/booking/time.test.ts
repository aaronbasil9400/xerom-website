import { describe, expect, it } from "vitest";
import { manualBookingRules } from "@/config/booking";
import { buildAvailability, generateCandidateSlots, localIso, overlaps, validateBookingOperatingWindow, validateBookingWindow } from "@/lib/booking/time";
import { addRecoveryFencesToBusy } from "@/lib/booking/resources";

describe("booking time rules", () => {
  it("builds Malaysia timestamps across midnight", () => {
    expect(localIso("2026-09-13", 24 * 60)).toBe("2026-09-14T00:00:00+08:00");
    expect(localIso("2026-09-13", 25 * 60)).toBe("2026-09-14T01:00:00+08:00");
  });

  it("allows exact adjacency and rejects overlap", () => {
    expect(overlaps("2026-09-13T20:00:00+08:00", "2026-09-13T21:00:00+08:00", "2026-09-13T21:00:00+08:00", "2026-09-13T22:00:00+08:00")).toBe(false);
    expect(overlaps("2026-09-13T20:00:00+08:00", "2026-09-13T22:00:00+08:00", "2026-09-13T21:00:00+08:00", "2026-09-13T23:00:00+08:00")).toBe(true);
  });

  it("generates one-hour Sunday slots through midnight", () => {
    const now = new Date("2026-09-11T00:00:00Z");
    const slots = generateCandidateSlots("2026-09-13", 60, now);
    expect(slots[0].start).toBe("2026-09-13T12:00:00+08:00");
    expect(slots.at(-1)?.end).toBe("2026-09-14T01:00:00+08:00");
  });

  it("enforces notice and the rolling horizon for public bookings", () => {
    const now = new Date("2026-09-09T10:00:00+08:00");
    expect(validateBookingWindow("2026-09-09T10:30:00+08:00", 60, now)).toMatch(/one hour/i);
    expect(validateBookingWindow("2026-09-13T10:00:00+08:00", 60, now)).toMatch(/three days/i);
    expect(validateBookingWindow("2026-09-10T14:00:00+08:00", 60, now)).toBeNull();
  });

  it("rejects times outside opening hours and off the public 30-minute grid", () => {
    const now = new Date("2026-09-09T10:00:00+08:00");
    expect(validateBookingWindow("2026-09-10T13:00:00+08:00", 60, now)).toMatch(/opening hours/i);
    expect(validateBookingWindow("2026-09-10T14:15:00+08:00", 60, now)).toMatch(/30-minute slot/i);
    expect(validateBookingWindow("2026-09-13T23:00:00+08:00", 120, new Date("2026-09-13T10:00:00+08:00"))).toBeNull();
  });

  it("allows owner manual bookings without notice or hourly alignment", () => {
    const now = new Date("2026-09-10T14:00:00+08:00");
    expect(validateBookingWindow("2026-09-10T14:11:00+08:00", 30, now, manualBookingRules)).toBeNull();
    expect(validateBookingWindow("2026-09-10T14:00:30+08:00", 60, now, manualBookingRules)).toMatch(/future|minute/i);
    expect(validateBookingWindow("2026-09-10T13:59:00+08:00", 60, now, manualBookingRules)).toMatch(/future/i);
    expect(validateBookingWindow("2026-09-10T14:11:00+08:00", 45, now, manualBookingRules)).toMatch(/30|60|90|120/);
  });

  it("validates reschedule and extension intervals against overnight opening hours", () => {
    expect(validateBookingOperatingWindow("2026-09-13T23:30:00+08:00", "2026-09-14T01:00:00+08:00")).toBeNull();
    expect(validateBookingOperatingWindow("2026-09-13T23:30:00+08:00", "2026-09-14T01:30:00+08:00")).toMatch(/opening hours/i);
    expect(validateBookingOperatingWindow("2026-09-13T11:30:00+08:00", "2026-09-13T12:30:00+08:00")).toMatch(/opening hours/i);
  });
});

describe("resource availability", () => {
  const groups = { "regular-sim": ["r1", "r2", "r3"], "pro-sim": ["p1"], ps5: ["g1", "g2"] } as const;
  const slot = [{ start: "2026-09-13T20:00:00+08:00", end: "2026-09-13T22:00:00+08:00" }];

  it("requires every mixed-tier resource for the complete interval", () => {
    const result = buildAvailability(slot, { ...groups, "regular-sim": [...groups["regular-sim"]], "pro-sim": [...groups["pro-sim"]], ps5: [...groups.ps5] }, { r1: [{ start: "2026-09-13T21:00:00+08:00", end: "2026-09-13T22:00:00+08:00" }] }, undefined, { "regular-sim": 3, "pro-sim": 1, ps5: 0 });
    expect(result[0].capacity["regular-sim"]).toBe(2);
    expect(result[0].available).toBe(false);
  });

  it("lets a control-calendar event close the whole venue", () => {
    const result = buildAvailability(slot, { ...groups, "regular-sim": [...groups["regular-sim"]], "pro-sim": [...groups["pro-sim"]], ps5: [...groups.ps5] }, { control: [{ start: slot[0].start, end: slot[0].end }] }, "control", { "regular-sim": 1, "pro-sim": 0, ps5: 0 });
    expect(result[0].available).toBe(false);
    expect(result[0].capacity.ps5).toBe(0);
  });

  it("maps recovery fences into the same busy-calendar model", () => {
    const env = { REGULAR_SIM_01_CALENDAR_ID: "r1", BOOKING_CONTROL_CALENDAR_ID: "control" } as CloudflareEnv;
    const busy = addRecoveryFencesToBusy(env, {}, [
      { resourceId: "regular-01", start: slot[0].start, end: slot[0].end },
      { resourceId: "booking-control", start: slot[0].start, end: slot[0].end },
    ]);
    const result = buildAvailability(slot, { ...groups, "regular-sim": [...groups["regular-sim"]], "pro-sim": [...groups["pro-sim"]], ps5: [...groups.ps5] }, busy, "control", { "regular-sim": 1, "pro-sim": 0, ps5: 0 });
    expect(busy.r1).toHaveLength(1);
    expect(result[0].available).toBe(false);
    expect(result[0].capacity["regular-sim"]).toBe(0);
  });

  it.each([30, 60, 90, 120])("blocks a %i-minute request when any part overlaps", (durationMinutes) => {
    const start = "2026-09-13T20:00:00+08:00";
    const end = new Date(Date.parse(start) + durationMinutes * 60_000).toISOString();
    const overlapStart = new Date(Date.parse(start) + Math.max(1, durationMinutes - 15) * 60_000).toISOString();
    const result = buildAvailability([{ start, end }], { ...groups, "regular-sim": [...groups["regular-sim"]], "pro-sim": [...groups["pro-sim"]], ps5: [...groups.ps5] }, { r1: [{ start: overlapStart, end }] }, undefined, { "regular-sim": 3, "pro-sim": 0, ps5: 0 });
    expect(result[0].capacity["regular-sim"]).toBe(2);
    expect(result[0].available).toBe(false);
  });
});
