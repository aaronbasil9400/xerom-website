# Website Upgrade Worklog

Source requirements:

- `/Users/aaronbasil/Downloads/xerom_website_changes_agent_prompt.md`
- `/Users/aaronbasil/Downloads/xerom_webiste_changes_brief_checklist.md`

Started: 2026-09-22

## Architecture checkpoint

- **COMPLETE** Audited Astro routing, public booking UI/APIs, Google Calendar adapters, coordinator serialization, Race Control, configuration, authentication, tests and Cloudflare bindings.
- **COMPLETE** Identified duplicated capacities/durations in `service-core`, booking schemas, mock availability, seed config and Race Control forms.
- **COMPLETE** Confirmed Google Calendar remains booking truth; no application database is justified.
- **COMPLETE** Recommended existing R2 revision design for runtime settings/media, with account activation explicitly gated.
- **COMPLETE** Recorded controller billing as RM3 per additional controller per booking.

## Tracked implementation

| Phase | Status | Scope / gate |
| --- | --- | --- |
| 1 Audit | COMPLETE | Architecture and risk report delivered 2026-09-22. |
| 2 Data/config foundation | COMPLETE | Canonical booking/customer/controller/duration contracts and configuration schema v2; validated by unit/type checks. |
| 3 Homepage | COMPLETE | Pro before Regular; Events/What’s New routes; membership placeholder CTA; six-width E2E coverage. |
| 4 Booking Setup | COMPLETE | Config-driven maximums, warnings, controllers, four durations, optional email; six-width E2E coverage. |
| 5 Availability UI Design | COMPLETE | Desktop/mobile mockup revision 2 approved by owner on 2026-09-22. |
| 6 Availability Engine/UI | COMPLETE | Approved single-row indicators, today auto-load, 30-minute slots, full-duration capacity and mixed-resource states; unit/E2E verified. |
| 7 Customer Details | COMPLETE | Optional email, Calendar metadata, final serialized validation, confirmation details and WhatsApp auto-open/fallback; unit/E2E verified. |
| 8 Race Control Schedule | IN PROGRESS | Contact/controller projection, WhatsApp customer and email on manual booking implemented; protected live inspector verification pending. |
| 9 Race Control Bookings | COMPLETE | Phone/resource/duration combined filters and normalized RFC 4180 CSV; unit/E2E verified. |
| 10 Business Settings | IN PROGRESS | Editors, private drafts, complete impact review and serialized publication/rollback are implemented and locally verified; automatic Calendar provisioning and authenticated live owner verification remain. |
| 11 Publishing | IN PROGRESS | 16:9 uploader, private media, reviewed config activation and rollback-as-new-draft are implemented; first live publication, approved replacement media and external verification remain separately gated. |
| 12 Reliability/Security | IN PROGRESS | Serialization/fences and exactly-one-winner test pass; optional rate-limit adapters are coded but production bindings remain unconfigured. |
| 13 Responsive/E2E QA | COMPLETE (local) | Six widths: 69 passed, 33 intentional viewport skips; typecheck, 92 unit tests, build and dry run pass. External integrations remain separately gated. |

## Confirmed implementation decisions

- Public and owner durations: 30, 60, 90, 120 minutes.
- Public slot interval: 30 minutes.
- PS5 controllers: 2 included, 0–6 additional, RM3 each per booking.
- Email: optional; store/display/export only. No delivery backend.
- Persistence: Calendar bookings + private R2 configuration/media + Durable Object coordination. No D1 or external database.
- R2: private buckets and bindings are active; no configuration revision or public pointer has been published.

## Deferred / owner gates

- TODO: Implement booking confirmation email backend.
- Final membership destination remains unresolved; use an explicit placeholder route/action.
- First configuration publication, production Turnstile, final hero asset and remaining `CONTENT_TODO.md` facts remain gated.

## Activity log

### 2026-09-22 — Audit and kickoff

- Read both supplied change documents and all project source-of-truth files.
- Ran Impeccable context; `DESIGN.md` is authoritative and its generated sidecar is stale.
- Verified `main` is clean and already contains the Race Control hardening merge.
- Inspected public booking, APIs, coordinator, runtime config contracts, Race Control routes, Access middleware and Playwright setup.
- Delivered Checkpoint 1 architecture/database recommendation.
- Received owner decisions for per-booking controller billing and code-only R2 work.

### 2026-09-22 — Foundation, homepage, booking setup and mockup gate

- Added config schema v2 controller settings and canonical booking/customer/status types.
- Public and owner contracts now accept 30/60/90/120-minute durations; public slot generation uses 30-minute increments.
- Removed duplicated schema limits in favor of centralized service/controller configuration.
- Added optional email to booking validation and private Calendar descriptions; added controller totals to Calendar metadata.
- Changed controller pricing to RM3 per added controller per booking.
- Reordered homepage service cards to Pro, Regular, PS5; added Events, What’s New and Membership placeholder routes and navigation.
- Added booking maximum warnings, conditional additional-controller selection, four duration choices, optional email, and controller/price review details.
- Updated Race Control manual booking fields for 90 minutes, email and controllers.
- Produced `docs/mockups/availability-indicators.html` plus desktop/mobile review captures in `.impeccable/review/availability-mockup/`.
- Mockup uses R circle, P diamond and PS square; filled means available, hatched outline means unavailable. Shape, label and fill avoid color-only meaning. On mobile the status text moves below while all service marks remain in one horizontal row.
- Verification: `npm run check` passed (0 diagnostics); `npm test` passed 81/81; `npm run build` passed; targeted six-width Playwright passed 49 with 23 intentional responsive skips.
- Impeccable detector ran in degraded regex mode because optional HTML parser modules were unavailable. Its only new mockup warning (Arial) was removed; remaining shared stylesheet advisories predate or intentionally follow the approved system, including the brief-required rounded membership CTA.
- Ran `graphify update .`; it rebuilt the code graph (2,750 nodes / 3,311 edges). Graphify reported partial parse warnings for Astro frontmatter files, while Astro's own typecheck remained clean.
- **STOP:** production availability indicators, auto-load behavior and remaining downstream phases are not implemented pending owner approval of the mockup.

### 2026-09-22 — Availability mockup revision 2

- Expanded the mobile legend to spell out `R — Regular Rig`, `P — Pro Rig`, and `PS — PS5 Lounge`.
- Added dedicated mobile Pro-only and PS5-only slot examples; the PS5 example demonstrates one available and one unavailable lounge.
- Regenerated desktop and 375px mobile captures and confirmed 0px document overflow at both widths. Production availability remains unchanged and the approval gate remains active.

### 2026-09-22 — Availability mockup approved

- Owner approved revision 2 and authorized production implementation.
- Phase 5 gate is closed; Phase 6 implementation started using the approved full-name legend and shape/label/fill system.

### 2026-09-22 — Availability, customer flow and Race Control records

- Implemented today auto-load and the approved shape/label/fill availability row. Every capacity mark represents freedom across the full selected 30/60/90/120-minute interval.
- Added public confirmation detail and post-success WhatsApp auto-open with a persistent fallback button; WhatsApp failure does not affect booking confirmation.
- Normalized grouped Calendar events into one owner booking projection with customer name, phone, optional email, duration, resources, controllers, price, status, creation timestamp and event IDs.
- Schedule inspector now exposes contact details, controller totals and a Malaysian-number-normalized WhatsApp Customer action. Manual booking already includes optional email and controller inputs.
- Bookings now combines phone, resource and duration filters and exports one CSV row per booking/service line with RFC 4180 escaping.

### 2026-09-22 — Settings, publishing and reliability code boundary

- Replaced placeholder Business Settings with config-schema-backed resource/controller, daily-hours/closed-day, pricing/discount, offers and advanced-rules editors.
- Kept Calendar IDs server-side by returning a redacted owner projection and rehydrating managed references only inside the draft API.
- Derived the hero upload contract from the shipped asset: exact 16:9, recommended/minimum 1600×900, JPEG/PNG/WebP, maximum 8 MB. Added client and server validation, private R2 media storage code and immutable public media delivery.
- No R2 bucket/binding was activated. Unsaved seed state and setup-required failures remain explicit.
- Added optional Cloudflare Rate Limiting binding adapters and documented proposed limits. No account namespaces/bindings were created.
- Extracted the coordinator mutation queue and proved two simultaneous attempts for the final resource return exactly one success and one conflict. Added overlap coverage for every supported duration.
- Final local verification: `npm run check` passed; `npm test` passed 92/92; `npm run build` passed; media manifest 21/21; coordinator Wrangler dry run passed; `git diff --check` passed; full six-width Playwright passed 69 with 33 intentional skips.
- Impeccable detector ran once. It reported existing shared CSS type/color advisories and pre-existing side-tab declarations that are overridden by the shipped 1px active navigation rule; no new blocking category was introduced.

### 2026-09-23 — Reviewed publication, rollback and runtime cutover safety

- Added coordinator-serialized publication: reload draft/ETag/hash, verify the short-lived review token and base revision, repeat the complete Calendar impact scan, persist intent, write an immutable R2 revision, conditionally activate and verify the pointer.
- Added deterministic same-attempt replay and post-activation lost-response recovery. Fresh review tokens produce fresh operation/revision IDs even when configuration content is identical.
- Added rollback preparation as a new private draft. It preserves current Calendar mappings and requires normal save/review/publication; no old pointer is restored directly.
- Replaced public live reads of compiled prices, hours, resources, controllers, venue content and booking rules with one active revision per rendered response. Booking availability and confirmation reject a changed displayed revision.
- Added focused tests for token tampering/expiry, stale ETag/hash/base revision, serialized scan conflicts, immutable replay, pre-activation retry, pointer-swap races, and post-activation response loss.
- Final local verification: `npm run check` clean; 119/119 unit/contract tests; production and staging builds passed; both Wrangler dry runs passed; six-width Playwright completed with 70 passed and 38 intentional viewport-specific skips.
- No publication endpoint was called, no `active.json` or immutable production revision was created, and no Google Calendar event was created or changed.

### 2026-09-23 — Production deployment of `c1432b5`

- Rotated a single shared `RACE_CONTROL_TOKEN_ENCRYPTION_KEY` onto both Workers via `wrangler secret bulk` using a 0600 temp JSON file that was deleted immediately afterward; the value was never printed.
- Deployed the coordinator first (`xerom-race-control-coordinator`, version `41465367-fa6f-4ad9-9882-a34ac334c90b`), then the website (`xerom-website`, version `2a1f2aaa-1937-4166-95c9-fc1e6e7e7990`, then secret version `65bf1e62-013d-4d3b-887f-850ee7714425`). The website secret was resynced after deploy because Wrangler blocks direct secret edits while an undeployed version exists.
- Read-only verification: homepage and `/api/public-config` 200 (compiled bootstrap `seed-draft-v2`); Race Control and admin config routes 302 to Access; coordinator public URL 404 by design; live availability 200 in `live` mode; both R2 config objects absent.
- Publication, rollback and authenticated owner review were not exercised; no Calendar or R2 object was written.
