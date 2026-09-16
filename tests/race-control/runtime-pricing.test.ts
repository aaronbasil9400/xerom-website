import { describe, expect, it } from "vitest";
import { createSeedConfig } from "@/lib/config/seed";
import { calculateRuntimeQuote } from "@/lib/race-control/pricing";

const seed = createSeedConfig({ resources: {} });
const eligibility = {
  serviceIds: ["regular-sim" as const], weekdays: [1], startDate: null, endDate: null,
  startTime: null, endTime: null, channels: ["owner" as const], durationMinutes: [120],
};

describe("runtime pricing", () => {
  it("chooses the lowest eligible price without stacking and uses deterministic ties", () => {
    const config = { ...seed, promotions: [
      { promotionId: "weekday-ten", type: "percentage" as const, label: "Synthetic 10%", state: "enabled" as const, percentageBasisPoints: 1_000, priority: 1, eligibility, terms: "Synthetic test only." },
      { promotionId: "two-hour-package", type: "duration-package" as const, label: "Synthetic package", state: "enabled" as const, packageDurationMinutes: 120, packagePriceSenPerResource: 3_500, priority: 1, eligibility, terms: "Synthetic test only." },
      { promotionId: "weekday-twenty", type: "percentage" as const, label: "Synthetic 20%", state: "enabled" as const, percentageBasisPoints: 2_000, priority: 1, eligibility, terms: "Synthetic test only." },
    ] };
    const quote = calculateRuntimeQuote(config, { items: [{ serviceId: "regular-sim", quantity: 2 }], start: "2026-09-21T20:00:00+08:00", durationMinutes: 120, channel: "owner" });
    expect(quote.lines[0]).toMatchObject({ baseAmountSenPerResource: 4_000, selectedAmountSenPerResource: 3_200, selectedPromotionId: "weekday-twenty", lineTotalSen: 6_400 });
  });

  it("uses the opening business day for after-midnight eligibility", () => {
    const fridayEligibility = { ...eligibility, weekdays: [5], channels: ["public" as const], durationMinutes: [60] };
    const config = { ...seed, promotions: [{ promotionId: "friday-fixture", type: "percentage" as const, label: "Synthetic Friday", state: "enabled" as const, percentageBasisPoints: 500, priority: 0, eligibility: fridayEligibility, terms: "Synthetic test only." }] };
    const quote = calculateRuntimeQuote(config, { items: [{ serviceId: "regular-sim", quantity: 1 }], start: "2026-09-19T00:00:00+08:00", durationMinutes: 60, channel: "public" });
    expect(quote.lines[0].selectedPromotionId).toBe("friday-fixture");
  });

  it("keeps controller add-ons gated pending owner confirmation", () => {
    expect(() => calculateRuntimeQuote(seed, { items: [{ serviceId: "ps5", quantity: 1, additionalControllers: 1 }], start: "2026-09-18T20:00:00+08:00", durationMinutes: 60, channel: "public" })).toThrow("remain disabled");
  });
});
