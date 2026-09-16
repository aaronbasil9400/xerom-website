import { listCalendarEvents, type CalendarEventRecord } from "@/lib/google/calendar";
import type { ServiceId } from "@/config/service-core";
import { bookingRules } from "@/config/booking";
import { localIso, localWeekday } from "@/lib/booking/time";

export interface ScheduleResource {
  resourceId: string;
  serviceId: ServiceId | "control";
  displayName: string;
  events: Array<CalendarEventRecord & { resourceId: string; serviceId: ServiceId | "control" }>;
}

export interface ScheduleWindow {
  start: string;
  end: string;
}

function registry(env: CloudflareEnv): ScheduleResource[] {
  return [
    ["regular-01", "regular-sim", "Regular 01", env.REGULAR_SIM_01_CALENDAR_ID],
    ["regular-02", "regular-sim", "Regular 02", env.REGULAR_SIM_02_CALENDAR_ID],
    ["regular-03", "regular-sim", "Regular 03", env.REGULAR_SIM_03_CALENDAR_ID],
    ["pro-01", "pro-sim", "Pro 01", env.PRO_SIM_01_CALENDAR_ID],
    ["ps5-01", "ps5", "PS5 01", env.PS5_01_CALENDAR_ID],
    ["ps5-02", "ps5", "PS5 02", env.PS5_02_CALENDAR_ID],
    ["booking-control", "control", "Venue control", env.BOOKING_CONTROL_CALENDAR_ID],
  ].map(([resourceId, serviceId, displayName, calendarId]) => {
    if (!calendarId) throw new Error(`Calendar mapping is unavailable for ${resourceId}.`);
    return { resourceId, serviceId, displayName, calendarId, events: [] } as ScheduleResource & { calendarId: string };
  });
}

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function minutesFromClock(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function scheduleWindowForDate(businessDate: string): ScheduleWindow {
  const interval = bookingRules.weeklyHours[localWeekday(businessDate)]?.[0];
  if (!interval) throw new Error("Opening hours are unavailable for this business date.");
  return { start: localIso(businessDate, minutesFromClock(interval.open)), end: localIso(businessDate, minutesFromClock(interval.close)) };
}

export async function loadRaceControlSchedule(env: CloudflareEnv, businessDate: string): Promise<{ businessDate: string; serverNow: string; businessWindow: ScheduleWindow; resources: ScheduleResource[] }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) throw new Error("Business date is invalid.");
  const timeMin = `${businessDate}T00:00:00+08:00`;
  const timeMax = `${nextDate(businessDate)}T06:00:00+08:00`;
  const businessWindow = scheduleWindowForDate(businessDate);
  const resources = registry(env) as Array<ScheduleResource & { calendarId: string }>;
  await Promise.all(resources.map(async (resource) => {
    const events = await listCalendarEvents(env, resource.calendarId, timeMin, timeMax);
    resource.events = events.filter((event) => event.status !== "cancelled" && event.transparency !== "transparent").map((event) => ({ ...event, resourceId: resource.resourceId, serviceId: resource.serviceId }));
  }));
  return { businessDate, serverNow: new Date().toISOString(), businessWindow, resources: resources.map(({ calendarId: _calendarId, ...resource }) => resource) };
}
