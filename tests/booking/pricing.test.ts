import { describe, expect, it } from "vitest";
import { calculateTotal } from "@/lib/booking/pricing";

describe("authoritative pricing", () => {
  it("prices mixed two-hour bookings", () => {
    const result = calculateTotal([
      { serviceId: "regular-sim", quantity: 2 },
      { serviceId: "pro-sim", quantity: 1 },
      { serviceId: "ps5", quantity: 0 },
    ], 120);
    expect(result.total).toBe(140);
  });

  it("adds PS5 controllers once per booking", () => {
    expect(calculateTotal([{ serviceId: "ps5", quantity: 1, additionalControllers: 1 }], 120).total).toBe(39);
  });

  it("prices a 30-minute manual session proportionally", () => {
    expect(calculateTotal([{ serviceId: "regular-sim", quantity: 1 }], 30).total).toBe(10);
  });
});
