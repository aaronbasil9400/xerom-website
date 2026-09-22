import { hashPayload } from "@/lib/booking/id";
import type { ConfigPointer, ConfigRevision } from "@/lib/config/schema";
import { ConfigNotActivatedError, type R2ConfigRepository } from "@/lib/config/repository";
import { draftHash, verifyConfigReviewToken } from "@/lib/security/review-token";
import type { ConfigReviewResult } from "./config-review";

export async function configPublicationOperationId(reviewToken: string, draftEtag: string): Promise<string> {
  return `publish_${(await hashPayload({ reviewToken, draftEtag })).slice(0, 48)}`;
}

export function configPublicationRevisionId(operationId: string): string {
  return `rev-${operationId}`;
}

export interface ConfigPublicationCommand {
  opId: string;
  expectedRevision: string;
  draftEtag: string;
  reviewToken: string;
  payloadHash: string;
}

export class ConfigPublicationRejectedError extends Error {
  constructor(message: string, readonly conflicts?: ConfigReviewResult["validationErrors"]) {
    super(message);
  }
}

interface ExecuteConfigPublicationOptions {
  repository: R2ConfigRepository;
  command: ConfigPublicationCommand;
  actorId: string;
  reviewSecret: string;
  seedConfig: ConfigRevision;
  publishedAt: string;
  review: (current: ConfigRevision, proposed: ConfigRevision, now: string) => Promise<ConfigReviewResult>;
  onIntent: (revisionId: string, publishedAt: string) => Promise<void>;
}

export async function recoverActivatedConfigPublication(repository: R2ConfigRepository, revisionId: string): Promise<{ revisionId: string; activatedAt: string } | null> {
  try {
    const active = await repository.readActive();
    return active.config.revisionId === revisionId ? { revisionId, activatedAt: active.pointer.value.activatedAt } : null;
  } catch (error) {
    if (error instanceof ConfigNotActivatedError) return null;
    throw error;
  }
}

export async function executeConfigPublication(options: ExecuteConfigPublicationOptions): Promise<{ revision: ConfigRevision; pointer: ConfigPointer }> {
  const { repository, command } = options;
  let active: Awaited<ReturnType<R2ConfigRepository["readActive"]>> | null;
  try { active = await repository.readActive(); } catch (error) {
    if (!(error instanceof ConfigNotActivatedError)) throw error;
    active = null;
  }
  const draft = await repository.readDraft();
  if (!draft || draft.etag !== command.draftEtag) throw new ConfigPublicationRejectedError("The draft changed after review. Review it again.");
  const hash = await draftHash(draft.value);
  if (hash !== command.payloadHash) throw new ConfigPublicationRejectedError("The draft changed after review. Review it again.");
  const token = await verifyConfigReviewToken(options.reviewSecret, command.reviewToken, Date.parse(options.publishedAt));
  if (!token || token.draftHash !== hash || token.baseRevision !== command.expectedRevision) throw new ConfigPublicationRejectedError("The configuration review expired or does not match this draft.");
  const currentRevision = active?.config.revisionId ?? (draft.value.parentRevision ?? draft.value.revisionId);
  if (currentRevision !== command.expectedRevision) throw new ConfigPublicationRejectedError("The active configuration changed. Review the draft again.");
  const impact = await options.review(active?.config ?? options.seedConfig, draft.value, options.publishedAt);
  if (!impact.publishable) throw new ConfigPublicationRejectedError("New Calendar conflicts were found. Review the draft again.", impact.validationErrors);
  const revisionId = configPublicationRevisionId(command.opId);
  const revision = { ...draft.value, revisionId, parentRevision: active?.config.revisionId ?? null, publishedAt: options.publishedAt, actorId: options.actorId };
  await options.onIntent(revisionId, options.publishedAt);
  await repository.ensureImmutableRevision(revision);
  const pointer = await repository.activate({ schemaVersion: 2, revisionId, activatedAt: options.publishedAt, operationId: `op-${(await hashPayload(command.opId)).slice(0, 48)}` }, active?.pointer.etag ?? null);
  return { revision, pointer: pointer.value };
}
