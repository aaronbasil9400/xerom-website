import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { ConfigNotActivatedError, getConfigRepository } from "@/lib/config/repository";
import { mergeActivityRecords, type ActivityRecord } from "@/lib/race-control/activity";

export const prerender = false;
const headers = { "cache-control": "private, no-store" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

async function publicationHistory(env: CloudflareEnv): Promise<ActivityRecord[]> {
  const repository = getConfigRepository(env);
  let config;
  try { config = (await repository.readActive()).config; }
  catch (error) { if (error instanceof ConfigNotActivatedError) return []; throw error; }
  const records: ActivityRecord[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < 50 && config && !seen.has(config.revisionId); index += 1) {
    seen.add(config.revisionId);
    if (config.publishedAt) records.push({
      id: `revision:${config.revisionId}`,
      category: "settings",
      action: "Configuration published",
      state: "succeeded",
      actorId: config.actorId,
      createdAt: config.publishedAt,
      updatedAt: config.publishedAt,
      revisionId: config.revisionId,
    });
    if (!config.parentRevision) break;
    config = await repository.readRevision(config.parentRevision);
  }
  return records;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limitValue = limitParam === null ? 50 : Number(limitParam);
  const limit = Number.isInteger(limitValue) ? Math.max(1, Math.min(limitValue, 100)) : 50;
  const cursor = url.searchParams.get("cursor") ?? undefined;
  if (cursor && (cursor.length > 220 || !/^activity:\d{13}:[A-Za-z0-9:_-]{1,180}$/.test(cursor))) return reply({ error: { message: "The activity page cursor is invalid." } }, 400);
  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  if (!env.BOOKING_COORDINATOR) return reply({ error: { message: "Activity history is unavailable." } }, 503);
  try {
    const id = env.BOOKING_COORDINATOR.idFromName("xerom-global-booking-coordinator");
    const response = await env.BOOKING_COORDINATOR.get(id).fetch("https://coordinator.internal/activity-history", {
      method: "POST",
      headers: { "content-type": "application/json", "x-xerom-command": "activity-history" },
      body: JSON.stringify({ limit, ...(cursor ? { cursor } : {}) }),
    });
    if (!response.ok) return reply({ error: { message: "Activity history could not be loaded." } }, response.status);
    const payload = await response.json() as { data?: ActivityRecord[]; nextCursor?: string | null; recoveryHolds?: Array<{ operationId: string; resourceIds: string[]; start: string; end: string; createdAt: string }>; recoveryHoldsTruncated?: boolean };
    let publications: ActivityRecord[] = [];
    let publicationHistoryUnavailable = false;
    if (!cursor) {
      try { publications = await publicationHistory(env); }
      catch { publicationHistoryUnavailable = true; }
    }
    const data = mergeActivityRecords([...(payload.data ?? []), ...publications]);
    return reply({
      data,
      nextCursor: payload.nextCursor ?? null,
      recoveryHolds: payload.recoveryHolds ?? [],
      recoveryHoldsTruncated: Boolean(payload.recoveryHoldsTruncated),
      publicationHistoryUnavailable,
    });
  } catch (error) {
    console.error(JSON.stringify({ message: "race_control_activity_read_failed", error: error instanceof Error ? error.message : "unknown" }));
    return reply({ error: { message: "Activity history could not be loaded." } }, 503);
  }
};
