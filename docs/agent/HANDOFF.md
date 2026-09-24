# Agent Handoff

Last updated: 2026-09-24

## Client-owned staging rebuild — 2026-09-24

The transferred repository’s local `origin` now points to `https://github.com/xerombookings-dev/xerom-website.git`; push access was verified with a dry run. Setup changes are not committed yet. Preserve the untracked `graphify-out/` directory.

The client Cloudflare account now hosts `xerom-race-control-coordinator` and `xerom-website` at `https://xerom-website.xerombookings.workers.dev`. The website runs live against seven private, client-owned Kuala Lumpur calendars. Owner paths require the Access allow policy for the client identity. A real managed Turnstile widget is restricted to the temporary worker hostname; five Rate Limiting bindings are deployed. The temporary host is `noindex` and `robots.txt` disallows crawling.

Verification: 126 unit/contract tests passed, Astro check is clean, the staging build and Wrangler dry run pass, and remote homepage visual E2E passed all six widths. Live availability returned capacities from the three service groups; the Access-authenticated Race Control schedule loaded Calendar data. Two simultaneous Pro requests at a single-resource slot produced one confirmation and one slot-taken response. The one winner event was deleted, Calendar search found no remaining matching event, and FreeBusy is clear. R2 write/read/delete probes also passed and were cleaned up.

Remaining: commit and push the setup changes, connect Cloudflare Workers Builds to the transferred GitHub repository if the owner intends automatic deploys, and replace the temporary workers.dev hostname when the owner supplies the canonical domain. R2 has no active or draft configuration, and no business configuration was published. Do not run another Calendar write test without a new owner request; the authorized synthetic race test has been completed and cleaned up.

## Homepage hours-card deployment — 2026-09-23

The Pick Your Pace card now shows today's Malaysia-local hours from active runtime configuration, including any date exception, with a link to the weekly schedule on `/visit#hours`. Commit `6587800` is pushed to `origin/minor_changes`; Cloudflare built preview version `2ea013fa-723f-4cbd-8fd5-ad714aa1ac5f`. The owner-requested `xerom-website.aaronbasil9400.workers.dev` Worker is deployed at version `c032fa67-ba2c-4132-b943-200324bdbcdd` (100% traffic).

Read-only deployed Playwright passed the homepage at all six required widths. At 390 and 1440px, the card and link were visually inspected, the weekly schedule destination loaded, and no console errors, failed requests or horizontal overflow appeared. Local check, 126 unit tests, staging build and the full local Playwright suite passed. No Calendar event or owner configuration was changed. The unrelated untracked `graphify-out/` directory was left intact.

## Private calendar provisioning — 2026-09-23

Resource increases were unpublishable because the readiness gate requires every non-retired resource to have an active private Calendar, and nothing could bind one. Race Control now provisions it: `POST /api/admin/resources/provision` creates one private secondary calendar per resource in the service-account identity, verifies read/write with a removed probe event, reconciles lost responses through a stable `xerom-resource:<resourceId>` marker instead of blind retries, and links `calendarRef` in the draft without ever returning it to the browser. The Resources editor lists every resource and offers **Create private calendar** for unlinked rows.

Deployed as `xerom-website` version `c1a6698a-7ee5-45a4-8e7d-46b2a4069319`. Verification: Astro check clean; 123/123 unit/contract tests; staging build passed. No calendar was created yet and no configuration was published.

First live attempt surfaced a defect: the write-verification probe used the event ID `xerom-provision-probe`, which violates Google's base32hex ID rule (`a-v`, `0-9`), so verification always failed with a 400. The probe ID is now a deterministic 32-character hex digest of the resource ID. Deployed as `xerom-website` version `7ebb2220-e3cc-49ab-87a2-11bf5fce128f` (124/124 tests). Because the calendar is created before verification, a resource that failed this way already has its calendar; retrying reconciles it by marker and links it. Calendar ownership remains service-account-based.

Optional improvement: set the `VENUE_GOOGLE_ACCOUNT_EMAIL` Worker secret to the venue Google account so new calendars are auto-shared for staff management. Without it, provisioning works but the owner shares the calendar manually. Next step is the owner's authenticated run: increase a quantity, provision, save, review, publish.

## Review-blocked publication fix — 2026-09-23

The owner could not publish. Production evidence: `/api/admin/config/review` returned 503 twice, `/api/admin/config/draft` 503 twice, and the coordinator received **zero** `activate-config` calls, so the Publish button never enabled.

Cause: the review impact scan listed each calendar with no time bound, walking the entire event history and expanding recurrences — a CPU/memory and Google quota risk that produced intermittent failures. Fix: the inventory is now bounded to events ending after the review instant (`singleEvents=true`, `timeMin=now`), while open-ended recurring series are still fetched by master ID and returned as explicit blocking conflicts. Review/publish failures now log an identifier-free cause and return a safe reason to the owner.

Deployed as `xerom-website` version `78940cac-8abd-4bab-97d7-1b0ae38f0ef1`. Verification: Astro check clean; 119/119 unit/contract tests; staging build passed. No config revision or `active.json` exists and no Calendar event changed.

Next: the owner retries **Review changes** then **Publish reviewed draft**. If review now reports conflicts, they are real future Calendar blocks in the private calendars that need explicit resolution; if it reports an error, the new logs name the cause without exposing identifiers.

## Production deployment checkpoint — 2026-09-23

Commit `c1432b5` is deployed to Cloudflare. The coordinator (`xerom-race-control-coordinator`) is live at version `41465367-fa6f-4ad9-9882-a34ac334c90b`, and the website (`xerom-website`) is live at code version `2a1f2aaa-1937-4166-95c9-fc1e6e7e7990` followed by secret-change version `65bf1e62-013d-4d3b-887f-850ee7714425`. The coordinator was deployed first because the website emits the new `activate-config` command and booking revision contract.

One shared `RACE_CONTROL_TOKEN_ENCRYPTION_KEY` value was rotated onto both Workers through `wrangler secret bulk` (never printed, passed only through a 0600 temp file that was deleted afterward). Both Workers now report the secret.

Read-only production verification after deploy: homepage `/` 200; `/api/public-config` 200 with compiled bootstrap (`seed-draft-v2`); `/race-control/schedule` and `/api/admin/config/draft` 302 to Cloudflare Access; coordinator public URL 404 as designed; live `/api/availability` 200 with `mode: "live"` and configured capacities. `xerom-race-control-config` still has no `active.json` or `draft.json` object.

Not done: no configuration revision was published, `active.json` was not created, no media object was added, and no Google Calendar event was created or changed. The authenticated owner review/publish flow has not yet been exercised end to end and remains the next gate.

## Configuration publication checkpoint — 2026-09-23

The local branch now implements the full reviewed publication boundary. Owner publication reloads and hashes the saved draft, verifies its five-minute token/base revision, repeats the complete Calendar scan inside the shared Durable Object queue, records durable intent, writes an immutable R2 revision and conditionally verifies `active.json`. Same-attempt retries recover before or after activation without duplicate revisions. Rollback creates a new draft from the prior revision while preserving the current private resource registry; it must pass the same review and publication path.

Public homepage, pricing, experiences, visit, booking setup, availability, final coordinator validation and Calendar price metadata now consume the same active configuration. An open booking page sends its displayed revision; availability or final creation rejects a changed revision rather than silently applying new prices/rules. Empty R2 remains an explicit compiled bootstrap, while a pointer to a missing revision fails closed.

Local evidence: Astro check clean; 119/119 unit/contract tests; production and staging builds; website/coordinator Wrangler dry runs; six-width Playwright 70 passed with 38 intentional viewport-specific skips. No publish/rollback API was invoked, no R2 active pointer/revision was created, and no Calendar state was mutated. Coordinator must deploy before the website because the website emits the updated activation command and booking revision contract. First authenticated review and any actual publication remain separate owner-controlled actions.

## R2 activation checkpoint — 2026-09-22

The owner approved R2 implementation. Source now binds two private buckets: `xerom-race-control-config` and `xerom-race-control-media`. No public bucket URL, custom domain or CORS is permitted. Existing repository/upload/public-read code remains fail-safe: an empty config bucket preserves compiled public values, uploaded media stays private, and only an active revision may expose its selected hero through the Worker route.

R2 is now enabled. Both APAC Standard-class buckets were created and website Worker version `e7a0627b-1bb1-4db4-ad6f-5dc846d506c5` was deployed with the bindings. Remote put/get/delete probes passed in both buckets and were removed; both buckets remain empty. `r2.dev` is disabled and neither bucket has a custom domain. Public homepage/pricing fallback and invalid-media denial passed after deployment. Authenticated owner draft/media persistence still needs an Access-authenticated browser session; settings publication remains blocked by the incomplete future-booking impact scan. Do not manually create `active.json`.

## Website upgrade kickoff — 2026-09-22 (in progress)

The owner supplied a new website upgrade brief and execution prompt. The architecture audit and required Checkpoint 1 report are complete. Google Calendar remains the booking record; the recommended persistence shape remains private R2 config/media plus the coordinator, with no conventional database. The owner specified RM3 per additional PS5 controller per booking and requested code-only R2 work with account activation separately gated.

Implementation tracking and the detailed activity log are in `docs/agent/WEBSITE_UPGRADE_WORKLOG.md`. Phases 2–4 are implemented and locally verified. Phase 5 mockups are in `docs/mockups/availability-indicators.html` with desktop/mobile captures under `.impeccable/review/availability-mockup/`. Work is stopped at the mandatory approval gate: do not implement production indicators, availability auto-load, or downstream phases until the owner explicitly approves or revises the mockup. Email delivery remains explicitly deferred.

Mockup revision 2 spells out all mobile legend abbreviations and includes dedicated Pro-only and PS5-only examples. It is still awaiting owner approval.

Owner approved mockup revision 2 on 2026-09-22. The Phase 5 hard stop is lifted; production availability implementation may proceed using that approved system.

## Website upgrade continuation checkpoint — 2026-09-22

The approved production availability indicators, today auto-load, full-duration capacity logic, optional-email booking flow, detailed confirmation and WhatsApp auto-open/fallback are implemented. Race Control now projects Calendar events into normalized contact/controller records, displays contact details in the live inspector, provides WhatsApp Customer, combines phone/resource/duration booking filters and exports escaped analytics CSV.

Business Settings and Publishing code now use the planned R2 boundary without activating R2. Settings load a clearly unsaved seed when storage is unavailable; managed Calendar IDs are redacted from browser responses and restored only server-side. The hero uploader preserves the existing 16:9/1600×900 contract and validates JPEG/PNG/WebP up to 8 MB on both client and server. Publication remains intentionally blocked because the future-booking impact scan and R2 activation are incomplete.

Cloudflare Rate Limiting adapters and recommended values are documented in `docs/architecture/RATE_LIMITING.md`; production bindings are not configured. The coordinator still serializes public and owner writes through one queue, and the new final-resource unit test proves exactly one of two simultaneous attempts succeeds.

Latest local evidence: Astro check clean; 92/92 unit tests; production build; 21/21 media derivatives; coordinator dry run; clean diff; Playwright 69 passed / 33 intentional viewport skips across 375, 390, 430, 768, 1024 and 1440. The first Playwright pass found 13px tablet overflow in Publishing; the grid breakpoint was corrected and the clean full rerun passed.

Remaining gates: authenticated protected-preview verification of the enriched live inspector; owner-approved R2 activation/bindings; complete affected-booking impact scan and publish/rollback path; automatic Calendar provisioning for increased resource quantity; production rate-limit bindings; approved replacement hero; production Turnstile; final external/deployed QA. No deployment, R2 activation or Calendar mutation was performed in this checkpoint.

## Merge-hardening checkpoint — 2026-09-19 (in progress)

The owner requested that the feature branch be hardened, verified, merged to `main`, and checked against the live website/coordinator/Google Calendar integration. The initial audit found three merge blockers: owner reschedule/extension bypassed operating-window and Booking Control rules; grouped Calendar patches could leave partial state without compensation/fencing; and all-day Calendar events were discarded by the event adapter. Server lifecycle transitions also relied on UI visibility rather than coordinator enforcement.

Implementation now in progress on `codex/race-control-working`:

- Google event listing preserves all-day events as Malaysia-local half-open intervals.
- Booking time logic exposes reusable full-interval opening-hours validation.
- Grouped mutations have a tested compensation helper.
- The coordinator uses a per-instance serialized mutation queue, writes durable per-resource recovery fences before grouped changes, validates lifecycle transitions and reschedule/extension policy server-side, checks resource and Booking Control conflicts, and retains fences when rollback is uncertain.
- Public availability and final booking allocation consult the same recovery fences.
- Rate limiting is recorded as a high-priority post-client-demo TODO at the owner’s request; it remains required before public launch.
- Deployment documentation now names `xerom-race-control-coordinator`, matching the branch config and current Cloudflare binding.

Current verification: `npm run check` passed with zero diagnostics; `npm test` passed 76/76; media verification and production build passed; generated Worker types are current; `git diff --check` passes; both website and coordinator Wrangler dry-runs pass; and the clean-server six-width Playwright suite passed 55 tests with 23 intentional viewport-specific skips. The first Playwright attempt hit a stale 31-minute Astro/Vite process returning HTTP 500 because an optimized SSR module disappeared after config regeneration; that run was stopped, the server was cleanly restarted, a `200` response was verified, and the complete rerun passed. No Calendar write, deployment, production traffic change, Access change, or merge has occurred during this hardening checkpoint yet. Preserve the untracked owner file `race-control-sidebar-collapse.patch`.

Remaining sequence: inspect the final diff; commit and push the feature branch; deploy the coordinator before the website because availability now consumes its recovery-fence contract; verify the branch build; merge into `main`; verify the main build/deployment and read-only live endpoints; then run a clearly labelled real Calendar smoke booking and cleanup if deployment credentials are available.

Deployment checkpoint: hardening commit `b6e9ad0` was pushed to `origin/codex/race-control-working`. The Cloudflare branch build updated before the separately deployed coordinator, so the preview availability endpoint correctly failed closed with HTTP 503 rather than treating missing recovery state as free capacity. Wrangler OAuth was then authorized by the owner and `xerom-race-control-coordinator` version `1094b087-ac6e-47d1-ac88-92099c497211` was deployed at 100% with message `Harden grouped Calendar mutation recovery`. The protected branch availability endpoint immediately recovered to live HTTP 200 with current Google Calendar capacities, and the coordinator public entry point remained HTTP 404. No Calendar event was created or changed by these read-only smoke checks.

## Current state

The responsive Astro site, mock booking flow, Google Calendar adapters, separate Race Control coordinator Worker, official SVG logo, and operational documentation are implemented on `codex/race-control-working`. The independent Impeccable review closed with `ship`; `DESIGN.md` and `.impeccable/design.json` reflect the reviewed interface. The branch preview is Access-protected and has completed a read-only live shared-calendar browser check; mutation verification remains intentionally gated behind an explicit synthetic-booking/cleanup approval.

## Next action

Google service-account credentials and calendar IDs are stored as encrypted secrets on both Workers, the separate coordinator is deployed, and local availability/booking, idempotency and concurrency tests pass. The feature branch now renders live shared-calendar reads when its server-side bindings are present; the public site remains unchanged. The client demo Worker is live with Cloudflare's always-pass Turnstile test pair; replace those test values with a hostname-scoped widget before public launch. Resolve the remaining owner items in `CONTENT_TODO.md` before public launch.

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

The implementation now lives on `codex/race-control-working`, pushed to `origin` at `d0ce491` after baseline commit `5e726da`. Cloudflare branch build `bb46454c` completed successfully for `d0ce491`; it uploaded a non-production version. Saving Access runtime variables later created production deployment `f3cefffa` from the existing production code; that deployment did not contain the feature-branch Race Control code and changed no public route behavior, but it is still recorded as production deployment activity.

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

Update: bounded owner booking search is now available at `GET /api/admin/bookings?from=&to=&query=` and the Bookings screen can query it. Results group only matching private `bookingId` events; unrecognized manual events remain separate `Calendar block` records. A fresh branch build receives the Access runtime variables. Local browser QA remains green after clearing a generated Vite SSR cache; the cache issue was tooling-only.

Update: the latest observed branch alias is version 60. Access app setup and the owner policy are active; owner OTP/Cloudflare identity sign-in and a live schedule-read check remain unverified in this automation session.

Latest verification (2026-09-16): `npm run check` clean across 103 files; `npm test` 60/60; `npm run build` passed; `git diff --check` clean. Latest branch commit is `2203d2a` (Zero Trust deployment audit). The branch preview URL is `https://codex-race-control-working-xerom-website.aaronbasil9400.workers.dev`; unauthenticated Race Control requests return Access 302, while the public root returns 200.
The generated root Worker types now resolve `BOOKING_COORDINATOR` to `xerom-race-control-coordinator` on this feature branch. The separate coordinator was deployed at `https://xerom-race-control-coordinator.aaronbasil9400.workers.dev` and has encrypted service-account/calendar secrets; the existing production website/coordinator binding remains unchanged on `main`.

Browser read checkpoint: the protected branch loaded in the in-app browser with `Shared Calendar mode`; its live agenda replaced fixtures with one existing private resource-calendar event and a server refresh timestamp. No customer details were copied into logs or documentation. A live write test still requires explicit creation/cleanup of a real booking event.

Deployment boundary: the website branch is built and Access-protected. It now points to the separate `xerom-race-control-coordinator`, while the existing production `xerom-booking-coordinator` remains the main-site binding. The separate coordinator contains the latest lifecycle/action/block code and encrypted Google secrets; live owner action verification remains pending the browser login/test.

Separate coordinator work has started: `coordinator/wrangler.race-control.jsonc` defines `xerom-race-control-coordinator` with independent SQLite DO state and observability. It is deployed at `https://xerom-race-control-coordinator.aaronbasil9400.workers.dev`, and all nine Google secrets are present as encrypted Worker secrets. The feature-branch website binding now points to it; existing production coordinator remains untouched.

Update: pure hours-impact and resource-lifecycle guards now cover outside-proposed-hours bookings, open-ended recurring series, retirement with future reservations, control/primary protections, and nonempty-calendar deletion retention gates. They are not yet wired to the settings UI or a live review job.

## Latest Race Control branch checkpoint — 2026-09-16

The live-state UI correction is committed as `7249049` and pushed to `origin/codex/race-control-working`; the documentation checkpoint is `3900f16`. It replaces the stale demo banner and synthetic inspector whenever the server-side Google/coordinator binding gate is present, while keeping local development fixture-safe. The latest branch alias version observed through Wrangler is 68.

Verification: `npm run check` (0 errors, 0 warnings, 0 hints), `npm test` (60/60), `npm run build` (pass), and the local six-width Race Control Playwright suite (12/12) all pass. The first local rerun was discarded as an invalid environment attempt because it used an external localhost URL without a running server; after clearing only the generated Vite SSR cache and confirming the clean dev server, the configured suite passed. The in-app browser then verified the protected branch’s live shared-calendar agenda, live inspector state and zero console errors; a temporary public-home test tab also loaded with zero console errors.

No real booking, block, cancellation, reschedule or extension was created. A live write test still needs action-time approval for one clearly labelled synthetic reservation and immediate cleanup. R2 remains disabled pending a separate billing/terms decision; settings/content publication, OAuth provisioning, impact review, recovery fencing and public runtime cutover remain open.

## Approved synthetic booking browser test — 2026-09-16

The owner approved one synthetic reservation and cleanup. The protected branch created a one-hour Regular 01 booking in a Calendar date with no busy events; the live agenda immediately displayed the new grouped booking and returned a coordinator confirmation. The new Bookings screen then found that record through the bounded Calendar search, presented the owner-only Cancel action, and cancelled it after the confirmation prompt. A second live schedule read reported no busy events for the tested date, proving availability was released; the booking search retained the record with status `cancelled` for auditability. No customer data was used and no production calendar was deleted.

The cancellation UI and live-state banner/sync labels are committed in `57bf428` and pushed to `origin/codex/race-control-working`. Local `npm run check`, `npm test` (60/60), `npm run build`, and the six-width Playwright suite (12/12) pass after this slice. The browser action required one confirmation-prompt handling retry because the first click waited on the modal while the request was already in flight; the final result was verified visually and by the follow-up live reads.

## Manual booking policy update — 2026-09-16

The owner-confirmed Race Control/manual booking change is committed in `7180fb3` and deployed to the separate coordinator. Manual bookings now allow any future minute inside opening hours, no minimum-notice floor, and 30/60/120-minute durations. The existing three-day horizon, future-start guard, opening-hours check, Calendar busy/control checks and serialized allocation remain enforced. The public customer flow remains on 60/120 minutes, one-hour notice and hourly availability until an explicit customer-facing policy decision.

Browser verification after the branch build shows the manual form with all three duration options and the minute-level/no-notice guidance; no second live reservation was created. Unit coverage now passes 64/64 and the clean-server six-width Playwright suite passes 12/12. The live manual path was previously proven end-to-end with an approved synthetic create/cancel test; this policy change itself has not created another live Calendar event.

## Remaining work plan — dependency order

1. Finish the owner front desk: expose check-in, completion/early-release, no-show, reschedule, extension/price-review and maintenance/closure review actions in the UI, plus activity/audit views. The coordinator contracts for most of these are already present; the missing work is UI, recovery and live verification.
2. Unblock runtime configuration: enable private R2 only after the owner approves the Cloudflare billing/terms gate; wire draft save, conflict review, impact scan, conditional activation and rollback to resources, hours, pricing, offers, advanced rules and website content/media. Missing owner facts remain explicit draft gates.
3. Complete calendar lifecycle and identity: venue-owner OAuth, resource provisioning/retirement safeguards, Access allow/deny checks, rate limits and production hostname-scoped Turnstile.
4. Harden operations: integrate the operation journal/recovery fences with coordinator compensation, restart/alarm/failure-injection tests, observability and privacy review; then run the final concurrency/security matrix.
5. Stage cutover: client UAT on the branch, a planned maintenance window, public runtime-config cutover and only then a separately approved production deployment. The existing production site/coordinator stays unchanged until that gate.

External owner gates are R2 activation/billing terms, confirmed content/assets and Turnstile values, OAuth consent, and any additional Access viewers. Code/UI work can proceed in parallel, but publication and production cutover cannot be marked complete without those inputs.

## Live schedule hardening checkpoint — 2026-09-16

The schedule surface is now date-aware and live-safe on the branch. It renders the selected MYT business date instead of a hard-coded fixture date, enables Previous/Today/Next navigation, supports live service filtering, and hides synthetic timeline content while a live read is loading or unavailable. Failed live reads explicitly state that no availability is being claimed. Live Calendar events are selectable and populate the owner inspector with booking/block status, time, resource and summary; the refresh control dispatches a fresh read.

Browser evidence on the protected branch: live read loaded the current date and real busy events; Next moved to the following business date and returned an empty live state; Today returned to the current date; the PS5 service filter removed non-PS5 events; selecting a live event populated the inspector. No mutation was performed in this verification. Local check/test/build and the six-width Playwright suite remain green. The operator walkthrough is [RACE_CONTROL_USER_GUIDE.md](RACE_CONTROL_USER_GUIDE.md).

## Live inspector action checkpoint — 2026-09-16

The selected live-booking inspector now exposes conditional Check in, Complete, No-show and Cancel controls, plus the explicit early-release checkbox for completion. Each action requires a confirmation prompt, sends the grouped expected version and idempotency key through the owner API, updates all linked Calendar events through the separate coordinator, and refreshes the schedule. Legacy events without `groupVersion` safely use version 0, matching the coordinator’s existing default. Reschedule and extension remain review-driven until quote inputs are surfaced.

Protected-branch browser verification selected an existing live booking and visibly showed the four controls; no action was submitted. `npm run check`, `npm test` 64/64, `npm run build` and the clean-server six-width suite remain green. The current code-bearing branch head is `344158b`; the latest documentation checkpoint is `34154cd` and the latest code-bearing schedule/action commits are `f1598ed`, `3c0ffd1` and `344158b`.

## Inspector compatibility checkpoint — 2026-09-16

Legacy live bookings that predate `groupVersion` now receive the coordinator’s version-0 default, so their valid lifecycle controls are not hidden. A date change or refresh clears the selected inspector before the next Calendar read, preventing stale booking details from remaining attached to a different date. The deployed branch browser confirmed an existing live booking exposed its actions, then Next returned to a clean inspector and an empty live state; no lifecycle action was submitted. This fix is commit `2beaa72`.

## Live resource timeline chart checkpoint — 2026-09-16

The branch now returns a `businessWindow` alongside the Calendar events and renders a real desktop resource timeline: resource rows (including Venue control), hour columns covering the opening window, proportional event positions/widths, lane stacking for overlaps, status/maintenance styling, and open space for resources with no busy events. The mobile presentation remains a chronological event list. Filtering and search apply to both views, and event selection continues to populate the inspector.

The previous flat list happened because the client only rendered `<article>` rows; no timeline layout was being generated from the available resource/start/end data. The chart is implemented in commit `4e94e5b`, with the responsive test suite passing 12/12; no live booking or block was created for this change.

## Manual booking error-flow checkpoint — 2026-09-16

The owner screenshot showed the manual form remaining in place with the generic `Review the booking details.` output. The form was not intentionally routing to a review page: the admin endpoint returned a 400 validation response, while the client discarded its field-level issues. The branch now normalizes `datetime-local` values before adding the MYT offset, returns `Review the highlighted booking fields.`, renders the rejected field path/reason in the output, and scrolls back to the live schedule after a confirmed create. No new live reservation was created for this fix.

The browser preview after deployment shows the live schedule, corrected manual guidance and 30/60/120-minute options; `npm run check`, `npm test` 64/64, `npm run build` and clean-server Playwright 12/12 pass. Code commits are `c45b420` and `3a92ae6`; production remains untouched.

## Live schedule polling checkpoint — 2026-09-16

The branch Schedule now polls the shared Calendar every 15 seconds only while the tab is visible, refreshes immediately on focus/visibility return, and records the actual last successful MYT sync time in the summary strip. Polls do not overlap: a changed date or focus event queues one follow-up read after the active request finishes. A failed poll retains the last chart as stale context and explicitly states that availability is not being claimed. The live preview was observed to update its refresh timestamp from 6:24:44 PM to 6:24:59 PM without a page reload. This is commit `dc7f925`.

## Client-demo banner checkpoint — 2026-09-16

The prominent amber/yellow live-state banners were replaced with neutral Broadcast-panel status treatments while retaining truthful text: shared Calendar mode, owner workspace, live sync, and draft boundary. Live form output is neutral by default, coral on validation errors and green on success. The browser preview verified the neutral appearance and zero console errors. The styling commit is `7befa54`; the subsequent live draft-badge polish is `988d88b`.

Repository logging is current through this checkpoint: RC-00 capability spike, shared contracts, Access setup, separate coordinator deployment, Calendar adapter safeguards, front-desk create/search/cancel/actions, manual timing policy, live schedule chart, error-flow fix, browser evidence, client runbook and remaining dependency plan are recorded in this file and [QA_REPORT.md](../../QA_REPORT.md). GitHub’s `origin/codex/race-control-working` pointer was verified against the local commit before this documentation-only update.

## Compact timeline lanes and polling-copy update — 2026-09-16

The live resource chart’s waste space was caused by using the count of all events on a resource as its visual lane count. `src/lib/race-control/timeline.ts` now provides the typed `assignTimelineLanes` helper and `Agenda.astro` sizes each row from its actual maximum simultaneous overlap. Sequential and back-to-back bookings remain one compact `3.6rem` row; only genuine same-resource collisions stack. A live branch browser read verified the resource from the owner screenshot with three sequential blocks at the compact height. Separate resource rows receiving a same-time group remain independently compact. No Calendar write occurred.

The transient `Loading the shared Google Calendar schedule…` text no longer appears for initial reads or 15-second background polls. The schedule retains its current chart during a poll; `aria-busy` continues to expose the in-progress state to assistive technology, while empty and failure messages remain explicit.

Verification: `npm run check` passed with 0 errors/warnings/hints; `npm test` passed 68/68; `npm run build` passed. A fresh protected-preview browser load confirmed the live resource chart and no transient loading text while the 15-second shared-Calendar read updated. The six-width Playwright suite could not start because macOS denied headless Chromium’s Mach-port rendezvous permission before any page loaded; record it as environment-blocked and rerun in a permitted desktop/CI session. The implementation/log commit is `16c64c5`, pushed to `origin/codex/race-control-working`; verify the remote pointer after this final documentation correction.

## Collapsible navigation update — 2026-09-17

The supplied Race Control sidebar-collapse patch is integrated with one responsive correction: local-storage collapse persistence applies only from 701px upward, so it cannot hide the phone horizontal navigation. The header has an accessible Collapse/Expand section navigation control tied to the navigation landmark. Its `aria-expanded` value and name match the current state; collapse gives the main workspace the recovered rail width, remains after reload, and restores without changing routes. The control is hidden on phones because the rail is already a horizontal section bar.

Verification passed: `npm run check` (0 errors/warnings/hints), `npm test` (68/68), `npm run build`, and the six-width Playwright suite (18 passed; 6 intentional viewport-specific skips). Playwright first reported connection refusals when invoked without a local server; the valid rerun used the project Astro server and passed. Generated review screenshots were restored. The manual Impeccable detector reported only pre-existing shared CSS advisories; no new detector category was introduced. Push this branch checkpoint and use a fresh protected-preview browser tab to visually confirm the deployed control before handoff.

The sidebar code commit is `e345f36`, followed by this documentation checkpoint on `origin/codex/race-control-working`. Cloudflare reports the code upload as preview Worker version 98 for that alias; production was not deployed or altered. A fresh remote browser session correctly stopped at the Cloudflare Access owner-login page. Do not request or submit an owner login code without the owner’s identity/approval; local six-width Playwright visual coverage is the completed visual evidence for this checkpoint.

## Schedule polling interval update — 2026-09-17

The owner changed the Race Control visible-tab schedule polling interval from 15 to 60 seconds. `Agenda.astro` now schedules the 60-second read and writes the same interval into the Last sync summary; the Schedule metric, user guide, and source plan match. Focus/visibility return, date selection, post-write refresh events, and the manual refresh action remain immediate. The no-overlap queue and stale/fail-closed behavior are unchanged.

Verification: `npm run check` 0 errors/warnings/hints, `npm test` 68/68, `npm run build` passed, and the six-width Playwright suite passed 18 tests with 6 intentional viewport-specific skips. Generated review screenshots were restored and the temporary dev server stopped. No Calendar or production mutation was made. Push this checkpoint to the feature branch and verify the current branch version before handoff.

## Schedule chrome reduction — 2026-09-17

The owner asked to remove the screenshot-highlighted Schedule chrome. The global workspace banner and Draft Surface badge are removed from the Race Control layout; the Schedule removes its shared-Calendar explanatory notice and the four-cell shared-record/refresh/calendar-health/timezone strip. The actual operating affordances remain: topbar Calendar state and refresh control, date/service/search toolbar, chart/agenda, error and stale state messaging, inspector, new booking, and block-time workflow. The 60-second timer still runs without a visible status-strip copy.

Verification: `npm run check` 0 errors/warnings/hints, `npm test` 68/68, `npm run build` passed, and six-width Playwright passed 18 tests with 6 intentional responsive skips. The suite explicitly checked browser console/request failures and horizontal overflow; desktop and phone screenshots were inspected for disparity, then restored. No Calendar or production mutation was made. Push this checkpoint to the feature branch and verify the branch preview version before handoff.

## Cloudflare agent runbook — 2026-09-17

The verified branch-preview workflow is now documented in [CLOUDFLARE_AGENT_CHANGE_RUNBOOK.md](CLOUDFLARE_AGENT_CHANGE_RUNBOOK.md). It distinguishes safe source/branch work from owner-gated Cloudflare, Access, secret, R2, coordinator and Calendar actions; records the exact local test, Git push and read-only version-verification steps; and explains why a fresh browser reaching Access login is expected rather than a failed preview.
