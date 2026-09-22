import { describe, expect, it } from "vitest";
import { ConfigConflictError, ConfigNotActivatedError, ConfigUnavailableError, R2ConfigRepository, type ConfigObjectStore } from "@/lib/config/repository";
import { createSeedConfig } from "@/lib/config/seed";

class MemoryObjectStore implements ConfigObjectStore {
  private values = new Map<string, { value: string; etag: string }>();
  private version = 0;
  remove(key: string) { this.values.delete(key); }

  async get(key: string) {
    const item = this.values.get(key);
    if (!item) return null;
    return { etag: item.etag, json: async <T>() => JSON.parse(item.value) as T };
  }

  async head(key: string) {
    const item = this.values.get(key);
    return item ? { etag: item.etag } : null;
  }

  async put(key: string, value: string, options: Parameters<ConfigObjectStore["put"]>[2]) {
    const current = this.values.get(key);
    if (options.onlyIf.etagDoesNotMatch === "*" && current) return null;
    if (options.onlyIf.etagMatches !== undefined && current?.etag !== options.onlyIf.etagMatches) return null;
    this.version += 1;
    const stored = { value, etag: `etag-${this.version}` };
    this.values.set(key, stored);
    return { etag: stored.etag };
  }
}

const refs = { resources: {
  "regular-01": "fixture-ref-1", "regular-02": "fixture-ref-2", "regular-03": "fixture-ref-3",
  "pro-01": "fixture-ref-4", "ps5-01": "fixture-ref-5", "ps5-02": "fixture-ref-6",
} } as const;

describe("R2 config repository contract", () => {
  it("distinguishes an empty bootstrap bucket from a broken active revision", async () => {
    const store = new MemoryObjectStore();
    const repository = new R2ConfigRepository(store);
    await expect(repository.readActive()).rejects.toBeInstanceOf(ConfigNotActivatedError);
    const revision = { ...createSeedConfig(refs), revisionId: "revision-1", publishedAt: "2026-09-16T13:00:00+08:00" };
    await repository.writeImmutableRevision(revision);
    await repository.activate({ schemaVersion: 2, revisionId: revision.revisionId, activatedAt: "2026-09-16T13:00:01+08:00", operationId: "operation-123" }, null);
    store.remove(`revisions/${revision.revisionId}.json`);
    const failure = repository.readActive().catch((error) => error);
    await expect(failure).resolves.toBeInstanceOf(ConfigUnavailableError);
    await expect(failure).resolves.not.toBeInstanceOf(ConfigNotActivatedError);
  });

  it("rejects a stale draft write", async () => {
    const repository = new R2ConfigRepository(new MemoryObjectStore());
    const draft = createSeedConfig(refs);
    const first = await repository.saveDraft(draft, null);
    await expect(repository.saveDraft({ ...draft, actorId: "access:other" }, "stale-etag")).rejects.toBeInstanceOf(ConfigConflictError);
    const updated = await repository.saveDraft({ ...draft, actorId: "access:owner" }, first.etag);
    expect(updated.value.actorId).toBe("access:owner");
  });

  it("writes immutable revisions before conditionally activating and verifies the pointer", async () => {
    const repository = new R2ConfigRepository(new MemoryObjectStore());
    const revision = { ...createSeedConfig(refs), revisionId: "revision-1", publishedAt: "2026-09-16T13:00:00+08:00" };
    await repository.writeImmutableRevision(revision);
    await expect(repository.writeImmutableRevision(revision)).rejects.toBeInstanceOf(ConfigConflictError);
    const active = await repository.activate({ schemaVersion: 2, revisionId: "revision-1", activatedAt: "2026-09-16T13:00:01+08:00", operationId: "operation-123" }, null);
    expect(active.value.revisionId).toBe("revision-1");
    const loaded = await repository.readActive();
    expect(loaded.config.revisionId).toBe("revision-1");
  });

  it("recovers an identical immutable write and allows only one conditional pointer winner", async () => {
    const repository = new R2ConfigRepository(new MemoryObjectStore());
    const first = { ...createSeedConfig(refs), revisionId: "revision-1", publishedAt: "2026-09-16T13:00:00+08:00" };
    const second = { ...first, revisionId: "revision-2", parentRevision: "revision-1", publishedAt: "2026-09-16T14:00:00+08:00" };
    await repository.writeImmutableRevision(first);
    await expect(repository.ensureImmutableRevision(first)).resolves.toMatchObject({ value: { revisionId: "revision-1" } });
    const active = await repository.activate({ schemaVersion: 2, revisionId: "revision-1", activatedAt: "2026-09-16T13:00:01+08:00", operationId: "operation-1" }, null);
    await repository.writeImmutableRevision(second);
    const results = await Promise.allSettled([
      repository.activate({ schemaVersion: 2, revisionId: "revision-2", activatedAt: "2026-09-16T14:00:01+08:00", operationId: "operation-2" }, active.etag),
      repository.activate({ schemaVersion: 2, revisionId: "revision-2", activatedAt: "2026-09-16T14:00:02+08:00", operationId: "operation-3" }, active.etag),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected" && result.reason instanceof ConfigConflictError)).toHaveLength(1);
  });
});
