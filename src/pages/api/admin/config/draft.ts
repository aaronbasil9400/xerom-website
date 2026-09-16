import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { ConfigConflictError, ConfigUnavailableError, getConfigRepository } from "@/lib/config/repository";
import { configRevisionSchema } from "@/lib/config/schema";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";

export const prerender = false;

const headers = { "cache-control": "private, no-store" };

export const GET: APIRoute = async () => {
  try {
    const draft = await getConfigRepository(cloudflareEnv).readDraft();
    return Response.json({ data: draft?.value ?? null, etag: draft?.etag ?? null }, { headers });
  } catch (error) {
    return Response.json({ error: { code: "CONFIG_UNAVAILABLE", message: error instanceof ConfigUnavailableError ? error.message : "Draft configuration could not be read.", retryable: true } }, { status: 503, headers });
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!verifyOwnerMutationOrigin(request)) return Response.json({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: { code: "CONTENT_TYPE", message: "Send JSON.", retryable: false } }, { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 256_000) return Response.json({ error: { code: "TOO_LARGE", message: "The draft is too large.", retryable: false } }, { status: 413, headers });
  const incoming = await request.json().catch(() => null);
  if (!incoming || typeof incoming !== "object") return Response.json({ error: { code: "INVALID_JSON", message: "The draft is not valid JSON.", retryable: false } }, { status: 400, headers });
  const body = incoming as { config?: unknown; expectedEtag?: unknown };
  const parsed = configRevisionSchema.safeParse(body.config);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_DRAFT", message: "Review the highlighted settings.", fieldErrors: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })), retryable: false } }, { status: 400, headers });
  const expectedEtag = body.expectedEtag === null || typeof body.expectedEtag === "string" ? body.expectedEtag : undefined;
  if (expectedEtag === undefined) return Response.json({ error: { code: "EXPECTED_VERSION_REQUIRED", message: "Reload the draft before saving.", retryable: false } }, { status: 400, headers });
  try {
    const repository = getConfigRepository(cloudflareEnv);
    const saved = await repository.saveDraft({ ...parsed.data, actorId: locals.owner!.actorId }, expectedEtag);
    return Response.json({ data: saved.value, etag: saved.etag }, { headers });
  } catch (error) {
    if (error instanceof ConfigConflictError) return Response.json({ error: { code: "STALE_DRAFT", message: error.message, retryable: false }, etag: error.currentEtag }, { status: 409, headers });
    return Response.json({ error: { code: "CONFIG_UNAVAILABLE", message: "The draft could not be saved.", retryable: true } }, { status: 503, headers });
  }
};
