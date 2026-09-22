import { describe, expect, it, vi, afterEach } from "vitest";
import { bookingRecordsToCsv, searchRaceControlBookings } from "@/lib/race-control/bookings";

vi.mock("@/lib/google/calendar", async () => ({
  listCalendarEvents: vi.fn(async (_env: CloudflareEnv, calendarId: string) => calendarId === "regular" ? [
    { id: "event-1", etag: "etag-1", summary: "XR-FIXTURE | Regular", description: "Customer: Test, Driver\nPhone: 012-345 6789\nEmail: driver@example.com\nDuration: 60 minutes\nTotal booking price: RM20", start: "2026-09-16T20:00:00+08:00", end: "2026-09-16T21:00:00+08:00", status: "confirmed", transparency: "opaque", privateProperties: { bookingId: "XR-FIXTURE", status: "confirmed", serviceType: "regular-sim", quantity: "1", createdAt: "2026-09-15T10:00:00Z" } },
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
    expect(result[0].customer).toEqual({ name: "Test, Driver", phone: "012-345 6789", email: "driver@example.com" });
    expect(result[1]).toMatchObject({ bookingId: null, status: "blocked" });
  });

  it("combines phone, service and duration filters", async () => {
    const result = await searchRaceControlBookings({ REGULAR_SIM_01_CALENDAR_ID: "regular" } as CloudflareEnv, "2026-09-16", "2026-09-16", { phone: "12345", serviceId: "regular-sim", durationMinutes: 60 });
    expect(result.map((booking) => booking.bookingId)).toEqual(["XR-FIXTURE"]);
    await expect(searchRaceControlBookings({ REGULAR_SIM_01_CALENDAR_ID: "regular" } as CloudflareEnv, "2026-09-16", "2026-09-16", { durationMinutes: 90 })).resolves.toHaveLength(0);
  });

  it("exports normalized records with RFC 4180 escaping", async () => {
    const result = await searchRaceControlBookings({ REGULAR_SIM_01_CALENDAR_ID: "regular" } as CloudflareEnv, "2026-09-16", "2026-09-16");
    const csv = bookingRecordsToCsv(result);
    expect(csv).toContain('XR-FIXTURE,"Test, Driver",012-345 6789,driver@example.com');
    expect(csv).toContain(",regular-sim,1,0,20,confirmed,");
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});
