export interface RateLimitDecision { allowed: boolean; configured: boolean }

export async function checkRateLimit(binding: RateLimit | undefined, key: string): Promise<RateLimitDecision> {
  if (!binding) return { allowed: true, configured: false };
  const result = await binding.limit({ key });
  return { allowed: result.success, configured: true };
}

export function rateLimitResponse(): Response {
  return Response.json({ error: { code: "RATE_LIMITED", message: "Too many requests. Wait a minute and try again.", retryable: true } }, { status: 429, headers: { "cache-control": "private, no-store", "retry-after": "60" } });
}
