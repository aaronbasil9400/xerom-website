export async function verifyTurnstile(
  secret: string | undefined,
  token: string | undefined,
  remoteIp?: string,
  expectedHostname?: string,
  expectedAction?: string,
): Promise<boolean> {
  if (!secret) return false;
  if (!token) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const data = await response.json<{ success: boolean; hostname?: string; action?: string }>();
    if (!data.success) return false;
    if (expectedHostname && data.hostname !== expectedHostname) return false;
    if (expectedAction && data.action !== expectedAction) return false;
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
