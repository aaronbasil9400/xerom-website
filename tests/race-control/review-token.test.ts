import { describe, expect, it } from "vitest";
import { createConfigReviewToken, draftHash, verifyConfigReviewToken } from "@/lib/security/review-token";

describe("configuration review tokens", () => {
  it("binds a review to a draft hash, base revision and short expiry", async () => {
    const hash = await draftHash({ revisionId: "draft-1", value: "fixture" });
    const token = await createConfigReviewToken("fixture-secret", { draftHash: hash, baseRevision: "revision-1", expiresAt: "2026-09-16T13:05:00+08:00" });
    expect(token.split(".")).toHaveLength(2);
    expect(token).not.toContain("fixture-secret");
    await expect(verifyConfigReviewToken("fixture-secret", token, Date.parse("2026-09-16T13:00:00+08:00"))).resolves.toMatchObject({ draftHash: hash, baseRevision: "revision-1" });
    await expect(verifyConfigReviewToken("wrong-secret", token, Date.parse("2026-09-16T13:00:00+08:00"))).resolves.toBeNull();
    await expect(verifyConfigReviewToken("fixture-secret", token, Date.parse("2026-09-16T13:06:00+08:00"))).resolves.toBeNull();
  });

  it("fails closed without the encryption secret", async () => {
    await expect(createConfigReviewToken(undefined, { draftHash: "a".repeat(64), baseRevision: "revision-1", expiresAt: "2026-09-16T13:05:00+08:00" })).rejects.toThrow("not configured");
  });
});
