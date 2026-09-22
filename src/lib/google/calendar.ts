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
  etag?: string;
  summary?: string;
  description?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  visibility?: string;
  transparency?: string;
  extendedProperties?: { private?: Record<string, string> };
  recurrence?: string[];
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
  let response: Response;
  try {
    response = await fetch(`${API}/calendars/${encodeURIComponent(event.calendarId)}/events`, {
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
  } catch {
    try {
      const existing = await readEventWithToken(token, event.calendarId, event.eventId);
      if (existing && eventMatchesCreate(existing, event)) return event.eventId;
    } catch {
      // The deterministic read is best-effort; an unreadable outcome remains fenced by the caller.
    }
    throw new CalendarMutationUncertainError("Calendar event creation outcome is uncertain.");
  }
  if (response.status === 409) {
    const existing = await readEventWithToken(token, event.calendarId, event.eventId);
    if (existing && eventMatchesCreate(existing, event)) return event.eventId;
    throw new Error("Calendar event ID conflict did not match this operation.");
  }
  if (response.status >= 500) throw new CalendarMutationUncertainError(`Calendar event creation outcome is uncertain (${response.status}).`);
  if (!response.ok) throw new Error(`Calendar event creation failed (${response.status}).`);
  const data = await response.json<{ id: string }>().catch(() => null);
  if (!data) throw new CalendarMutationUncertainError("Calendar event creation returned an unreadable success response.");
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

export interface CalendarEventRecord {
  id: string;
  etag: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  status: string;
  transparency: string;
  privateProperties: Record<string, string>;
  allDay: boolean;
  recurrence?: string[];
}

function eventBoundary(value: { dateTime?: string; date?: string } | undefined): { value: string; allDay: boolean } | null {
  if (value?.dateTime) return { value: value.dateTime, allDay: false };
  if (value?.date) return { value: `${value.date}T00:00:00+08:00`, allDay: true };
  return null;
}

export async function listCalendarEvents(env: CloudflareEnv, calendarId: string, timeMin: string, timeMax: string, privateProperty?: string): Promise<CalendarEventRecord[]> {
  const token = await getGoogleAccessToken(env);
  return listCalendarEventsWithToken(token, calendarId, timeMin, timeMax, privateProperty);
}

export async function listCalendarEventsWithToken(token: string, calendarId: string, timeMin: string, timeMax: string, privateProperty?: string): Promise<CalendarEventRecord[]> {
  const events: CalendarEventRecord[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "2500" });
    if (privateProperty) params.append("privateExtendedProperty", privateProperty);
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Calendar event listing failed (${response.status}).`);
    const data = await response.json<{ items?: GoogleEventRecord[]; nextPageToken?: string }>();
    if (!Array.isArray(data.items)) throw new Error("Calendar event listing returned an invalid response.");
    for (const item of data.items) {
      const start = eventBoundary(item.start);
      const end = eventBoundary(item.end);
      if (!item.id || !start || !end) continue;
      events.push({
        id: item.id,
        etag: item.etag ?? "",
        summary: item.summary ?? "Calendar block",
        description: item.description ?? "",
        start: start.value,
        end: end.value,
        status: item.status ?? "confirmed",
        transparency: item.transparency ?? "opaque",
        privateProperties: item.extendedProperties?.private ?? {},
        allDay: start.allDay || end.allDay,
        recurrence: item.recurrence ?? [],
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return events;
}

function normalizeCalendarEvent(item: GoogleEventRecord): CalendarEventRecord | null {
  const start = eventBoundary(item.start);
  const end = eventBoundary(item.end);
  if (!item.id || !start || !end) return null;
  return { id: item.id, etag: item.etag ?? "", summary: item.summary ?? "Calendar block", description: item.description ?? "", start: start.value, end: end.value, status: item.status ?? "confirmed", transparency: item.transparency ?? "opaque", privateProperties: item.extendedProperties?.private ?? {}, allDay: start.allDay || end.allDay, recurrence: item.recurrence ?? [] };
}

/** Complete finite-series expansion; open-ended masters stay explicit and block review. */
export async function listCalendarReviewInventory(env: CloudflareEnv, calendarId: string, timeMin: string): Promise<CalendarEventRecord[]> {
  const token = await getGoogleAccessToken(env);
  return listCalendarReviewInventoryWithToken(token, calendarId, timeMin);
}

export async function listCalendarReviewInventoryWithToken(token: string, calendarId: string, timeMin: string): Promise<CalendarEventRecord[]> {
  const masters: CalendarEventRecord[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ singleEvents: "false", showDeleted: "false", maxResults: "2500" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Calendar event listing failed (${response.status}).`);
    const data = await response.json<{ items?: GoogleEventRecord[]; nextPageToken?: string }>();
    if (!Array.isArray(data.items)) throw new Error("Calendar event listing returned an invalid response.");
    for (const item of data.items) { const event = normalizeCalendarEvent(item); if (event) masters.push(event); }
    pageToken = data.nextPageToken;
  } while (pageToken);
  const events = masters.filter((event) => !event.recurrence?.length && Date.parse(event.end) > Date.parse(timeMin));
  for (const master of masters.filter((event) => event.recurrence?.length)) {
    const finite = master.recurrence!.some((rule) => rule.startsWith("RRULE:") && (rule.includes("UNTIL=") || rule.includes("COUNT=")));
    if (!finite) { events.push(master); continue; }
    let instancePageToken: string | undefined;
    do {
      const params = new URLSearchParams({ timeMin, showDeleted: "false", maxResults: "2500" });
      if (instancePageToken) params.set("pageToken", instancePageToken);
      const response = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(master.id)}/instances?${params}`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Calendar recurring event listing failed (${response.status}).`);
      const data = await response.json<{ items?: GoogleEventRecord[]; nextPageToken?: string }>();
      if (!Array.isArray(data.items)) throw new Error("Calendar recurring event listing returned an invalid response.");
      for (const item of data.items) { const event = normalizeCalendarEvent(item); if (event) events.push({ ...event, recurrence: [] }); }
      instancePageToken = data.nextPageToken;
    } while (instancePageToken);
  }
  return events;
}

export class CalendarVersionConflictError extends Error {}
export class CalendarMutationUncertainError extends Error {}

export interface CalendarEventPatch {
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  transparency?: "opaque" | "transparent";
  privateProperties?: Record<string, string>;
}

export async function patchCalendarEvent(env: CloudflareEnv, calendarId: string, eventId: string, patch: CalendarEventPatch, etag: string): Promise<CalendarEventRecord> {
  const token = await getGoogleAccessToken(env);
  return patchCalendarEventWithToken(token, calendarId, eventId, patch, etag);
}

export async function patchCalendarEventWithToken(token: string, calendarId: string, eventId: string, patch: CalendarEventPatch, etag: string): Promise<CalendarEventRecord> {
  const body: Record<string, unknown> = {};
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.start !== undefined) body.start = { dateTime: patch.start, timeZone: "Asia/Kuala_Lumpur" };
  if (patch.end !== undefined) body.end = { dateTime: patch.end, timeZone: "Asia/Kuala_Lumpur" };
  if (patch.transparency !== undefined) body.transparency = patch.transparency;
  if (patch.privateProperties !== undefined) body.extendedProperties = { private: patch.privateProperties };
  let response: Response;
  try {
    response = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "if-match": etag },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CalendarMutationUncertainError("Calendar event update outcome is uncertain.");
  }
  if (response.status === 412) throw new CalendarVersionConflictError("The Calendar event changed outside Race Control.");
  if (response.status === 404 || response.status === 410) throw new Error("Calendar event no longer exists.");
  if (response.status >= 500) throw new CalendarMutationUncertainError(`Calendar event update outcome is uncertain (${response.status}).`);
  if (!response.ok) throw new Error(`Calendar event update failed (${response.status}).`);
  const data = await response.json<GoogleEventRecord>().catch(() => null);
  if (!data) throw new CalendarMutationUncertainError("Calendar event update returned an unreadable success response.");
  if (!data.id || !data.start?.dateTime || !data.end?.dateTime) throw new Error("Calendar event update returned an invalid response.");
  return {
    id: data.id,
    etag: data.etag ?? "",
    summary: data.summary ?? "Calendar block",
    description: data.description ?? "",
    start: data.start.dateTime,
    end: data.end.dateTime,
    status: data.status ?? "confirmed",
    transparency: data.transparency ?? "opaque",
    privateProperties: data.extendedProperties?.private ?? {},
    allDay: false,
    recurrence: data.recurrence ?? [],
  };
}
