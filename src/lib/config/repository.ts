import { configPointerSchema, configRevisionSchema, type ConfigPointer, type ConfigRevision } from "./schema";

export class ConfigUnavailableError extends Error {}
export class ConfigNotActivatedError extends ConfigUnavailableError {}
export class ConfigConflictError extends Error {
  constructor(message: string, readonly currentEtag: string | null) {
    super(message);
  }
}

export interface VersionedConfig<T> {
  value: T;
  etag: string;
}

export interface ConfigObjectStore {
  get(key: string): Promise<{ etag: string; json<T>(): Promise<T> } | null>;
  head(key: string): Promise<{ etag: string } | null>;
  put(key: string, value: string, options: {
    httpMetadata: { contentType: string; cacheControl: string };
    onlyIf: { etagMatches?: string; etagDoesNotMatch?: string };
  }): Promise<{ etag: string } | null>;
}

export class R2ConfigRepository {
  constructor(private readonly bucket: ConfigObjectStore) {}

  async readActive(): Promise<{ pointer: VersionedConfig<ConfigPointer>; config: ConfigRevision }> {
    const pointerObject = await this.bucket.get("active.json");
    if (!pointerObject) throw new ConfigNotActivatedError("Active configuration has not been activated.");
    const pointer = configPointerSchema.parse(await pointerObject.json());
    const revisionObject = await this.bucket.get(`revisions/${pointer.revisionId}.json`);
    if (!revisionObject) throw new ConfigUnavailableError("Active configuration revision is unavailable.");
    return { pointer: { value: pointer, etag: pointerObject.etag }, config: configRevisionSchema.parse(await revisionObject.json()) };
  }

  async readDraft(): Promise<VersionedConfig<ConfigRevision> | null> {
    const object = await this.bucket.get("draft.json");
    if (!object) return null;
    return { value: configRevisionSchema.parse(await object.json()), etag: object.etag };
  }

  async readRevision(revisionId: string): Promise<ConfigRevision | null> {
    const object = await this.bucket.get(`revisions/${revisionId}.json`);
    return object ? configRevisionSchema.parse(await object.json()) : null;
  }

  async saveDraft(config: ConfigRevision, expectedEtag: string | null): Promise<VersionedConfig<ConfigRevision>> {
    const parsed = configRevisionSchema.parse(config);
    const result = await this.bucket.put("draft.json", JSON.stringify(parsed), {
      httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
      onlyIf: expectedEtag === null ? { etagDoesNotMatch: "*" } : { etagMatches: expectedEtag },
    });
    if (!result) throw new ConfigConflictError("The draft changed in another session.", (await this.bucket.head("draft.json"))?.etag ?? null);
    return { value: parsed, etag: result.etag };
  }

  async writeImmutableRevision(config: ConfigRevision): Promise<VersionedConfig<ConfigRevision>> {
    const parsed = configRevisionSchema.parse(config);
    if (!parsed.publishedAt) throw new Error("Published revisions require publishedAt.");
    const result = await this.bucket.put(`revisions/${parsed.revisionId}.json`, JSON.stringify(parsed), {
      httpMetadata: { contentType: "application/json", cacheControl: "private, max-age=31536000, immutable" },
      onlyIf: { etagDoesNotMatch: "*" },
    });
    if (!result) throw new ConfigConflictError("That immutable revision already exists.", (await this.bucket.head(`revisions/${parsed.revisionId}.json`))?.etag ?? null);
    return { value: parsed, etag: result.etag };
  }

  async ensureImmutableRevision(config: ConfigRevision): Promise<VersionedConfig<ConfigRevision>> {
    try { return await this.writeImmutableRevision(config); } catch (error) {
      if (!(error instanceof ConfigConflictError)) throw error;
      const object = await this.bucket.get(`revisions/${config.revisionId}.json`);
      if (!object) throw error;
      const existing = configRevisionSchema.parse(await object.json());
      if (JSON.stringify(existing) !== JSON.stringify(config)) throw error;
      return { value: existing, etag: object.etag };
    }
  }

  async activate(pointer: ConfigPointer, expectedEtag: string | null): Promise<VersionedConfig<ConfigPointer>> {
    const parsed = configPointerSchema.parse(pointer);
    const revision = await this.bucket.head(`revisions/${parsed.revisionId}.json`);
    if (!revision) throw new ConfigUnavailableError("The revision to activate does not exist.");
    const result = await this.bucket.put("active.json", JSON.stringify(parsed), {
      httpMetadata: { contentType: "application/json", cacheControl: "no-store" },
      onlyIf: expectedEtag === null ? { etagDoesNotMatch: "*" } : { etagMatches: expectedEtag },
    });
    if (!result) throw new ConfigConflictError("The active revision changed during publication.", (await this.bucket.head("active.json"))?.etag ?? null);
    const confirmed = await this.bucket.get("active.json");
    if (!confirmed) throw new ConfigUnavailableError("The activated pointer could not be verified.");
    return { value: configPointerSchema.parse(await confirmed.json()), etag: confirmed.etag };
  }
}

export function getConfigRepository(env: CloudflareEnv): R2ConfigRepository {
  if (!env.RACE_CONTROL_CONFIG_BUCKET) throw new ConfigNotActivatedError("Runtime configuration storage is not bound.");
  return new R2ConfigRepository(env.RACE_CONTROL_CONFIG_BUCKET);
}
