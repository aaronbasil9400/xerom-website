# Agent Handoff

Last updated: 2026-09-16

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

Verification: `npm run check` passed with 0 errors/warnings/hints; `npm test` passed 68/68; `npm run build` passed. The six-width Playwright suite could not start because macOS denied headless Chromium’s Mach-port rendezvous permission before any page loaded; record it as environment-blocked and rerun in a permitted desktop/CI session. The latest code commit before this documentation update is `848ec3a`; commit/push this pending UI/test/docs checkpoint before handoff and verify the remote branch pointer.
