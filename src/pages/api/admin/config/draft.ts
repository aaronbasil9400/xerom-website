import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { ConfigConflictError, ConfigNotActivatedError, ConfigUnavailableError, getConfigRepository } from "@/lib/config/repository";
import { configRevisionSchema } from "@/lib/config/schema";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";
import { createSeedConfig } from "@/lib/config/seed";
import type { ConfigRevision } from "@/lib/config/schema";
import { draftHash } from "@/lib/security/review-token";

export const prerender = false;

const headers = { "cache-control": "private, no-store" };

function seedConfig(): ConfigRevision {
  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  return createSeedConfig({ resources: {
    "regular-01": env.REGULAR_SIM_01_CALENDAR_ID,
    "regular-02": env.REGULAR_SIM_02_CALENDAR_ID,
    "regular-03": env.REGULAR_SIM_03_CALENDAR_ID,
    "pro-01": env.PRO_SIM_01_CALENDAR_ID,
    "ps5-01": env.PS5_01_CALENDAR_ID,
    "ps5-02": env.PS5_02_CALENDAR_ID,
  } }, new Date().toISOString());
}

function ownerProjection(config: ConfigRevision) {
  return { ...config, resources: config.resources.map(({ calendarRef, ...resource }) => ({ ...resource, calendarRef: null, calendarManaged: Boolean(calendarRef) })) };
}

export const GET: APIRoute = async () => {
  try {
    const repository = getConfigRepository(cloudflareEnv);
    const [draft, active] = await Promise.all([repository.readDraft(), repository.readActive().catch((error) => error instanceof ConfigNotActivatedError ? null : Promise.reject(error))]);
    const config = draft?.value ?? seedConfig();
    return Response.json({ data: ownerProjection(config), etag: draft?.etag ?? null, draftHash: await draftHash(config), seeded: !draft, activeRevision: active?.config.revisionId ?? null, rollbackAvailable: Boolean(active?.config.parentRevision) }, { headers });
  } catch (error) {
    if (error instanceof ConfigUnavailableError) { const config = seedConfig(); return Response.json({ data: ownerProjection(config), etag: null, draftHash: await draftHash(config), seeded: true, setupRequired: true }, { headers }); }
    return Response.json({ error: { code: "CONFIG_UNAVAILABLE", message: "Draft configuration could not be read.", retryable: true } }, { status: 503, headers });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!verifyOwnerMutationOrigin(request)) return Response.json({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: { code: "CONTENT_TYPE", message: "Send JSON.", retryable: false } }, { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 256_000) return Response.json({ error: { code: "TOO_LARGE", message: "The draft is too large.", retryable: false } }, { status: 413, headers });
  const incoming = await request.json().catch(() => null);
  if (!incoming || typeof incoming !== "object") return Response.json({ error: { code: "INVALID_JSON", message: "The draft is not valid JSON.", retryable: false } }, { status: 400, headers });
  const body = incoming as { config?: unknown; expectedEtag?: unknown };
  let baseline: ConfigRevision;
  try {
    baseline = (await getConfigRepository(cloudflareEnv).readDraft())?.value ?? seedConfig();
  } catch {
    baseline = seedConfig();
  }
  const incomingConfig = body.config && typeof body.config === "object" ? body.config as Record<string, unknown> : null;
  const incomingResources = Array.isArray(incomingConfig?.resources) ? incomingConfig.resources : [];
  const baselineRefs = new Map(baseline.resources.map((resource) => [resource.resourceId, resource.calendarRef]));
  const hydratedConfig = incomingConfig ? { ...incomingConfig, resources: incomingResources.map((resource) => {
    if (!resource || typeof resource !== "object") return resource;
    const candidate = resource as Record<string, unknown>;
    const { calendarManaged: _calendarManaged, calendarRef: _calendarRef, ...editable } = candidate;
    return { ...editable, calendarRef: typeof candidate.resourceId === "string" ? baselineRefs.get(candidate.resourceId) ?? null : null };
  }) } : null;
  const parsed = configRevisionSchema.safeParse(hydratedConfig);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_DRAFT", message: "Review the highlighted settings.", fieldErrors: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })), retryable: false } }, { status: 400, headers });
  const expectedEtag = body.expectedEtag === null || typeof body.expectedEtag === "string" ? body.expectedEtag : undefined;
  if (expectedEtag === undefined) return Response.json({ error: { code: "EXPECTED_VERSION_REQUIRED", message: "Reload the draft before saving.", retryable: false } }, { status: 400, headers });
  try {
    const repository = getConfigRepository(cloudflareEnv);
    const saved = await repository.saveDraft({ ...parsed.data, actorId: locals.owner!.actorId }, expectedEtag);
    return Response.json({ data: ownerProjection(saved.value), etag: saved.etag, draftHash: await draftHash(saved.value) }, { headers });
  } catch (error) {
    if (error instanceof ConfigConflictError) return Response.json({ error: { code: "STALE_DRAFT", message: error.message, retryable: false }, etag: error.currentEtag }, { status: 409, headers });
    return Response.json({ error: { code: "CONFIG_UNAVAILABLE", message: "The draft could not be saved.", retryable: true } }, { status: 503, headers });
  }
};
