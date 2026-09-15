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
  quantity: z.number().int().min(0).max(4),
  additionalControllers: z.number().int().min(0).max(6).optional(),
}).superRefine((item, context) => {
  const limits = { "regular-sim": 3, "pro-sim": 1, ps5: 2 } as const;
  if (item.quantity > limits[item.serviceId]) {
    context.addIssue({ code: "custom", path: ["quantity"], message: `Maximum available ${item.serviceId} quantity is ${limits[item.serviceId]}.` });
  }
  if (item.serviceId !== "ps5" && item.additionalControllers) {
    context.addIssue({ code: "custom", message: "Additional controllers apply only to PS5." });
  }
});

export const bookingRequestSchema = z.object({
  start: z.iso.datetime({ offset: true }),
  durationMinutes: z.union([z.literal(60), z.literal(120)]),
  items: z.array(lineItemSchema).min(1).max(3),
  customer: z.object({
    name: z.string().trim().min(2).max(80),
    phone: malaysianMobileSchema,
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

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().pipe(z.union([z.literal(60), z.literal(120)])),
  regular: z.coerce.number().int().min(0).max(3).default(0),
  pro: z.coerce.number().int().min(0).max(1).default(0),
  ps5: z.coerce.number().int().min(0).max(2).default(0),
});
