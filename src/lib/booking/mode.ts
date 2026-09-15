export type BookingMode = "mock" | "live" | "disabled";

export function resolveBookingMode(isDevelopment: boolean, configured: unknown): BookingMode {
  if (isDevelopment) return "mock";
  if (configured === "live" || configured === "mock" || configured === "disabled") return configured;
  return "disabled";
}
