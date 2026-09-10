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
