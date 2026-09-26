import { z } from "zod";
import { configRevisionSchema, serviceIdSchema } from "@/lib/config/schema";

const opaqueId = z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);
const isoInstant = z.iso.datetime({ offset: true });

export const quoteRequestSchema = z.object({
  items: z.array(z.object({ serviceId: serviceIdSchema, quantity: z.number().int().positive().max(64), additionalControllers: z.number().int().nonnegative().max(64).optional() }).strict()).min(1).max(3),
  start: isoInstant,
  durationMinutes: z.number().int().positive().max(720),
  channel: z.enum(["public", "owner", "walk-in"]),
}).strict();

export const quoteSchema = z.object({
  quoteId: opaqueId,
  configRevision: z.string().min(1),
  pricingEngineVersion: z.literal("race-control-v1"),
  expiresAt: isoInstant,
  currency: z.literal("MYR"),
  lines: z.array(z.object({
    serviceId: serviceIdSchema,
    quantity: z.number().int().positive(),
    baseAmountSenPerResource: z.number().int().nonnegative(),
    selectedAmountSenPerResource: z.number().int().nonnegative(),
    selectedPromotionId: z.string().nullable(),
    savingsSen: z.number().int().nonnegative(),
    addOnAmountSen: z.number().int().nonnegative(),
    lineTotalSen: z.number().int().nonnegative(),
    explanations: z.array(z.object({ candidateId: z.string(), eligible: z.boolean(), reason: z.string() }).strict()),
  }).strict()).min(1),
  totalSen: z.number().int().nonnegative(),
  token: z.string().min(16),
}).strict();

export const bookingLifecycleSchema = z.enum(["confirmed", "checked_in", "completed", "no_show", "cancelled"]);

const expectedBookingVersionSchema = z.object({ bookingId: opaqueId, version: z.number().int().nonnegative() }).strict();

export const bookingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check-in"), expected: expectedBookingVersionSchema }).strict(),
  z.object({ action: z.literal("complete"), expected: expectedBookingVersionSchema, releaseRemainingTime: z.boolean() }).strict(),
  z.object({ action: z.literal("no-show"), expected: expectedBookingVersionSchema, reason: z.string().trim().max(500).optional() }).strict(),
  z.object({ action: z.literal("cancel"), expected: expectedBookingVersionSchema, reason: z.string().trim().min(1).max(500) }).strict(),
  z.object({ action: z.literal("reschedule"), expected: expectedBookingVersionSchema, start: isoInstant, resourceIds: z.array(z.string()).min(1).max(64), quoteId: opaqueId.nullable() }).strict(),
  z.object({ action: z.literal("extend"), expected: expectedBookingVersionSchema, durationMinutes: z.number().int().positive().max(720), quoteId: opaqueId }).strict(),
]);

export const operationCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("create-booking"), opId: opaqueId, idempotencyKey: opaqueId, quoteId: opaqueId, source: z.enum(["public", "owner", "walk-in"]), payloadHash: z.string().length(64) }).strict(),
  z.object({ type: z.literal("booking-action"), opId: opaqueId, idempotencyKey: opaqueId, action: bookingActionSchema, payloadHash: z.string().length(64) }).strict(),
  z.object({ type: z.literal("activate-config"), opId: opaqueId, idempotencyKey: opaqueId, expectedRevision: z.string().min(1), draftEtag: z.string().min(1), reviewToken: z.string().min(16), payloadHash: z.string().length(64) }).strict(),
  z.object({ type: z.literal("provision-resource"), opId: opaqueId, idempotencyKey: opaqueId, resourceId: z.string().min(1), confirmationToken: z.string().min(16), payloadHash: z.string().length(64) }).strict(),
  z.object({ type: z.literal("delete-resource-calendar"), opId: opaqueId, idempotencyKey: opaqueId, resourceId: z.string().min(1), confirmationToken: z.string().min(16), payloadHash: z.string().length(64) }).strict(),
  z.object({ type: z.literal("block-time"), opId: opaqueId, idempotencyKey: opaqueId, blockType: z.enum(["maintenance", "venue-closure"]), resourceIds: z.array(z.string().min(1)).min(1).max(64), start: isoInstant, end: isoInstant, reason: z.string().trim().min(1).max(500), payloadHash: z.string().length(64) }).strict(),
]);

export const operationSchema = z.object({
  opId: opaqueId,
  type: z.enum(["create-booking", "booking-action", "activate-config", "provision-resource", "delete-resource-calendar", "block-time"]),
  actorId: z.string().min(1).max(256),
  payloadHash: z.string().length(64),
  state: z.enum(["pending", "running", "succeeded", "failed", "needs_review"]),
  createdAt: isoInstant,
  updatedAt: isoInstant,
  retryCount: z.number().int().nonnegative(),
  affectedResourceIds: z.array(z.string()).max(64),
  safeNextAction: z.enum(["none", "retry", "review", "reconnect-google"]),
  publicResult: z.unknown().optional(),
}).strict();

export const configReviewSchema = z.object({
  draftHash: z.string().length(64),
  baseRevision: z.string().min(1),
  normalizedDraft: configRevisionSchema,
  affectedBookingIds: z.array(z.string()).max(10_000),
  validationErrors: z.array(z.object({ path: z.string(), message: z.string() }).strict()),
  reviewedAt: isoInstant,
  expiresAt: isoInstant,
  reviewToken: z.string().min(16),
}).strict();

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type BookingAction = z.infer<typeof bookingActionSchema>;
export type OperationCommand = z.infer<typeof operationCommandSchema>;
export type Operation = z.infer<typeof operationSchema>;

export const blockTimeRequestSchema = z.object({
  blockType: z.enum(["maintenance", "venue-closure"]),
  resourceIds: z.array(z.string().min(1).max(96)).min(1).max(64),
  start: isoInstant,
  end: isoInstant,
  reason: z.string().trim().min(1).max(500),
  idempotencyKey: opaqueId,
}).strict().superRefine((value, context) => {
  if (Date.parse(value.end) <= Date.parse(value.start)) context.addIssue({ code: "custom", path: ["end"], message: "End must be after start." });
  if (value.blockType === "venue-closure" && !value.resourceIds.includes("booking-control")) context.addIssue({ code: "custom", path: ["resourceIds"], message: "Venue closures must target the Booking Control calendar." });
});

export type BlockTimeRequest = z.infer<typeof blockTimeRequestSchema>;

export const blockRemovalRequestSchema = z.object({
  blockId: z.string().min(1).max(128).nullable().optional(),
  blockType: z.enum(["maintenance", "venue-closure"]),
  resourceIds: z.array(z.string().min(1).max(96)).min(1).max(64),
  start: isoInstant,
  end: isoInstant,
  idempotencyKey: opaqueId,
}).strict().superRefine((value, context) => {
  if (Date.parse(value.end) <= Date.parse(value.start)) context.addIssue({ code: "custom", path: ["end"], message: "End must be after start." });
  if (value.blockType === "venue-closure" && !value.resourceIds.includes("booking-control")) context.addIssue({ code: "custom", path: ["resourceIds"], message: "Venue closures must target the Booking Control calendar." });
});

export type BlockRemovalRequest = z.infer<typeof blockRemovalRequestSchema>;
