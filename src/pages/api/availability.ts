import type { APIRoute } from "astro";
import { availabilityQuerySchema } from "@/lib/booking/schema";
import { buildAvailability, generateCandidateSlots } from "@/lib/booking/time";
import { addRecoveryFencesToBusy, allCalendarIds, calendarGroups } from "@/lib/booking/resources";
import { queryFreeBusy } from "@/lib/google/calendar";
import { resolveBookingMode } from "@/lib/booking/mode";
import type { ServiceId } from "@/config/service-core";
import { env as cloudflareEnv } from "cloudflare:workers";

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
});

function mockGroups(): Record<ServiceId, string[]> {
  return {
    "regular-sim": ["regular-1", "regular-2", "regular-3"],
    "pro-sim": ["pro-1"],
    ps5: ["ps5-1", "ps5-2"],
  };
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return json({ error: "Check the date, duration, and quantities." }, 400);
  const requested: Record<ServiceId, number> = {
    "regular-sim": parsed.data.regular,
    "pro-sim": parsed.data.pro,
    ps5: parsed.data.ps5,
  };
  if (!Object.values(requested).some(Boolean)) return json({ error: "Choose at least one experience." }, 400);

  const candidates = generateCandidateSlots(parsed.data.date, parsed.data.durationMinutes);
  const env = cloudflareEnv as unknown as CloudflareEnv;
  const mode = resolveBookingMode(import.meta.env.DEV, env.BOOKING_MODE);
  if (mode === "disabled") return json({ error: "Online booking is being configured. Please WhatsApp Xerom." }, 503);

  try {
    if (mode === "mock") {
      return json({ date: parsed.data.date, durationMinutes: parsed.data.durationMinutes, mode, slots: buildAvailability(candidates, mockGroups(), {}, undefined, requested) });
    }
    const groups = calendarGroups(env);
    const ids = allCalendarIds(env);
    const busy = candidates.length
      ? await queryFreeBusy(env, ids, candidates[0].start, candidates.at(-1)!.end)
      : {};
    if (candidates.length) {
      if (!env.BOOKING_COORDINATOR) throw new Error("Booking coordination is unavailable.");
      const id = env.BOOKING_COORDINATOR.idFromName("xerom-global-booking-coordinator");
      const response = await env.BOOKING_COORDINATOR.get(id).fetch("https://coordinator.internal/recovery-fences", {
        method: "POST",
        headers: { "content-type": "application/json", "x-xerom-command": "recovery-fences" },
        body: JSON.stringify({ start: candidates[0].start, end: candidates.at(-1)!.end }),
      });
      if (!response.ok) throw new Error("Booking recovery state is unavailable.");
      const recovery = await response.json<{ fences?: Array<{ resourceId: string; start: string; end: string }> }>();
      if (!Array.isArray(recovery.fences) || recovery.fences.some((fence) => typeof fence.resourceId !== "string" || !Number.isFinite(Date.parse(fence.start)) || !Number.isFinite(Date.parse(fence.end)))) {
        throw new Error("Booking recovery state is invalid.");
      }
      addRecoveryFencesToBusy(env, busy, recovery.fences);
    }
    return json({
      date: parsed.data.date,
      durationMinutes: parsed.data.durationMinutes,
      mode,
      slots: buildAvailability(candidates, groups, busy, env.BOOKING_CONTROL_CALENDAR_ID, requested),
    });
  } catch (error) {
    console.error("availability_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "Availability is temporarily unavailable. Please try again or WhatsApp Xerom." }, 503);
  }
};
