import { describe, expect, it } from "vitest";
import { bookingRequestSchema, publicBookingRequestSchema } from "@/lib/booking/schema";
import { resolveBookingMode } from "@/lib/booking/mode";

const valid = {
  start: "2026-09-10T20:00:00+08:00",
  durationMinutes: 60,
  items: [{ serviceId: "regular-sim", quantity: 1 }],
  customer: { name: "Aaron", phone: "+60129401440" },
  idempotencyKey: "8fb920ca-1bfd-4cb3-9d10-d72329ed9d23",
  configRevision: "fixture-revision",
};

describe("booking validation", () => {
  it("accepts a minimal booking", () => expect(bookingRequestSchema.safeParse(valid).success).toBe(true));
  it("keeps staff notes available for owner bookings but does not accept notes online", () => {
    const request = { ...valid, customer: { ...valid.customer, notes: "Call on arrival" } };
    expect(bookingRequestSchema.safeParse(request).success).toBe(true);
    expect(publicBookingRequestSchema.safeParse(request).success).toBe(false);
  });
  it("accepts a 30-minute owner booking structurally", () => expect(bookingRequestSchema.safeParse({ ...valid, durationMinutes: 30 }).success).toBe(true));
  it.each([30, 60, 90, 120])("accepts %i-minute public bookings", (durationMinutes) => expect(publicBookingRequestSchema.safeParse({ ...valid, durationMinutes }).success).toBe(true));
  it("requires public bookings to identify the reviewed configuration", () => expect(publicBookingRequestSchema.safeParse({ ...valid, configRevision: undefined }).success).toBe(false));
  it("normalizes a valid phone number to E.164", () => expect(bookingRequestSchema.parse(valid).customer.phone).toBe("+60129401440"));
  it("accepts an optional valid email and rejects an invalid one", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, customer: { ...valid.customer, email: "driver@example.com" } }).success).toBe(true);
    expect(bookingRequestSchema.safeParse({ ...valid, customer: { ...valid.customer, email: "driver@" } }).success).toBe(false);
  });
  it("accepts the 90-minute PS5 command sent to the coordinator", () => {
    const command = {
      ...valid,
      durationMinutes: 90,
      items: [{ serviceId: "ps5", quantity: 1, additionalControllers: 2 }],
      customer: { ...valid.customer, email: "driver@example.com" },
    };
    expect(publicBookingRequestSchema.safeParse(command).success).toBe(true);
    expect(bookingRequestSchema.safeParse(command).success).toBe(true);
  });
  it("rejects no selected resources", () => expect(bookingRequestSchema.safeParse({ ...valid, items: [{ serviceId: "regular-sim", quantity: 0 }] }).success).toBe(false));
  it("rejects duplicate service lines", () => expect(bookingRequestSchema.safeParse({ ...valid, items: [valid.items[0], valid.items[0]] }).success).toBe(false));
  it("rejects controller add-ons on sim rigs", () => expect(bookingRequestSchema.safeParse({ ...valid, items: [{ serviceId: "regular-sim", quantity: 1, additionalControllers: 1 }] }).success).toBe(false));
  it("leaves dynamic resource and controller maximums to active-config validation", () => {
    expect(bookingRequestSchema.safeParse({ ...valid, items: [{ serviceId: "regular-sim", quantity: 4 }] }).success).toBe(true);
    expect(bookingRequestSchema.safeParse({ ...valid, items: [{ serviceId: "ps5", quantity: 1, additionalControllers: 7 }] }).success).toBe(true);
    expect(bookingRequestSchema.safeParse({ ...valid, items: [{ serviceId: "regular-sim", quantity: 65 }] }).success).toBe(false);
  });
});

describe("booking runtime mode", () => {
  it("fails closed for an unknown deployed mode", () => {
    expect(resolveBookingMode(false, "enabled")).toBe("disabled");
  });

  it("keeps local development on mock mode", () => {
    expect(resolveBookingMode(true, "live")).toBe("mock");
  });
});
