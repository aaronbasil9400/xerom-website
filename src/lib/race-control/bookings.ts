import { listCalendarEvents, type CalendarEventRecord } from "@/lib/google/calendar";
import { calendarIdForResource } from "@/lib/booking/resources";

export interface BookingSearchResult {
  bookingId: string | null;
  version: number;
  status: string;
  start: string;
  end: string;
  resources: string[];
  summaries: string[];
  eventCount: number;
}

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function calendarRegistry(env: CloudflareEnv): Array<{ calendarId: string; resourceId: string }> {
  return ["regular-01", "regular-02", "regular-03", "pro-01", "ps5-01", "ps5-02", "booking-control"]
    .map((resourceId) => ({ resourceId, calendarId: calendarIdForResource(env, resourceId) }))
    .filter((entry): entry is { calendarId: string; resourceId: string } => Boolean(entry.calendarId));
}

export async function searchRaceControlBookings(env: CloudflareEnv, from: string, to: string, query = ""): Promise<BookingSearchResult[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) throw new Error("Booking search dates are invalid.");
  const start = `${from}T00:00:00+08:00`;
  const end = `${nextDate(to)}T00:00:00+08:00`;
  const registry = calendarRegistry(env);
  if (registry.length === 0) throw new Error("Booking calendars are not configured.");
  const rows = (await Promise.all(registry.map(async ({ calendarId, resourceId }) => ({ resourceId, events: await listCalendarEvents(env, calendarId, start, end) })))).flatMap(({ resourceId, events }) => events.filter((event) => event.status !== "cancelled").map((event) => ({ resourceId, event })));
  const needle = query.trim().toLowerCase();
  const filtered = needle ? rows.filter(({ event }) => `${event.summary} ${event.privateProperties.bookingId ?? ""}`.toLowerCase().includes(needle)) : rows;
  const groups = new Map<string, { events: Array<{ resourceId: string; event: CalendarEventRecord }>; bookingId: string | null }>();
  let blockIndex = 0;
  for (const row of filtered) {
    const bookingId = row.event.privateProperties.bookingId ?? null;
    const key = bookingId ?? `block:${row.event.id}:${blockIndex++}`;
    const group = groups.get(key) ?? { bookingId, events: [] };
    group.events.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const events = group.events.map(({ event }) => event);
    const versions = events.map((event) => Number(event.privateProperties.groupVersion ?? "0"));
    const version = versions.length > 0 && versions.every((candidate) => candidate === versions[0]) ? versions[0] : -1;
    return {
      bookingId: group.bookingId,
      version,
      status: group.bookingId ? events[0]?.privateProperties.status ?? "confirmed" : "blocked",
      start: events.map((event) => event.start).sort()[0],
      end: events.map((event) => event.end).sort().at(-1)!,
      resources: [...new Set(group.events.map(({ resourceId }) => resourceId))],
      summaries: [...new Set(events.map((event) => event.summary))],
      eventCount: events.length,
    };
  }).sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
}
