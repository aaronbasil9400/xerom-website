import { bookingRules } from "./booking";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const displayOrder = [1, 2, 3, 4, 5, 6, 0];

export interface OpeningHoursGroup {
  days: string;
  hours: string;
}

function formatClock(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const normalized = hours % 24;
  const suffix = normalized >= 12 ? "PM" : "AM";
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  const minutePart = minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`;
  return `${hour12}${minutePart}${suffix}`;
}

function formatDayRange(days: number[]): string {
  if (days.length === 1) return dayNames[days[0]];
  return `${dayNames[days[0]]}–${dayNames[days.at(-1)!]}`;
}

function buildGroups(): OpeningHoursGroup[] {
  const groups: Array<{ days: number[]; hours: string }> = [];
  for (const day of displayOrder) {
    const windows = bookingRules.weeklyHours[day as keyof typeof bookingRules.weeklyHours];
    const hours = windows.map((window) => `${formatClock(window.open)} – ${formatClock(window.close)}`).join(", ");
    const last = groups.at(-1);
    if (last && last.hours === hours) last.days.push(day);
    else groups.push({ days: [day], hours });
  }
  return groups.map((group) => ({ days: formatDayRange(group.days), hours: group.hours }));
}

export const openingHours: OpeningHoursGroup[] = buildGroups();
