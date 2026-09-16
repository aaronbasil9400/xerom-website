import { getGoogleAccessToken } from "./auth";
import type { BusyByCalendar, BusyInterval } from "@/lib/booking/types";

const API = "https://www.googleapis.com/calendar/v3";

export async function queryFreeBusy(env: CloudflareEnv, calendarIds: string[], timeMin: string, timeMax: string): Promise<BusyByCalendar> {
  if (calendarIds.length === 0) throw new Error("Booking calendars are not configured.");
  const token = await getGoogleAccessToken(env);
  return queryFreeBusyWithToken(token, calendarIds, timeMin, timeMax);
}

export async function queryFreeBusyWithToken(token: string, calendarIds: string[], timeMin: string, timeMax: string): Promise<BusyByCalendar> {
  const response = await fetch(`${API}/freeBusy`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, timeZone: "Asia/Kuala_Lumpur", items: calendarIds.map((id) => ({ id })) }),
  });
  if (!response.ok) throw new Error(`Google FreeBusy failed (${response.status}).`);
  const data = await response.json<{ calendars?: Record<string, { busy?: BusyInterval[]; errors?: unknown[] }> }>();
  if (!data.calendars) throw new Error("Google FreeBusy returned an invalid response.");
  for (const calendarId of calendarIds) {
    const calendar = data.calendars[calendarId];
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) throw new Error("A booking calendar could not be read.");
  }
  return Object.fromEntries(calendarIds.map((id) => [id, data.calendars![id].busy!]));
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
  return insertEventWithToken(token, event);
}

interface GoogleEventRecord {
  id?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  visibility?: string;
  transparency?: string;
  extendedProperties?: { private?: Record<string, string> };
}

async function readEventWithToken(token: string, calendarId: string, eventId: string): Promise<GoogleEventRecord | null> {
  const response = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error(`Calendar event verification failed (${response.status}).`);
  return response.json<GoogleEventRecord>();
}

function samePrivateProperties(expected: Record<string, string>, actual: Record<string, string> | undefined): boolean {
  return Boolean(actual) && Object.entries(expected).every(([key, value]) => actual?.[key] === value);
}

function eventMatchesCreate(existing: GoogleEventRecord, expected: CalendarEventInput): boolean {
  return existing.id === expected.eventId
    && existing.start?.dateTime === expected.start
    && existing.end?.dateTime === expected.end
    && existing.visibility === "private"
    && existing.transparency === "opaque"
    && samePrivateProperties(expected.privateProperties, existing.extendedProperties?.private);
}

export async function insertEventWithToken(token: string, event: CalendarEventInput): Promise<string> {
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
  if (response.status === 409) {
    const existing = await readEventWithToken(token, event.calendarId, event.eventId);
    if (existing && eventMatchesCreate(existing, event)) return event.eventId;
    throw new Error("Calendar event ID conflict did not match this operation.");
  }
  if (!response.ok) throw new Error(`Calendar event creation failed (${response.status}).`);
  const data = await response.json<{ id: string }>();
  if (!data.id) throw new Error("Calendar event creation returned an invalid response.");
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
