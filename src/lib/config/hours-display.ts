import type { ConfigRevision } from "./schema";

const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function formatClock(value: string): string {
  const [hour, minute] = value.split(":").map(Number);
  const hour12 = hour % 12 || 12;
  return `${hour12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour < 12 ? "am" : "pm"}`;
}

export function todayOpeningHours(hours: ConfigRevision["hours"], now: Date = new Date()): { day: string; hours: string } {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const datePart = (type: string) => dateParts.find((part) => part.type === type)?.value ?? "";
  const businessDate = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
  const weekdayName = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kuala_Lumpur", weekday: "long" })
    .format(now).toLowerCase();
  const weekdayIndex = weekdays.findIndex((day) => day === weekdayName);
  const intervals = hours.exceptions.find((exception) => exception.businessDate === businessDate)?.intervals
    ?? hours.weekly[weekdays[weekdayIndex]];

  return {
    day: weekdays[weekdayIndex].slice(0, 3).replace(/^./, (letter) => letter.toUpperCase()),
    hours: intervals.length
      ? intervals.map((interval) => `${formatClock(interval.open)}–${formatClock(interval.close)}`).join(", ")
      : "Closed",
  };
}
