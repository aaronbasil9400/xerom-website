export interface ProposedWindow { start: string; end: string }
export interface FutureCalendarEvent { eventId: string; resourceId: string; start: string; end: string; bookingId: string | null; recurring: boolean; recurrenceHasNoEnd: boolean }

export interface HoursImpact {
  blocking: boolean;
  conflicts: Array<{ eventId: string; resourceId: string; bookingId: string | null; reason: "outside-proposed-hours" | "recurring-series-needs-review"; start: string; end: string }>;
}

export function reviewHoursImpact(proposedWindowsByBusinessDate: Record<string, ProposedWindow[]>, events: FutureCalendarEvent[]): HoursImpact {
  const conflicts: HoursImpact["conflicts"] = [];
  for (const event of events) {
    if (event.recurring && event.recurrenceHasNoEnd) {
      conflicts.push({ eventId: event.eventId, resourceId: event.resourceId, bookingId: event.bookingId, reason: "recurring-series-needs-review", start: event.start, end: event.end });
      continue;
    }
    const businessDate = event.start.slice(0, 10);
    const windows = proposedWindowsByBusinessDate[businessDate] ?? [];
    if (!windows.some((window) => event.start >= window.start && event.end <= window.end)) conflicts.push({ eventId: event.eventId, resourceId: event.resourceId, bookingId: event.bookingId, reason: "outside-proposed-hours", start: event.start, end: event.end });
  }
  return { blocking: conflicts.length > 0, conflicts };
}
