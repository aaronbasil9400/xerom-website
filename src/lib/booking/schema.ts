import { z } from "zod";
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
  if (item.serviceId !== "ps5" && item.additionalControllers) {
    context.addIssue({ code: "custom", message: "Additional controllers apply only to PS5." });
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
  configRevision: z.string().min(1).max(128).optional(),
}).superRefine((request, context) => {
  const active = request.items.filter((item) => item.quantity > 0);
  if (active.length === 0) context.addIssue({ code: "custom", path: ["items"], message: "Choose at least one experience." });
  if (new Set(active.map((item) => item.serviceId)).size !== active.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "Each experience may appear only once." });
  }
});

export const publicBookingRequestSchema = bookingRequestSchema
  .superRefine((request, context) => {
    if (request.customer.notes !== undefined) {
      context.addIssue({ code: "custom", path: ["customer", "notes"], message: "Notes are not collected on online bookings." });
    }
  })
  .refine((request) => Boolean(request.configRevision), { path: ["configRevision"], message: "Reload booking settings before confirming." });

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().pipe(bookingDurationSchema),
  regular: z.coerce.number().int().min(0).max(64).default(0),
  pro: z.coerce.number().int().min(0).max(64).default(0),
  ps5: z.coerce.number().int().min(0).max(64).default(0),
});
