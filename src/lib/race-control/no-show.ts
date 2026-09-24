export const NO_SHOW_GRACE_MINUTES = 15;

export function noShowGraceElapsed(start: string, now = Date.now()): boolean {
  const startTime = Date.parse(start);
  return Number.isFinite(startTime) && now >= startTime + NO_SHOW_GRACE_MINUTES * 60_000;
}
