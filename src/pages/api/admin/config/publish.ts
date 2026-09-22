import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { z } from "zod";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";
import { configPublicationOperationId } from "@/lib/race-control/config-publication";

export const prerender = false;
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" };
const requestSchema = z.object({
  draftHash: z.string().length(64),
  draftEtag: z.string().min(1),
  baseRevision: z.string().min(1),
  reviewToken: z.string().min(16),
}).strict();

export const POST: APIRoute = async ({ request, locals }) => {
  if (!verifyOwnerMutationOrigin(request)) return Response.json({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: { code: "CONTENT_TYPE", message: "Send JSON.", retryable: false } }, { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 16_000) return Response.json({ error: { code: "TOO_LARGE", message: "The publication request is too large.", retryable: false } }, { status: 413, headers });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "INVALID_PUBLICATION", message: "Review the current draft again before publishing.", retryable: false } }, { status: 400, headers });
  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  if (!env.BOOKING_COORDINATOR) return Response.json({ error: { code: "COORDINATOR_UNAVAILABLE", message: "Configuration publication is unavailable.", retryable: true } }, { status: 503, headers });
  const opId = await configPublicationOperationId(parsed.data.reviewToken, parsed.data.draftEtag);
  const command = {
    type: "activate-config",
    opId,
    idempotencyKey: opId,
    expectedRevision: parsed.data.baseRevision,
    draftEtag: parsed.data.draftEtag,
    reviewToken: parsed.data.reviewToken,
    payloadHash: parsed.data.draftHash,
  };
  try {
    const id = env.BOOKING_COORDINATOR.idFromName("xerom-global-booking-coordinator");
    const response = await env.BOOKING_COORDINATOR.get(id).fetch("https://coordinator.internal/activate-config", {
      method: "POST",
      headers: { "content-type": "application/json", "x-xerom-command": "activate-config", "x-xerom-actor-id": locals.owner!.actorId },
      body: JSON.stringify(command),
    });
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    console.error(JSON.stringify({ message: "config_publish_coordinator_unavailable", operationId: opId, error: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: { code: "COORDINATOR_UNAVAILABLE", message: "Configuration publication could not be confirmed. Retry this same reviewed publication attempt.", retryable: true }, operationId: opId }, { status: 503, headers });
  }
};
