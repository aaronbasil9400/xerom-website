import type { ServiceId } from "./service-core";

export const pricingVersion = "2026-09-24";

export const pricing = {
  currency: "MYR",
  services: {
    "regular-sim": { hourlyRate: 20 },
    "pro-sim": { hourlyRate: 30 },
    ps5: {
      hourlyRate: 18,
      includedControllers: 2,
      maxAdditionalControllers: 6,
      additionalControllerRate: 3,
      additionalControllerBillingUnit: "per-booking",
    },
  } satisfies Record<ServiceId, Record<string, number | string>>,
  promotions: [],
} as const;

export function formatMoney(amount: number): string {
  return `RM${amount}`;
}
