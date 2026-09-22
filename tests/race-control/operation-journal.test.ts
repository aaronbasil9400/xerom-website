import { describe, expect, it } from "vitest";
import { CommandDispatcher } from "../../coordinator/src/command-dispatcher";
import { OperationJournal, type JournalStorage } from "../../coordinator/src/operation-journal";

class MemoryJournalStorage implements JournalStorage {
  values = new Map<string, unknown>();
  async get<T>(key: string) { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T) { this.values.set(key, value); }
  async list<T>({ prefix }: { prefix: string }) { return new Map([...this.values].filter(([key]) => key.startsWith(prefix))) as Map<string, T>; }
}

const command = (payloadHash = "a".repeat(64)) => ({
  type: "activate-config" as const,
  opId: "operation_123",
  idempotencyKey: "idempotency_123",
  expectedRevision: "revision-1",
  draftEtag: "draft-etag-1",
  reviewToken: "review-token-12345",
  payloadHash,
});

describe("coordinator operation journal", () => {
  it("persists an operation and fences resources before side effects", async () => {
    const storage = new MemoryJournalStorage();
    const journal = new OperationJournal(storage, () => "2026-09-16T12:00:00+08:00");
    const started = await journal.begin(command(), "access:owner", ["regular-01"]);
    expect(started.status).toBe("started");
    expect(await journal.activeFences()).toEqual(new Map([["regular-01", "operation_123"]]));
  });

  it("replays the same payload after restart and rejects a changed payload", async () => {
    const storage = new MemoryJournalStorage();
    await new OperationJournal(storage).begin(command(), "access:owner", []);
    expect((await new OperationJournal(storage).begin(command(), "access:owner", [])).status).toBe("replay");
    expect((await new OperationJournal(storage).begin(command("b".repeat(64)), "access:owner", [])).status).toBe("payload-mismatch");
  });

  it("keeps failed handlers fenced for review and replays their durable state", async () => {
    const storage = new MemoryJournalStorage();
    const dispatcher = new CommandDispatcher(storage, { "activate-config": async () => { throw new Error("fixture failure"); } });
    const first = await dispatcher.dispatch(command(), { actorId: "access:owner", affectedResourceIds: ["regular-01"] });
    expect(first).toMatchObject({ status: 202, body: { state: "needs_review" } });
    expect(await new OperationJournal(storage).activeFences()).toEqual(new Map([["regular-01", "operation_123"]]));
    const replay = await new CommandDispatcher(storage, {}).dispatch(command(), { actorId: "access:owner", affectedResourceIds: [] });
    expect(replay).toMatchObject({ status: 202, body: { state: "needs_review", replayed: true } });
  });
});
