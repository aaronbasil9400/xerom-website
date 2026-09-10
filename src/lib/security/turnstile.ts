export async function verifyTurnstile(secret: string | undefined, token: string | undefined, remoteIp?: string): Promise<boolean> {
  if (!secret) return false;
  if (!token) return false;
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) }),
  });
  if (!response.ok) return false;
  const data = await response.json<{ success: boolean }>();
  return data.success;
}
