export type ActivityCategory = "booking" | "block" | "settings";
export type ActivityState = "running" | "succeeded" | "failed" | "needs_review";

export interface ActivityRecord {
  id: string;
  category: ActivityCategory;
  action: string;
  state: ActivityState;
  actorId: string;
  createdAt: string;
  updatedAt: string;
  bookingId?: string;
  resourceIds?: string[];
  start?: string;
  end?: string;
  revisionId?: string;
}

const MAX_TIMESTAMP = 9_999_999_999_999;
export const ACTIVITY_RETENTION_DAYS = 30;

export function activityStorageKey(createdAt: string, id: string): string {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp) || !/^[A-Za-z0-9:_-]{1,180}$/.test(id)) throw new Error("Invalid activity identity.");
  return `activity:${String(MAX_TIMESTAMP - timestamp).padStart(13, "0")}:${id}`;
}

export function activityNeedsAttention(record: ActivityRecord, now = Date.now()): boolean {
  return record.state === "needs_review" || record.state === "failed" || (record.state === "running" && now - Date.parse(record.updatedAt) > 5 * 60_000);
}

export function activityExpired(record: ActivityRecord, now = Date.now()): boolean {
  return (record.state === "succeeded" || record.state === "failed")
    && now - Date.parse(record.createdAt) > ACTIVITY_RETENTION_DAYS * 24 * 60 * 60_000;
}

export function mergeActivityRecords(records: ActivityRecord[]): ActivityRecord[] {
  const byId = new Map<string, ActivityRecord>();
  for (const record of records) {
    const key = record.category === "settings" && record.revisionId ? `revision:${record.revisionId}` : record.id;
    const existing = byId.get(key);
    if (!existing || record.updatedAt > existing.updatedAt) byId.set(key, record);
  }
  return [...byId.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));
}
