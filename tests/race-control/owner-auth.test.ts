import { describe, expect, it } from "vitest";
import { verifyOwnerMutationOrigin, verifyOwnerRequest } from "@/lib/security/owner";

const env = {
  ACCESS_TEAM_DOMAIN: "https://xerom-example.cloudflareaccess.com",
  ACCESS_AUDIENCE: "audience-123",
  OWNER_EMAILS: "owner@example.test",
};

describe("owner authentication", () => {
  it("fails closed when Access configuration or assertion is absent", async () => {
    expect(await verifyOwnerRequest(new Request("https://example.test/race-control"), env)).toBeNull();
    expect(await verifyOwnerRequest(new Request("https://example.test/race-control", { headers: { "Cf-Access-Jwt-Assertion": "token" } }), {})).toBeNull();
  });

  it("requires the verified identity to match the exact owner allowlist", async () => {
    const request = new Request("https://example.test/race-control", { headers: { "Cf-Access-Jwt-Assertion": "token" } });
    const allowed = await verifyOwnerRequest(request, env, async (_token, options) => {
      expect(options).toMatchObject({ issuer: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUDIENCE });
      return { sub: "subject-1", email: "OWNER@example.test" };
    });
    expect(allowed).toEqual({ actorId: "access:subject-1", email: "owner@example.test", subject: "subject-1" });
    expect(await verifyOwnerRequest(request, env, async () => ({ sub: "subject-2", email: "other@example.test" }))).toBeNull();
  });

  it("rejects cross-origin or form-like owner mutations", () => {
    expect(verifyOwnerMutationOrigin(new Request("https://example.test/api/admin/config/draft", {
      method: "PUT",
      headers: { Origin: "https://example.test", "Sec-Fetch-Site": "same-origin", "X-Xerom-CSRF": "race-control-v1" },
    }))).toBe(true);
    expect(verifyOwnerMutationOrigin(new Request("https://example.test/api/admin/config/draft", {
      method: "PUT",
      headers: { Origin: "https://evil.test", "Sec-Fetch-Site": "cross-site", "X-Xerom-CSRF": "race-control-v1" },
    }))).toBe(false);
  });
});
