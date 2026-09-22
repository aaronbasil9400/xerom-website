import { listCalendarEvents, type CalendarEventRecord } from "@/lib/google/calendar";
import type { ServiceId } from "@/config/service-core";
import { localIso } from "@/lib/booking/time";
import { extractBookingEventDetails, type BookingEventDetails } from "@/lib/race-control/bookings";
import type { ConfigRevision } from "@/lib/config/schema";
import { resolveRuntimeConfig } from "@/lib/config/runtime";

export interface ScheduleResource {
  resourceId: string;
  serviceId: ServiceId | "control";
  displayName: string;
  events: Array<CalendarEventRecord & { resourceId: string; serviceId: ServiceId | "control"; bookingDetails: BookingEventDetails }>;
}

export interface ScheduleWindow {
  start: string;
  end: string;
}
const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function registry(env: CloudflareEnv, config: ConfigRevision): Array<ScheduleResource & { calendarId: string }> {
  const resources = config.resources.filter((resource) => resource.calendarRef).map((resource) => ({
    resourceId: resource.resourceId,
    serviceId: resource.serviceId,
    displayName: resource.displayName,
    calendarId: resource.calendarRef!,
    events: [],
  }));
  if (!env.BOOKING_CONTROL_CALENDAR_ID) throw new Error("Booking Control Calendar mapping is unavailable.");
  return [...resources, { resourceId: "booking-control", serviceId: "control", displayName: "Venue control", calendarId: env.BOOKING_CONTROL_CALENDAR_ID, events: [] }];
}

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function minutesFromClock(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function scheduleWindowForDate(config: ConfigRevision, businessDate: string): ScheduleWindow {
  const weekday = dayNames[new Date(`${businessDate}T00:00:00+08:00`).getUTCDay()];
  const interval = (config.hours.exceptions.find((exception) => exception.businessDate === businessDate)?.intervals ?? config.hours.weekly[weekday])?.[0];
  if (!interval) throw new Error("Opening hours are unavailable for this business date.");
  return { start: localIso(businessDate, minutesFromClock(interval.open)), end: localIso(businessDate, minutesFromClock(interval.close) + interval.closeDayOffset * 1_440) };
}

export async function loadRaceControlSchedule(env: CloudflareEnv, businessDate: string): Promise<{ businessDate: string; serverNow: string; businessWindow: ScheduleWindow; resources: ScheduleResource[] }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) throw new Error("Business date is invalid.");
  const { config } = await resolveRuntimeConfig(env);
  const timeMin = `${businessDate}T00:00:00+08:00`;
  const timeMax = `${nextDate(businessDate)}T06:00:00+08:00`;
  const businessWindow = scheduleWindowForDate(config, businessDate);
  const resources = registry(env, config);
  await Promise.all(resources.map(async (resource) => {
    const events = await listCalendarEvents(env, resource.calendarId, timeMin, timeMax);
    resource.events = events.filter((event) => event.status !== "cancelled" && event.transparency !== "transparent").map((event) => ({ ...event, resourceId: resource.resourceId, serviceId: resource.serviceId, bookingDetails: extractBookingEventDetails(event) }));
  }));
  return { businessDate, serverNow: new Date().toISOString(), businessWindow, resources: resources.map(({ calendarId: _calendarId, ...resource }) => resource) };
}
