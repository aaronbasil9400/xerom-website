import type { ServiceId } from "./service-core";

export const pricingVersion = "2026-09-09";

export const pricing = {
  currency: "MYR",
  services: {
    "regular-sim": { hourlyRate: 20, compareAtHourlyRate: 22 },
    "pro-sim": { hourlyRate: 30, compareAtHourlyRate: 35 },
    ps5: {
      hourlyRate: 18,
      compareAtHourlyRate: 20,
      includedControllers: 2,
      maxAdditionalControllers: 6,
      additionalControllerRate: 3,
      additionalControllerBillingUnit: "per-booking",
    },
  } satisfies Record<ServiceId, Record<string, number | string>>,
  promotions: [
    {
      id: "instagram-follow-tag",
      label: "Follow & tag discount",
      percentage: 5,
      active: false,
      note: "Owner must confirm eligibility, redemption, dates, and stacking before activation.",
    },
  ],
} as const;

export function formatMoney(amount: number): string {
  return `RM${amount}`;
}
