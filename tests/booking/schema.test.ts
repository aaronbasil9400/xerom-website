import { describe, expect, it } from "vitest";
import { bookingRequestSchema } from "@/lib/booking/schema";
import { resolveBookingMode } from "@/lib/booking/mode";

const valid = {
  start: "2026-09-10T20:00:00+08:00",
  durationMinutes: 60,
  items: [{ serviceId: "regular-sim", quantity: 1 }],
  customer: { name: "Aaron", phone: "+60129401440" },
  idempotencyKey: "8fb920ca-1bfd-4cb3-9d10-d72329ed9d23",
};

describe("booking validation", () => {
  it("accepts a minimal booking", () => expect(bookingRequestSchema.safeParse(valid).success).toBe(true));
  it("normalizes a valid phone number to E.164", () => expect(bookingRequestSchema.parse(valid).customer.phone).toBe("+60129401440"));
  it("rejects no selected resources", () => expect(bookingRequestSchema.safeParse({ ...valid, items: [{ serviceId: "regular-sim", quantity: 0 }] }).success).toBe(false));
  it("rejects duplicate service lines", () => expect(bookingRequestSchema.safeParse({ ...valid, items: [valid.items[0], valid.items[0]] }).success).toBe(false));
  it("rejects controller add-ons on sim rigs", () => expect(bookingRequestSchema.safeParse({ ...valid, items: [{ serviceId: "regular-sim", quantity: 1, additionalControllers: 1 }] }).success).toBe(false));
});

describe("booking runtime mode", () => {
  it("fails closed for an unknown deployed mode", () => {
    expect(resolveBookingMode(false, "enabled")).toBe("disabled");
  });

  it("keeps local development on mock mode", () => {
    expect(resolveBookingMode(true, "live")).toBe("mock");
  });
});
