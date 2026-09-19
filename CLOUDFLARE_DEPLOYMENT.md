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

## Current Worker client demo

The client demo uses the existing `xerom-website` Worker and the separately deployed `xerom-race-control-coordinator`. The root configuration uses `BOOKING_MODE=live`, so a successful demo booking is a real Calendar reservation and must be cancelled or removed from every assigned resource calendar afterward.

Deploy the current Worker with:

```bash
npm run build:staging
npx wrangler deploy --message "Client demo"
```

`build:staging` injects Cloudflare's documented always-pass public demo site key so the widget is present. It does not contain or change the private `TURNSTILE_SECRET_KEY`. To use a real widget later, override `PUBLIC_TURNSTILE_SITE_KEY` for the build and update the Worker secret through Wrangler's secret workflow.

Do not use this Worker for unattended previews or synthetic browser tests. Branch previews that need isolation must use `BOOKING_MODE=disabled` or a separately provisioned set of seven test calendars and Turnstile domains.

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
npm run coordinator:deploy
```

Never place secrets in `wrangler.jsonc`. Cloudflare requires this Durable Object to be deployed as a Worker and then bound to the public Worker using the `script_name` recorded in the root `wrangler.jsonc`.

## Configure the public Worker

Production environment variables/secrets:

```text
BOOKING_MODE=live
TURNSTILE_SECRET_KEY=<encrypted secret>
PUBLIC_TURNSTILE_SITE_KEY=<public environment variable>
```

The Durable Object binding must be named `BOOKING_COORDINATOR`, point to class `BookingCoordinator`, and use script `xerom-race-control-coordinator`.

Preview environments should use `BOOKING_MODE=disabled` unless they are connected to dedicated non-production calendars. Never let a preview deployment write to live resource calendars.

## Turnstile

1. Add the production and preview hostnames allowed to use the widget.
2. Store the secret only in Cloudflare encrypted secrets.
3. Expose only the site key as `PUBLIC_TURNSTILE_SITE_KEY`.
4. Test success, expiry, retry, and failure before enabling live booking.

### Current demo note

The `xerom-website` Worker currently uses Cloudflare's documented always-pass Turnstile test pair so the client demo can exercise the live Google Calendar flow on its temporary `workers.dev` hostname. Replace both test values with a real hostname-scoped widget before public launch; test credentials must never remain on a production hostname.

## Rate limiting

**High-priority deferred launch task:** after the current client test/demo, create Cloudflare rate-limiting rules for `/api/availability` and `/api/bookings`. Start conservatively, observe real traffic, and allow ordinary group booking retries while blocking sustained automated bursts. The booking endpoint already validates origin, request size, schema, Turnstile, and idempotency; edge rate limiting is the outer abuse-control layer. Do not treat the demo deferral as production approval.

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
