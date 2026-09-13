/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_BOOKING_MODE?: "mock" | "live" | "disabled";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface BookingCoordinatorNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface CloudflareEnv {
  BOOKING_COORDINATOR?: BookingCoordinatorNamespace;
  BOOKING_MODE?: "mock" | "live" | "disabled";
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  TURNSTILE_EXPECTED_ACTION?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  REGULAR_SIM_01_CALENDAR_ID?: string;
  REGULAR_SIM_02_CALENDAR_ID?: string;
  REGULAR_SIM_03_CALENDAR_ID?: string;
  PRO_SIM_01_CALENDAR_ID?: string;
  PS5_01_CALENDAR_ID?: string;
  PS5_02_CALENDAR_ID?: string;
  BOOKING_CONTROL_CALENDAR_ID?: string;
}
