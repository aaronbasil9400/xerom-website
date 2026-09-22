import { z } from "zod";
import { configRevisionSchema, serviceIdSchema, type ConfigRevision } from "./schema";

export const publicConfigSchema = z.object({
  schemaVersion: z.literal(2),
  revisionId: z.string(),
  venue: z.object({ name: z.string(), timezone: z.literal("Asia/Kuala_Lumpur"), currency: z.literal("MYR") }).strict(),
  services: z.array(z.object({ serviceId: serviceIdSchema, name: z.string(), shortName: z.string(), unitLabel: z.string(), description: z.string(), enabled: z.boolean(), activeResourceCount: z.number().int().nonnegative() }).strict()),
  hours: configRevisionSchema.shape.hours,
  rates: configRevisionSchema.shape.rates,
  promotions: configRevisionSchema.shape.promotions,
  controllers: configRevisionSchema.shape.controllers,
  bookingRules: configRevisionSchema.shape.bookingRules,
  websiteContent: configRevisionSchema.shape.websiteContent,
}).strict();

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export function toPublicConfig(config: ConfigRevision): PublicConfig {
  const parsed = configRevisionSchema.parse(config);
  return publicConfigSchema.parse({
    schemaVersion: parsed.schemaVersion,
    revisionId: parsed.revisionId,
    venue: parsed.venue,
    services: parsed.services.map((service) => ({
      ...service,
      activeResourceCount: parsed.resources.filter((resource) => resource.serviceId === service.serviceId && resource.lifecycle === "active").length,
    })),
    hours: parsed.hours,
    rates: parsed.rates,
    promotions: parsed.promotions.filter((promotion) => promotion.state === "enabled"),
    controllers: parsed.controllers,
    bookingRules: parsed.bookingRules,
    websiteContent: parsed.websiteContent,
  });
}
