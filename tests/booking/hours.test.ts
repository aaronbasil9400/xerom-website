import { describe, expect, it } from "vitest";
import { openingHours } from "@/config/hours";

describe("published opening hours", () => {
  it("groups the owner-confirmed hours for display", () => {
    expect(openingHours).toEqual([
      { days: "Monday–Thursday", hours: "2PM – 1AM" },
      { days: "Friday–Sunday", hours: "12PM – 1AM" },
    ]);
  });
});
