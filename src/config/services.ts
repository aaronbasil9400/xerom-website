import type { ImageMetadata } from "astro";
import { media } from "./media";
import { serviceCore, type ServiceId } from "./service-core";

export type { ServiceId } from "./service-core";

export interface ServiceDefinition {
  id: ServiceId;
  name: string;
  shortName: string;
  unitLabel: string;
  capacity: number;
  calendarEnvKeys: readonly string[];
  description: string;
  image: ImageMetadata;
  imageAlt: string;
}

export const services: Record<ServiceId, ServiceDefinition> = {
  "regular-sim": { ...serviceCore["regular-sim"], image: media.regularRig, imageAlt: "Close-up of the Fanatec control on Xerom’s Regular Rig" },
  "pro-sim": { ...serviceCore["pro-sim"], image: media.proRig, imageAlt: "Close-up of the Porsche-branded wheel centre on Xerom’s Pro Rig" },
  ps5: { ...serviceCore.ps5, image: media.ps5Lounge, imageAlt: "Two PS5 controllers ready in front of the Xerom lounge screen" },
};

export const serviceList = Object.values(services);
