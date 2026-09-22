import { describe, expect, it } from "vitest";
import { SerializedExecutor } from "../../coordinator/src/serialized-executor";

describe("final-resource concurrency", () => {
  it("allows exactly one of two simultaneous attempts to claim the final resource", async () => {
    const coordinator = new SerializedExecutor();
    let remaining = 1;
    const attempt = () => coordinator.run(async () => {
      const availableAfterAuthoritativeReread = remaining > 0;
      await Promise.resolve();
      if (!availableAfterAuthoritativeReread) return { status: 409 };
      remaining -= 1;
      return { status: 201 };
    });
    const responses = await Promise.all([attempt(), attempt()]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(remaining).toBe(0);
  });
});
