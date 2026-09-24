# Cloudflare Deployment

The production/demo system has two deployables:

1. `xerom-race-control-coordinator` — a small Worker that hosts the Durable Object and owns serialized Calendar booking creation and owner mutations. The legacy `xerom-booking-coordinator` remains rollback-only and is not the active binding.
2. `xerom-website` — the Astro website deployed as the existing Cloudflare Worker and bound to that Durable Object (the Astro output is also Pages-compatible).

Google Calendar remains the booking record. The Durable Object stores only short-lived coordination/idempotency state.

## Prerequisites

- Cloudflare account and the existing `xerom-website` Worker.
- GitHub repository connected to Workers CI/CD.
- Google Calendar setup completed from `GOOGLE_CALENDAR_SETUP.md`.
- Cloudflare Turnstile widget for the production hostname.
- Confirmed domain, business hours, promotion rules, logo, and launch photography.

## Build settings

```text
Build command: npm run build
Output directory: dist
Node version: current Cloudflare-supported LTS compatible with Astro 7
```

The site uses `@astrojs/cloudflare` with compile-time image optimization and no Astro session store.

## Client-owned temporary Worker — 2026-09-24

The transferred repository is deployed in the client account at `https://xerom-website.xerombookings.workers.dev`, bound to `xerom-race-control-coordinator`. The Worker is live on the seven production-named, private Google Calendars owned by `xerombookings@gmail.com`. The temporary URL is marked `noindex`; attach the approved canonical hostname and update the Turnstile widget before domain cutover.

Race Control and `/api/admin/*` are protected by Cloudflare Access for the owner email. The public booking flow uses a managed Turnstile widget scoped to the Worker hostname, and the Worker has all five Rate Limiting bindings. Test reservations on these calendars are real reservations: label them clearly and remove them from every assigned calendar after the test.

Build and deploy with the client hostname-scoped public widget key:

```bash
PUBLIC_TURNSTILE_SITE_KEY=<public-site-key> npm run build:staging
npx wrangler deploy --var BOOKING_MODE:live --message "Client staging update"
```

`build:staging` requires an explicit `PUBLIC_TURNSTILE_SITE_KEY` and fails instead of falling back to Cloudflare's always-pass test key. Store its matching `TURNSTILE_SECRET_KEY` only as an encrypted Worker secret. To deploy a non-booking preview, use `--var BOOKING_MODE:disabled`.

Do not point unattended previews or synthetic browser tests at the production-named calendars. Use `BOOKING_MODE=disabled` or a separately provisioned set of seven test calendars and a hostname-scoped Turnstile widget.

## Deploy the coordinator first

Authenticate Wrangler locally, then set Worker secrets:

```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put GOOGLE_PRIVATE_KEY --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put REGULAR_SIM_01_CALENDAR_ID --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put REGULAR_SIM_02_CALENDAR_ID --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put REGULAR_SIM_03_CALENDAR_ID --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put PRO_SIM_01_CALENDAR_ID --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put PS5_01_CALENDAR_ID --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put PS5_02_CALENDAR_ID --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put BOOKING_CONTROL_CALENDAR_ID --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put VENUE_GOOGLE_ACCOUNT_EMAIL --config coordinator/wrangler.race-control.jsonc
npx wrangler secret put RACE_CONTROL_TOKEN_ENCRYPTION_KEY --config coordinator/wrangler.race-control.jsonc
npx wrangler deploy --config coordinator/wrangler.race-control.jsonc
```

The coordinator and public Worker need the same randomly generated review-token secret. Enter each value at Wrangler's secret prompt; do not put values in command arguments, logs, source files, or `wrangler.jsonc`. The website also needs the Google service account and seven Calendar IDs for live availability and Race Control schedule reads, plus `OWNER_EMAILS` and the same `RACE_CONTROL_TOKEN_ENCRYPTION_KEY`. The coordinator binds the private `xerom-race-control-config` bucket so final Calendar checks, immutable revision creation and conditional pointer activation run inside venue serialization. Cloudflare requires the Durable Object Worker to be deployed before the website binds to its `script_name`.

## Configure the public Worker

Production environment variables/secrets:

```text
BOOKING_MODE=live
TURNSTILE_SECRET_KEY=<encrypted secret>
RACE_CONTROL_TOKEN_ENCRYPTION_KEY=<at least 32 random bytes; required for configuration review tokens>
OWNER_EMAILS=<encrypted owner email allowlist>
TURNSTILE_EXPECTED_HOSTNAME=<worker hostname until domain cutover>
PUBLIC_TURNSTILE_SITE_KEY=<public build variable; not a Worker secret>
```

The Durable Object binding must be named `BOOKING_COORDINATOR`, point to class `BookingCoordinator`, and use script `xerom-race-control-coordinator`.

### Private R2 configuration and media

R2 uses two private buckets. Objects are reachable only through authenticated admin routes or the website's active-asset allowlist; do not enable `r2.dev`, a custom bucket domain, or browser CORS.

First enable R2 for the Cloudflare account in the Dashboard. This account-level step may present billing terms and cannot be completed through Wrangler. Then create the buckets in the Asia-Pacific region:

```bash
npx wrangler r2 bucket create xerom-race-control-config --location apac
npx wrangler r2 bucket create xerom-race-control-media --location apac
npx wrangler r2 bucket list
```

`wrangler.jsonc` binds both buckets; `coordinator/wrangler.race-control.jsonc` binds only the private configuration bucket. Deploy only after both bucket names exist. An empty config bucket is safe: public runtime reads retain compiled values until a reviewed revision is conditionally activated. Media uploads remain private drafts; `/api/media/:assetId` serves only the hero referenced by the active config revision.

Do not manually seed `active.json`. Publication reloads the saved draft, verifies the expiring review token, repeats the complete Calendar impact scan inside coordinator serialization, writes immutable `revisions/<revisionId>.json`, then conditionally activates and verifies `active.json`. Lost responses retry with the same deterministic operation and revision IDs. Rollback prepares the previous immutable revision as a new draft and must pass the same review/publication path; it never rewinds the pointer directly.

Preview environments should use `BOOKING_MODE=disabled` unless they are connected to dedicated non-production calendars. Never let a preview deployment write to live resource calendars.

## Turnstile

1. Add the production and preview hostnames allowed to use the widget.
2. Store the secret only in Cloudflare encrypted secrets.
3. Expose only the site key as `PUBLIC_TURNSTILE_SITE_KEY`.
4. Test success, expiry, retry, and failure before enabling live booking.

### Hostname cutover

The current managed widget is scoped to `xerom-website.xerombookings.workers.dev`. Add the eventual canonical hostname to a verified widget before domain cutover and update `TURNSTILE_EXPECTED_HOSTNAME`; test credentials must never remain on a production hostname.

## Rate limiting

The five documented Rate Limiting bindings are configured on the client Worker: 120/min availability, 10/min bookings, 60/min owner reads, 60/min owner mutations, and 10/min uploads. They use location-local counters, so retain the Durable Object as the global booking serialization and final Calendar revalidation layer.

## Domain and SEO

1. Attach the approved canonical hostname.
2. Update `site` in `astro.config.mjs` if the final hostname is not `https://xerom.my`.
3. Confirm redirects between `www` and apex.
4. Verify `/robots.txt`, `/sitemap.xml`, canonical tags, Open Graph image, LocalBusiness JSON-LD, contact links, and Google Maps URL.

## Deployment gates

Run locally before merging:

```bash
npm run check
npm test
npm run test:e2e
npm run build
npx wrangler deploy --dry-run --config coordinator/wrangler.race-control.jsonc
npm audit --omit=dev
```

After deployment, run a production smoke test with a dedicated test slot, then remove the test events. Do not announce online booking until real Calendar insertion, rollback, Turnstile, and final-resource concurrency tests have passed in the deployed environment.
