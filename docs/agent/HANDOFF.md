# Agent Handoff

Last updated: 2026-09-16

## Current state

The responsive Astro site, mock booking flow, Google Calendar adapters, booking coordinator Worker, official SVG logo, and operational documentation are implemented. The independent Impeccable review closed with `ship`; `DESIGN.md` and `.impeccable/design.json` reflect the reviewed interface. Google Cloud Calendar resources are created and shared, and the coordinator Worker is deployed; encrypted secret entry and live smoke testing remain.

## Next action

Google service-account credentials and calendar IDs are stored as encrypted secrets on both Workers, the coordinator is deployed, and live availability/booking, idempotency, and concurrency smoke tests have passed. The client demo Worker is live with Cloudflare's always-pass Turnstile test pair; replace those test values with a hostname-scoped widget before public launch. Resolve the remaining owner items in `CONTENT_TODO.md` before public launch.

## Tooling note

Project Playwright Chromium is installed and the six-width local suite passes. The separate Playwright MCP remained configured for a system Chrome path that was unavailable; local QA used the project Playwright runtime instead.

## Known blockers

See `CONTENT_TODO.md`. Most items do not block concept work, but verified address/contact, public-holiday hours, promotion behavior, production media, and Cloudflare/Google credentials block launch.

## Homepage upgrade continuation

The cinematic homepage upgrade is implemented, locally verified, committed, and pushed on `exp/homepage-cinematic-v1` through `7b313df`. The exact hero headline is `Race Together`; booking production files are unchanged from baseline `4e9787c`. Before/after evidence and Lighthouse JSON live in `.impeccable/review/homepage-upgrade/`, and the complete chronology is in `docs/agent/HOMEPAGE_UPGRADE_WORKLOG.md`.

The remaining gate is external: deploy the pushed branch with a valid `CLOUDFLARE_API_TOKEN`, run `VISUAL_VARIANT=deployed PLAYWRIGHT_BASE_URL=<staging-origin> npx playwright test tests/e2e/visual.spec.ts --workers=1`, run Lighthouse against that origin, and perform the non-destructive staging checks permitted by the owner. The 2026-09-15 deployment attempt stopped before upload because the token was absent; the existing staging Worker was not changed. Do not merge to `main` without owner approval.

## Race Control planning handoff — 2026-09-15

Owner discovery is complete. Start dashboard implementation with [RACE_CONTROL_HANDOFF.md](RACE_CONTROL_HANDOFF.md), then follow [the complete plan](../RACE_CONTROL_PLAN.md). Begin with RC-00 capability spike and RC-01 shared contracts; preserve the existing public site and user-owned `docs/mockups/index.html`. No dashboard code, deployment, Google mutation or new storage was performed during planning.

Do not repeat the nine scope questions: answers are recorded in PRODUCT.md and the plan. Remaining real values/identity/retention inputs are in CONTENT_TODO.md. Historical status above describes earlier work and must not be mistaken for verification of these new features.

## Race Control implementation checkpoint — 2026-09-16

RC-00 and the first RC-01/RC-02/RC-03 foundations are implemented locally. See `docs/agent/RC00_CAPABILITY_SPIKE.md`. Shared strict schemas cover config, public projection, quotes, booking actions and operations; the seed contains confirmed hours/prices/resources and no active offer. Owner auth fails closed outside localhost development. The private config repository implements stale-draft rejection, immutable revisions and conditional pointer activation behind an unbound R2 gate. Google FreeBusy and insert replay now fail closed. A typed operation journal/dispatcher prototype persists idempotency state and recovery fences. Runtime pricing tests the no-stacking winner rule with synthetic offers only.

The owner dashboard shell and all stable navigation routes exist under `/race-control`, use the official logo and current design system, default to a phone agenda, and are explicitly labelled as non-live fixtures. The shell is not a complete front desk: actions, settings review/publish, Calendar schedule reads, OAuth/provisioning, media upload and public runtime cutover remain unimplemented.

Local evidence: `npm run check` passed; `npm test` passed 51/51; `npm run build` passed; the Race Control Playwright suite passed 12/12 across all six required widths after fixing 768/1024 overflow. Screenshots are in `.impeccable/review/race-control/`. No production deployment, R2 write, Google mutation, calendar creation or deletion occurred.

Continue in dependency order: finish RC-02 API review/publish and authenticated preview, integrate RC-03 journal/fences into the live coordinator with alarm recovery and failure injection, then RC-04 runtime cutover behind isolated bindings. Do not treat the present static shell as RC-05/RC-06/RC-07 completion.

## Race Control branch-preview progress — 2026-09-16

The implementation now lives on `codex/race-control-working`, pushed to `origin` at `d0ce491` after baseline commit `5e726da`. Cloudflare branch build `bb46454c` completed successfully for `d0ce491`; it uploaded a non-production version and did not change production traffic. The production `main` Worker remains on its prior active version.

The feature branch adds authenticated owner endpoints for a bounded schedule read and owner booking creation. `GET /api/admin/schedule` lists the same private Google resource/control calendars used by the main public booking flow and fails closed if any calendar cannot be read. `POST /api/admin/bookings` uses the existing named booking coordinator, so successful owner bookings create the same linked Calendar events and availability blocks as public bookings. The browser UI changes from fixtures to that live shared schedule only when the runtime calendar/coordinator bindings exist; local development remains fixture-safe.

Tests at this checkpoint: `npm run check` clean; targeted Calendar adapter tests 4/4 pass; local six-width Race Control suite 12/12 passes after live reads were gated away from missing local secrets. A prior local test run generated ignored Playwright report artifacts; `tsconfig.json` now excludes them from Astro checking.

Blocking external action: the Cloudflare account has no Zero Trust organization. Do not expose the deployed owner routes until the owner explicitly confirms creation of a Zero Trust organization and an email-OTP Access policy for the owner identity. No Access app, policy, R2 bucket, Google OAuth credential, Calendar ACL or Calendar event has been created/changed during this branch work.

Update: Zero Trust onboarding reached the Free-plan checkout. Cloudflare requires terms acceptance and authorization of the saved payment card for possible overage charges before activation. This is awaiting explicit owner approval; no plan, Access organization, policy, identity provider, or billing authorization has been activated. The repeatable setup procedure is in `docs/agent/CLIENT_RACE_CONTROL_SETUP.md`.

## Zero Trust activation checkpoint — 2026-09-16

Owner authorized the Free-plan terms/card step. Zero Trust is now active as team `lingering-sky-58df`. Access application `Xerom Race Control Branch Preview` (`6cbb336f-5aff-4659-b1e2-97982924b3aa`) protects the branch hostname paths `/race-control/*` and `/api/admin/*`; reusable Allow policy `Xerom Race Control Owner` (`57014aed-34b5-4b9b-967a-bce1e926400f`) contains only the owner email. Worker runtime variables `ACCESS_TEAM_DOMAIN` and `ACCESS_AUDIENCE` plus encrypted `OWNER_EMAILS` were added through the Cloudflare dashboard. The exact recreation steps and non-secret identifiers are in `CLIENT_RACE_CONTROL_SETUP.md`; do not copy the AUD value into public docs or source.

R2 remains unenabled: the account API returns code 10042 and asks for Dashboard enablement. No R2 bucket/binding was created. Treat any R2 billing/terms prompt as a new explicit approval gate.

## Front-desk booking action checkpoint — 2026-09-16

The branch now exposes owner-only booking creation at `POST /api/admin/bookings` and grouped lifecycle actions at `POST /api/admin/bookings/:id/actions`. Creation delegates to the same named `xerom-global-booking-coordinator` and Calendar resources as the main public booking flow. Lifecycle actions are coordinator-ordered, locate all linked events by private `bookingId`, require a matching group version, and use Google `If-Match` ETags. Check-in, complete, no-show and cancel are implemented; cancel preserves the Calendar record and releases availability by setting transparency to `transparent`. Partial or stale updates return failure/review responses rather than success.

Schedule reads now support paginated Calendar event listing and private-property filtering. The browser schedule switches from labelled fixtures to a live event list only when the runtime credentials/binding gate is present; local development stays fixture-safe. The new owner booking form generates an idempotency key and displays success only after the coordinator response.

Local evidence after this slice: `npm run check` clean; Race Control unit/contract tests 24/24; `npm run build` passed. Google action behavior is adapter-tested with mocked responses but has not been run against live Calendar events. Reschedule, extension, maintenance/closure commands, settings publication, R2 persistence, OAuth provisioning and media publication remain open.

Update: the coordinator action dispatcher now also supports same-resource rescheduling (with resource-set equality and busy-event exclusion) and extensions (with next-interval conflict checks and an explicit price-review result). These paths preserve the original booking price and use ETag-guarded patches. Moving resources, quote calculation for extensions, compensation after partial group updates, maintenance/closure blocks and settings remain open.

Update: maintenance and venue-closure blocks are now available through `POST /api/admin/blocks` and a shared Race Control form. Maintenance targets selected resource calendars; a venue closure must target Booking Control. The coordinator preflights busy events, creates deterministic opaque events, and best-effort rolls back partial creation. No automatic customer cancellation is performed. R2-backed publication and full impact-review UI remain gated.

Update: configuration review now has a fail-closed `POST /api/admin/config/review` boundary. It hashes the saved draft, binds a five-minute HMAC review token to its base revision, and explicitly reports that the complete future-booking impact scan is still required. It cannot publish without the R2 repository, encryption secret and coordinator-backed impact review.
