import { getGoogleAccessToken } from "./auth";
import type { BusyByCalendar, BusyInterval } from "@/lib/booking/types";

const API = "https://www.googleapis.com/calendar/v3";

export async function queryFreeBusy(env: CloudflareEnv, calendarIds: string[], timeMin: string, timeMax: string): Promise<BusyByCalendar> {
  if (calendarIds.length === 0) throw new Error("Booking calendars are not configured.");
  const token = await getGoogleAccessToken(env);
  const response = await fetch(`${API}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, timeZone: "Asia/Kuala_Lumpur", items: calendarIds.map((id) => ({ id })) }),
  });
  if (!response.ok) throw new Error(`Google FreeBusy failed (${response.status}).`);
  const data = await response.json<{ calendars: Record<string, { busy?: BusyInterval[]; errors?: unknown[] }> }>();
  for (const calendar of Object.values(data.calendars)) if (calendar.errors?.length) throw new Error("A booking calendar could not be read.");
  return Object.fromEntries(calendarIds.map((id) => [id, data.calendars[id]?.busy ?? []]));
}

export interface CalendarEventInput {
  calendarId: string;
  eventId: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  privateProperties: Record<string, string>;
}

export async function insertEvent(env: CloudflareEnv, event: CalendarEventInput): Promise<string> {
  const token = await getGoogleAccessToken(env);
  const response = await fetch(`${API}/calendars/${encodeURIComponent(event.calendarId)}/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      id: event.eventId,
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start, timeZone: "Asia/Kuala_Lumpur" },
      end: { dateTime: event.end, timeZone: "Asia/Kuala_Lumpur" },
      visibility: "private",
      transparency: "opaque",
      extendedProperties: { private: event.privateProperties },
    }),
  });
  if (response.status === 409) return event.eventId;
  if (!response.ok) throw new Error(`Calendar event creation failed (${response.status}).`);
  const data = await response.json<{ id: string }>();
  return data.id;
}

export async function deleteEvent(env: CloudflareEnv, calendarId: string, eventId: string): Promise<void> {
  const token = await getGoogleAccessToken(env);
  const response = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error(`Calendar rollback failed (${response.status}).`);
}
