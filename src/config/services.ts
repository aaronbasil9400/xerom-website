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
  "regular-sim": { ...serviceCore["regular-sim"], image: media.regularRig, imageAlt: "Placeholder for a Xerom Regular Sim rig photograph" },
  "pro-sim": { ...serviceCore["pro-sim"], image: media.proRig, imageAlt: "Placeholder for the Xerom Pro Sim rig photograph" },
  ps5: { ...serviceCore.ps5, image: media.ps5Lounge, imageAlt: "Placeholder for a Xerom PS5 lounge photograph" },
};

export const serviceList = Object.values(services);
