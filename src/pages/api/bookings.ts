import type { APIRoute } from "astro";
import { bookingRequestSchema } from "@/lib/booking/schema";
import { calculateTotal } from "@/lib/booking/pricing";
import { createBookingId } from "@/lib/booking/id";
import { verifyTurnstile } from "@/lib/security/turnstile";
import { env as cloudflareEnv } from "cloudflare:workers";

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send a JSON booking request." }, 415);
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 12_000) return json({ error: "Booking request is too large." }, 413);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Booking request was rejected." }, 403);

  let incoming: unknown;
  try { incoming = await request.json(); } catch { return json({ error: "Booking request is not valid JSON." }, 400); }
  const token = typeof incoming === "object" && incoming ? String((incoming as Record<string, unknown>).turnstileToken ?? "") : "";
  const parsed = bookingRequestSchema.safeParse(incoming);
  if (!parsed.success) return json({ error: "Check your booking details.", issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) }, 400);

  const env = cloudflareEnv as unknown as CloudflareEnv;
  const mode = import.meta.env.DEV ? "mock" : (env.BOOKING_MODE ?? "disabled");
  if (mode === "disabled") return json({ error: "Online booking is being configured. Please WhatsApp Xerom." }, 503);

  if (mode === "live") {
    const turnstileOk = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, clientAddress, env.TURNSTILE_EXPECTED_HOSTNAME, env.TURNSTILE_EXPECTED_ACTION);
    if (!turnstileOk) return json({ error: "We could not verify this request. Please try again." }, 403);
    if (!env.BOOKING_COORDINATOR) return json({ error: "Booking coordination is unavailable. Please WhatsApp Xerom." }, 503);
    const id = env.BOOKING_COORDINATOR.idFromName("xerom-global-booking-coordinator");
    const response = await env.BOOKING_COORDINATOR.get(id).fetch("https://coordinator.internal/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    return new Response(response.body, { status: response.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" } });
  }

  const pricing = calculateTotal(parsed.data.items, parsed.data.durationMinutes);
  const end = new Date(Date.parse(parsed.data.start) + parsed.data.durationMinutes * 60_000).toISOString();
  return json({
    bookingId: createBookingId(),
    start: parsed.data.start,
    end,
    durationMinutes: parsed.data.durationMinutes,
    items: parsed.data.items.filter((item) => item.quantity > 0),
    customerName: parsed.data.customer.name,
    total: pricing.total,
    currency: "MYR",
    mock: true,
  }, 201);
};
