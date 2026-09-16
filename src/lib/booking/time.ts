import { bookingRules } from "@/config/booking";
import type { AvailabilitySlot, BusyByCalendar } from "./types";
import type { ServiceId } from "@/config/service-core";

const MALAYSIA_OFFSET = "+08:00";
const localFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: bookingRules.timezone,
  calendar: "gregory",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

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

type MalaysiaLocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function malaysiaLocalParts(value: Date): MalaysiaLocalParts {
  const parts = Object.fromEntries(localFormatter.formatToParts(value).map(({ type, value: part }) => [type, Number(part)]));
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function localCalendarMinutes(parts: MalaysiaLocalParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) / 60_000;
}

function localWeekdayFromParts(parts: MalaysiaLocalParts): keyof typeof bookingRules.weeklyHours {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay() as keyof typeof bookingRules.weeklyHours;
}

export interface BookingWindowPolicy {
  minimumNoticeMinutes: number;
  maximumAdvanceMinutes: number;
  allowedDurationsMinutes: readonly number[];
  enforceSlotAlignment?: boolean;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(bStart) < Date.parse(aEnd);
}

export function validateBookingWindow(start: string, durationMinutes: number, now = new Date(), policy: BookingWindowPolicy = bookingRules): string | null {
  const startMs = Date.parse(start);
  if (!Number.isFinite(startMs)) return "Invalid start time.";
  if (startMs <= now.getTime()) return "Bookings must start in the future.";
  if (startMs < now.getTime() + policy.minimumNoticeMinutes * 60_000) return "Bookings need at least one hour of notice.";
  if (startMs > now.getTime() + policy.maximumAdvanceMinutes * 60_000) return "Bookings open up to three days ahead.";
  if (!policy.allowedDurationsMinutes.includes(durationMinutes)) return "Choose a 30-, 60-, or 120-minute session.";

  const startParts = malaysiaLocalParts(new Date(startMs));
  if (startParts.second !== 0) return "Choose a time on the minute.";
  const endParts = malaysiaLocalParts(new Date(startMs + durationMinutes * 60_000));
  const startLocalMinutes = localCalendarMinutes(startParts);
  const endLocalMinutes = localCalendarMinutes(endParts);
  const elapsedLocalMinutes = endLocalMinutes - startLocalMinutes;
  const startDayMinutes = Date.UTC(startParts.year, startParts.month - 1, startParts.day) / 60_000;
  // An overnight window (for example Sunday 12:00–25:00) owns the
  // after-midnight slots on the following local date. Check both the start
  // date and the previous date so a 00:00 Monday booking remains valid.
  const windowContexts = [startDayMinutes, startDayMinutes - 24 * 60].map((dayMinutes) => {
    const day = new Date(dayMinutes * 60_000);
    const parts = { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1, day: day.getUTCDate(), hour: 0, minute: 0, second: 0 };
    return { dayMinutes, windows: bookingRules.weeklyHours[localWeekdayFromParts(parts)] ?? [] };
  });
  const containingWindow = windowContexts.some(({ dayMinutes, windows }) => {
    const relativeStart = startLocalMinutes - dayMinutes;
    return windows.some((window) => {
      const open = minutesFromClock(window.open);
      const close = minutesFromClock(window.close);
      return relativeStart >= open && relativeStart + elapsedLocalMinutes <= close;
    });
  });
  if (!containingWindow) return "Choose a slot during opening hours.";
  const alignedToHourlyGrid = windowContexts.some(({ dayMinutes, windows }) => {
    const relativeStart = startLocalMinutes - dayMinutes;
    return windows.some((window) => {
      const open = minutesFromClock(window.open);
      const close = minutesFromClock(window.close);
      return relativeStart >= open
        && relativeStart + elapsedLocalMinutes <= close
        && (relativeStart - open) % bookingRules.slotIntervalMinutes === 0;
    });
  });
  if (policy.enforceSlotAlignment !== false && !alignedToHourlyGrid) return "Choose an hourly slot.";
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
