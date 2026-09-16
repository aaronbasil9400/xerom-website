# QA Report

Last updated: 2026-09-15

## Current result

The client-demo Worker is live on its temporary `workers.dev` hostname with Google Calendar as the booking record, a serialized coordinator Durable Object, and Cloudflare's documented always-pass Turnstile test pair. Live availability, event creation/rollback, idempotent replay, and the final-resource race all pass. Replace the test Turnstile values and complete the remaining owner/content/security gates before public launch.

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| Astro/TypeScript diagnostics | Pass | `npm run check`: 0 errors, 0 warnings; two Zod deprecation hints |
| Booking unit tests | Pass | `npm test`: 15 tests across time, overlap, capacity, closure, pricing, validation, and Calendar text sanitization |
| Responsive/booking E2E | Pass | Final media run: 31 passed, 5 intentional single-writer hero-capture skips; homepage, core routes, assets, favicon/manifest, console, and complete mock booking flow at 375, 390, 430, 768, 1024, and 1440 widths |
| Visual captures | Pass | Six full-page captures under `.impeccable/review/` with reduced motion and lazy media loaded |
| Mobile overflow | Pass | Automated document-width assertion at 375, 390, and 430 pixels |
| Production build | Pass | `npm run build`, Cloudflare server output in `dist/` |
| Coordinator Worker dry run | Pass | `npx wrangler deploy --dry-run --config coordinator/wrangler.jsonc`; Durable Object bundle and `exports.BookingCoordinator` compiled |
| Direction contract retention | Pass | Seed `5323fcd4` present in built server output |
| Impeccable detector | Pass | `detect.mjs --json src` returned `[]` |
| Independent Impeccable finish review | Ship | Rebuild and fix rounds closed; final service/price proof verdict resolved with no regression |
| Production dependency audit | Pass | `npm install` after the `sharp` override reported 0 vulnerabilities |
| Official logo trace | Pass | SVG parsed with `xmllint`; two editable color paths; visual raster comparison stored at `.impeccable/review/logo-vector-preview.png` |
| Owner image derivatives | Pass | Four focal crops verified at 480×360, 800×600, and 1200×900; hashes and provenance recorded in the media manifest |
| Favicon/icon family | Pass | Official X paths reused in SVG; 32, 180, 192, and 512px transparent PNGs rendered and dimension-checked |
| Focused media review | Ship | Regular Rig focal correction scored resolved; other crops, phone layouts, mapping, cafe visibility, and favicon geometry passed |
| Filled-control contrast | Pass | Action Racing Red `#d12a25` with white measures 5.16:1; hover `#b92320` measures 6.32:1 |

## Live integration checks (2026-09-13)

| Check | Result | Evidence |
|---|---|---|
| Google service-account auth + FreeBusy | Pass | Deployed `/api/availability` returned HTTP 200 with `mode: live` and expected Regular/Pro/PS5 capacities for a future Malaysia-local date |
| Private Calendar event creation + cleanup | Pass | Temporary Regular booking returned HTTP 201 (`RM20`); event was found by booking ID and deleted; follow-up availability restored full capacity |
| Idempotency replay | Pass | Same PS5 request returned HTTP 201 then HTTP 200 with `replayed: true`; the single event was deleted afterward |
| Final-resource concurrency | Pass | Two simultaneous Pro requests returned exactly one HTTP 201 and one HTTP 409; the winning event was deleted afterward |
| Turnstile server verification | Pass (demo keys) | Cloudflare documented always-pass site/secret pair accepted `XXXX.DUMMY.TOKEN.XXXX`; replace before launch |
| Coordinator deployment | Pass | `xerom-booking-coordinator` deployed at its `workers.dev` endpoint; logs captured the prior 403 diagnosis and are now enabled |
| Public Worker binding | Pass | Root deployment log shows `env.BOOKING_COORDINATOR (BookingCoordinator, defined in xerom-booking-coordinator)` |
| Temporary-event cleanup | Pass | Calendar API audit query found zero remaining smoke/race/idempotency/diagnostic events |
| Browser UI live flow | Pass | Public `/book` page rendered Turnstile “Success!”, loaded 11 live start times, and reached “Booking confirmed” after a real form submit; event was deleted afterward |
| Deployed security headers | Pass | Public Worker responses after `b305a9a` include HSTS, CSP, COOP/CORP, Permissions-Policy, Referrer-Policy, `X-Content-Type-Options`, and `X-Frame-Options` |

## Screenshot evidence

- `.impeccable/review/mobile-375.png`
- `.impeccable/review/mobile.png` (390)
- `.impeccable/review/mobile-430.png`
- `.impeccable/review/tablet-768.png`
- `.impeccable/review/desktop-1024.png`
- `.impeccable/review/desktop.png` (1440)

## Covered behavior

- One- and two-hour session rules.
- Rolling one-hour notice and 72-hour horizon.
- Asia/Kuala_Lumpur timestamp generation across midnight.
- Half-open overlap semantics so exact back-to-back sessions are allowed.
- Mixed Regular + Pro capacity requirements.
- Manual Busy intervals and Booking Control closures.
- Authoritative mixed-service and PS5 controller-add-on pricing.
- Booking request validation and duplicate service rejection.
- Mock journey from setup through slot selection, customer details, confirmation, booking ID, and WhatsApp action.
- Six responsive viewport sizes and mobile overflow.

## Not yet verified against external systems

- Real partial multi-resource failure and rollback.
- Turnstile expiry/retry and production hostname rules using a real widget (demo uses test credentials).
- Cloudflare custom domain and rate limiting rules.
- Production analytics provider integration.
- Lighthouse scores on the deployed origin.
- Live contact, Maps, and canonical-domain accuracy after owner confirmation.

These items must not be marked passed until the required accounts, calendars, secrets, and confirmed business content are available.

## Homepage UI/UX upgrade verification (2026-09-15)

The cinematic homepage upgrade is implemented on `exp/homepage-cinematic-v1`. Its hero headline is exactly `Race Together`; Klang appears only as separate location information. The booking API, coordinator, form components, and booking configuration are unchanged from baseline `4e9787c`.

| Check | Result | Evidence |
|---|---|---|
| Astro/TypeScript diagnostics | Pass | `npm run check`: 0 errors and 0 warnings in project sources; two hints originate in the pre-existing untracked `hive-v3-installation` directory |
| Booking unit tests | Pass | `npm test`: 15/15 passed |
| Production build | Pass | `npm run build`: Cloudflare server output generated successfully |
| Media manifest | Pass | `npm run assets:verify`: 21/21 derivatives verified, including six responsive hero AVIF/WebP assets |
| Responsive and booking E2E | Pass | `npm run test:e2e`: 36 passed, 12 intentional project-specific skips at 375, 390, 430, 768, 1024, and 1440 CSS pixels |
| Headline contract | Pass | Accessible name and visible text both assert exactly `Race Together`; `In Klang` is absent from the heading |
| Accessibility regression | Pass | Keyboard-contained menu, Escape dismissal/focus return, visible 3px focus, 44px mobile Book target, no mobile overflow, 200%-equivalent reflow, reduced-motion behavior, and semantic booking confirmation assertions pass |
| Browser/runtime regression | Pass | Core routes have no browser console errors, failed requests, broken images, or missing favicon/manifest assets in the automated pass |
| Booking UI regression | Pass | Complete setup, slot, customer details, confirmation, booking ID, total, and WhatsApp journey passes with only the final local POST mocked; no booking production code was edited |
| Booking invariants | Pass (unchanged evidence) | Protected booking diff from baseline is empty; the 2026-09-13 live idempotency, rollback cleanup, and exactly-one-winner concurrency evidence above remains applicable |
| Local production-preview Lighthouse | Pass with LCP note | Performance 93, Accessibility 100, Best Practices 100, SEO 100; FCP 2.0s, LCP 2.9–3.0s, CLS 0.018, TBT 0ms. The local LCP is 0.4–0.5s above the 2.5s stretch target and requires deployed-origin remeasurement |
| Responsive screenshots | Pass | Before and after captures are stored under `.impeccable/review/homepage-upgrade/` for all six required widths |

The only non-owner homepage media remains `social-group-hero.placeholder-ai.*`. It is explicitly identified in its filename, manifest provenance, source comments, and alternative text, and must be replaced with an owner-approved social venue photograph before production sign-off.

The branch was pushed to `origin/exp/homepage-cinematic-v1`. A 2026-09-15 `wrangler deploy` attempt stopped before deployment because this non-interactive session has no `CLOUDFLARE_API_TOKEN`; therefore deployed-origin screenshots, Lighthouse, and live-stage smoke checks remain unrun and are not marked passing. The existing staging Worker was not changed. One warm full E2E run completed every functional assertion and encountered a transient OneDrive lock only while overwriting the final 1440px PNG; the isolated screenshot case passed immediately afterward, giving 36 passed checks and 12 intentional skips across the combined final run.

### Owner revision: Choose Your Setup restoration

The redundant More Than Racing gallery was replaced with the previous Choose Your Setup split section only. The restored block uses the Pro Rig image, the three confirmed resource facts, and a Compare Experiences link to `/experiences`. Astro diagnostics, all 15 booking unit tests, and the production build pass. The section contract and no-overflow checks pass at all six required widths; refreshed 390px and 1440px captures are stored under `.impeccable/review/homepage-upgrade/setup-restored/`.

### Owner revision: phone experience-dock removal

The Race / Play / Refuel dock is hidden at the 560px phone breakpoint to remove duplication with Pick Your Pace, while remaining visible at 768px and all desktop widths. Automated assertions verify the breakpoint behavior and document-width overflow at all six required viewports. No markup, service route, or booking behavior was removed; phone users retain the four Pick Your Pace cards and their direct service links.

Verification passed with 0 Astro errors, 15/15 unit tests, a successful production build, and 12/12 breakpoint/overflow/core-route checks. The full functional browser suite passed every case across the combined final run: one first-request local booking timeout at 375px passed on immediate focused rerun. Representative phone, tablet, and desktop captures are stored under `.impeccable/review/homepage-upgrade/mobile-dock-hidden/`.

## Race Control RC-00 through contract/security shell checkpoint (2026-09-16)

Environment: local repository on macOS, Astro development fixture mode, no R2 binding, no owner OAuth, no Google mutation, no deployment.

| Check | Result | Evidence |
|---|---|---|
| Astro/TypeScript diagnostics | Pass | `npm run check`: 0 errors, 0 warnings, 0 hints across 87 files before the final browser-only test addition |
| Full unit/contract suite | Pass | `npm test`: 51/51 tests across 13 files |
| Production build | Pass | `npm run build`: Cloudflare server output completed successfully |
| Impeccable detector | Pass | `detect.mjs --json` returned `[]` after the first UI implementation; subsequent cleanup removed the external font import, glyph icons, invalid logo path and incomplete ARIA grid claim |
| Race Control contract tests | Pass | Config schema/seed/public allowlist, stale draft, conditional activation, owner Access allowlist/CSRF, lost-create reconciliation, operation replay/fences, Google fail-closed behavior and runtime pricing all pass locally |
| Responsive Race Control browser suite | Pass after one fix round | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4321 npx playwright test tests/e2e/race-control.spec.ts --workers=1`: 12/12 passed across 375, 390, 430, 768, 1024 and 1440 CSS-pixel widths. Initial run found fixture-placeholder assertion misuse and real overflow at 768/1024; both were fixed before rerun |
| Browser errors and failed requests | Pass | Race Control schedule test asserts no console errors or failed requests at all six widths |
| Private/draft labelling | Pass | Browser assertions verify the owner surface is `noindex`, visibly marked demo-only, settings remain `Not published`, and no fixture calendar reference reaches rendered output |
| Screenshot evidence | Pass | `.impeccable/review/race-control/{mobile-375,mobile-390,mobile-430,tablet-768,desktop-1024,desktop-1440}.png` |
| Independent shell finish review | Ship | First review returned five material fixes; toolbar, tablet overlay, chronological agenda, contextual Details labels and mobile-nav cue were implemented. Second-pass verdict scored all five resolved |
| Coordinator bundle dry run | Pass | `WRANGLER_LOG_PATH=/tmp/xerom-coordinator-dry-run.log npx wrangler deploy --dry-run --config coordinator/wrangler.jsonc` completed; no deployment occurred |

Not run and not passed: live R2 conditional writes, Access JWT verification against the actual team domain, Google owner OAuth, Calendar create/share/probe/delete, real coordinator restart/alarm recovery, config publication, front-desk booking mutations, resource provisioning, media upload, public-runtime cutover, deployed security/rate-limit checks, or production deployment. The dashboard remains a clearly labelled synthetic shell; it does not satisfy the complete Race Control definition of done.

## Race Control branch sync checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Feature branch | Pass | `codex/race-control-working`, baseline commit `5e726da`, Calendar sync commit `d0ce491`, pushed to `origin` |
| Cloudflare branch build | Pass | Build `bb46454c` for `d0ce491` reported Success and branch alias versions are separate from the public deployment |
| Shared Calendar schedule contract | Pass locally | Paginated event-list adapter test added; schedule endpoint reads resource/control calendars server-side and keeps IDs out of the response |
| Shared booking command | Implemented, not externally exercised | Owner booking endpoint delegates to the same named coordinator used by the public site; no live event was created as a test |
| Local UI regression | Pass | `npm run check` clean, Calendar adapter tests 4/4, six-width Race Control Playwright suite 12/12 with runtime reads disabled in local fixture mode |

Remaining before web verification: Cloudflare Access has no Zero Trust organization, so owner endpoints must remain deny-by-default. Owner confirmation is required before creating the organization and email-OTP policy. The branch build is not a production deployment.

## Access-protected branch preview checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Zero Trust Free activation | Pass | Cloudflare confirmation showed purchase complete, Zero Trust Free, and $0 due today after owner-authorized terms/card step |
| Access application | Pass | `Xerom Race Control Branch Preview`, app ID `6cbb336f-5aff-4659-b1e2-97982924b3aa`; destinations are branch `/race-control/*` and `/api/admin/*` only |
| Owner policy | Pass | Reusable policy `Xerom Race Control Owner`, policy ID `57014aed-34b5-4b9b-967a-bce1e926400f`, one owner email rule |
| Worker Access variables | Pass | `ACCESS_TEAM_DOMAIN` and `ACCESS_AUDIENCE` variables plus encrypted `OWNER_EMAILS` visible in Worker settings; secrets remain out of Git |
| R2 capability check | Blocked | `npx wrangler r2 bucket list` returned Cloudflare code 10042: enable R2 through Dashboard; no bucket/binding was created |

The branch preview has fresh alias versions (latest observed version number 60) and still needs owner OTP login plus a non-destructive schedule-read check. Saving Access variables through the Worker dashboard also created production deployment `f3cefffa` at 100% traffic from the pre-existing production code; no Race Control branch code was promoted and no Google Calendar mutation was performed here.

## Front-desk action implementation checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Owner booking creation route | Implemented | `POST /api/admin/bookings` validates the existing booking schema and delegates to the same global coordinator/calendar path as public bookings |
| Group lifecycle action route | Implemented locally | `POST /api/admin/bookings/:id/actions` supports check-in, complete, no-show and cancel; owner auth/CSRF and coordinator binding gates apply |
| Calendar mutation safety | Adapter-tested | ETag `If-Match`, 412 conflict handling, private booking lookup and transparent cancellation are covered by local mocked Calendar tests |
| Local contract/build verification | Pass | `npm run check`, Race Control tests 24/24, and `npm run build` |

Not yet run: live owner OTP login, live schedule listing, live owner booking/action, exact Calendar event cleanup, extension/reschedule/maintenance/closure operations, R2 publication, or production traffic changes. These require the protected branch preview and explicit test-booking cleanup authorization.

## Extension/reschedule implementation checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Same-resource reschedule | Implemented locally | Coordinator finds the complete booking group by private booking ID, rejects resource-set changes, excludes verified current event IDs from conflict checks, and patches all events with ETags |
| Extension | Implemented locally | Coordinator checks the added interval on every linked resource and patches all ends only after the interval is clear; response flags explicit price review |
| Coordinator dry run | Pass | `WRANGLER_LOG_PATH=/tmp/xerom-coordinator-dry-run.log npx wrangler deploy --dry-run --config coordinator/wrangler.jsonc` completed with the existing SQLite DO binding |
| Local verification | Pass | Astro check clean, Race Control tests 24/24, production build passed |

Not yet run against Google: any extension/reschedule or lifecycle action, partial-update compensation/reconciliation, maintenance/closure, settings publication, R2, or production traffic. Current implementation deliberately does not silently move resources or repackage historical prices.

## Maintenance/closure implementation checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Maintenance block contract | Implemented locally | Strict block schema requires interval, reason, resource IDs and idempotency key |
| Venue closure contract | Implemented locally | Venue closures must target Booking Control; created blocks remain opaque and server-authoritative |
| Block creation safety | Implemented locally | Coordinator preflights every target Calendar, creates deterministic events, records the attempt, and best-effort rolls back partial creation |
| UI regression | Pass | Local Race Control Playwright suite 12/12 across all required widths; new block form is keyboard-labelled and no-overflow |

No live maintenance/closure block was created. Real conflict review, compensation fencing, and Calendar mutation verification remain open.

## Configuration review boundary checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Draft review endpoint | Implemented locally | `POST /api/admin/config/review` reads the conditional draft, verifies the server-calculated hash, issues a five-minute HMAC token and returns explicit impact-scan blocking state |
| Review token binding | Pass | Local tests 2/2 cover draft hash/base revision binding and missing-secret failure |
| Safe publication boundary | Pass | No publish action is exposed until complete future-booking impact review and R2 activation prerequisites exist |

The review endpoint has not been run with live R2 or Google data and intentionally cannot authorize publication while those gates are absent.

## Bounded owner booking search checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Search contract | Pass | Local booking-search tests validate reversed-date rejection, private booking grouping and separate manual blocks |
| Owner search route | Implemented locally | `GET /api/admin/bookings?from=&to=&query=` has bounded date inputs and no permanent customer directory |
| Bookings UI | Implemented locally | Date range/query form updates a semantic table from the route and retains labelled fixtures on unavailable integration |
| Responsive regression | Pass | Six-width Race Control browser suite 12/12 after clearing generated Vite cache; no source or production state was removed |

## Hours/resource safety rule checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Hours impact review rules | Pass | Tests block outside-proposed-hours events and open-ended recurring series for explicit owner review |
| Resource retirement guards | Pass | Tests allow retirement only after future capacity/recurrence is resolved |
| Permanent deletion guards | Pass | Tests require a retired, non-control, empty calendar and a fresh confirmation; nonempty history is blocked pending retention/export policy |

These rules are pure contract coverage only. No Calendar deletion, retirement, or hours publication was executed.

## Latest repository checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Astro diagnostics | Pass | `npm run check`: 0 errors, 0 warnings, 0 hints across 103 files |
| Full unit/contract suite | Pass | `npm test`: 60/60 tests across 16 files |
| Production build | Pass | `npm run build`: Cloudflare server output completed successfully |
| Working tree | Pass | `git diff --check` clean; latest feature-branch commit `2203d2a` pushed to origin |
| Branch access smoke | Pass | Read-only curl: `/race-control/schedule` returns Access 302; public `/` returns 200; no Calendar mutation |

The owner OTP/session and live authenticated schedule/booking checks remain unrun in this environment.

## Separate coordinator deployment checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Separate Worker deployment | Pass | `xerom-race-control-coordinator` deployed with SQLite Durable Object and observability; URL `https://xerom-race-control-coordinator.aaronbasil9400.workers.dev` |
| Google secret provisioning | Pass | `wrangler secret list --config coordinator/wrangler.race-control.jsonc` shows the private key, service-account email, six resource IDs and Booking Control ID; values were never printed or committed |
| Website feature-branch binding | Implemented | Feature `wrangler.jsonc` now names `xerom-race-control-coordinator`; generated `worker-configuration.d.ts` reflects that binding |
| Main-site preservation | Pass | `main` remains bound to `xerom-booking-coordinator`; no production Calendar/event mutation was performed |

The fresh feature-branch build and authenticated browser test are still pending. The one-time downloaded Google key file was removed after upload.

## Coordinator deployment boundary (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Website branch deployment | Pass | Branch alias builds are current and Access-protected |
| Existing coordinator compatibility | Preserved | Main website remains bound to `script_name: xerom-booking-coordinator`; current production coordinator was not changed |
| Separate coordinator commands | Deployed, live verification pending | `xerom-race-control-coordinator` has its own SQLite DO, latest coordinator code, observability, and encrypted Google secrets; owner-authenticated action tests have not yet run |

Live lifecycle/extension/reschedule/maintenance/closure/block commands can now be tested only after owner Access login on the branch preview. No test action has been submitted yet; preserve the main-site coordinator and clean up only an explicitly authorized test booking/block.

## Browser shared-calendar read checkpoint (2026-09-16)

| Check | Result | Evidence |
|---|---|---|
| Protected branch browser route | Pass | In-app browser loaded `/race-control/schedule` on the feature preview after the separate coordinator binding and Access variables were present |
| Shared Calendar read | Pass | Live agenda replaced fixtures with one existing private resource-calendar event and displayed the server refresh timestamp; no customer details were copied into this report |
| Live write test | Pending | Creating a browser test booking would create a real reservation event; it has not been submitted yet |

The browser session confirmed the shared-calendar connection state and live event list. Owner-authenticated mutation verification remains pending a clearly labelled test booking and cleanup.
