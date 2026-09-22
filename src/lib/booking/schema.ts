import { z } from "zod";
import { bookingRules } from "@/config/booking";
import { pricing } from "@/config/pricing";
import { serviceCore } from "@/config/service-core";
import { normalizeMalaysianMobile } from "./phone";

export const serviceIdSchema = z.enum(["regular-sim", "pro-sim", "ps5"]);

export const malaysianMobileSchema = z.string()
  .trim()
  .min(8)
  .max(20)
  .refine((value) => normalizeMalaysianMobile(value) !== null, "Enter a valid Malaysian mobile number, e.g. 012-345 6789.")
  .transform((value) => normalizeMalaysianMobile(value)!);

export const lineItemSchema = z.object({
  serviceId: serviceIdSchema,
  quantity: z.number().int().min(0).max(64),
  additionalControllers: z.number().int().min(0).max(64).optional(),
}).superRefine((item, context) => {
  const service = serviceCore[item.serviceId];
  if (item.quantity > service.capacity) {
    context.addIssue({ code: "custom", path: ["quantity"], message: `Maximum ${service.capacity} ${service.name}${service.capacity === 1 ? "" : "s"} available.` });
  }
  if (item.serviceId !== "ps5" && item.additionalControllers) {
    context.addIssue({ code: "custom", message: "Additional controllers apply only to PS5." });
  }
  if (item.serviceId === "ps5" && (item.additionalControllers ?? 0) > pricing.services.ps5.maxAdditionalControllers) {
    context.addIssue({ code: "custom", path: ["additionalControllers"], message: `Maximum ${pricing.services.ps5.maxAdditionalControllers} additional controllers available.` });
  }
  if (item.serviceId === "ps5" && item.quantity === 0 && (item.additionalControllers ?? 0) > 0) {
    context.addIssue({ code: "custom", path: ["additionalControllers"], message: "Select a PS5 Lounge before adding controllers." });
  }
});

const bookingDurationSchema = z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]);

export const bookingRequestSchema = z.object({
  start: z.iso.datetime({ offset: true }),
  durationMinutes: bookingDurationSchema,
  items: z.array(lineItemSchema).min(1).max(3),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: malaysianMobileSchema,
    email: z.string().trim().max(254).pipe(z.email("Enter a valid email address.")).optional(),
    notes: z.string().trim().max(300).optional(),
  }),
  idempotencyKey: z.uuid(),
}).superRefine((request, context) => {
  const active = request.items.filter((item) => item.quantity > 0);
  if (active.length === 0) context.addIssue({ code: "custom", path: ["items"], message: "Choose at least one experience." });
  if (new Set(active.map((item) => item.serviceId)).size !== active.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Each experience may appear only once." });
  }
});

export const publicBookingRequestSchema = bookingRequestSchema;

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().pipe(bookingDurationSchema),
  regular: z.coerce.number().int().min(0).max(64).default(0),
  pro: z.coerce.number().int().min(0).max(64).default(0),
  ps5: z.coerce.number().int().min(0).max(64).default(0),
}).superRefine((query, context) => {
  const quantities = { "regular-sim": query.regular, "pro-sim": query.pro, ps5: query.ps5 } as const;
  for (const serviceId of Object.keys(quantities) as Array<keyof typeof quantities>) {
    if (quantities[serviceId] > serviceCore[serviceId].capacity) {
      context.addIssue({ code: "custom", path: [serviceId === "regular-sim" ? "regular" : serviceId === "pro-sim" ? "pro" : "ps5"], message: `Maximum ${serviceCore[serviceId].capacity} available.` });
    }
  }
  if (!bookingRules.allowedDurationsMinutes.includes(query.durationMinutes)) {
    context.addIssue({ code: "custom", path: ["durationMinutes"], message: bookingRules.durationErrorMessage });
  }
});
