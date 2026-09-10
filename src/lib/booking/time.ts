import { bookingRules } from "@/config/booking";
import type { AvailabilitySlot, BusyByCalendar } from "./types";
import type { ServiceId } from "@/config/service-core";

const MALAYSIA_OFFSET = "+08:00";

export function localIso(date: string, minutes: number): string {
  const nextDate = new Date(`${date}T00:00:00${MALAYSIA_OFFSET}`);
  nextDate.setUTCMinutes(nextDate.getUTCMinutes() + minutes);
  const local = new Date(nextDate.getTime() + 8 * 60 * 60 * 1000);
  return `${local.toISOString().slice(0, 19)}${MALAYSIA_OFFSET}`;
}

export function malaysiaDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: bookingRules.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function localWeekday(date: string): keyof typeof bookingRules.weeklyHours {
  return new Date(`${date}T00:00:00${MALAYSIA_OFFSET}`).getUTCDay() as keyof typeof bookingRules.weeklyHours;
}

function minutesFromClock(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(bStart) < Date.parse(aEnd);
}

export function validateBookingWindow(start: string, durationMinutes: number, now = new Date()): string | null {
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs)) return "Invalid start time.";
  if (startMs < now.getTime() + bookingRules.minimumNoticeMinutes * 60_000) return "Bookings need at least one hour of notice.";
  if (startMs > now.getTime() + bookingRules.maximumAdvanceMinutes * 60_000) return "Bookings open up to three days ahead.";
  if (!bookingRules.allowedDurationsMinutes.includes(durationMinutes as 60 | 120)) return "Choose a one- or two-hour session.";
  return null;
}

export function generateCandidateSlots(date: string, durationMinutes: 60 | 120, now = new Date()): Array<{ start: string; end: string }> {
  const windows = bookingRules.weeklyHours[localWeekday(date)] ?? [];
  const slots: Array<{ start: string; end: string }> = [];
  for (const window of windows) {
    const open = minutesFromClock(window.open);
    const close = minutesFromClock(window.close);
    for (let cursor = open; cursor + durationMinutes <= close; cursor += bookingRules.slotIntervalMinutes) {
      const start = localIso(date, cursor);
      const end = localIso(date, cursor + durationMinutes);
      if (!validateBookingWindow(start, durationMinutes, now)) slots.push({ start, end });
    }
  }
  return slots;
}

export function buildAvailability(
  candidates: Array<{ start: string; end: string }>,
  calendarGroups: Record<ServiceId, string[]>,
  busy: BusyByCalendar,
  controlCalendarId: string | undefined,
  requested: Record<ServiceId, number>,
): AvailabilitySlot[] {
  return candidates.map(({ start, end }) => {
    const venueBlocked = controlCalendarId
      ? (busy[controlCalendarId] ?? []).some((interval) => overlaps(start, end, interval.start, interval.end))
      : false;
    const capacity = Object.fromEntries(Object.entries(calendarGroups).map(([serviceId, ids]) => [
      serviceId,
      venueBlocked ? 0 : ids.filter((id) => !(busy[id] ?? []).some((interval) => overlaps(start, end, interval.start, interval.end))).length,
    ])) as Record<ServiceId, number>;
    const available = !venueBlocked && (Object.keys(requested) as ServiceId[]).every((id) => capacity[id] >= requested[id]);
    return { start, end, available, capacity };
  });
}
