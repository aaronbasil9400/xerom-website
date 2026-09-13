export const bookingRules = {
  timezone: "Asia/Kuala_Lumpur",
  slotIntervalMinutes: 60,
  allowedDurationsMinutes: [60, 120] as const,
  minimumNoticeMinutes: 60,
  maximumAdvanceMinutes: 72 * 60,
  bufferMinutes: 0,
  // Owner-confirmed 2026-09-12: Mon–Thu 14:00–01:00, Fri–Sun 12:00–01:00. Source of truth for availability and published hours.
  weeklyHours: {
    0: [{ open: "12:00", close: "25:00" }],
    1: [{ open: "14:00", close: "25:00" }],
    2: [{ open: "14:00", close: "25:00" }],
    3: [{ open: "14:00", close: "25:00" }],
    4: [{ open: "14:00", close: "25:00" }],
    5: [{ open: "12:00", close: "25:00" }],
    6: [{ open: "12:00", close: "25:00" }],
  },
} as const;
