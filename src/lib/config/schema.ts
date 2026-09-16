import { z } from "zod";

export const raceControlSchemaVersion = 1 as const;
export const malaysiaTimezone = "Asia/Kuala_Lumpur" as const;

const id = z.string().min(1).max(96).regex(/^[a-z0-9][a-z0-9_-]*$/);
const isoInstant = z.iso.datetime({ offset: true });
const localDate = z.iso.date();
const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const safeText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const serviceIdSchema = z.enum(["regular-sim", "pro-sim", "ps5"]);
export type ServiceId = z.infer<typeof serviceIdSchema>;

export const serviceSchema = z.object({
  serviceId: serviceIdSchema,
  name: safeText(80),
  shortName: safeText(32),
  unitLabel: safeText(24),
  description: safeText(320),
  enabled: z.boolean(),
}).strict();

export const resourceSchema = z.object({
  resourceId: id,
  serviceId: serviceIdSchema,
  displayName: safeText(80),
  lifecycle: z.enum(["draft", "provisioning", "ready", "active", "retired", "error"]),
  activeFrom: isoInstant.nullable(),
  retiredFrom: isoInstant.nullable(),
  controllerCapacity: z.number().int().positive().max(16).nullable(),
  calendarRef: z.string().min(1).max(256).nullable(),
}).strict().superRefine((resource, context) => {
  if (resource.lifecycle === "active" && !resource.calendarRef) {
    context.addIssue({ code: "custom", path: ["calendarRef"], message: "Active resources require a private calendar reference." });
  }
  if (resource.serviceId !== "ps5" && resource.controllerCapacity !== null) {
    context.addIssue({ code: "custom", path: ["controllerCapacity"], message: "Controller capacity is only valid for PS5 resources." });
  }
});

export const hoursIntervalSchema = z.object({
  open: localTime,
  close: localTime,
  closeDayOffset: z.union([z.literal(0), z.literal(1)]),
}).strict();

export const weeklyHoursSchema = z.object({
  monday: z.array(hoursIntervalSchema).max(3),
  tuesday: z.array(hoursIntervalSchema).max(3),
  wednesday: z.array(hoursIntervalSchema).max(3),
  thursday: z.array(hoursIntervalSchema).max(3),
  friday: z.array(hoursIntervalSchema).max(3),
  saturday: z.array(hoursIntervalSchema).max(3),
  sunday: z.array(hoursIntervalSchema).max(3),
}).strict();

export const hoursExceptionSchema = z.object({
  exceptionId: id,
  businessDate: localDate,
  label: safeText(120),
  intervals: z.array(hoursIntervalSchema).max(3),
}).strict();

export const rateSchema = z.object({
  rateId: id,
  serviceId: serviceIdSchema,
  amountSenPerResourceHour: z.number().int().nonnegative().max(1_000_000),
  effectiveFrom: isoInstant,
  effectiveUntil: isoInstant.nullable(),
}).strict();

const offerEligibilitySchema = z.object({
  serviceIds: z.array(serviceIdSchema).min(1),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  startDate: localDate.nullable(),
  endDate: localDate.nullable(),
  startTime: localTime.nullable(),
  endTime: localTime.nullable(),
  channels: z.array(z.enum(["public", "owner", "walk-in"])).min(1),
  durationMinutes: z.array(z.number().int().positive().max(720)).min(1),
}).strict();

export const promotionSchema = z.discriminatedUnion("type", [
  z.object({
    promotionId: id,
    type: z.literal("percentage"),
    label: safeText(100),
    state: z.enum(["draft", "enabled", "paused"]),
    percentageBasisPoints: z.number().int().min(0).max(10_000),
    priority: z.number().int().min(-1_000).max(1_000),
    eligibility: offerEligibilitySchema,
    terms: z.string().trim().max(500),
  }).strict(),
  z.object({
    promotionId: id,
    type: z.literal("duration-package"),
    label: safeText(100),
    state: z.enum(["draft", "enabled", "paused"]),
    packageDurationMinutes: z.number().int().positive().max(720),
    packagePriceSenPerResource: z.number().int().nonnegative().max(1_000_000),
    priority: z.number().int().min(-1_000).max(1_000),
    eligibility: offerEligibilitySchema,
    terms: z.string().trim().max(500),
  }).strict(),
]);

export const bookingRulesSchema = z.object({
  slotIntervalMinutes: z.number().int().positive().max(240),
  allowedDurationsMinutes: z.array(z.number().int().positive().max(720)).min(1),
  customerMinimumNoticeMinutes: z.number().int().nonnegative().max(10_080),
  horizon: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("rolling-minutes"), value: z.number().int().positive().max(43_200) }).strict(),
    z.object({ mode: z.literal("local-calendar-days"), value: z.number().int().positive().max(365) }).strict(),
  ]),
  bufferMinutes: z.number().int().nonnegative().max(240),
  perServiceGroupLimits: z.record(serviceIdSchema, z.number().int().nonnegative().max(64)),
  totalGroupLimit: z.number().int().positive().max(64),
  mixedServiceAllowed: z.boolean(),
}).strict();

export const websiteContentSchema = z.object({
  homepage: z.object({ headline: safeText(80), intro: safeText(500), heroAssetId: id.nullable() }).strict(),
  experiences: z.record(serviceIdSchema, z.object({ heading: safeText(80), body: safeText(600), assetId: id.nullable() }).strict()),
  venue: z.object({
    phoneDisplay: safeText(40),
    phoneInternational: safeText(40),
    whatsappNumber: safeText(40),
    instagramHandle: safeText(80),
    instagramUrl: z.url(),
    mapsUrl: z.url(),
    addressLines: z.array(safeText(160)).min(1).max(6),
  }).strict(),
  pricingIntro: safeText(500),
  galleryAssetIds: z.array(id).max(24),
}).strict();

export const configRevisionSchema = z.object({
  schemaVersion: z.literal(raceControlSchemaVersion),
  revisionId: id,
  parentRevision: id.nullable(),
  publishedAt: isoInstant.nullable(),
  actorId: z.string().min(1).max(256),
  venue: z.object({ name: safeText(120), timezone: z.literal(malaysiaTimezone), currency: z.literal("MYR") }).strict(),
  services: z.array(serviceSchema).length(3),
  resources: z.array(resourceSchema).max(64),
  hours: z.object({ weekly: weeklyHoursSchema, exceptions: z.array(hoursExceptionSchema).max(366) }).strict(),
  rates: z.array(rateSchema).min(3).max(128),
  promotions: z.array(promotionSchema).max(128),
  bookingRules: bookingRulesSchema,
  websiteContent: websiteContentSchema,
}).strict().superRefine((config, context) => {
  const resourceIds = config.resources.map((resource) => resource.resourceId);
  if (new Set(resourceIds).size !== resourceIds.length) {
    context.addIssue({ code: "custom", path: ["resources"], message: "Resource IDs must be unique." });
  }
  const calendarRefs = config.resources.flatMap((resource) => resource.calendarRef ? [resource.calendarRef] : []);
  if (new Set(calendarRefs).size !== calendarRefs.length) {
    context.addIssue({ code: "custom", path: ["resources"], message: "Calendar references must be unique." });
  }
  for (const serviceId of serviceIdSchema.options) {
    if (!config.services.some((service) => service.serviceId === serviceId)) {
      context.addIssue({ code: "custom", path: ["services"], message: `Missing service ${serviceId}.` });
    }
  }
});

export type ConfigRevision = z.infer<typeof configRevisionSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type Promotion = z.infer<typeof promotionSchema>;

export const configPointerSchema = z.object({
  schemaVersion: z.literal(raceControlSchemaVersion),
  revisionId: id,
  activatedAt: isoInstant,
  operationId: id,
}).strict();

export type ConfigPointer = z.infer<typeof configPointerSchema>;
