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
  RACE_CONTROL_CONFIG_BUCKET?: R2Bucket;
  RACE_CONTROL_MEDIA_BUCKET?: R2Bucket;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUDIENCE?: string;
  OWNER_EMAILS?: string;
  GOOGLE_OWNER_OAUTH_CLIENT_ID?: string;
  GOOGLE_OWNER_OAUTH_CLIENT_SECRET?: string;
  GOOGLE_OWNER_OAUTH_REDIRECT_URI?: string;
  RACE_CONTROL_TOKEN_ENCRYPTION_KEY?: string;
}

declare namespace App {
  interface Locals {
    owner?: {
      actorId: string;
      email: string;
      subject: string;
    };
  }
}
