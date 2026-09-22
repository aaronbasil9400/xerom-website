import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { bookingRequestSchema } from "@/lib/booking/schema";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";
import { bookingRecordsToCsv, searchRaceControlBookings } from "@/lib/race-control/bookings";
import { serviceCore, type ServiceId } from "@/config/service-core";
import { resolveRuntimeConfig } from "@/lib/config/runtime";

export const prerender = false;
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" };

export const GET: APIRoute = async ({ request }) => {
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? from;
  const query = params.get("query") ?? "";
  const phone = params.get("phone") ?? "";
  const service = params.get("service") ?? "";
  const durationText = params.get("duration") ?? "";
  const format = params.get("format") ?? "json";
  try {
    const { config } = await resolveRuntimeConfig(cloudflareEnv as typeof cloudflareEnv & CloudflareEnv);
    if (service && !(service in serviceCore)) return new Response(JSON.stringify({ error: { code: "INVALID_FILTER", message: "Choose a valid resource type.", retryable: false } }), { status: 400, headers });
    const durationMinutes = durationText ? Number(durationText) : undefined;
    if (durationMinutes !== undefined && !config.bookingRules.allowedDurationsMinutes.some((allowed) => allowed === durationMinutes)) return new Response(JSON.stringify({ error: { code: "INVALID_FILTER", message: "Choose a valid booking duration.", retryable: false } }), { status: 400, headers });
    if (format !== "json" && format !== "csv") return new Response(JSON.stringify({ error: { code: "INVALID_FORMAT", message: "Choose JSON or CSV.", retryable: false } }), { status: 400, headers });
    const data = await searchRaceControlBookings(cloudflareEnv as typeof cloudflareEnv & CloudflareEnv, from, to, { query, phone, serviceId: service ? service as ServiceId : undefined, durationMinutes });
    if (format === "csv") {
      return new Response(`\uFEFF${bookingRecordsToCsv(data)}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="xerom-bookings-${from}-to-${to}.csv"`, "cache-control": "private, no-store" } });
    }
    return new Response(JSON.stringify({ data }), { headers });
  } catch (error) {
    console.error(JSON.stringify({ message: "race_control_booking_search_failed", error: error instanceof Error ? error.message : "unknown" }));
    return new Response(JSON.stringify({ error: { code: "BOOKINGS_UNAVAILABLE", message: "Bookings could not be loaded.", retryable: true } }), { status: 503, headers });
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!verifyOwnerMutationOrigin(request)) return new Response(JSON.stringify({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again.", retryable: false } }), { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("application/json")) return new Response(JSON.stringify({ error: { code: "CONTENT_TYPE", message: "Send JSON.", retryable: false } }), { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 12_000) return new Response(JSON.stringify({ error: { code: "TOO_LARGE", message: "The booking request is too large.", retryable: false } }), { status: 413, headers });
  const parsed = bookingRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(JSON.stringify({ error: { code: "INVALID_BOOKING", message: "Review the highlighted booking fields.", fieldErrors: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })), retryable: false } }), { status: 400, headers });
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
