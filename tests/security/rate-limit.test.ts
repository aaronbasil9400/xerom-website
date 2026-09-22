import { describe, expect, it, vi } from "vitest";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

describe("rate limit adapter", () => {
  it("fails open only when an optional binding is not configured", async () => {
    await expect(checkRateLimit(undefined, "fixture")).resolves.toEqual({ allowed: true, configured: false });
  });
  it("uses the Cloudflare binding decision", async () => {
    const binding = { limit: vi.fn().mockResolvedValue({ success: false }) } as unknown as RateLimit;
    await expect(checkRateLimit(binding, "owner:fixture")).resolves.toEqual({ allowed: false, configured: true });
    expect(binding.limit).toHaveBeenCalledWith({ key: "owner:fixture" });
    const response = rateLimitResponse(); expect(response.status).toBe(429); expect(response.headers.get("retry-after")).toBe("60");
  });
});
