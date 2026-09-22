import type { ConfigRevision } from "@/lib/config/schema";

export interface FutureCalendarEvent {
  eventId: string;
  resourceId: string;
  start: string;
  end: string;
  bookingId: string | null;
  recurring: boolean;
  recurrenceHasNoEnd: boolean;
  allDay?: boolean;
}

export type ImpactReason = "outside-proposed-hours" | "recurring-series-needs-review" | "resource-unavailable" | "duration-no-longer-allowed" | "calendar-block-needs-review";
export interface HoursImpact { blocking: boolean; conflicts: Array<FutureCalendarEvent & { reason: ImpactReason }> }
export interface ConfigImpactScope { hours: boolean; resources: boolean; durations: boolean; buffer: boolean }

const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const localDateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" });

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function windows(config: ConfigRevision, businessDate: string): Array<{ start: number; end: number }> {
  const exception = config.hours.exceptions.find((candidate) => candidate.businessDate === businessDate);
  const weekday = days[new Date(`${businessDate}T00:00:00+08:00`).getUTCDay()];
  return (exception?.intervals ?? config.hours.weekly[weekday]).map((interval) => ({
    start: Date.parse(`${businessDate}T${interval.open}:00+08:00`),
    end: Date.parse(`${shiftDate(businessDate, interval.closeDayOffset)}T${interval.close}:00+08:00`),
  }));
}

export function configImpactScope(current: ConfigRevision, proposed: ConfigRevision): ConfigImpactScope {
  const resourceShape = (config: ConfigRevision) => ({ services: config.services.map(({ serviceId, enabled }) => ({ serviceId, enabled })), resources: config.resources.map(({ resourceId, serviceId, lifecycle, calendarRef }) => ({ resourceId, serviceId, lifecycle, calendarRef })) });
  return {
    hours: JSON.stringify(current.hours) !== JSON.stringify(proposed.hours),
    resources: JSON.stringify(resourceShape(current)) !== JSON.stringify(resourceShape(proposed)),
    durations: JSON.stringify(current.bookingRules.allowedDurationsMinutes) !== JSON.stringify(proposed.bookingRules.allowedDurationsMinutes),
    buffer: current.bookingRules.bufferMinutes !== proposed.bookingRules.bufferMinutes,
  };
}

export function reviewConfigImpact(config: ConfigRevision, events: FutureCalendarEvent[], scope: ConfigImpactScope = { hours: true, resources: true, durations: true, buffer: true }): HoursImpact {
  const conflicts: HoursImpact["conflicts"] = [];
  const activeResources = new Map(config.resources.filter((resource) => resource.lifecycle === "active" && config.services.find((service) => service.serviceId === resource.serviceId)?.enabled).map((resource) => [resource.resourceId, resource]));
  const availabilityChanges = scope.hours || scope.resources || scope.durations || scope.buffer;
  for (const event of events) {
    if (!availabilityChanges) continue;
    if (event.recurring) { conflicts.push({ ...event, reason: "recurring-series-needs-review" }); continue; }
    if (!event.bookingId) { conflicts.push({ ...event, reason: "calendar-block-needs-review" }); continue; }
    if (scope.resources && event.resourceId !== "booking-control" && !activeResources.has(event.resourceId)) { conflicts.push({ ...event, reason: "resource-unavailable" }); continue; }
    const duration = (Date.parse(event.end) - Date.parse(event.start)) / 60_000;
    if (scope.durations && !config.bookingRules.allowedDurationsMinutes.includes(duration)) { conflicts.push({ ...event, reason: "duration-no-longer-allowed" }); continue; }
    if (!scope.hours && !scope.buffer) continue;
    const start = Date.parse(event.start) - config.bookingRules.bufferMinutes * 60_000;
    const end = Date.parse(event.end) + config.bookingRules.bufferMinutes * 60_000;
    const localDate = localDateFormatter.format(new Date(event.start));
    const fits = [shiftDate(localDate, -1), localDate].flatMap((date) => windows(config, date)).some((window) => start >= window.start && end <= window.end);
    if (!fits) conflicts.push({ ...event, reason: "outside-proposed-hours" });
  }
  return { blocking: conflicts.length > 0, conflicts };
}

/** Backward-compatible pure helper retained for existing callers/tests. */
export function reviewHoursImpact(proposedWindowsByBusinessDate: Record<string, Array<{ start: string; end: string }>>, events: FutureCalendarEvent[]): HoursImpact {
  const conflicts: HoursImpact["conflicts"] = [];
  for (const event of events) {
    if (event.recurring && event.recurrenceHasNoEnd) { conflicts.push({ ...event, reason: "recurring-series-needs-review" }); continue; }
    const businessDate = event.start.slice(0, 10);
    if (!(proposedWindowsByBusinessDate[businessDate] ?? []).some((window) => event.start >= window.start && event.end <= window.end)) conflicts.push({ ...event, reason: "outside-proposed-hours" });
  }
  return { blocking: conflicts.length > 0, conflicts };
}
