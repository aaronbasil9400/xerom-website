import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { ConfigUnavailableError, getConfigRepository } from "@/lib/config/repository";
import { createConfigReviewToken, draftHash } from "@/lib/security/review-token";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";
import { listCalendarReviewInventoryWithToken } from "@/lib/google/calendar";
import { getGoogleAccessToken } from "@/lib/google/auth";
import { configImpactScope, reviewConfigImpact, type FutureCalendarEvent } from "@/lib/race-control/hours-impact";
import { allCalendarIds, resourceIdForCalendar } from "@/lib/booking/resources";
import { createSeedConfig } from "@/lib/config/seed";

export const prerender = false;
const headers = { "cache-control": "private, no-store" };

export const POST: APIRoute = async ({ request }) => {
  if (!verifyOwnerMutationOrigin(request)) return Response.json({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }, { status: 403, headers });
  const body = await request.json().catch(() => null) as { draftHash?: unknown } | null;
  try {
    const repository = getConfigRepository(cloudflareEnv);
    const draft = await repository.readDraft();
    if (!draft) return Response.json({ error: { code: "DRAFT_NOT_FOUND", message: "Save a draft before reviewing it.", retryable: false } }, { status: 409, headers });
    const hash = await draftHash(draft.value);
    if (typeof body?.draftHash !== "string" || body.draftHash !== hash) return Response.json({ error: { code: "STALE_DRAFT", message: "Reload the draft before reviewing it.", retryable: false } }, { status: 409, headers });
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
    if (!env.RACE_CONTROL_TOKEN_ENCRYPTION_KEY) throw new ConfigUnavailableError("Review token signing is not configured.");
    const now = new Date().toISOString();
    let current;
    try { current = (await repository.readActive()).config; } catch (error) {
      if (!(error instanceof ConfigUnavailableError)) throw error;
      current = createSeedConfig({ resources: { "regular-01": env.REGULAR_SIM_01_CALENDAR_ID, "regular-02": env.REGULAR_SIM_02_CALENDAR_ID, "regular-03": env.REGULAR_SIM_03_CALENDAR_ID, "pro-01": env.PRO_SIM_01_CALENDAR_ID, "ps5-01": env.PS5_01_CALENDAR_ID, "ps5-02": env.PS5_02_CALENDAR_ID } }, now);
    }
    const scope = configImpactScope(current, draft.value);
    const calendars = [...new Map([
      ...allCalendarIds(env).map((calendarRef) => [calendarRef, { resourceId: resourceIdForCalendar(env, calendarRef) ?? "booking-control", calendarRef }] as const),
      ...draft.value.resources.filter((resource) => resource.calendarRef).map((resource) => [resource.calendarRef!, { resourceId: resource.resourceId, calendarRef: resource.calendarRef! }] as const),
    ]).values()];
    const scanRequired = Object.values(scope).some(Boolean);
    const googleToken = scanRequired ? await getGoogleAccessToken(env) : null;
    const inventories = googleToken ? await Promise.all(calendars.map(async (resource) => ({ resource, events: await listCalendarReviewInventoryWithToken(googleToken, resource.calendarRef, now) }))) : [];
    const events: FutureCalendarEvent[] = inventories.flatMap(({ resource, events }) => events.filter((event) => event.status !== "cancelled" && event.transparency !== "transparent" && event.privateProperties.status !== "cancelled" && ((event.recurrence?.length ?? 0) > 0 || Date.parse(event.end) > Date.parse(now))).map((event) => ({ eventId: event.id, resourceId: resource.resourceId, start: event.start, end: event.end, bookingId: event.privateProperties.bookingId ?? null, recurring: (event.recurrence?.length ?? 0) > 0, recurrenceHasNoEnd: event.recurrence?.some((rule) => rule.startsWith("RRULE:") && !rule.includes("UNTIL=") && !rule.includes("COUNT=")) ?? false, allDay: event.allDay })));
    const impact = reviewConfigImpact(draft.value, events, scope);
    const affectedBookingIds = [...new Set(impact.conflicts.flatMap((conflict) => conflict.bookingId ? [conflict.bookingId] : []))];
    const validationErrors = impact.conflicts.map((conflict) => ({ path: `resources.${conflict.resourceId}`, message: `${conflict.bookingId ? `Booking ${conflict.bookingId}` : "Calendar block"} requires review: ${conflict.reason.replaceAll("-", " ")}.` }));
    const reviewToken = impact.blocking ? null : await createConfigReviewToken(env.RACE_CONTROL_TOKEN_ENCRYPTION_KEY, { draftHash: hash, baseRevision: draft.value.parentRevision ?? draft.value.revisionId, expiresAt });
    return Response.json({ data: { draftHash: hash, baseRevision: draft.value.parentRevision ?? draft.value.revisionId, affectedBookingIds, validationErrors, impactScanComplete: true, publishable: !impact.blocking, scannedEventCount: events.length, expiresAt, reviewToken }, etag: draft.etag }, { headers });
  } catch (error) {
    const message = error instanceof ConfigUnavailableError ? error.message : "Configuration review is unavailable.";
    return Response.json({ error: { code: "CONFIG_UNAVAILABLE", message, retryable: true } }, { status: 503, headers });
  }
};
