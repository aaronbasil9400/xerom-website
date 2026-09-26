import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { blockTimeRequestSchema, blockRemovalRequestSchema } from "@/lib/race-control/contracts";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";

export const prerender = false;
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" };

export const POST: APIRoute = async ({ request, locals }) => {
  if (!verifyOwnerMutationOrigin(request)) return new Response(JSON.stringify({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }), { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return new Response(JSON.stringify({ error: { code: "CONTENT_TYPE", message: "Send JSON.", retryable: false } }), { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 12_000) return new Response(JSON.stringify({ error: { code: "TOO_LARGE", message: "The block request is too large.", retryable: false } }), { status: 413, headers });
  const parsed = blockTimeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(JSON.stringify({ error: { code: "INVALID_BLOCK", message: "Review the block interval and affected resources.", retryable: false } }), { status: 400, headers });
  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  const coordinator = env.BOOKING_COORDINATOR;
  if (!coordinator) return new Response(JSON.stringify({ error: { code: "COORDINATOR_UNAVAILABLE", message: "Booking coordination is unavailable.", retryable: true } }), { status: 503, headers });
  const id = coordinator.idFromName("xerom-global-booking-coordinator");
  const response = await coordinator.get(id).fetch("https://coordinator.internal/block-time", {
    method: "POST",
    headers: { "content-type": "application/json", "x-xerom-command": "block-time", "x-xerom-actor-id": locals.owner!.actorId },
    body: JSON.stringify(parsed.data),
  });
  return new Response(response.body, { status: response.status, headers });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!verifyOwnerMutationOrigin(request)) return new Response(JSON.stringify({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }), { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return new Response(JSON.stringify({ error: { code: "CONTENT_TYPE", message: "Send JSON.", retryable: false } }), { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 12_000) return new Response(JSON.stringify({ error: { code: "TOO_LARGE", message: "The block removal request is too large.", retryable: false } }), { status: 413, headers });
  const parsed = blockRemovalRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(JSON.stringify({ error: { code: "INVALID_BLOCK_REMOVAL", message: "Review the block interval and affected resources.", retryable: false } }), { status: 400, headers });
  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  const coordinator = env.BOOKING_COORDINATOR;
  if (!coordinator) return new Response(JSON.stringify({ error: { code: "COORDINATOR_UNAVAILABLE", message: "Booking coordination is unavailable.", retryable: true } }), { status: 503, headers });
  const id = coordinator.idFromName("xerom-global-booking-coordinator");
  const response = await coordinator.get(id).fetch("https://coordinator.internal/remove-block", {
    method: "POST",
    headers: { "content-type": "application/json", "x-xerom-command": "remove-block", "x-xerom-actor-id": locals.owner!.actorId },
    body: JSON.stringify(parsed.data),
  });
  return new Response(response.body, { status: response.status, headers });
};
