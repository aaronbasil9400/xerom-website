import { describe, expect, it } from "vitest";
import { sanitizeCalendarText } from "@/lib/booking/text";

describe("calendar text sanitization", () => {
  it("removes control characters and structured delimiters", () => {
    expect(sanitizeCalendarText("Aaron | test\nPhone: forged\u0000")).toBe("Aaron / test Phone: forged");
  });
});
