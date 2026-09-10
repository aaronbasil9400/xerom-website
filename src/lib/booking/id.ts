const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createBookingId(random = crypto.getRandomValues(new Uint8Array(5))): string {
  return `XR-${Array.from(random, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

export async function hashPayload(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
