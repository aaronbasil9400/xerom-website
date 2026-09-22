import { describe, expect, it } from "vitest";
import { createSeedConfig } from "@/lib/config/seed";
import { configRevisionSchema } from "@/lib/config/schema";
import { publicConfigSchema, toPublicConfig } from "@/lib/config/public-projection";
import { blockTimeRequestSchema, bookingActionSchema, operationCommandSchema, quoteRequestSchema } from "@/lib/race-control/contracts";

const syntheticCalendarRefs = {
  resources: {
    "regular-01": "fixture-calendar-ref-regular-01",
    "regular-02": "fixture-calendar-ref-regular-02",
    "regular-03": "fixture-calendar-ref-regular-03",
    "pro-01": "fixture-calendar-ref-pro-01",
    "ps5-01": "fixture-calendar-ref-ps5-01",
    "ps5-02": "fixture-calendar-ref-ps5-02",
  },
} as const;

describe("Race Control shared contracts", () => {
  it("migrates confirmed seed values without enabling unresolved offers", () => {
    const seed = createSeedConfig(syntheticCalendarRefs);
    expect(configRevisionSchema.parse(seed).promotions).toEqual([]);
    expect(seed.rates.map((rate) => rate.amountSenPerResourceHour)).toEqual([2_000, 3_000, 1_800]);
    expect(seed.bookingRules.allowedDurationsMinutes).toEqual([30, 60, 90, 120]);
    expect(seed.resources).toHaveLength(6);
  });

  it("fails an active resource closed when its private calendar mapping is absent", () => {
    const seed = createSeedConfig(syntheticCalendarRefs);
    const invalid = { ...seed, resources: seed.resources.map((resource, index) => index === 0 ? { ...resource, calendarRef: null } : resource) };
    expect(configRevisionSchema.safeParse(invalid).success).toBe(false);
  });

  it("constructs the public projection from an allowlist", () => {
    const projected = toPublicConfig(createSeedConfig(syntheticCalendarRefs));
    expect(publicConfigSchema.parse(projected).services[0].activeResourceCount).toBe(3);
    expect(JSON.stringify(projected)).not.toContain("calendarRef");
    expect(JSON.stringify(projected)).not.toContain("fixture-calendar-ref");
    expect(JSON.stringify(projected)).not.toContain("actorId");
  });

  it("rejects browser-supplied quote totals and unknown admin fields", () => {
    expect(quoteRequestSchema.safeParse({
      items: [{ serviceId: "regular-sim", quantity: 1 }],
      start: "2026-09-16T20:00:00+08:00",
      durationMinutes: 60,
      channel: "public",
      total: 1,
    }).success).toBe(false);
  });

  it("uses discriminated booking actions and operation commands", () => {
    expect(bookingActionSchema.safeParse({ action: "cancel", expected: { bookingId: "booking_123", version: 2 }, reason: "Owner-confirmed cancellation" }).success).toBe(true);
    expect(operationCommandSchema.safeParse({ type: "activate-config", opId: "operation_123", idempotencyKey: "attempt_123", expectedRevision: "rev-1", draftEtag: "draft-etag-1", reviewToken: "review-token-12345", payloadHash: "a".repeat(64) }).success).toBe(true);
    expect(blockTimeRequestSchema.safeParse({ blockType: "maintenance", resourceIds: ["regular-01"], start: "2026-09-16T20:00:00+08:00", end: "2026-09-16T21:00:00+08:00", reason: "Fixture maintenance", idempotencyKey: "attempt_123" }).success).toBe(true);
    expect(blockTimeRequestSchema.safeParse({ blockType: "venue-closure", resourceIds: ["regular-01"], start: "2026-09-16T20:00:00+08:00", end: "2026-09-16T21:00:00+08:00", reason: "Fixture closure", idempotencyKey: "attempt_123" }).success).toBe(false);
  });
});
