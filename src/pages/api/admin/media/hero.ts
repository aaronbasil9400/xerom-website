import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { verifyOwnerMutationOrigin } from "@/lib/security/owner";
import { heroImageRequirements, validateHeroImage } from "@/lib/media/image-validation";

export const prerender = false;
const headers = { "cache-control": "private, no-store" };

export const POST: APIRoute = async ({ request }) => {
  if (!verifyOwnerMutationOrigin(request)) return Response.json({ error: { code: "CSRF_REJECTED", message: "Refresh Race Control and try again." } }, { status: 403, headers });
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) return Response.json({ error: { code: "CONTENT_TYPE", message: "Choose an image file to upload." } }, { status: 415, headers });
  if (Number(request.headers.get("content-length") ?? 0) > heroImageRequirements.maximumBytes + 128_000) return Response.json({ error: { code: "TOO_LARGE", message: "The hero image must be no larger than 8 MB." } }, { status: 413, headers });
  const env = cloudflareEnv as typeof cloudflareEnv & CloudflareEnv;
  if (!env.RACE_CONTROL_MEDIA_BUCKET) return Response.json({ error: { code: "MEDIA_STORAGE_UNAVAILABLE", message: "Private media storage is not bound. R2 activation still requires owner approval." } }, { status: 503, headers });
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return Response.json({ error: { code: "IMAGE_REQUIRED", message: "Choose a hero image." } }, { status: 400, headers });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dimensions = validateHeroImage(bytes, file.type);
    const assetId = `hero-${crypto.randomUUID()}`;
    await env.RACE_CONTROL_MEDIA_BUCKET.put(`media/${assetId}`, bytes, { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { width: String(dimensions.width), height: String(dimensions.height), originalName: file.name.slice(0, 180) } });
    const verified = await env.RACE_CONTROL_MEDIA_BUCKET.head(`media/${assetId}`);
    if (!verified) throw new Error("The uploaded image could not be verified.");
    return Response.json({ data: { assetId, url: `/api/media/${assetId}`, ...dimensions } }, { status: 201, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The hero image could not be uploaded.";
    const validation = /JPEG|PNG|WebP|8 MB|pixels|16:9|could not be read/.test(message);
    return Response.json({ error: { code: validation ? "INVALID_IMAGE" : "UPLOAD_FAILED", message } }, { status: validation ? 400 : 503, headers });
  }
};
