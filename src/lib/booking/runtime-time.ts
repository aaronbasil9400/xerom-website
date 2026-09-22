import type { ConfigRevision } from "@/lib/config/schema";
import type { BookingDurationMinutes } from "./types";

const OFFSET = "+08:00";
const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function shiftDate(date: string, amount: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

function localDate(epoch: number): string {
  return new Date(epoch + 8 * 60 * 60_000).toISOString().slice(0, 10);
}

function intervals(config: ConfigRevision, businessDate: string) {
  const exception = config.hours.exceptions.find((candidate) => candidate.businessDate === businessDate);
  const weekday = days[new Date(`${businessDate}T00:00:00${OFFSET}`).getUTCDay()];
  return exception?.intervals ?? config.hours.weekly[weekday];
}

function intervalEpochs(config: ConfigRevision, businessDate: string) {
  return intervals(config, businessDate).map((interval) => ({
    start: Date.parse(`${businessDate}T${interval.open}:00${OFFSET}`),
    end: Date.parse(`${shiftDate(businessDate, interval.closeDayOffset)}T${interval.close}:00${OFFSET}`),
  }));
}

export function validateRuntimeBookingWindow(config: ConfigRevision, start: string, durationMinutes: number, now = new Date(), owner = false): string | null {
  const startEpoch = Date.parse(start);
  const endEpoch = startEpoch + durationMinutes * 60_000;
  if (!Number.isFinite(startEpoch) || startEpoch <= now.getTime()) return "Bookings must start in the future.";
  if (!config.bookingRules.allowedDurationsMinutes.includes(durationMinutes)) return "Choose a valid session duration.";
  if (!owner && startEpoch < now.getTime() + config.bookingRules.customerMinimumNoticeMinutes * 60_000) return "This booking does not meet the minimum notice period.";
  if (startEpoch > now.getTime() + config.bookingRules.horizon.value * 60_000) return "This booking is outside the booking horizon.";
  const date = localDate(startEpoch);
  const containing = [shiftDate(date, -1), date].flatMap((candidate) => intervalEpochs(config, candidate)).some((window) => {
    const aligned = owner || (startEpoch - window.start) % (config.bookingRules.slotIntervalMinutes * 60_000) === 0;
    return aligned && startEpoch - config.bookingRules.bufferMinutes * 60_000 >= window.start && endEpoch + config.bookingRules.bufferMinutes * 60_000 <= window.end;
  });
  return containing ? null : "Choose a slot during configured opening hours.";
}

export function generateRuntimeCandidateSlots(config: ConfigRevision, date: string, durationMinutes: BookingDurationMinutes, now = new Date()): Array<{ start: string; end: string }> {
  const slots: Array<{ start: string; end: string }> = [];
  for (const interval of intervalEpochs(config, date)) {
    for (let cursor = interval.start; cursor + durationMinutes * 60_000 <= interval.end; cursor += config.bookingRules.slotIntervalMinutes * 60_000) {
      const start = new Date(cursor).toISOString();
      if (!validateRuntimeBookingWindow(config, start, durationMinutes, now)) slots.push({ start, end: new Date(cursor + durationMinutes * 60_000).toISOString() });
    }
  }
  return slots;
}
