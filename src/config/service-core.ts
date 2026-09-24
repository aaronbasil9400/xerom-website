export type ServiceId = "regular-sim" | "pro-sim" | "ps5";

export const serviceCore = {
  "regular-sim": { id: "regular-sim", name: "Regular Rig", shortName: "Regular", unitLabel: "rig", capacity: 3, calendarEnvKeys: ["REGULAR_SIM_01_CALENDAR_ID", "REGULAR_SIM_02_CALENDAR_ID", "REGULAR_SIM_03_CALENDAR_ID"], description: "An approachable racing setup for casual laps and friendly competition." },
  "pro-sim": { id: "pro-sim", name: "Pro Rig", shortName: "Pro", unitLabel: "rig", capacity: 1, calendarEnvKeys: ["PRO_SIM_01_CALENDAR_ID"], description: "The higher-spec option for drivers who want the most focused experience." },
  ps5: { id: "ps5", name: "PS5 Lounge", shortName: "PS5", unitLabel: "lounge", capacity: 2, calendarEnvKeys: ["PS5_01_CALENDAR_ID", "PS5_02_CALENDAR_ID"], description: "A comfortable lounge setup for two-controller play with friends." },
} as const;
