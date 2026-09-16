import { business } from "@/config/business";
import { serviceCore, type ServiceId as LegacyServiceId } from "@/config/service-core";
import { configRevisionSchema, type ConfigRevision, type ServiceId } from "./schema";

export interface SeedCalendarRefs {
  resources: Partial<Record<"regular-01" | "regular-02" | "regular-03" | "pro-01" | "ps5-01" | "ps5-02", string>>;
}

const resourceSeeds: Array<{ resourceId: keyof SeedCalendarRefs["resources"]; serviceId: ServiceId; displayName: string }> = [
  { resourceId: "regular-01", serviceId: "regular-sim", displayName: "Regular Rig 01" },
  { resourceId: "regular-02", serviceId: "regular-sim", displayName: "Regular Rig 02" },
  { resourceId: "regular-03", serviceId: "regular-sim", displayName: "Regular Rig 03" },
  { resourceId: "pro-01", serviceId: "pro-sim", displayName: "Pro Rig 01" },
  { resourceId: "ps5-01", serviceId: "ps5", displayName: "PS5 Lounge 01" },
  { resourceId: "ps5-02", serviceId: "ps5", displayName: "PS5 Lounge 02" },
];

/**
 * Builds the first runtime draft from confirmed compiled values. Calendar IDs are
 * injected by the server and never embedded in source, fixtures, or public JSON.
 */
export function createSeedConfig(calendarRefs: SeedCalendarRefs, now = "2026-09-16T00:00:00+08:00"): ConfigRevision {
  const rateByService: Record<ServiceId, number> = { "regular-sim": 2_000, "pro-sim": 3_000, ps5: 1_800 };
  const draft = {
    schemaVersion: 1,
    revisionId: "seed-draft-v1",
    parentRevision: null,
    publishedAt: null,
    actorId: "migration:compiled-config",
    venue: { name: business.name, timezone: "Asia/Kuala_Lumpur", currency: "MYR" },
    services: (Object.keys(serviceCore) as LegacyServiceId[]).map((serviceId) => ({
      serviceId,
      name: serviceCore[serviceId].name,
      shortName: serviceCore[serviceId].shortName,
      unitLabel: serviceCore[serviceId].unitLabel,
      description: serviceCore[serviceId].description,
      enabled: true,
    })),
    resources: resourceSeeds.map((resource) => ({
      ...resource,
      lifecycle: calendarRefs.resources[resource.resourceId] ? "active" : "draft",
      activeFrom: calendarRefs.resources[resource.resourceId] ? now : null,
      retiredFrom: null,
      controllerCapacity: null,
      calendarRef: calendarRefs.resources[resource.resourceId] ?? null,
    })),
    hours: {
      weekly: {
        monday: [{ open: "14:00", close: "01:00", closeDayOffset: 1 }],
        tuesday: [{ open: "14:00", close: "01:00", closeDayOffset: 1 }],
        wednesday: [{ open: "14:00", close: "01:00", closeDayOffset: 1 }],
        thursday: [{ open: "14:00", close: "01:00", closeDayOffset: 1 }],
        friday: [{ open: "12:00", close: "01:00", closeDayOffset: 1 }],
        saturday: [{ open: "12:00", close: "01:00", closeDayOffset: 1 }],
        sunday: [{ open: "12:00", close: "01:00", closeDayOffset: 1 }],
      },
      exceptions: [],
    },
    rates: (Object.keys(rateByService) as ServiceId[]).map((serviceId) => ({
      rateId: `${serviceId}-base-2026-09-09`,
      serviceId,
      amountSenPerResourceHour: rateByService[serviceId],
      effectiveFrom: "2026-09-09T00:00:00+08:00",
      effectiveUntil: null,
    })),
    // Owner values for offers are unresolved. No synthetic or Instagram offer is activated.
    promotions: [],
    bookingRules: {
      slotIntervalMinutes: 60,
      allowedDurationsMinutes: [60, 120],
      customerMinimumNoticeMinutes: 60,
      horizon: { mode: "rolling-minutes", value: 4_320 },
      bufferMinutes: 0,
      perServiceGroupLimits: { "regular-sim": 3, "pro-sim": 1, ps5: 2 },
      totalGroupLimit: 6,
      mixedServiceAllowed: true,
    },
    websiteContent: {
      homepage: {
        headline: "Race Together",
        intro: "Race. Play. Refuel. One place, one crew, one seriously good night out in Klang.",
        heroAssetId: "social-group-hero-placeholder-ai",
      },
      experiences: {
        "regular-sim": { heading: "Regular Rig", body: serviceCore["regular-sim"].description, assetId: "regular-rig" },
        "pro-sim": { heading: "Pro Rig", body: serviceCore["pro-sim"].description, assetId: "pro-rig" },
        ps5: { heading: "PS5 Lounge", body: serviceCore.ps5.description, assetId: "ps5-lounge" },
      },
      venue: {
        phoneDisplay: business.phoneDisplay,
        phoneInternational: business.phoneInternational,
        whatsappNumber: business.whatsappNumber,
        instagramHandle: business.instagramHandle,
        instagramUrl: business.instagramUrl,
        mapsUrl: business.mapsUrl,
        addressLines: [business.address.street, business.address.locality, `${business.address.postalCode} ${business.address.city}`, business.address.region, business.address.country],
      },
      pricingIntro: "Simple hourly sessions for every kind of crew.",
      galleryAssetIds: ["regular-rig", "pro-rig", "ps5-lounge", "cafe-atmosphere"],
    },
  };
  return configRevisionSchema.parse(draft);
}
