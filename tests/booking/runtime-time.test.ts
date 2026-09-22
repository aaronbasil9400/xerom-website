import { describe, expect, it } from "vitest";
import { createSeedConfig } from "@/lib/config/seed";
import { generateRuntimeCandidateSlots, validateRuntimeBookingWindow } from "@/lib/booking/runtime-time";

describe("runtime booking windows", () => {
  it("uses date exceptions, duration rules, notice, and buffer from active config", () => {
    const seed = createSeedConfig({ resources: {} });
    const config = {
      ...seed,
      hours: { ...seed.hours, exceptions: [{ exceptionId: "fixture-hours", businessDate: "2026-09-25", label: "Fixture", intervals: [{ open: "18:00", close: "20:00", closeDayOffset: 0 as const }] }] },
      bookingRules: { ...seed.bookingRules, allowedDurationsMinutes: [60], bufferMinutes: 15, customerMinimumNoticeMinutes: 0 },
    };
    const now = new Date("2026-09-25T08:00:00+08:00");
    expect(generateRuntimeCandidateSlots(config, "2026-09-25", 60, now).map((slot) => slot.start)).toEqual(["2026-09-25T10:30:00.000Z"]);
    expect(validateRuntimeBookingWindow(config, "2026-09-25T18:00:00+08:00", 60, now)).toContain("opening hours");
    expect(validateRuntimeBookingWindow(config, "2026-09-25T18:30:00+08:00", 30, now)).toContain("duration");
  });

  it("supports previous-business-day overnight windows", () => {
    const config = createSeedConfig({ resources: {} });
    expect(validateRuntimeBookingWindow(config, "2026-09-19T00:00:00+08:00", 60, new Date("2026-09-18T12:00:00+08:00"))).toBeNull();
  });
});
