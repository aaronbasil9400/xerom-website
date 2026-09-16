import { z } from "zod";
import { configPointerSchema, type ConfigPointer } from "@/lib/config/schema";

/** Phase-0-only interfaces. They model platform behavior without binding live R2 or Google resources. */
export interface ConditionalObjectStore {
  get(key: string): Promise<{ etag: string; text(): Promise<string> } | null>;
  put(key: string, body: string, options: { etagMatches?: string; etagDoesNotMatch?: string }): Promise<{ etag: string } | null>;
}

export type PointerActivationResult =
  | { status: "activated"; pointer: ConfigPointer; etag: string }
  | { status: "conflict"; active: ConfigPointer | null; etag: string | null };

export async function activatePointerConditionally(store: ConditionalObjectStore, pointer: ConfigPointer, expectedEtag: string | null): Promise<PointerActivationResult> {
  const parsed = configPointerSchema.parse(pointer);
  const result = await store.put("active.json", JSON.stringify(parsed), expectedEtag === null ? { etagDoesNotMatch: "*" } : { etagMatches: expectedEtag });
  if (result) return { status: "activated", pointer: parsed, etag: result.etag };

  const current = await store.get("active.json");
  if (!current) return { status: "conflict", active: null, etag: null };
  return { status: "conflict", active: configPointerSchema.parse(JSON.parse(await current.text())), etag: current.etag };
}

export const calendarProvisioningMarkerSchema = z.object({
  operationId: z.string().min(8).max(128),
  resourceId: z.string().min(1).max(96),
}).strict();

export interface CalendarListCandidate {
  id: string;
  summary: string;
  description: string | null;
  primary: boolean;
  accessRole: "freeBusyReader" | "reader" | "writer" | "owner";
}

export type LostCreateResolution =
  | { status: "not-found" }
  | { status: "reconciled"; calendarId: string }
  | { status: "needs-review"; candidateCalendarIds: string[] };

export function provisioningMarker(marker: z.infer<typeof calendarProvisioningMarkerSchema>): string {
  const parsed = calendarProvisioningMarkerSchema.parse(marker);
  return `xerom-provisioning:${parsed.operationId}:${parsed.resourceId}`;
}

export function reconcileLostCalendarCreate(candidates: CalendarListCandidate[], marker: z.infer<typeof calendarProvisioningMarkerSchema>): LostCreateResolution {
  const expected = provisioningMarker(marker);
  const matches = candidates.filter((candidate) => !candidate.primary && candidate.accessRole === "owner" && candidate.description?.includes(expected));
  if (matches.length === 0) return { status: "not-found" };
  if (matches.length === 1) return { status: "reconciled", calendarId: matches[0].id };
  return { status: "needs-review", candidateCalendarIds: matches.map((candidate) => candidate.id) };
}

export const ownerAccessConfigSchema = z.object({
  teamDomain: z.url().refine((value) => value.endsWith(".cloudflareaccess.com"), "Use the Cloudflare Access team domain."),
  audience: z.string().min(8),
  ownerEmails: z.array(z.email()).min(1),
}).strict();

export const googleOwnerOAuthScopeProposal = [
  "https://www.googleapis.com/auth/calendar.calendars",
  "https://www.googleapis.com/auth/calendar.acl",
] as const;
