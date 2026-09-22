import { describe, expect, it } from "vitest";
import { ConfigPublicationRejectedError, configPublicationOperationId, configPublicationRevisionId, executeConfigPublication, recoverActivatedConfigPublication } from "@/lib/race-control/config-publication";
import { ConfigConflictError, R2ConfigRepository, type ConfigObjectStore } from "@/lib/config/repository";
import { createSeedConfig } from "@/lib/config/seed";
import { createConfigReviewToken, draftHash } from "@/lib/security/review-token";

class MemoryObjectStore implements ConfigObjectStore {
  values = new Map<string, { value: string; etag: string }>();
  private version = 0;
  async get(key: string) { const item = this.values.get(key); return item ? { etag: item.etag, json: async <T>() => JSON.parse(item.value) as T } : null; }
  async head(key: string) { const item = this.values.get(key); return item ? { etag: item.etag } : null; }
  async put(key: string, value: string, options: Parameters<ConfigObjectStore["put"]>[2]) {
    const current = this.values.get(key);
    if (options.onlyIf.etagDoesNotMatch === "*" && current) return null;
    if (options.onlyIf.etagMatches !== undefined && current?.etag !== options.onlyIf.etagMatches) return null;
    const stored = { value, etag: `etag-${++this.version}` };
    this.values.set(key, stored);
    return { etag: stored.etag };
  }
}

const refs = { resources: {
  "regular-01": "fixture-ref-1", "regular-02": "fixture-ref-2", "regular-03": "fixture-ref-3",
  "pro-01": "fixture-ref-4", "ps5-01": "fixture-ref-5", "ps5-02": "fixture-ref-6",
} } as const;
const secret = "fixture-publication-secret";
const publishedAt = "2026-09-23T10:00:00+08:00";
const noConflicts = async () => ({ affectedBookingIds: [], validationErrors: [], scannedEventCount: 0, publishable: true });

async function fixture() {
  const store = new MemoryObjectStore();
  const repository = new R2ConfigRepository(store);
  const draft = createSeedConfig(refs, "2026-09-22T10:00:00+08:00");
  const saved = await repository.saveDraft(draft, null);
  const payloadHash = await draftHash(saved.value);
  const reviewToken = await createConfigReviewToken(secret, { draftHash: payloadHash, baseRevision: draft.revisionId, expiresAt: "2026-09-23T10:05:00+08:00" });
  const command = { opId: "publish_operation_a", expectedRevision: draft.revisionId, draftEtag: saved.etag, reviewToken, payloadHash };
  return { store, repository, draft, command };
}

describe("configuration publication identity", () => {
  it("reuses an operation for a lost response to the same reviewed attempt", async () => {
    const first = await configPublicationOperationId("signed-review-token-a", "draft-etag-a");
    const retry = await configPublicationOperationId("signed-review-token-a", "draft-etag-a");
    expect(retry).toBe(first);
    expect(configPublicationRevisionId(first)).toBe(`rev-${first}`);
  });

  it("creates a new revision identity after a fresh review of identical content", async () => {
    const first = await configPublicationOperationId("signed-review-token-a", "draft-etag-a");
    const reviewedAgain = await configPublicationOperationId("signed-review-token-b", "draft-etag-a");
    expect(reviewedAgain).not.toBe(first);
    expect(configPublicationRevisionId(reviewedAgain)).not.toBe(configPublicationRevisionId(first));
  });

  it("rejects stale draft ETags, hashes, base pointers, and expired review tokens", async () => {
    const cases = [
      { draftEtag: "stale-etag" },
      { payloadHash: "b".repeat(64) },
      { expectedRevision: "stale-revision" },
    ];
    for (const change of cases) {
      const { repository, draft, command } = await fixture();
      await expect(executeConfigPublication({ repository, command: { ...command, ...change }, actorId: "access:owner", reviewSecret: secret, seedConfig: draft, publishedAt, review: noConflicts, onIntent: async () => {} })).rejects.toBeInstanceOf(ConfigPublicationRejectedError);
    }
    const { repository, draft, command } = await fixture();
    await expect(executeConfigPublication({ repository, command, actorId: "access:owner", reviewSecret: secret, seedConfig: draft, publishedAt: "2026-09-23T10:06:00+08:00", review: noConflicts, onIntent: async () => {} })).rejects.toBeInstanceOf(ConfigPublicationRejectedError);
  });

  it("blocks publication when the serialized fresh scan finds a conflict", async () => {
    const { store, repository, draft, command } = await fixture();
    let intentWritten = false;
    await expect(executeConfigPublication({
      repository, command, actorId: "access:owner", reviewSecret: secret, seedConfig: draft, publishedAt,
      review: async () => ({ affectedBookingIds: ["fixture-booking"], validationErrors: [{ path: "hours", message: "Fixture conflict." }], scannedEventCount: 1, publishable: false }),
      onIntent: async () => { intentWritten = true; },
    })).rejects.toMatchObject({ conflicts: [{ path: "hours", message: "Fixture conflict." }] });
    expect(intentWritten).toBe(false);
    expect(store.values.has("active.json")).toBe(false);
  });

  it("retries safely after a failure before immutable revision creation", async () => {
    const { store, repository, draft, command } = await fixture();
    await expect(executeConfigPublication({ repository, command, actorId: "access:owner", reviewSecret: secret, seedConfig: draft, publishedAt, review: noConflicts, onIntent: async () => { throw new Error("fixture journal failure"); } })).rejects.toThrow("fixture journal failure");
    expect([...store.values.keys()].filter((key) => key.startsWith("revisions/"))).toHaveLength(0);
    const result = await executeConfigPublication({ repository, command, actorId: "access:owner", reviewSecret: secret, seedConfig: draft, publishedAt, review: noConflicts, onIntent: async () => {} });
    expect(result.revision.revisionId).toBe("rev-publish_operation_a");
    expect((await repository.readActive()).config.revisionId).toBe(result.revision.revisionId);
  });

  it("recovers a lost response after activation without publishing again", async () => {
    const { store, repository, draft, command } = await fixture();
    const result = await executeConfigPublication({ repository, command, actorId: "access:owner", reviewSecret: secret, seedConfig: draft, publishedAt, review: noConflicts, onIntent: async () => {} });
    const revisionCount = [...store.values.keys()].filter((key) => key.startsWith("revisions/")).length;
    await expect(recoverActivatedConfigPublication(repository, result.revision.revisionId)).resolves.toEqual({ revisionId: result.revision.revisionId, activatedAt: publishedAt });
    expect([...store.values.keys()].filter((key) => key.startsWith("revisions/"))).toHaveLength(revisionCount);
  });

  it("loses a conditional pointer race rather than overwriting another activation", async () => {
    const { repository, draft, command } = await fixture();
    const competing = { ...draft, revisionId: "revision-competing", publishedAt };
    await expect(executeConfigPublication({
      repository, command, actorId: "access:owner", reviewSecret: secret, seedConfig: draft, publishedAt,
      review: async () => {
        await repository.writeImmutableRevision(competing);
        await repository.activate({ schemaVersion: 2, revisionId: competing.revisionId, activatedAt: publishedAt, operationId: "operation-competing" }, null);
        return noConflicts();
      },
      onIntent: async () => {},
    })).rejects.toBeInstanceOf(ConfigConflictError);
    expect((await repository.readActive()).config.revisionId).toBe(competing.revisionId);
  });
});
