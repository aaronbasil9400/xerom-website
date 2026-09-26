import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { bookingActionSchema } from "@/lib/race-control/contracts";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";

export const prerender = false;
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" };

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!verifyOwnerMutationOrigin(request)) return new Response(JSON.stringify({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }), { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return new Response(JSON.stringify({ error: { code: "CONTENT_TYPE", message: "Send JSON.", retryable: false } }), { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 12_000) return new Response(JSON.stringify({ error: { code: "TOO_LARGE", message: "The action request is too large.", retryable: false } }), { status: 413, headers });
  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  const coordinator = env.BOOKING_COORDINATOR;
  if (!coordinator) return new Response(JSON.stringify({ error: { code: "COORDINATOR_UNAVAILABLE", message: "Booking coordination is unavailable.", retryable: true } }), { status: 503, headers });
  const body = await request.json().catch(() => null) as { action?: unknown; idempotencyKey?: unknown } | null;
  const action = bookingActionSchema.safeParse(body?.action);
  if (!action.success || action.data.expected.bookingId !== params.id || typeof body?.idempotencyKey !== "string") return new Response(JSON.stringify({ error: { code: "INVALID_ACTION", message: "Review the booking action.", retryable: false } }), { status: 400, headers });
  const id = coordinator.idFromName("xerom-global-booking-coordinator");
  const response = await coordinator.get(id).fetch("https://coordinator.internal/booking-action", {
    method: "POST",
    headers: { "content-type": "application/json", "x-xerom-command": "booking-action", "x-xerom-actor-id": locals.owner!.actorId },
    body: JSON.stringify({ action: action.data, idempotencyKey: body.idempotencyKey }),
  });
  return new Response(response.body, { status: response.status, headers });
};
