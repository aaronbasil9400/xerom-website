export type ConversionEvent =
  | "booking_started"
  | "availability_checked"
  | "booking_slot_selected"
  | "booking_completed"
  | "booking_failed"
  | "whatsapp_clicked"
  | "directions_clicked"
  | "phone_clicked"
  | "instagram_clicked";

export function trackConversion(name: ConversionEvent, metadata: Record<string, string | number | boolean> = {}) {
  const safe = Object.fromEntries(Object.entries(metadata).filter(([key]) => !/name|phone|note|booking|date|time|resource/i.test(key)));
  window.dispatchEvent(new CustomEvent("xerom:conversion", { detail: { name, ...safe } }));
  const layer = (window as Window & { dataLayer?: unknown[] }).dataLayer;
  if (Array.isArray(layer)) layer.push({ event: name, ...safe });
}
