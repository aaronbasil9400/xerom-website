import { listCalendarEvents, type CalendarEventRecord } from "@/lib/google/calendar";
import { calendarIdForResource } from "@/lib/booking/resources";
import type { ServiceId } from "@/config/service-core";

export interface BookingResourceBreakdown {
  serviceId: ServiceId;
  quantity: number;
  resourceIds: string[];
  calendarEventIds: string[];
}

export interface BookingSearchResult {
  bookingId: string | null;
  version: number;
  status: string;
  start: string;
  end: string;
  durationMinutes: number;
  customer: { name: string; phone: string; email?: string };
  resources: string[];
  serviceIds: ServiceId[];
  resourceBreakdown: BookingResourceBreakdown[];
  includedControllers: number;
  additionalControllers: number;
  totalControllers: number;
  priceTotal: number | null;
  createdAt: string | null;
  calendarEventIds: string[];
  summaries: string[];
  eventCount: number;
}

export interface BookingSearchFilters {
  query?: string;
  phone?: string;
  serviceId?: ServiceId;
  durationMinutes?: number;
}

interface RegisteredCalendar {
  calendarId: string;
  resourceId: string;
  serviceId: ServiceId | "control";
}

function nextDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function calendarRegistry(env: CloudflareEnv): RegisteredCalendar[] {
  return [
    ["regular-01", "regular-sim"], ["regular-02", "regular-sim"], ["regular-03", "regular-sim"],
    ["pro-01", "pro-sim"], ["ps5-01", "ps5"], ["ps5-02", "ps5"], ["booking-control", "control"],
  ].map(([resourceId, serviceId]) => ({ resourceId, serviceId, calendarId: calendarIdForResource(env, resourceId) }))
    .filter((entry): entry is RegisteredCalendar => Boolean(entry.calendarId));
}

function descriptionValue(description: string, label: string): string {
  const prefix = `${label}:`;
  return description.split(/\r?\n/).find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
}

function firstValue(events: CalendarEventRecord[], property: string, descriptionLabel?: string): string {
  for (const event of events) {
    const propertyValue = event.privateProperties[property]?.trim();
    if (propertyValue) return propertyValue;
    if (descriptionLabel) {
      const description = descriptionValue(event.description, descriptionLabel);
      if (description) return description;
    }
  }
  return "";
}

function numberValue(value: string, fallback = 0): number {
  const parsed = Number(value.replace(/^RM\s*/i, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface BookingEventDetails {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  durationMinutes: number;
  includedControllers: number;
  additionalControllers: number;
  totalControllers: number;
  priceTotal: number | null;
  createdAt: string | null;
}

export function extractBookingEventDetails(event: CalendarEventRecord): BookingEventDetails {
  const fromPropertyOrDescription = (property: string, label: string) => event.privateProperties[property]?.trim() || descriptionValue(event.description, label);
  const includedControllers = numberValue(fromPropertyOrDescription("includedControllers", "Included controllers"));
  const additionalControllers = numberValue(fromPropertyOrDescription("additionalControllers", "Additional controllers"));
  const email = fromPropertyOrDescription("customerEmail", "Email");
  const price = fromPropertyOrDescription("priceTotal", "Total booking price");
  return {
    customerName: fromPropertyOrDescription("customerName", "Customer"),
    customerPhone: fromPropertyOrDescription("customerPhone", "Phone"),
    ...(email ? { customerEmail: email } : {}),
    durationMinutes: numberValue(fromPropertyOrDescription("durationMinutes", "Duration"), Math.round((Date.parse(event.end) - Date.parse(event.start)) / 60_000)),
    includedControllers,
    additionalControllers,
    totalControllers: numberValue(fromPropertyOrDescription("totalControllers", "Total controllers"), includedControllers + additionalControllers),
    priceTotal: price ? numberValue(price) : null,
    createdAt: event.privateProperties.createdAt || null,
  };
}

function compactPhone(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeGroup(group: { events: Array<{ resourceId: string; serviceId: ServiceId | "control"; event: CalendarEventRecord }>; bookingId: string | null }): BookingSearchResult {
  const events = group.events.map(({ event }) => event);
  const details = events.map(extractBookingEventDetails);
  const versions = events.map((event) => Number(event.privateProperties.groupVersion ?? "0"));
  const version = versions.length > 0 && versions.every((candidate) => candidate === versions[0]) ? versions[0] : -1;
  const start = events.map((event) => event.start).sort()[0];
  const end = events.map((event) => event.end).sort().at(-1)!;
  const durationFromMetadata = details.find((detail) => detail.durationMinutes > 0)?.durationMinutes ?? 0;
  const durationMinutes = durationFromMetadata || Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
  const serviceIds: ServiceId[] = [...new Set(group.events.flatMap(({ serviceId, event }): ServiceId[] => {
    const stored = event.privateProperties.serviceType;
    return stored === "regular-sim" || stored === "pro-sim" || stored === "ps5" ? [stored] : serviceId === "control" ? [] : [serviceId];
  }))];
  const resourceBreakdown = serviceIds.map((serviceId) => {
    const matches = group.events.filter(({ serviceId: registryService, event }) => (event.privateProperties.serviceType ?? registryService) === serviceId);
    return {
      serviceId,
      quantity: numberValue(matches[0]?.event.privateProperties.quantity ?? "", matches.length),
      resourceIds: [...new Set(matches.map(({ resourceId }) => resourceId))],
      calendarEventIds: [...new Set(matches.map(({ event }) => event.id))],
    };
  });
  const includedControllers = details.find((detail) => detail.includedControllers > 0)?.includedControllers ?? 0;
  const additionalControllers = details.find((detail) => detail.additionalControllers > 0)?.additionalControllers ?? 0;
  const totalControllers = details.find((detail) => detail.totalControllers > 0)?.totalControllers ?? includedControllers + additionalControllers;
  const priceTotal = details.find((detail) => detail.priceTotal !== null)?.priceTotal ?? null;
  const name = details.find((detail) => detail.customerName)?.customerName ?? "";
  const phone = details.find((detail) => detail.customerPhone)?.customerPhone ?? "";
  const email = details.find((detail) => detail.customerEmail)?.customerEmail ?? "";
  return {
    bookingId: group.bookingId,
    version,
    status: group.bookingId ? firstValue(events, "status") || "confirmed" : "blocked",
    start,
    end,
    durationMinutes,
    customer: { name, phone, ...(email ? { email } : {}) },
    resources: [...new Set(group.events.map(({ resourceId }) => resourceId))],
    serviceIds,
    resourceBreakdown,
    includedControllers,
    additionalControllers,
    totalControllers,
    priceTotal,
    createdAt: details.find((detail) => detail.createdAt)?.createdAt ?? null,
    calendarEventIds: [...new Set(events.map((event) => event.id))],
    summaries: [...new Set(events.map((event) => event.summary))],
    eventCount: events.length,
  };
}

export async function searchRaceControlBookings(env: CloudflareEnv, from: string, to: string, filters: BookingSearchFilters | string = {}): Promise<BookingSearchResult[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) throw new Error("Booking search dates are invalid.");
  const start = `${from}T00:00:00+08:00`;
  const end = `${nextDate(to)}T00:00:00+08:00`;
  const registry = calendarRegistry(env);
  if (registry.length === 0) throw new Error("Booking calendars are not configured.");
  const rows = (await Promise.all(registry.map(async ({ calendarId, resourceId, serviceId }) => ({ resourceId, serviceId, events: await listCalendarEvents(env, calendarId, start, end) }))))
    .flatMap(({ resourceId, serviceId, events }) => events.filter((event) => event.status !== "cancelled").map((event) => ({ resourceId, serviceId, event })));
  const groups = new Map<string, { events: typeof rows; bookingId: string | null }>();
  let blockIndex = 0;
  for (const row of rows) {
    const bookingId = row.event.privateProperties.bookingId ?? null;
    const key = bookingId ?? `block:${row.event.id}:${blockIndex++}`;
    const group = groups.get(key) ?? { bookingId, events: [] };
    group.events.push(row);
    groups.set(key, group);
  }
  const normalizedFilters = typeof filters === "string" ? { query: filters } : filters;
  const needle = normalizedFilters.query?.trim().toLowerCase() ?? "";
  const phoneNeedle = compactPhone(normalizedFilters.phone ?? "");
  return [...groups.values()].map(normalizeGroup).filter((booking) => {
    const searchMatch = !needle || [booking.bookingId, booking.customer.name, booking.customer.phone, booking.customer.email, ...booking.resources, ...booking.summaries].filter(Boolean).join(" ").toLowerCase().includes(needle);
    const phoneMatch = !phoneNeedle || compactPhone(booking.customer.phone).includes(phoneNeedle);
    const serviceMatch = !normalizedFilters.serviceId || booking.serviceIds.includes(normalizedFilters.serviceId);
    const durationMatch = !normalizedFilters.durationMinutes || booking.durationMinutes === normalizedFilters.durationMinutes;
    return searchMatch && phoneMatch && serviceMatch && durationMatch;
  }).sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
}

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function bookingRecordsToCsv(bookings: BookingSearchResult[]): string {
  const columns = ["booking_id", "customer_name", "phone", "email", "booking_date", "start_time", "end_time", "duration_minutes", "resource_type", "resource_quantity", "additional_controllers", "price_myr", "booking_status", "created_at", "calendar_event_ids"];
  const rows = bookings.filter((booking) => booking.bookingId).flatMap((booking) => {
    const lines = booking.resourceBreakdown.length ? booking.resourceBreakdown : [{ serviceId: "" as ServiceId, quantity: 0, resourceIds: [], calendarEventIds: booking.calendarEventIds }];
    return lines.map((line) => [
      booking.bookingId, booking.customer.name, booking.customer.phone, booking.customer.email ?? "", booking.start.slice(0, 10), booking.start, booking.end,
      booking.durationMinutes, line.serviceId, line.quantity, line.serviceId === "ps5" ? booking.additionalControllers : 0, booking.priceTotal, booking.status, booking.createdAt,
      line.calendarEventIds.join("|"),
    ].map(csvCell).join(","));
  });
  return [columns.join(","), ...rows].join("\r\n");
}
