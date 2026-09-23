import { describe, expect, it } from "vitest";
import { todayOpeningHours } from "@/lib/config/hours-display";
import { createSeedConfig } from "@/lib/config/seed";

describe("homepage hours summary", () => {
  const seedHours = createSeedConfig({ resources: {} }).hours;

  it("uses the Malaysia-local day and published weekly hours", () => {
    expect(todayOpeningHours(seedHours, new Date("2026-09-23T17:30:00Z"))).toEqual({ day: "Thu", hours: "2 pm–1 am" });
    expect(todayOpeningHours(seedHours, new Date("2026-09-25T04:00:00Z"))).toEqual({ day: "Fri", hours: "12 pm–1 am" });
  });

  it("reflects edited weekly hours, closures and same-day exceptions", () => {
    const hours = structuredClone(seedHours);
    hours.weekly.friday = [{ open: "15:30", close: "23:00", closeDayOffset: 0 }];
    const friday = new Date("2026-09-25T04:00:00Z");
    expect(todayOpeningHours(hours, friday).hours).toBe("3:30 pm–11 pm");
    hours.exceptions = [{ exceptionId: "special-day", businessDate: "2026-09-25", label: "Special day", intervals: [] }];
    expect(todayOpeningHours(hours, friday).hours).toBe("Closed");
  });
});
