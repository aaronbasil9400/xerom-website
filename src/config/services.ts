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
  "regular-sim": { ...serviceCore["regular-sim"], image: media.regularRig, imageAlt: "A row of sim racing rigs at Xerom" },
  "pro-sim": { ...serviceCore["pro-sim"], image: media.proRig, imageAlt: "Porsche-branded racing wheel and pedals at Xerom" },
  ps5: { ...serviceCore.ps5, image: media.ps5Lounge, imageAlt: "PS5 lounge with a sofa, screen and console at Xerom" },
};

export const serviceList = Object.values(services);
