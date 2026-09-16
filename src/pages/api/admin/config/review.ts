import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { ConfigUnavailableError, getConfigRepository } from "@/lib/config/repository";
import { createConfigReviewToken, draftHash } from "@/lib/security/review-token";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";

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
    const reviewToken = await createConfigReviewToken(env.RACE_CONTROL_TOKEN_ENCRYPTION_KEY, { draftHash: hash, baseRevision: draft.value.parentRevision ?? draft.value.revisionId, expiresAt });
    return Response.json({ data: { draftHash: hash, baseRevision: draft.value.parentRevision ?? draft.value.revisionId, affectedBookingIds: [], validationErrors: [{ path: "impact", message: "A complete future-booking impact scan is required before publication." }], impactScanComplete: false, expiresAt, reviewToken }, etag: draft.etag }, { headers });
  } catch (error) {
    const message = error instanceof ConfigUnavailableError ? error.message : "Configuration review is unavailable.";
    return Response.json({ error: { code: "CONFIG_UNAVAILABLE", message, retryable: true } }, { status: 503, headers });
  }
};
