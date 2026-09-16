import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { bookingRequestSchema } from "@/lib/booking/schema";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";

export const prerender = false;
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" };

export const POST: APIRoute = async ({ request }) => {
  if (!verifyOwnerMutationOrigin(request)) return new Response(JSON.stringify({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }), { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return new Response(JSON.stringify({ error: { code: "CONTENT_TYPE", message: "Send JSON.", retryable: false } }), { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 12_000) return new Response(JSON.stringify({ error: { code: "TOO_LARGE", message: "The booking request is too large.", retryable: false } }), { status: 413, headers });
  const parsed = bookingRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(JSON.stringify({ error: { code: "INVALID_BOOKING", message: "Review the booking details.", fieldErrors: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })), retryable: false } }), { status: 400, headers });
  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  if (!env.BOOKING_COORDINATOR) return new Response(JSON.stringify({ error: { code: "COORDINATOR_UNAVAILABLE", message: "Booking coordination is unavailable.", retryable: true } }), { status: 503, headers });
  const id = env.BOOKING_COORDINATOR.idFromName("xerom-global-booking-coordinator");
  const response = await env.BOOKING_COORDINATOR.get(id).fetch("https://coordinator.internal/book", {
    method: "POST",
    headers: { "content-type": "application/json", "x-xerom-source": "race-control-owner" },
    body: JSON.stringify(parsed.data),
  });
  return new Response(response.body, { status: response.status, headers });
};
