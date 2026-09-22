import type { ConfigRevision } from "@/lib/config/schema";
import { allCalendarIds, resourceIdForCalendar } from "@/lib/booking/resources";
import { getGoogleAccessToken } from "@/lib/google/auth";
import { listCalendarReviewInventoryWithToken } from "@/lib/google/calendar";
import { configImpactScope, reviewConfigImpact, type FutureCalendarEvent } from "./hours-impact";

export interface ConfigReviewResult {
  affectedBookingIds: string[];
  validationErrors: Array<{ path: string; message: string }>;
  scannedEventCount: number;
  publishable: boolean;
}

export async function reviewConfigDraft(env: CloudflareEnv, current: ConfigRevision, proposed: ConfigRevision, now: string): Promise<ConfigReviewResult> {
  const readinessErrors: ConfigReviewResult["validationErrors"] = [];
  for (const service of proposed.services) {
    const resources = proposed.resources.filter((resource) => resource.serviceId === service.serviceId && resource.lifecycle !== "retired");
    const active = resources.filter((resource) => resource.lifecycle === "active" && resource.calendarRef);
    if (resources.some((resource) => !["active", "retired"].includes(resource.lifecycle))) readinessErrors.push({ path: `resources.${service.serviceId}`, message: `${service.name} has resources that are not provisioned and active.` });
    if (service.enabled && active.length === 0) readinessErrors.push({ path: `services.${service.serviceId}`, message: `${service.name} is enabled but has no active Calendar-backed resource.` });
    if (proposed.bookingRules.perServiceGroupLimits[service.serviceId] > active.length) readinessErrors.push({ path: `bookingRules.perServiceGroupLimits.${service.serviceId}`, message: `${service.name} group limit exceeds active resource capacity.` });
  }
  const scope = configImpactScope(current, proposed);
  if (!Object.values(scope).some(Boolean)) return { affectedBookingIds: [], validationErrors: readinessErrors, scannedEventCount: 0, publishable: readinessErrors.length === 0 };
  const calendars = [...new Map([
    ...allCalendarIds(env).map((calendarRef) => [calendarRef, { resourceId: resourceIdForCalendar(env, calendarRef) ?? "booking-control", calendarRef }] as const),
    ...current.resources.filter((resource) => resource.calendarRef).map((resource) => [resource.calendarRef!, { resourceId: resource.resourceId, calendarRef: resource.calendarRef! }] as const),
    ...proposed.resources.filter((resource) => resource.calendarRef).map((resource) => [resource.calendarRef!, { resourceId: resource.resourceId, calendarRef: resource.calendarRef! }] as const),
  ]).values()];
  const token = await getGoogleAccessToken(env);
  const inventories = await Promise.all(calendars.map(async (resource) => ({ resource, events: await listCalendarReviewInventoryWithToken(token, resource.calendarRef, now) })));
  const events: FutureCalendarEvent[] = inventories.flatMap(({ resource, events }) => events
    .filter((event) => event.status !== "cancelled" && event.transparency !== "transparent" && event.privateProperties.status !== "cancelled" && ((event.recurrence?.length ?? 0) > 0 || Date.parse(event.end) > Date.parse(now)))
    .map((event) => ({ eventId: event.id, resourceId: resource.resourceId, start: event.start, end: event.end, bookingId: event.privateProperties.bookingId ?? null, recurring: (event.recurrence?.length ?? 0) > 0, recurrenceHasNoEnd: event.recurrence?.some((rule) => rule.startsWith("RRULE:") && !rule.includes("UNTIL=") && !rule.includes("COUNT=")) ?? false, allDay: event.allDay })));
  const impact = reviewConfigImpact(proposed, events, scope);
  return {
    affectedBookingIds: [...new Set(impact.conflicts.flatMap((conflict) => conflict.bookingId ? [conflict.bookingId] : []))],
    validationErrors: [...readinessErrors, ...impact.conflicts.map((conflict) => ({ path: `resources.${conflict.resourceId}`, message: `${conflict.bookingId ? `Booking ${conflict.bookingId}` : "Calendar block"} requires review: ${conflict.reason.replaceAll("-", " ")}.` }))],
    scannedEventCount: events.length,
    publishable: readinessErrors.length === 0 && !impact.blocking,
  };
}
