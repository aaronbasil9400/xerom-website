import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { loadRaceControlSchedule } from "@/lib/race-control/schedule";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const businessDate = new URL(request.url).searchParams.get("businessDate") ?? "";
  try {
    const data = await loadRaceControlSchedule(cloudflareEnv, businessDate);
    return Response.json({ data, serverNow: data.serverNow }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ message: "race_control_schedule_failed", error: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: { code: "SCHEDULE_UNAVAILABLE", message: "The Calendar schedule could not be loaded.", retryable: true } }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
};
