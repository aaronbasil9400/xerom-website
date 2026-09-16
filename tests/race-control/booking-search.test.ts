import { describe, expect, it, vi, afterEach } from "vitest";
import { searchRaceControlBookings } from "@/lib/race-control/bookings";

vi.mock("@/lib/google/calendar", async () => ({
  listCalendarEvents: vi.fn(async (_env: CloudflareEnv, calendarId: string) => calendarId === "regular" ? [
    { id: "event-1", etag: "etag-1", summary: "XR-FIXTURE | Regular", description: "", start: "2026-09-16T20:00:00+08:00", end: "2026-09-16T21:00:00+08:00", status: "confirmed", transparency: "opaque", privateProperties: { bookingId: "XR-FIXTURE", status: "confirmed" } },
    { id: "block-1", etag: "etag-2", summary: "Manual block", description: "", start: "2026-09-16T21:00:00+08:00", end: "2026-09-16T22:00:00+08:00", status: "confirmed", transparency: "opaque", privateProperties: {} },
  ] : []),
}));

afterEach(() => vi.restoreAllMocks());

describe("bounded booking search", () => {
  it("rejects invalid or reversed date bounds", async () => {
    await expect(searchRaceControlBookings({} as CloudflareEnv, "2026-09-17", "2026-09-16")).rejects.toThrow("invalid");
  });

  it("groups private booking events and keeps manual blocks separate", async () => {
    const result = await searchRaceControlBookings({ REGULAR_SIM_01_CALENDAR_ID: "regular" } as CloudflareEnv, "2026-09-16", "2026-09-16");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ bookingId: "XR-FIXTURE", eventCount: 1 });
    expect(result[1]).toMatchObject({ bookingId: null, status: "blocked" });
  });
});
