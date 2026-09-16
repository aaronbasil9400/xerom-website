import { operationCommandSchema, operationSchema, type Operation, type OperationCommand } from "../../src/lib/race-control/contracts";

export interface JournalStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  list<T>(options: { prefix: string }): Promise<Map<string, T>>;
}

export type BeginOperationResult =
  | { status: "started"; operation: Operation }
  | { status: "replay"; operation: Operation }
  | { status: "payload-mismatch"; operation: Operation };

export class OperationJournal {
  constructor(private readonly storage: JournalStorage, private readonly now: () => string = () => new Date().toISOString()) {}

  async begin(commandInput: OperationCommand, actorId: string, affectedResourceIds: string[]): Promise<BeginOperationResult> {
    const command = operationCommandSchema.parse(commandInput);
    const key = `operation:${command.opId}`;
    const prior = await this.storage.get<Operation>(key);
    if (prior) return prior.payloadHash === command.payloadHash ? { status: "replay", operation: prior } : { status: "payload-mismatch", operation: prior };
    const timestamp = this.now();
    const operation = operationSchema.parse({
      opId: command.opId,
      type: command.type,
      actorId,
      payloadHash: command.payloadHash,
      state: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
      retryCount: 0,
      affectedResourceIds,
      safeNextAction: "none",
    });
    await this.storage.put(key, operation);
    for (const resourceId of affectedResourceIds) await this.storage.put(`fence:${resourceId}`, { operationId: operation.opId, createdAt: timestamp });
    return { status: "started", operation };
  }

  async transition(opId: string, state: Operation["state"], safeNextAction: Operation["safeNextAction"], publicResult?: unknown): Promise<Operation> {
    const key = `operation:${opId}`;
    const current = await this.storage.get<Operation>(key);
    if (!current) throw new Error("Operation does not exist.");
    const next = operationSchema.parse({ ...current, state, safeNextAction, updatedAt: this.now(), ...(publicResult === undefined ? {} : { publicResult }) });
    await this.storage.put(key, next);
    if (state === "succeeded" || state === "failed") {
      for (const resourceId of current.affectedResourceIds) await this.storage.put(`fence:${resourceId}`, { operationId: opId, clearedAt: this.now(), cleared: true });
    }
    return next;
  }

  async recordRetry(opId: string): Promise<Operation> {
    const key = `operation:${opId}`;
    const current = await this.storage.get<Operation>(key);
    if (!current) throw new Error("Operation does not exist.");
    const next = operationSchema.parse({ ...current, retryCount: current.retryCount + 1, updatedAt: this.now() });
    await this.storage.put(key, next);
    return next;
  }

  async activeFences(): Promise<Map<string, string>> {
    const records = await this.storage.list<{ operationId: string; cleared?: boolean }>({ prefix: "fence:" });
    return new Map([...records].filter(([, value]) => !value.cleared).map(([key, value]) => [key.slice("fence:".length), value.operationId]));
  }
}
