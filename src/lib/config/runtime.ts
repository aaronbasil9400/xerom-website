import { ConfigNotActivatedError, getConfigRepository } from "./repository";
import { createSeedConfig } from "./seed";
import type { ConfigRevision } from "./schema";

export function compiledConfig(env: CloudflareEnv, now = new Date().toISOString()): ConfigRevision {
  return createSeedConfig({ resources: {
    "regular-01": env.REGULAR_SIM_01_CALENDAR_ID ?? "compiled-regular-01",
    "regular-02": env.REGULAR_SIM_02_CALENDAR_ID ?? "compiled-regular-02",
    "regular-03": env.REGULAR_SIM_03_CALENDAR_ID ?? "compiled-regular-03",
    "pro-01": env.PRO_SIM_01_CALENDAR_ID ?? "compiled-pro-01",
    "ps5-01": env.PS5_01_CALENDAR_ID ?? "compiled-ps5-01",
    "ps5-02": env.PS5_02_CALENDAR_ID ?? "compiled-ps5-02",
  } }, now);
}

export async function resolveRuntimeConfig(env: CloudflareEnv, now = new Date().toISOString()): Promise<{ config: ConfigRevision; compiledFallback: boolean }> {
  try {
    return { config: (await getConfigRepository(env).readActive()).config, compiledFallback: false };
  } catch (error) {
    if (!(error instanceof ConfigNotActivatedError)) throw error;
    return { config: compiledConfig(env, now), compiledFallback: true };
  }
}
