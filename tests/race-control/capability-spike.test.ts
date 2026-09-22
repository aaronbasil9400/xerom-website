import { describe, expect, it } from "vitest";
import { activatePointerConditionally, provisioningMarker, reconcileLostCalendarCreate, type ConditionalObjectStore } from "@/lib/race-control/capability-spike";

class MemoryConditionalStore implements ConditionalObjectStore {
  private value: { body: string; etag: string } | null = null;
  private version = 0;

  async get() {
    if (!this.value) return null;
    const snapshot = this.value;
    return { etag: snapshot.etag, text: async () => snapshot.body };
  }

  async put(_key: string, body: string, condition: { etagMatches?: string; etagDoesNotMatch?: string }) {
    if (condition.etagDoesNotMatch === "*" && this.value) return null;
    if (condition.etagMatches !== undefined && condition.etagMatches !== this.value?.etag) return null;
    this.version += 1;
    this.value = { body, etag: `etag-${this.version}` };
    return { etag: this.value.etag };
  }
}

const pointer = (revisionId: string, operationId: string) => ({
  schemaVersion: 2 as const,
  revisionId,
  activatedAt: "2026-09-16T12:00:00+08:00",
  operationId,
});

describe("Race Control capability spike", () => {
  it("models create-only and compare-and-swap pointer activation", async () => {
    const store = new MemoryConditionalStore();
    const first = await activatePointerConditionally(store, pointer("rev-1", "operation-1"), null);
    expect(first.status).toBe("activated");
    const stale = await activatePointerConditionally(store, pointer("rev-2", "operation-2"), null);
    expect(stale).toMatchObject({ status: "conflict", active: { revisionId: "rev-1" } });
    const updated = await activatePointerConditionally(store, pointer("rev-2", "operation-2"), first.status === "activated" ? first.etag : "");
    expect(updated).toMatchObject({ status: "activated", pointer: { revisionId: "rev-2" } });
  });

  it("reconciles exactly one owner-owned secondary calendar after a lost create response", () => {
    const marker = { operationId: "operation-123", resourceId: "regular-04" };
    const description = `Created by Race Control\n${provisioningMarker(marker)}`;
    expect(reconcileLostCalendarCreate([
      { id: "fixture-calendar", summary: "XEROM — Regular Sim 04", description, primary: false, accessRole: "owner" },
    ], marker)).toEqual({ status: "reconciled", calendarId: "fixture-calendar" });
  });

  it("requires review for ambiguous create reconciliation and ignores primary calendars", () => {
    const marker = { operationId: "operation-123", resourceId: "regular-04" };
    const description = provisioningMarker(marker);
    expect(reconcileLostCalendarCreate([
      { id: "primary", summary: "Primary", description, primary: true, accessRole: "owner" },
      { id: "fixture-a", summary: "A", description, primary: false, accessRole: "owner" },
      { id: "fixture-b", summary: "B", description, primary: false, accessRole: "owner" },
    ], marker)).toEqual({ status: "needs-review", candidateCalendarIds: ["fixture-a", "fixture-b"] });
  });
});
