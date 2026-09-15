import { describe, expect, it } from "vitest";
import { normalizeMalaysianMobile } from "@/lib/booking/phone";

describe("Malaysian mobile numbers", () => {
  it.each([
    ["012-345 6789", "+60123456789"],
    ["011-1234 5678", "+601112345678"],
    ["+60 12 345 6789", "+60123456789"],
    ["+60 11 1234 5678", "+601112345678"],
    ["0060 12 345 6789", "+60123456789"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeMalaysianMobile(input)).toBe(expected);
  });

  it.each([
    "012-345 678",
    "011-1234 567",
    "012-345 67890",
    "03-8765 4321",
    "+44 7700 900123",
    "abc0123456789",
  ])("rejects %s", (input) => {
    expect(normalizeMalaysianMobile(input)).toBeNull();
  });
});
