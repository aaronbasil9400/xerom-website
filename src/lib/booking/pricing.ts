import { pricing, pricingVersion } from "@/config/pricing";
import type { BookingLineItem } from "./types";

export function calculateTotal(items: BookingLineItem[], durationMinutes: 60 | 120) {
  const hours = durationMinutes / 60;
  const lines = items.filter((item) => item.quantity > 0).map((item) => {
    const config = pricing.services[item.serviceId];
    const base = config.hourlyRate * item.quantity * hours;
    const controllerAddOn = item.serviceId === "ps5"
      ? (item.additionalControllers ?? 0) * pricing.services.ps5.additionalControllerRate * hours
      : 0;
    return { ...item, amount: base + controllerAddOn };
  });
  return { total: lines.reduce((sum, line) => sum + line.amount, 0), currency: pricing.currency, version: pricingVersion, lines };
}
