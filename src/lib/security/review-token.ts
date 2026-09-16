import { hashPayload } from "@/lib/booking/id";

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

export async function draftHash(value: unknown): Promise<string> {
  return hashPayload(value);
}
