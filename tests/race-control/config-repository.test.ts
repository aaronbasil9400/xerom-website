import { describe, expect, it } from "vitest";
import { ConfigConflictError, R2ConfigRepository, type ConfigObjectStore } from "@/lib/config/repository";
import { createSeedConfig } from "@/lib/config/seed";

class MemoryObjectStore implements ConfigObjectStore {
  private values = new Map<string, { value: string; etag: string }>();
  private version = 0;

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
});
