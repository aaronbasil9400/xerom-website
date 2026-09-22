import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { z } from "zod";
import { ConfigConflictError, ConfigUnavailableError, getConfigRepository } from "@/lib/config/repository";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";
import { draftHash } from "@/lib/security/review-token";
import type { ConfigRevision } from "@/lib/config/schema";

export const prerender = false;
const headers = { "cache-control": "private, no-store" };
const requestSchema = z.object({ expectedDraftEtag: z.string().min(1) }).strict();
const ownerProjection = (config: ConfigRevision) => ({ ...config, resources: config.resources.map(({ calendarRef, ...resource }) => ({ ...resource, calendarRef: null, calendarManaged: Boolean(calendarRef) })) });

export const POST: APIRoute = async ({ request, locals }) => {
  if (!verifyOwnerMutationOrigin(request)) return Response.json({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: { code: "CONTENT_TYPE", message: "Send JSON.", retryable: false } }, { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 8_000) return Response.json({ error: { code: "TOO_LARGE", message: "The rollback request is too large.", retryable: false } }, { status: 413, headers });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "INVALID_ROLLBACK", message: "Reload settings before preparing a rollback.", retryable: false } }, { status: 400, headers });
  try {
    const repository = getConfigRepository(cloudflareEnv);
    const active = await repository.readActive();
    if (!active.config.parentRevision) return Response.json({ error: { code: "ROLLBACK_UNAVAILABLE", message: "There is no previous published revision to restore.", retryable: false } }, { status: 409, headers });
    const previous = await repository.readRevision(active.config.parentRevision);
    if (!previous) throw new ConfigUnavailableError("The previous configuration revision is unavailable.");
    const currentResources = new Map(active.config.resources.map((resource) => [resource.resourceId, resource]));
    const previousIds = new Set(previous.resources.map((resource) => resource.resourceId));
    const restoredResources = previous.resources.map((resource) => {
      const current = currentResources.get(resource.resourceId);
      return current
        ? { ...resource, calendarRef: current.calendarRef, activeFrom: current.activeFrom }
        : { ...resource, lifecycle: "draft" as const, calendarRef: null, activeFrom: null, retiredFrom: null };
    });
    const preservedNewResources = active.config.resources.filter((resource) => !previousIds.has(resource.resourceId)).map((resource) => ({
      ...resource,
      lifecycle: "retired" as const,
      retiredFrom: resource.retiredFrom ?? new Date().toISOString(),
    }));
    const prepared = { ...previous, resources: [...restoredResources, ...preservedNewResources], revisionId: `rollback-${active.config.revisionId.slice(0, 40)}`, parentRevision: active.config.revisionId, publishedAt: null, actorId: locals.owner!.actorId };
    const saved = await repository.saveDraft(prepared, parsed.data.expectedDraftEtag);
    return Response.json({ data: ownerProjection(saved.value), etag: saved.etag, draftHash: await draftHash(saved.value), rollbackFrom: active.config.revisionId, rollbackTo: previous.revisionId }, { headers });
  } catch (error) {
    if (error instanceof ConfigConflictError) return Response.json({ error: { code: "STALE_DRAFT", message: "The draft changed in another session. Reload before preparing rollback.", retryable: false }, etag: error.currentEtag }, { status: 409, headers });
    return Response.json({ error: { code: "ROLLBACK_UNAVAILABLE", message: error instanceof ConfigUnavailableError ? error.message : "Rollback could not be prepared.", retryable: true } }, { status: 503, headers });
  }
};
