import { CalendarMutationUncertainError, type CalendarEventPatch, type CalendarEventRecord } from "../../src/lib/google/calendar";

export interface GroupedMutationStep {
  calendarId: string;
  event: CalendarEventRecord;
  patch: CalendarEventPatch;
  restore: CalendarEventPatch;
}

export type PatchCalendarEvent = (
  calendarId: string,
  eventId: string,
  patch: CalendarEventPatch,
  etag: string,
) => Promise<CalendarEventRecord>;

export class GroupedMutationError extends Error {
  constructor(
    message: string,
    readonly compensationFailed: boolean,
    readonly appliedCount: number,
  ) {
    super(message);
  }
}

export type BookingActionName = "check-in" | "complete" | "no-show" | "cancel" | "reschedule" | "extend";

export function lifecycleTransitionAllowed(status: string, action: BookingActionName): boolean {
  const allowed: Record<BookingActionName, string[]> = {
    "check-in": ["confirmed"],
    complete: ["checked_in"],
    "no-show": ["confirmed"],
    cancel: ["confirmed", "checked_in"],
    reschedule: ["confirmed"],
    extend: ["confirmed", "checked_in"],
  };
  return allowed[action].includes(status);
}

export async function applyGroupedMutation(steps: GroupedMutationStep[], patchEvent: PatchCalendarEvent): Promise<CalendarEventRecord[]> {
  const applied: Array<{ step: GroupedMutationStep; updated: CalendarEventRecord }> = [];
  try {
    for (const step of steps) {
      const updated = await patchEvent(step.calendarId, step.event.id, step.patch, step.event.etag);
      applied.push({ step, updated });
    }
    return applied.map(({ updated }) => updated);
  } catch (error) {
    let compensationFailed = error instanceof CalendarMutationUncertainError;
    for (const { step, updated } of applied.reverse()) {
      try {
        await patchEvent(step.calendarId, step.event.id, step.restore, updated.etag);
      } catch {
        compensationFailed = true;
      }
    }
    throw new GroupedMutationError(
      error instanceof Error ? error.message : "Grouped Calendar mutation failed.",
      compensationFailed,
      applied.length,
    );
  }
}
