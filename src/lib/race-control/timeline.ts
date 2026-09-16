export interface TimelineInterval {
  start: string;
  end: string;
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
