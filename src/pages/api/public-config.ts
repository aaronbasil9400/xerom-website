import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { ConfigUnavailableError, getConfigRepository } from "@/lib/config/repository";
import { toPublicConfig } from "@/lib/config/public-projection";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const { config } = await getConfigRepository(cloudflareEnv).readActive();
    return Response.json({ data: toPublicConfig(config), configRevision: config.revisionId }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (!(error instanceof ConfigUnavailableError)) console.error(JSON.stringify({ message: "public_config_failed", error: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: { code: "CONFIG_UNAVAILABLE", message: "Live business information is temporarily unavailable.", retryable: true } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
};
