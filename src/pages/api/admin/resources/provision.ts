import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { z } from "zod";
import { ConfigConflictError, ConfigUnavailableError, getConfigRepository } from "@/lib/config/repository";
import { configRevisionSchema, type ConfigRevision } from "@/lib/config/schema";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";
import { getGoogleAccessToken } from "@/lib/google/auth";
import { createSecondaryCalendarWithToken, findCalendarsByMarkerWithToken, shareCalendarWithOwnerWithToken, verifyCalendarWriteWithToken, CalendarProvisioningUncertainError } from "@/lib/google/calendar";
import { hashPayload } from "@/lib/booking/id";

export const prerender = false;
const headers = { "cache-control": "private, no-store" };
const requestSchema = z.object({ resourceId: z.string().min(1).max(96), expectedEtag: z.string().min(1) }).strict();

const ownerProjection = (config: ConfigRevision) => ({
  ...config,
  resources: config.resources.map(({ calendarRef, ...resource }) => ({ ...resource, calendarRef: null, calendarManaged: Boolean(calendarRef) })),
});

const reply = (body: unknown, status: number) => Response.json(body, { status, headers });
const fail = (code: string, message: string, status: number, retryable = false) => reply({ error: { code, message, retryable } }, status);

/**
 * Provisions exactly one private Calendar for an existing draft resource, then links it in the private
 * draft. Creating a Calendar is not transactional, so the operation marker lets a lost response be
 * reconciled by listing rather than retried blindly. Calendar identifiers never reach the browser.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!verifyOwnerMutationOrigin(request)) return fail("CSRF_REJECTED", "Refresh Race Control and try again.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return fail("CONTENT_TYPE", "Send JSON.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 8_000) return fail("TOO_LARGE", "The provisioning request is too large.", 413);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("INVALID_PROVISIONING", "Reload the resources editor and try again.", 400);
  const { resourceId, expectedEtag } = parsed.data;

  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  if (!env.RACE_CONTROL_CONFIG_BUCKET) return fail("CONFIG_UNAVAILABLE", "Configuration storage is unavailable.", 503, true);
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) return fail("GOOGLE_UNAVAILABLE", "The Google booking identity is not configured.", 503);

  try {
    const repository = getConfigRepository(env);
    const draft = await repository.readDraft();
    if (!draft) return fail("DRAFT_NOT_FOUND", "Save the resources draft before provisioning a calendar.", 409);
    if (draft.etag !== expectedEtag) return fail("STALE_DRAFT", "The draft changed in another session. Reload before provisioning.", 409);

    const resource = draft.value.resources.find((candidate) => candidate.resourceId === resourceId);
    if (!resource) return fail("RESOURCE_NOT_FOUND", "That resource is not part of the saved draft.", 404);
    if (resource.lifecycle === "retired") return fail("RESOURCE_RETIRED", "A retired resource cannot be provisioned.", 409);
    if (resource.calendarRef) return fail("ALREADY_PROVISIONED", "That resource already has a private calendar.", 409);

    const marker = `xerom-resource:${resourceId}`;
    const token = await getGoogleAccessToken(env);

    // Reconcile first: a previous attempt may have created the calendar without storing the reference.
    let existing = await findCalendarsByMarkerWithToken(token, marker);
    if (existing.length > 1) return fail("PROVISIONING_AMBIGUOUS", "More than one calendar matches this resource. Resolve it in Google Calendar before retrying.", 409);

    if (existing.length === 0) {
      try {
        const created = await createSecondaryCalendarWithToken(token, `Xerom · ${resource.displayName}`, marker);
        existing = [{ id: created.id, summary: created.summary }];
      } catch (error) {
        if (!(error instanceof CalendarProvisioningUncertainError)) throw error;
        const reconciled = await findCalendarsByMarkerWithToken(token, marker);
        if (reconciled.length === 1) existing = reconciled;
        else {
          console.error(JSON.stringify({ message: "resource_provisioning_uncertain", resourceId }));
          return fail("PROVISIONING_UNCERTAIN", "Calendar creation could not be confirmed. Retry to reconcile it.", 503, true);
        }
      }
    }

    const calendarRef = existing[0].id;
    let sharedWithOwner = false;
    if (env.VENUE_GOOGLE_ACCOUNT_EMAIL) {
      try {
        await shareCalendarWithOwnerWithToken(token, calendarRef, env.VENUE_GOOGLE_ACCOUNT_EMAIL);
        sharedWithOwner = true;
      } catch (error) {
        // The calendar is usable for bookings even when venue sharing fails; surface the manual step instead.
        console.error(JSON.stringify({ message: "resource_provisioning_share_failed", resourceId, error: error instanceof Error ? error.message : "unknown" }));
      }
    }

    try {
      // Google event IDs must be base32hex (lowercase a-v, 0-9); a hex digest satisfies that and stays deterministic for retries.
      const probeEventId = (await hashPayload({ provisionProbe: resourceId })).slice(0, 32);
      await verifyCalendarWriteWithToken(token, calendarRef, probeEventId);
    } catch (error) {
      console.error(JSON.stringify({ message: "resource_provisioning_verify_failed", resourceId, error: error instanceof Error ? error.message : "unknown" }));
      return fail("PROVISIONING_UNVERIFIED", "The new calendar could not be verified for writes. Retry to recheck it.", 503, true);
    }

    const updated: ConfigRevision = {
      ...draft.value,
      resources: draft.value.resources.map((candidate) => candidate.resourceId === resourceId
        ? { ...candidate, calendarRef, lifecycle: "active" as const, activeFrom: candidate.activeFrom ?? new Date().toISOString(), retiredFrom: null }
        : candidate),
    };
    const validated = configRevisionSchema.parse(updated);
    const saved = await repository.saveDraft(validated, expectedEtag);
    return reply({ data: ownerProjection(saved.value), etag: saved.etag, provisioned: true, sharedWithOwner }, 200);
  } catch (error) {
    if (error instanceof ConfigConflictError) return fail("STALE_DRAFT", "The draft changed in another session. Reload before provisioning.", 409);
    if (error instanceof ConfigUnavailableError) return fail("CONFIG_UNAVAILABLE", error.message, 503, true);
    console.error(JSON.stringify({ message: "resource_provisioning_failed", resourceId, error: error instanceof Error ? error.message : "unknown" }));
    return fail("PROVISIONING_FAILED", "The private calendar could not be provisioned.", 503, true);
  }
};
