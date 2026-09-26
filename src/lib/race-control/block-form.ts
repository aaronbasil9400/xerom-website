import type { ConfigRevision } from "@/lib/config/schema";
import { orderScheduleResources } from "./timeline";

export interface BlockResourceOption {
  resourceId: string;
  displayName: string;
}

/**
 * The resources an owner can target with a maintenance block: active resources that
 * are bound to a Calendar, ordered alphabetically so recently added rigs slot in place.
 */
export function activeBlockResources(config: ConfigRevision): BlockResourceOption[] {
  return orderScheduleResources(
    config.resources
      .filter((resource) => resource.lifecycle === "active" && resource.calendarRef)
      .map((resource) => ({ resourceId: resource.resourceId, displayName: resource.displayName })),
  );
}

export type BlockKind = "maintenance" | "venue-closure";

export interface BlockDraft {
  blockType: BlockKind;
  resourceIds: string[];
  start: string;
  end: string;
  reason: string;
}

export interface BlockDraftInput {
  blockType: string;
  selectedResourceIds: string[];
  start: string;
  end: string;
  reason: string;
}

export type BlockDraftResult =
  | { ok: true; request: BlockDraft }
  | { ok: false; message: string };

/** A venue closure always targets the shared booking-control calendar, ignoring resource selection. */
export function normalizeBlockResources(blockType: string, selectedResourceIds: string[]): string[] {
  return blockType === "venue-closure" ? ["booking-control"] : [...new Set(selectedResourceIds)];
}

/**
 * Validates the owner's block inputs against the same rules the API enforces, so the form
 * can give a precise message before the request is sent.
 */
export function buildBlockDraft(input: BlockDraftInput): BlockDraftResult {
  const blockType: BlockKind = input.blockType === "venue-closure" ? "venue-closure" : "maintenance";
  const resourceIds = normalizeBlockResources(blockType, input.selectedResourceIds);
  if (resourceIds.length === 0) return { ok: false, message: "Select at least one resource to block." };
  if (resourceIds.length > 64) return { ok: false, message: "Select 64 resources or fewer." };
  const start = input.start.trim();
  const end = input.end.trim();
  if (!start || !end) return { ok: false, message: "Choose a start and end time for the block." };
  if (Date.parse(end) <= Date.parse(start)) return { ok: false, message: "The end time must be after the start time." };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, message: "Add a reason for the block." };
  if (reason.length > 500) return { ok: false, message: "Keep the reason to 500 characters or fewer." };
  return { ok: true, request: { blockType, resourceIds, start, end, reason } };
}
