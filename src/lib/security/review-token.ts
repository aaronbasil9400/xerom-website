import { hashPayload } from "@/lib/booking/id";
import { z } from "zod";

const payloadSchema = z.object({
  draftHash: z.string().length(64),
  baseRevision: z.string().min(1),
  expiresAt: z.iso.datetime({ offset: true }),
}).strict();

export type ConfigReviewTokenPayload = z.infer<typeof payloadSchema>;

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createConfigReviewToken(secret: string | undefined, payload: { draftHash: string; baseRevision: string; expiresAt: string }): Promise<string> {
  if (!secret) throw new Error("Review token encryption is not configured.");
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${base64url(signature)}`;
}

function decodeBase64url(value: string): Uint8Array {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function verifyConfigReviewToken(secret: string | undefined, token: string, now = Date.now()): Promise<ConfigReviewTokenPayload | null> {
  if (!secret) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signatureBytes = decodeBase64url(signature);
    const signatureBuffer = signatureBytes.buffer.slice(signatureBytes.byteOffset, signatureBytes.byteOffset + signatureBytes.byteLength) as ArrayBuffer;
    if (!await crypto.subtle.verify("HMAC", key, signatureBuffer, new TextEncoder().encode(body))) return null;
    const parsed = payloadSchema.safeParse(JSON.parse(new TextDecoder().decode(decodeBase64url(body))));
    return parsed.success && Date.parse(parsed.data.expiresAt) > now ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function draftHash(value: unknown): Promise<string> {
  return hashPayload(value);
}
