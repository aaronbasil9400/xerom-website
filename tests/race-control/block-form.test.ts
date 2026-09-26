import { describe, expect, it } from "vitest";
import { activeBlockResources, buildBlockDraft, normalizeBlockResources } from "@/lib/race-control/block-form";
import type { ConfigRevision } from "@/lib/config/schema";

const config = (resources: Array<{ resourceId: string; displayName: string; lifecycle: "active" | "inactive"; calendarRef?: string | null; serviceId: "regular-sim" | "pro-sim" | "ps5" }>): ConfigRevision => ({ resources } as unknown as ConfigRevision);

describe("Race Control block time form", () => {
  it("lists only active, calendar-bound resources alphabetically so newly added rigs appear", () => {
    const options = activeBlockResources(config([
      { resourceId: "regular-01", displayName: "Regular Rig 01", lifecycle: "active", calendarRef: "cal-1", serviceId: "regular-sim" },
      { resourceId: "regular-02", displayName: "Regular Rig 02", lifecycle: "active", calendarRef: "cal-2", serviceId: "regular-sim" },
      { resourceId: "regular-03", displayName: "Regular Rig 03", lifecycle: "active", calendarRef: "cal-3", serviceId: "regular-sim" },
      { resourceId: "pro-01", displayName: "Pro Rig 01", lifecycle: "active", calendarRef: "cal-4", serviceId: "pro-sim" },
      { resourceId: "ps5-01", displayName: "PS5 Lounge 01", lifecycle: "active", calendarRef: "cal-5", serviceId: "ps5" },
      { resourceId: "ps5-02", displayName: "PS5 Lounge 02", lifecycle: "active", calendarRef: "cal-6", serviceId: "ps5" },
      { resourceId: "regular-04", displayName: "Regular Rig 04", lifecycle: "active", calendarRef: "cal-7", serviceId: "regular-sim" },
      { resourceId: "regular-05", displayName: "Regular Rig 05", lifecycle: "inactive", calendarRef: "cal-8", serviceId: "regular-sim" },
      { resourceId: "regular-06", displayName: "Regular Rig 06", lifecycle: "active", calendarRef: null, serviceId: "regular-sim" },
    ]));
    expect(options.map((resource) => resource.resourceId)).toEqual([
      "pro-01",
      "ps5-01",
      "ps5-02",
      "regular-01",
      "regular-02",
      "regular-03",
      "regular-04",
    ]);
  });

  it("targets the booking-control calendar for a venue closure regardless of selection", () => {
    expect(normalizeBlockResources("venue-closure", ["regular-01"])).toEqual(["booking-control"]);
    expect(normalizeBlockResources("maintenance", ["regular-01", "regular-01", "ps5-02"])).toEqual(["regular-01", "ps5-02"]);
  });

  it("rejects an empty resource selection", () => {
    const result = buildBlockDraft({ blockType: "maintenance", selectedResourceIds: [], start: "2026-09-26T20:00", end: "2026-09-26T21:00", reason: "Repair" });
    expect(result).toEqual({ ok: false, message: "Select at least one resource to block." });
  });

  it("requires the end to be after the start", () => {
    const result = buildBlockDraft({ blockType: "maintenance", selectedResourceIds: ["regular-01"], start: "2026-09-26T21:00", end: "2026-09-26T20:00", reason: "Repair" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toBe("The end time must be after the start time.");
  });

  it("requires a reason", () => {
    const result = buildBlockDraft({ blockType: "maintenance", selectedResourceIds: ["regular-01"], start: "2026-09-26T20:00", end: "2026-09-26T21:00", reason: "   " });
    expect(result).toEqual({ ok: false, message: "Add a reason for the block." });
  });

  it("returns a normalized request for a valid maintenance block", () => {
    const result = buildBlockDraft({ blockType: "maintenance", selectedResourceIds: ["regular-01", "ps5-01"], start: "2026-09-26T20:00", end: "2026-09-26T21:00", reason: "Screen swap" });
    expect(result).toEqual({ ok: true, request: { blockType: "maintenance", resourceIds: ["regular-01", "ps5-01"], start: "2026-09-26T20:00", end: "2026-09-26T21:00", reason: "Screen swap" } });
  });

  it("returns a booking-control request for a valid venue closure", () => {
    const result = buildBlockDraft({ blockType: "venue-closure", selectedResourceIds: [], start: "2026-09-26T20:00", end: "2026-09-26T22:00", reason: "Private event" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.request.resourceIds).toEqual(["booking-control"]);
  });
});
