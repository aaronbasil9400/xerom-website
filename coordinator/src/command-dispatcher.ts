import { operationCommandSchema, type OperationCommand } from "../../src/lib/race-control/contracts";
import { OperationJournal, type JournalStorage } from "./operation-journal";

export interface DispatchContext {
  actorId: string;
  affectedResourceIds: string[];
}

export type CommandHandler = (command: OperationCommand) => Promise<unknown>;

export class CommandDispatcher {
  private readonly journal: OperationJournal;

  constructor(storage: JournalStorage, private readonly handlers: Partial<Record<OperationCommand["type"], CommandHandler>>, now?: () => string) {
    this.journal = new OperationJournal(storage, now);
  }

  async dispatch(input: unknown, context: DispatchContext): Promise<{ status: number; body: unknown }> {
    const parsed = operationCommandSchema.safeParse(input);
    if (!parsed.success) return { status: 400, body: { error: { code: "INVALID_COMMAND", message: "The operation command is invalid.", retryable: false } } };
    const started = await this.journal.begin(parsed.data, context.actorId, context.affectedResourceIds);
    if (started.status === "payload-mismatch") return { status: 409, body: { error: { code: "IDEMPOTENCY_MISMATCH", message: "This operation ID was already used with different details.", retryable: false }, operationId: parsed.data.opId } };
    if (started.status === "replay") {
      const operation = started.operation;
      return { status: operation.state === "succeeded" ? 200 : 202, body: { data: operation.publicResult, operationId: operation.opId, state: operation.state, replayed: true } };
    }

    const handler = this.handlers[parsed.data.type];
    if (!handler) {
      const operation = await this.journal.transition(parsed.data.opId, "needs_review", "review");
      return { status: 202, body: { operationId: operation.opId, state: operation.state } };
    }

    await this.journal.transition(parsed.data.opId, "running", "none");
    try {
      const result = await handler(parsed.data);
      const operation = await this.journal.transition(parsed.data.opId, "succeeded", "none", result);
      return { status: 201, body: { data: operation.publicResult, operationId: operation.opId, state: operation.state } };
    } catch {
      const operation = await this.journal.transition(parsed.data.opId, "needs_review", "review");
      return { status: 202, body: { operationId: operation.opId, state: operation.state } };
    }
  }
}
