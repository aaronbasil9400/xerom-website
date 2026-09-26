export interface TimelineInterval {
  start: string;
  end: string;
}

export interface OrderedResource {
  resourceId: string;
  displayName: string;
}

/** Internal calendars (venue closures, recovery fences) that stay out of the owner-facing schedule grid. */
export const HIDDEN_SCHEDULE_RESOURCE_IDS: readonly string[] = ["booking-control"];

const resourceNameCollator = new Intl.Collator("en-MY", { numeric: true, sensitivity: "base" });

/**
 * Orders rigs and lounges alphabetically for the schedule view (numeric-aware, so
 * "Regular Rig 04" follows "Regular Rig 03" and "Regular Rig 10" follows "Regular Rig 09")
 * and drops internal resource calendars such as venue control.
 */
export function orderScheduleResources<T extends OrderedResource>(resources: readonly T[]): T[] {
  return resources
    .filter((resource) => !HIDDEN_SCHEDULE_RESOURCE_IDS.includes(resource.resourceId))
    .slice()
    .sort((left, right) => resourceNameCollator.compare(left.displayName, right.displayName) || left.resourceId.localeCompare(right.resourceId));
}

export interface TimelineLane<T extends TimelineInterval> {
  event: T;
  lane: number;
}

export interface TimelineLanes<T extends TimelineInterval> {
  items: TimelineLane<T>[];
  laneCount: number;
}

/**
 * Places events in the first free lane. Intervals are half-open, so an event
 * ending at 5:00 PM can reuse the lane of one beginning at 5:00 PM.
 */
export function assignTimelineLanes<T extends TimelineInterval>(events: T[]): TimelineLanes<T> {
  const laneEnds: number[] = [];
  const items: TimelineLane<T>[] = [];

  for (const event of events.slice().sort((left, right) => Date.parse(left.start) - Date.parse(right.start))) {
    const start = Date.parse(event.start);
    const end = Date.parse(event.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    items.push({ event, lane });
  }

  return { items, laneCount: laneEnds.length };
}
