# XEROM Website Agent Guide

## Mission

Build and maintain the production website and database-free booking system for Xerom SimRacing & Cafe in Klang, Malaysia. The website is a real business surface: never invent prices, hours, equipment, policies, reviews, promotions, or capacities.

## Sources of truth

Read these files before changing the project:

1. `PRODUCT.md` — confirmed product facts and durable constraints.
2. `CONTENT_TODO.md` — unresolved facts and assets that require owner confirmation.
3. `WEBSITE_PLAN.md` — approved delivery sequence and acceptance gates.
4. `BOOKING_ARCHITECTURE.md` — booking invariants, API boundaries, and failure handling.
5. `RESEARCH.md` — evidence, provenance, and source limitations.
6. `DESIGN.md` — visual system after the visual direction has been approved and implemented. It is intentionally absent during the planning/concept phase.

If documents conflict, confirmed owner input in `PRODUCT.md` wins over public promotional material. Security and booking invariants in `BOOKING_ARCHITECTURE.md` win over presentation preferences.

## Mandatory working rules

- Use Astro + TypeScript and target Cloudflare Pages.
- Use Google Calendar as the persistent booking system of record. Do not introduce D1, Firebase, Supabase, PostgreSQL, MySQL, MongoDB, or another application database without an explicit new requirement and owner approval.
- Keep secrets and calendar IDs server-side. Never place them in browser bundles, logs, analytics, fixtures, screenshots, or commits.
- Treat all busy events on a resource calendar as unavailable, including manual bookings and maintenance blocks.
- Revalidate availability inside the serialized booking operation before creating any event.
- Never report success until every required Google Calendar event has been created. Roll back partial multi-resource creation on failure.
- Preserve idempotency: retries of one booking attempt must not create a second booking.
- Do not send names, phone numbers, booking IDs, notes, or slot details to analytics.
- Keep business data centralized and editable; do not repeat prices, hours, resource counts, or promotions across components.
- Add every unknown or stale business fact to `CONTENT_TODO.md` instead of substituting plausible copy.
- Do not scrape and republish Instagram imagery as production assets. Temporary placeholders must be marked and replaceable.

## Design workflow

- The project uses Impeccable in comp-first mode. Read `PRODUCT.md` before design work.
- `DESIGN.md` is the authoritative source for the latest implemented visual system. Use it for design references and decisions; treat `.impeccable/design.json` and other generated Impeccable sidecars as derived caches that must not override `DESIGN.md` when they disagree or are stale.
- Do not create or finalize `DESIGN.md` before the owner selects a visual concept and the implemented surface is visually verified. `DESIGN.md` must describe the shipped world, not an aspiration.
- Preserve the official Xerom wordmark at `src/assets/brand/xerom-logo.svg`. Its red and white paths were traced from the owner-supplied raster; do not redraw, typeset, recolor, or distort it without explicit owner approval.
- Visual concept selection is an explicit approval gate. Do not silently choose a generic neon gaming template.
- Meet WCAG 2.2 AA where applicable, support reduced motion, and keep booking usable with keyboard and screen readers.
- Visual QA must cover 375, 390, 430, 768, 1024, and 1440+ CSS-pixel widths.

## Verification expectations

Before calling an implementation complete, run lint, typecheck, unit/integration tests, production build, and Playwright end-to-end checks. Inspect browser console errors, failed network requests, broken links, 404 assets, keyboard flow, focus visibility, mobile overflow, reduced motion, and booking error states. Test the final-resource concurrency race and prove exactly one request succeeds.

Keep `QA_REPORT.md` evidence-based. Record commands, dates, environments, results, known limitations, and screenshot paths. Do not mark unrun checks as passing.

## Change discipline

- Preserve user changes and unrelated work.
- Update relevant documentation in the same change as behavior or configuration.
- Add an entry to `docs/agent/DECISIONS.md` for material architecture, policy, integration, or design decisions.
- Leave a concise update in `docs/agent/HANDOFF.md` when stopping with incomplete work.
- Use explicit placeholders such as `TODO(owner): ...`; never disguise a placeholder as final business copy.

## How the project fits together, especially on Cloudflare

Read this before changing anything that can affect the deployed site. The repository ships **two separate Cloudflare Workers**, and they are **deployed independently**. Mixing them up is the most common and most damaging mistake an agent can make here.

### The two deployables

1. **`xerom-website`** — the Astro website and all HTTP routes. Built from the repo root with `wrangler.jsonc` and `@astrojs/cloudflare`. This worker:
   - Serves the public marketing pages, the booking flow, and the protected Race Control UI.
   - Owns every API route under `src/pages/api/**` (public `/api/availability`, `/api/bookings`, `/api/public-config`, `/api/media/:assetId`; owner `/api/admin/**`).
   - Holds the rate-limit bindings (see below), the `BOOKING_COORDINATOR` Durable Object binding, and both R2 buckets (`RACE_CONTROL_CONFIG_BUCKET`, `RACE_CONTROL_MEDIA_BUCKET`).
   - Is **auto-deployed by Cloudflare Workers Builds on every push to `main`** (build command `npm run build:staging`, deploy command `npx wrangler deploy`). Pushing to `main` is normally all that is needed to ship website changes.

2. **`xerom-race-control-coordinator`** — a separate Worker that hosts the `BookingCoordinator` Durable Object. Built from `coordinator/` with `coordinator/wrangler.race-control.jsonc`. This worker:
   - Owns serialized booking creation/revalidation, idempotency, and every owner mutation that touches Google Calendar (booking actions, block-time create/remove, config activation, recovery fences).
   - Binds the private `xerom-race-control-config` R2 bucket and the Google/Calendar secrets.
   - Is **NOT deployed by the website pipeline.** It is deployed **manually** with `npm run coordinator:deploy`. A `git push` to `main` does **not** update it. The website worker talks to it over the `BOOKING_COORDINATOR` binding (`script_name: xerom-race-control-coordinator`).
   - `coordinator/wrangler.jsonc` (worker name `xerom-booking-coordinator`) is the **legacy rollback-only** config and is not the active binding. Do not deploy it as part of normal work.

### Rule: coordinator changes require a coordinator deploy

**Any change under `coordinator/` only takes effect after `npm run coordinator:deploy`.** If you change `coordinator/src/index.ts` (for example adding a new command or an API-route-to-coordinator path) and only push to `main`, the website ships the new UI/route but the live coordinator still runs the old code — the feature silently fails at runtime even though the deploy "succeeded". Always:

1. Verify the change locally (see the coordinator section of `CLOUDFLARE_DEPLOYMENT.md`).
2. Run `npm run coordinator:deploy` (or confirm the owner pipeline does) so the coordinator version advances.
3. Confirm with `npx wrangler deployments status --name xerom-race-control-coordinator` that a new version is at 100%.

Coordinator deploys are a live-infrastructure action. Per `docs/agent/CLOUDFLARE_AGENT_CHANGE_RUNBOOK.md`, source/binding changes to the coordinator require their own test and rollback plan, and production-affecting actions need explicit owner approval — do not treat dashboard access as permission.

### Request flow at runtime

- Owner browser → `xerom-website` `/race-control/*` → Cloudflare Access (owner identity) → `verifyOwnerRequest` in `src/middleware.ts` → route.
- Owner mutations (`src/pages/api/admin/*`, non-GET) → verified owner + CSRF header (`X-Xerom-CSRF: race-control-v1`) → forwarded to the coordinator Durable Object via the `BOOKING_COORDINATOR` binding with an `x-xerom-command` header (for example `block-time`, `remove-block`, `booking-action`, `activate-config`). The coordinator dispatches on that header in `coordinator/src/index.ts`; **a command header the live coordinator does not recognize falls through to the booking parser and returns an error**, which is exactly the failure mode a stale coordinator produces.
- Public booking → `/api/bookings` → same coordinator binding.

### Bindings and protection (as configured in `wrangler.jsonc`)

- **Durable Object:** `BOOKING_COORDINATOR` → class `BookingCoordinator` → `script_name: xerom-race-control-coordinator`.
- **R2 buckets:** `RACE_CONTROL_CONFIG_BUCKET` (`xerom-race-control-config`) and `RACE_CONTROL_MEDIA_BUCKET` (`xerom-race-control-media`), private, no `r2.dev`/custom domain/browser CORS.
- **Rate limits (location-local):** `PUBLIC_AVAILABILITY_RATE_LIMIT` 120/min, `PUBLIC_BOOKING_RATE_LIMIT` 10/min, `OWNER_READ_RATE_LIMIT` 60/min, `OWNER_MUTATION_RATE_LIMIT` 60/min, `OWNER_UPLOAD_RATE_LIMIT` 10/min. Assignment lives in `src/middleware.ts`; note `OWNER_MUTATION_RATE_LIMIT` covers any `/api/admin/*` non-GET, including `DELETE /api/admin/blocks`.
- **Access:** `/race-control`, `/race-control/*`, and `/api/admin/*` are owner-only (Cloudflare Access + `verifyOwnerRequest`). Locally, `import.meta.env.DEV` on `localhost`/`127.0.0.1` injects a fixture owner so tests and dev work without Access.
- **Vars/secrets:** `BOOKING_MODE=live`, `TURNSTILE_EXPECTED_HOSTNAME` (current Worker hostname until cutover), `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE`; secrets include `TURNSTILE_SECRET_KEY`, `RACE_CONTROL_TOKEN_ENCRYPTION_KEY`, `OWNER_EMAILS`, and the Google service account + seven Calendar IDs. Never put secrets in source, `wrangler.jsonc`, logs, fixtures, or commits.

### Environment and data model

- Google Calendar is the booking system of record; the coordinator's Durable Object stores only short-lived coordination/idempotency/activity state. Do not add a conventional database (see the mandatory rules above).
- The website runs `BOOKING_MODE=live` against the production-named private calendars. Never point unattended previews or synthetic tests at those calendars; use `BOOKING_MODE=disabled` or dedicated test calendars.
- Local `npm run dev` uses mock availability/booking and, without `.dev.vars` (gitignored), shows fixture views rather than the live Schedule — so e2e tests normally exercise the fixture/demo UI, not live Google data.

### Deploy and verify commands

```bash
# Website (normally via Workers Builds on push to main; these are for local/staging builds)
npm run build:staging                 # requires PUBLIC_TURNSTILE_SITE_KEY; sets PUBLIC_STAGING_SITE=1
npx wrangler deploy --var BOOKING_MODE:live --message "<note>"

# Coordinator (MANUAL — required for any coordinator/ change)
npm run coordinator:deploy

# Read-only deploys status
npx wrangler deployments status --name xerom-website
npx wrangler deployments status --name xerom-race-control-coordinator

# Deployment gates before merging (see CLOUDFLARE_DEPLOYMENT.md)
npm run check && npm test && npm run test:e2e && npm run build
npx wrangler deploy --dry-run --config coordinator/wrangler.race-control.jsonc
```

### Practical lesson recorded from a real incident

A block-removal feature shipped to `main` with the UI, the `DELETE /api/admin/blocks` route, and the new `remove-block` coordinator command — but the feature did not work in production because the coordinator had not been redeployed since before the change. The prompt appeared (client code ran) but the block never disappeared (the stale coordinator rejected the unknown command). The fix was `npm run coordinator:deploy`. **Whenever a feature spans `src/` and `coordinator/`, confirm both the website and the coordinator are on the new version before calling it done.**

See also: `CLOUDFLARE_DEPLOYMENT.md` (full deployment model), `docs/agent/CLOUDFLARE_AGENT_CHANGE_RUNBOOK.md` (safe change workflow and escalation), `BOOKING_ARCHITECTURE.md` (booking invariants), `docs/agent/CLIENT_RACE_CONTROL_SETUP.md` (account/Access/Google setup).
