import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { toPublicConfig } from "@/lib/config/public-projection";
import { resolveRuntimeConfig } from "@/lib/config/runtime";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const { config, compiledFallback } = await resolveRuntimeConfig(cloudflareEnv);
    return Response.json({ data: toPublicConfig(config), configRevision: config.revisionId, compiledFallback }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ message: "public_config_failed", error: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: { code: "CONFIG_UNAVAILABLE", message: "Live business information is temporarily unavailable.", retryable: true } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
};
