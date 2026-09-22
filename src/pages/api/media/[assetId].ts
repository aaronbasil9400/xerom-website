import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { getConfigRepository } from "@/lib/config/repository";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const assetId = params.assetId ?? "";
  if (!/^hero-[0-9a-f-]{36}$/.test(assetId)) return new Response("Not found", { status: 404 });
  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  if (!env.RACE_CONTROL_MEDIA_BUCKET || !env.RACE_CONTROL_CONFIG_BUCKET) return new Response("Not found", { status: 404 });
  try {
    const { config } = await getConfigRepository(env).readActive();
    if (config.websiteContent.homepage.heroAssetId !== assetId) return new Response("Not found", { status: 404 });
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const object = await env.RACE_CONTROL_MEDIA_BUCKET.get(`media/${assetId}`);
  if (!object?.body) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
};
