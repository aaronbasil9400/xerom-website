import { serviceCore, type ServiceId } from "@/config/service-core";

export function calendarGroups(env: CloudflareEnv): Record<ServiceId, string[]> {
  return Object.fromEntries(Object.entries(serviceCore).map(([id, service]) => [
    id,
    service.calendarEnvKeys.map((key) => env[key as keyof CloudflareEnv]).filter((value): value is string => typeof value === "string" && value.length > 0),
  ])) as Record<ServiceId, string[]>;
}

export function allCalendarIds(env: CloudflareEnv): string[] {
  return [...Object.values(calendarGroups(env)).flat(), env.BOOKING_CONTROL_CALENDAR_ID].filter((value): value is string => Boolean(value));
}

export function resourceIdForCalendar(env: CloudflareEnv, calendarId: string): string | null {
  const entries: Array<[string, string | undefined]> = [
    ["regular-01", env.REGULAR_SIM_01_CALENDAR_ID], ["regular-02", env.REGULAR_SIM_02_CALENDAR_ID], ["regular-03", env.REGULAR_SIM_03_CALENDAR_ID],
    ["pro-01", env.PRO_SIM_01_CALENDAR_ID], ["ps5-01", env.PS5_01_CALENDAR_ID], ["ps5-02", env.PS5_02_CALENDAR_ID],
    ["booking-control", env.BOOKING_CONTROL_CALENDAR_ID],
  ];
  return entries.find(([, id]) => id === calendarId)?.[0] ?? null;
}

export function calendarIdForResource(env: CloudflareEnv, resourceId: string): string | null {
  const entries: Record<string, string | undefined> = {
    "regular-01": env.REGULAR_SIM_01_CALENDAR_ID, "regular-02": env.REGULAR_SIM_02_CALENDAR_ID, "regular-03": env.REGULAR_SIM_03_CALENDAR_ID,
    "pro-01": env.PRO_SIM_01_CALENDAR_ID, "ps5-01": env.PS5_01_CALENDAR_ID, "ps5-02": env.PS5_02_CALENDAR_ID, "booking-control": env.BOOKING_CONTROL_CALENDAR_ID,
  };
  return entries[resourceId] ?? null;
}
