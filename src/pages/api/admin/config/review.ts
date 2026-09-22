import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { ConfigNotActivatedError, ConfigUnavailableError, getConfigRepository } from "@/lib/config/repository";
import { createConfigReviewToken, draftHash } from "@/lib/security/review-token";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";
import { createSeedConfig } from "@/lib/config/seed";
import { reviewConfigDraft } from "@/lib/race-control/config-review";

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
      if (!(error instanceof ConfigNotActivatedError)) throw error;
      current = createSeedConfig({ resources: { "regular-01": env.REGULAR_SIM_01_CALENDAR_ID, "regular-02": env.REGULAR_SIM_02_CALENDAR_ID, "regular-03": env.REGULAR_SIM_03_CALENDAR_ID, "pro-01": env.PRO_SIM_01_CALENDAR_ID, "ps5-01": env.PS5_01_CALENDAR_ID, "ps5-02": env.PS5_02_CALENDAR_ID } }, now);
    }
    const impact = await reviewConfigDraft(env, current, draft.value, now);
    const baseRevision = draft.value.parentRevision ?? draft.value.revisionId;
    const reviewToken = impact.publishable ? await createConfigReviewToken(env.RACE_CONTROL_TOKEN_ENCRYPTION_KEY, { draftHash: hash, baseRevision, expiresAt }) : null;
    return Response.json({ data: { draftHash: hash, baseRevision, ...impact, impactScanComplete: true, expiresAt, reviewToken }, etag: draft.etag }, { headers });
  } catch (error) {
    const message = error instanceof ConfigUnavailableError ? error.message : "Configuration review is unavailable.";
    return Response.json({ error: { code: "CONFIG_UNAVAILABLE", message, retryable: true } }, { status: 503, headers });
  }
};
