# Race Control — implementation and UX plan

Date: 2026-09-15  
Status: build-ready planning proposal based on owner answers; no dashboard implementation or infrastructure changes performed.  
Audience: owner, implementation agents, reviewers.  
Companion: [Agent handoff](agent/RACE_CONTROL_HANDOFF.md).

## 1. Outcome and authority

Race Control becomes Xerom's owner-operated front desk and business editor. The public site remains a mobile-first discovery and booking surface. Google Calendar remains the booking system of record. Business edits publish at runtime without rebuilding/redeploying the website. Initial engineering deployment and initial account authorization are still necessary.

Read AGENTS.md, PRODUCT.md, CONTENT_TODO.md, WEBSITE_PLAN.md, BOOKING_ARCHITECTURE.md, RESEARCH.md, DESIGN.md, and this plan before implementation. Confirmed owner facts win. Preserve the official logo. The mockup at `docs/mockups/index.html` is visual evidence, not a source of rates, statuses, permissions or working interaction logic.

### Confirmed owner decisions

1. Create, change and cancel reservations in Race Control; Calendar retains records.
2. One owner role initially; no staff account/permission management UI.
3. Runtime publication with no website build; evaluate avoiding a separate database.
4. Edit inventory, prices, add-ons, weekly/exception hours, promotions, booking rules, website text/contact/photos. Advanced booking rules and website content have separate sections.
5. Preserve confirmed prices. Review affected reservations before restrictive changes; explicitly review bookings outside changed business hours. No automatic cancellation or customer notifications.
6. Percentage offers, weekday/weekend offers and duration packages are required; define conflict handling.
7. Desktop is primary; tablet supports the booking chart. Include walk-ins, check-in, countdown, extension, completion and no-show handling.
8. Automatic Calendar setup; explicit confirmation before creating or deleting each resource calendar.
9. Preserve current black/red/white Race Control direction.

### Engineering defaults proposed by this plan (not owner-confirmed business facts)

- Lowest eligible price per resource, no discount stacking; base price is always a candidate.
- Fixed-duration packages priced per resource; mixed groups sum resource-level results.
- Resource retirement preserves calendars; permanent deletion is a separate guarded action.
- Price-only changes publish immediately; restrictive hours/resource changes require conflict resolution.
- Owner walk-ins may bypass customer advance-notice/horizon rules, never physical availability or closures.
- Check-in/no-show/completion do not automatically release reserved time.
- Authentication through Cloudflare Access; Calendar provisioning through venue-owner OAuth.
- R2 versioned objects for configuration/media; existing Durable Object for serialization and recovery metadata.

### Owner policy update — 2026-09-16

Race Control/manual owner bookings are allowed at any future minute within opening hours, without a minimum-notice floor, and support 30, 60 and 120 minutes. Public customer bookings remain on the confirmed 60/120-minute and one-hour-notice policy until the owner explicitly changes the customer-facing rules. This update does not bypass Calendar availability, venue closures or the existing three-day horizon.

These are precise starting rules for builders. Do not interpret illustrative examples or feature support as activation of a real promotion, new price, holiday schedule, or longer session duration.

## 2. Existing implementation and required refactors

| Existing path | Current role | Required evolution |
| --- | --- | --- |
| `astro.config.mjs` | Server output, Cloudflare adapter, compile-time image service | Retain Astro/TS. Render editable business data at request time; uploaded media uses runtime asset URLs |
| `src/config/service-core.ts` | Fixed three service types, capacities and calendar environment keys | Keep stable service IDs; replace live resource counts/mappings with runtime registry |
| `src/config/booking.ts`, `pricing.ts`, `business.ts`, `services.ts`, `hours.ts`, `media.ts` | Compiled business values and presentation | Bootstrap/migration seed only after cutover; live reads use one config repository |
| `src/lib/booking/schema.ts` | Hard-coded capacities and 60/120-minute unions | Separate structural input validation from runtime business validation; retain safe request-size bounds |
| `src/lib/booking/time.ts`, `pricing.ts`, `resources.ts` | Pure-ish helpers with config imports | Inject validated config snapshot and clock; no duplicated live constants |
| `src/lib/google/auth.ts`, `calendar.ts` | Service-account auth, FreeBusy, event insert/delete | Add event get/list/patch, ETags, pagination, owner provisioning adapter and strict response validation |
| `src/pages/api/availability.ts`, `bookings.ts` | Public booking API | Share quote/config logic, preserve privacy/Turnstile; final check in coordinator |
| `coordinator/src/index.ts` | Single named DO, creation idempotency, rollback | Typed command dispatcher, durable operation journal, group mutation recovery, config activation ordering |
| `src/pages/`, public components | Existing marketed experience | Read sanitized runtime settings; preserve composition and booking accessibility |
| `tests/booking`, `tests/e2e` | Existing domain and browser tests | Extend; add coordinator/Google failure injection contracts |

Important baseline findings to resolve before reusing adapters:

- `queryFreeBusy` currently treats a missing calendar entry as an empty schedule. Missing entries must fail closed.
- `insertEvent` currently treats every 409 as success. Retrieve the existing event and verify operation identity/payload before accepting a replay.
- Current event `resourceId` is an allocation-loop index, not a durable physical identity. Introduce stable IDs and a legacy mapping adapter.
- The coordinator currently validates time before its serialized section and imports compiled pricing. Move final rule/config/quote validation inside the serialized operation.
- Failed/ambiguous inserts and crashes between Google writes and journal writes need deterministic recovery before expanding mutations.
- Current package `lint` aliases `astro check`; report that accurately, not as an independent lint engine.
- AGENTS.md targets Cloudflare Pages; the existing demo is a Worker. Preserve the running demo. Verify Pages-compatible bindings in the first spike and document the deployment target before making any migration. Do not introduce a framework/platform migration implicitly.

## 3. Storage decision: avoid a separate application database

### Options

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Compiled TypeScript / Git-backed publishing | Simple, versioned with code | Requires build/deploy; fails runtime-edit requirement | Seed/export only |
| Store settings in Calendar event descriptions | No extra storage product | Misuses schedules, awkward validation/versioning, cannot host photos, easy manual corruption | Reject |
| Google Sheets/Drive settings | Familiar Google tools | Extra API/auth surface, weaker app-level validation and concurrent editing model, media delivery complications | Not preferred |
| Workers KV | Simple distributed reads | Eventual consistency can show old rules after publish; still a persistent key/value datastore | Do not use for authoritative activation |
| R2 objects + existing coordinator | Runtime configuration and images, immutable revisions, no separate relational database | Must implement schema validation, pointers, audit/recovery and access controls; no SQL/reporting | Recommended |
| D1/Postgres/etc. | Transactions, querying, reporting, richer multi-location administration | Extra database lifecycle and schema; diverges from requested constraint | Revisit only with new requirement/approval |

Recommendation: use **private R2 configuration objects plus the existing booking coordinator**. This avoids a separate application database, not all storage. Durable Objects already use persistent storage internally; recovery metadata is still necessary. Calendar holds confirmed operational bookings, not R2 booking tables.

R2's direct object reads are strongly consistent; cached public-domain reads can lag. KV can return stale values across locations. These differences drive the choice, not a claim that R2 supplies cross-service transactions. [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/), [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

### Storage boundaries

- Private config bucket: immutable `revisions/{revisionId}.json`, one `active.json` pointer, owner draft, private registry, mutation audit objects and encrypted OAuth token envelope.
- Media bucket: immutable processed assets keyed by content hash; draft assets accessible only through authenticated preview. Serve only published assets via an allowlisted public media endpoint.
- DO storage: operation ID, request hash, state, resource/event references, temporary mutation preimages, publication activation fence and recovery checkpoints. Never a permanent independent booking ledger.
- Calendar: customer details, group booking metadata, immutable price snapshot reference/content, lifecycle status and resource reservations.
- Secrets/bindings: encryption key, Google client secret/service-account credentials, Access issuer/audience/owner allowlist, Turnstile keys. No secret values in documents or public config.
- Audit records contain actor ID, action, object IDs, version delta and result; omit customer name/phone/notes. Incomplete recovery records must not expire. Completed journals default to 30 days pending privacy/retention approval; configuration revisions and non-PII audit remain until owner chooses a retention policy.
- This is one venue and one owner; no analytics warehouse, membership system or customer account database.

### Publication and runtime read contract

1. Every request resolves one `active.json` pointer via a direct binding read, then loads the immutable revision it names. All content/prices/JSON-LD in that response use that revision.
2. Public projection is constructed by an explicit allowlist. Never serialize the private document and remove a few fields afterward. Calendar IDs, resource secrets, drafts and audit data never enter browser payloads.
3. Mutable HTML/config responses use `no-store` initially. Immutable JS/CSS/media and immutable internal config bodies can cache by revision/hash. Do not use stale-while-revalidate for active pricing/availability rules.
4. Open public booking sessions obtain a fresh quote before confirmation. Refresh public display config on focus and at a proposed 60-second visible-page interval; new navigations see the latest revision immediately. Do not promise that already-open pages change at the exact instant of publication.
5. Save draft with expected revision/ETag. Stale saves return 409 and a field diff; never last-writer-wins, even with one owner using two tabs.
6. Review returns normalized draft hash, base revision, impact results and an expiring review token. Proposed expiry: five minutes. Publish reloads data and revalidates under the same coordinator used by bookings.
7. Write immutable revision and audit intent before activation. Under serialization, conditionally update the active pointer using expected ETag, then read it back. The pointer swap is the publication boundary. [R2 conditional writes](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
8. Lost publish response: retry the same operation ID, inspect active pointer, complete audit/reply without publishing a second revision. Failed pre-activation writes leave the old revision live.
9. Crash after activation: recovery completes the audit from durable intent. Do not claim nothing changed if pointer already advanced.
10. Rollback creates a new revision through normal validation/impact review. Never restore old resource mappings blindly after deletion or cancel bookings automatically.
11. Config outage: block new reservations and owner writes. Show a truthful unavailable state; do not silently use compiled seed values for live decisions.
12. Ordinary text/rate publication performs no Google mutation. Resource provisioning and immediate maintenance are separate explicit operations. Avoid a fake “atomic transaction” spanning R2 and Google.

## 4. Authentication and Google ownership

Owner login and Google integration connection are distinct:

- Protect `/race-control/*` and `/api/admin/*` with Access and server-side JWT signature/issuer/audience/expiry validation plus one verified owner identity allowlist. Deny missing identity on all hostnames, including preview/workers.dev bypasses. [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).
- Require same-origin + CSRF protection on owner mutations, bounded bodies, secure session handling, no admin responses in shared caches. No admin powers from a browser `role` or `source` field.
- Existing service-account event access does not automatically grant ownership/provisioning rights. Use a one-time venue-owner OAuth connection for creating/deleting secondary calendars and necessary ACL setup. Retain narrow service-account access for booking operations.
- Calendar created with service-account credentials would be owned by that service account; use the venue's Google identity for ownership. [Google calendar ownership](https://developers.google.com/workspace/calendar/api/concepts/events-calendars).
- Request only required scopes verified by a test-account spike: calendars creation/deletion, owned-calendar event inspection as needed, and ACL permission for sharing with the booking identity. Do not request domain-wide delegation by default.
- Use authorization-code OAuth with state, PKCE where supported, exact callback allowlist, offline access, server token exchange and encrypted refresh-token storage; verify production consent/testing-mode constraints. Owner consent is an explicit setup gate. [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).
- Token revocation: preserve reservations, stop provisioning, display Reconnect Google. If booking identity cannot read/write, fail booking commands closed. Do not expose raw tokens or calendar IDs in UI/errors.
- Local development uses explicit mock identities on localhost only; production cannot fall back to mock admin login.

## 5. Domain model and invariants

### Typed records (shared schemas, immutable IDs)

| Record | Required content |
| --- | --- |
| `ConfigRevision` | schemaVersion, revisionId, parentRevision, publishedAt, actorId, venue, services, resources, hours, rates, promotions, bookingRules, websiteContent |
| `Resource` | stable resourceId, serviceId, displayName, activeFrom, retiredFrom, lifecycle (`draft/provisioning/ready/active/retired/error`), controller capacity if relevant, private calendarRef; busy is derived, not a saved lifecycle |
| `Hours` | timezone fixed to Asia/Kuala_Lumpur; weekly intervals; date-specific overrides with explicit opening-date and next-day end; closures; revision |
| `Rate` | integer sen per resource-hour, optional add-on rate and explicitly confirmed add-on billing unit, effective interval |
| `Promotion` | immutable id, label, type, eligibility (days/dates/services/channel/duration/time), percentage basis points OR package price sen, priority, state, terms, effective interval |
| `BookingRules` | slot interval, allowed durations, customer minimum notice, explicit horizon mode/value, buffer, per-service and total group limits, mixed-service permissions |
| `BookingGroup` | bookingId, schemaVersion, operationVersion, expected resource IDs/count, start/end, businessDate, line items, source, customer, lifecycle, locked price snapshot, configRevision; event references remain private |
| `Operation` | opId, command type, actor, hash, expected versions, steps/preimages, results, `pending/running/succeeded/failed/needs_review`, safe retry/recovery information |
| `Review` | draftHash, baseRevision, affected booking IDs, validation errors, timestamp, expiry; not authorization to skip a fresh scan |
| `MediaAsset` | hash/id, mime, dimensions, derivatives, alt text, focal point, rights confirmation, draft/published references |

Each application event carries the same booking ID, group version, expected membership manifest/hash and locked itemized price snapshot (or a compact self-contained serialization within verified Calendar field limits), plus its own stable resource ID. Validate provider size limits in RC-00; bound supported group size and reject oversize records before writing. Do not depend on a permanently stored DO response to reconstruct a booking. Group inspection checks the expected membership against all linked Calendar events; missing/divergent events trigger review, not a smaller apparently complete group. Keep technical metadata separate from owner-readable descriptions where possible and preserve unrelated manually added fields during conditional patches.

Public capacities derive from eligible resource registry entries; no second independently edited inventory count. Physical seats/controllers, number of bookable resources, and group maximum are separate concepts. Do not invent people/fire-safety capacity.

### Time and eligibility

- Store event instants as ISO timestamps; use Asia/Kuala_Lumpur for business dates and display.
- Intervals are half-open `[start,end)`, with buffers added consistently to both availability and final allocation. A zero buffer allows exact adjacency.
- A business date is the date the operating window opens. A Saturday 00:30 session inside Friday's overnight window belongs to Friday's service day. Label this rule in hours/promotions editors.
- Preserve confirmed seed hours and durations (60/120 minutes). Owners may later publish additional durations through Advanced settings. Packages cannot bypass allowed durations, closing times or resource availability.
- Date overrides replace that business date's weekly intervals. Reject overlaps, duplicate overrides and accidental overlaps with the following day's opening windows.
- For calendar all-day closure events, respect local calendar-date semantics and exclusive end date; do not reinterpret them automatically as overnight business-day closures. Race Control creates exact timed closure intervals covering the intended operating day.
- All busy manual events and control-calendar blocks remain authoritative. A gap in the chart is not a promise of online availability.
- Structural input bounds protect the server; dynamic limits come from config. Keep service IDs stable for the initial Regular/Pro/PS5 domain. Editing names is supported; arbitrary new service types require another scoped feature.

## 6. Promotion and package engine

### Owner-facing model

One Offers section, three creation choices: **Percentage discount**, **Weekday/weekend offer**, **Duration package**. Weekday/weekend is a date/day eligibility preset, not a second discount stacked onto an offer. Owner explicitly selects included weekdays; never infer them from opening-hour groups.

Each offer editor asks: name → services → days/dates/time window → amount/duration → channels → preview → terms. Required real values stay empty/draft until supplied. Use `Draft`, `Scheduled`, `Active`, `Expired`, `Paused` badges computed from time and enabled state; expiration does not depend on a deployment or cron job. Eligibility uses the booked service interval, not the current badge: an enabled scheduled offer may price a future booking inside its valid dates. Paused/draft offers never qualify.

### Deterministic pricing algorithm

1. Validate current config and the full requested reservation interval.
2. For each service line, calculate the undiscounted per-resource session price in integer sen. Select one base rate version effective at session start; the booking locks it at confirmation.
3. Build candidate prices: base; each eligible percentage offer applied to base; each eligible exact-duration package price.
4. Eligibility requires the requested service, channel, business-day weekday, date range, duration, and entire time window to match. Full interval must fit an offer window; an offer starting/ending mid-session cannot partly discount it in this release.
5. Pick the lowest nonnegative candidate per resource. No stacking percentage with package, percentage with percentage, or sequential discounts. If prices tie, prefer base if equal to base, otherwise higher configured priority, then stable offer ID. Priority only breaks ties; it never forces a higher price.
6. Multiply winning per-resource amount by quantity. Add controller charges separately at the configured billing unit. Promotions exclude add-ons initially; UI states this. Controller billing unit/maximum remains owner-required before enabling the add-on online.
7. Sum service lines. Mixed groups can have different winning offers. Each resource's whole session uses one offer; no automatic splitting into several smaller packages or buy-X-get-Y logic.
8. Percentage arithmetic: basis points, round half-up to one sen once per resource-session, then multiply quantity. Reject NaN, negative rates, invalid dates, percentages outside 0–100%, empty applicability and unsupported package durations.
9. Return itemized base, selected offer, saving, add-ons, final total, currency, config revision, pricing-engine version, quote hash/expiry and machine-readable explanations of rejected candidates for owner preview.
10. Customer sees selected offer and total only; detailed competing offers belong in owner preview. Quotes expire after a proposed five minutes and reserve no capacity. Bind the quote to normalized items/start/duration/channel/revision/amount/expiry with a server-authenticated token (or equivalent server verification); a browser-supplied hash or total is not evidence of a previously quoted price. Final coordinator recalculates; changed totals/rules require a new review/confirmation, never a silent price increase.

Example for tests ONLY (not production business copy): Regular base RM20/hour; two hours = RM40; weekday 10% offer = RM36; two-hour package RM35 → RM35 wins. With a 20% offer RM32 wins. Two rigs cost RM64 in the latter case. Add-ons remain separate. These synthetic offers must never be seeded active.

### Conflict editor

- Show overlap warnings listing matching services, dates/days, times and durations.
- Distinguish invalid configuration (blocks publish) from legitimate competing offers (warning plus deterministic winner).
- Preview one- and two-hour examples for selected weekdays/weekend dates and mixed groups; owner chooses dates rather than synthetic previews presented as actual sales.
- Show “May never win” when an offer is dominated by another throughout demonstrably overlapping eligibility. Do not claim exhaustive coverage from a few samples.
- Base/pricing updates never mutate existing booking snapshots. Reject overlapping base-rate effective intervals for the same service; offers may overlap under the winner rule. A weekday/weekend offer can choose a percentage or a configured duration-package amount; it cannot create an implicit stacked discount.
- Default reschedule with identical service/quantity/duration preserves locked total. Changing resources within the same tier preserves it. Changed tier/quantity/duration requires an explicit new itemized quote.
- Extension preserves original charges; quote only the added time using current applicable rules. Original plus added charges is shown before confirmation; do not retroactively repackage the original session. Enable extension lengths only from published rules.

## 7. Front-desk booking operations

### Schedule data and refresh

- Fetch private events for selected business day across active and relevant retired resources plus control calendar, with pagination and recurrence expansion. Group by application booking ID; never merge manual events merely because titles match.
- Display unrecognized events as “Calendar block”; they still prevent booking. Allow explicit import/adoption review before applying grouped booking actions; do not infer customer data/prices from free text.
- Start with polling every 15 seconds while visible, refresh on focus and after writes; pause background polling. Show actual `lastSuccessfulReadAt` and per-calendar status. If a poll fails, immediately mark affected availability unknown, retain old blocks as stale context, and disable affected mutation actions until server validation succeeds.
- Countdown uses server time offset and scheduled end; no write every second. At zero show “Time ended — confirm completion”; do not auto-complete or free a rig.
- No fake occupancy or revenue: active count comes from consistent event intervals and lifecycle; distinguish booked rigs, checked-in rigs and free rigs. Revenue/payment tracking is outside scope.
- Polling is a view freshness mechanism, never an allocation lock. Google offers event listing/recurrence support; implement pagination and cancellation handling per API. [Events list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).

### Lifecycle

`confirmed → checked_in → completed`; `confirmed → no_show`; `confirmed → cancelled`; `checked_in → cancelled` requires explicit review. No-show is manual after start time; no automatic late/no-show grace policy. Corrections back to a previous state require a reason and conditional update. Never automatically resurrect cancelled reservations.

The app lifecycle is separate from Google's event status. Cancellation explicitly changes all linked reservations to private transparent historical records with app lifecycle `cancelled`, releasing their intervals while preserving metadata. Completed/no-show events stay opaque and keep their original occupied interval by default; releasing remaining future time is a separate explicit action. Badge-only changes cannot implicitly release capacity. Early release shortens the blocking interval while preserving original scheduled times in metadata and audit; a late release never backdates or erases historical usage.

| Action | UI and business logic |
| --- | --- |
| New booking | Resource/service quantities → date/time/duration → customer → authoritative quote → confirm; allocate all resources together |
| Walk-in | Same flow, source preset walk-in, start defaults to server now; owner can use current time off the public hourly grid. Still check full duration, buffers, hours and all busy blocks. Display that customer notice/horizon limits are bypassed |
| Check in | Selected group, show resources/time, one action persisted across all group events; actual check-in timestamp separate from scheduled start |
| Extend | Show current end, allowed extra durations, next conflict and additional charge; reserve full added interval for all selected group resources before success |
| Reschedule | New date/start/resources, impact/price review; fetch all group events and expected versions; exclude only verified current-group event IDs from conflict checks |
| Complete | Mark actual completion timestamp; retain scheduled interval/history. Offer separate “Release remaining time” if early |
| No-show | Manual after start, reason optional, preserve reservation interval until explicit release |
| Cancel | Show all linked resources, reason, consequences and confirmation; update every group event, retain history, no automatic message |
| Maintenance | Select specific rigs and interval; immediate operational action, impact review for existing bookings, no fabricated free capacity |
| Venue closure | Exact timed control-calendar block; review affected reservations; block publication/creation until conflicts resolved |

Customer requests can still arrive via WhatsApp; owner performs actual changes in Race Control. No WhatsApp API automation, automatic messages, deposits or payment collection in this phase. Do not add hidden notifications through Google attendees/reminders.

### Mutation integrity and recovery

- All app booking, blocking and config activation commands share the same venue coordinator ordering. Authenticated owner commands enter via trusted service binding with server-derived actor; public payload cannot impersonate owner.
- Persist operation ID and normalized payload hash before side effects. Booking ID must be stable before first insert. Duplicate response loss returns recorded outcome; changed payload on same ID gives 409.
- Final validation runs inside serialization: active config, rules, fresh Calendar data, quote and resource health.
- Multi-resource edits are not Google transactions. Implement a durable step journal: read all versions/preimages; preflight all changes; write in deterministic order with `If-Match`; record each result; verify all before success.
- On failure, compensate only versions created/changed by this operation. Never overwrite an intervening external edit to “roll back.” If compensation is unsafe or uncertain, keep operation in `needs_review`, fence affected resources and show reconciliation instructions.
- Use full event IDs/ETags privately; external edit conflict yields owner-friendly 409 after Google 412. [Google conditional mutations](https://developers.google.com/workspace/calendar/api/guides/version-resources).
- Availability considers coordinator recovery fences as well as Calendar; uncertainty cannot reopen a partially modified slot. Public reads may call coordinator for fence snapshot; final commands always consult authoritative fence state.
- Preserve before-images temporarily only for recovery. Do not copy all booking history into DO/R2.
- Existing `blockConcurrencyWhile` wraps network calls; verify runtime timeout/interleaving semantics. Long provisioning/history scans must be paginated jobs with durable checkpoints. Implement a coordinator alarm/recovery runner so accepted operations progress after the browser closes; GET operation polling must not be the only execution driver. Persist retry counts and bounded exponential backoff for dependency throttling; surface exhausted/ambiguous jobs for review. Use short bounded serialized mutation phases and persistent fences across resumable work, not an unbounded lock. All mutations recheck job/operation versions before proceeding.
- Direct Calendar UI writes bypass this coordinator. Detect external overlaps/group divergence on refresh and after writes, flag for owner, and fence conflicts. Do not claim a distributed lock over Google Calendar. In-app writes should be the routine workflow; external editing remains an exceptional recovery path.

## 8. Hours changes and affected-booking review

Hours editor supports individual weekdays, copy-to-days, explicit overnight end, date exceptions and closures. Right-hand preview shows the resulting public hours and valid booking intervals.

Changing hours:

1. Save draft; live hours stay unchanged.
2. Compare proposed windows with every relevant future reservation (not just public three-day horizon). Include manually added bookings, all resources, buffers and the previous overnight business date.
3. Paginate the complete future event inventory. For recurring series without an end, conservatively flag the series for review instead of pretending a finite scan proves safety. No arbitrary silent lookahead cutoff.
4. Review lists booking/date/customer/resources/old window/proposed conflict/reason. Group app events once; unknown busy blocks receive explicit classification/review.
5. Allowed resolutions: revise proposed hours, add an explicit date exception that covers the reservation, reschedule in Race Control, or explicitly cancel with owner confirmation. No “ignore and publish” blanket bypass.
6. Cancellations/reschedules execute as separate live booking operations with their own confirmation; discarding the settings draft does not undo them. Explain this visibly.
7. Refresh review. At publication run a fresh conflict check under coordinator ordering, or use a fenced resumable review job for large inventories and revalidate before pointer swap. External changes during review invalidate it. If complete inspection cannot be established, publishing remains blocked.
8. Publish only when no unresolved conflicts remain. Preserve existing price snapshots.

Availability-reducing rules (buffers, resource retirement, maximum durations where applicable) follow the same impact-review mechanism. Lower group limits apply to new bookings and do not invalidate existing reservations by default; explain that distinction.

## 9. Automatic resource/calendar lifecycle

### Add resource

1. Owner chooses service, display name and optional verified controller capacity. Count is derived, not edited separately.
2. Review dialog states “Create one private Google Calendar for [resource] in the connected Xerom account.” Show timezone and booking identity access in plain language. Explicit **Create calendar** confirmation is required.
3. Backend creates a durable provisioning operation; creates a secondary calendar as venue owner; records returned ID privately; shares required event access with booking identity; verifies read/write permissions using isolated temporary probe events cleaned up before completion.
4. Calendar insert does not accept a client event-style deterministic ID. If create response is lost, do not blindly retry. Include an operation marker in a supported calendar field and reconcile through an owner calendar listing plus metadata; ambiguous results need review. Test this behavior before launch. [Calendar creation](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert).
5. Resource becomes `ready`, not publicly active. Owner publishes activation; verify mapping/ACL/health again. New count, pricing page and allocation registry then agree.
6. Discarding an activation draft leaves an unused ready resource/calendar. Offer retirement or separate confirmed deletion; never silently delete it.
7. On partial setup failure, show the actual state and Retry setup. Do not create duplicates or make resource bookable. Any cleanup requiring calendar deletion needs the explicit deletion confirmation.

### Pause, retire and delete

- Pause interval: use maintenance/block workflow with impact review. No Calendar deletion.
- Retire: stop new bookings from effective time; resolve future bookings first; preserve calendar/history and retired registry entry. Recommended everyday “remove from fleet” action.
- Permanent delete: separate Danger zone. Require owner identity, typed resource name, explicit explanation that Calendar events/history are removed, fresh server preview token bound to resource/action and short expiry, then **Delete calendar permanently**.
- Never delete primary Calendar, Booking Control, an unmapped/unowned calendar, or an active resource. Do not accept raw client calendar IDs.
- Default guard: only empty retired calendars may be permanently deleted. For calendars containing history, deletion remains disabled until the owner confirms a retention/export policy; do not disguise retirement as deletion. This protects the confirmed history requirement while still supporting automatic empty-calendar deletion.
- Future reservations, manual busy events and recurring series must all be checked. Any conflict or incomplete scan blocks deletion. Keep resource fenced during deletion and verify success before final registry tombstone.
- Lost delete response: verify Calendar absence and journal result; don't recreate a calendar automatically. Failure leaves retired/unavailable, with Retry deletion requiring valid reviewed intent.
- Google calendar delete is a separate API action; removing an entry from a user's calendar list is not deletion. [Calendar deletion](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/delete).

## 10. UI architecture and visual hierarchy

Mode: **Operate**. Keep branded frame; prioritize scan speed, accurate state and predictable actions. This is an expansion of DESIGN.md's implemented identity, not permission to rewrite its shipped design tokens. Update DESIGN.md only after new UI is implemented and visually verified.

### Navigation

```text
Race Control
├── Schedule                 /race-control
├── Bookings                 /race-control/bookings
├── Business Settings
│   ├── Resources            /race-control/settings/resources
│   ├── Hours & Closures     /race-control/settings/hours
│   ├── Pricing              /race-control/settings/pricing
│   ├── Offers & Packages    /race-control/settings/offers
│   └── Advanced Rules       /race-control/settings/rules
├── Website Content          /race-control/content
├── Changes & Activity       /race-control/activity
└── Connection               /race-control/connection
```

No role switcher or user-management page in owner-only release. Every route has a stable URL; switching routes cannot discard unsaved draft state silently.

### Desktop schedule (1440+)

- Top application bar, approximately 64px: official logo / Race Control; current business date and timezone; actual sync age; owner menu. Avoid duplicate enormous page title.
- Left navigation approximately 200px, collapsible; one active item. Resource filters live above the chart, not a second permanent roster duplicating chart rows.
- Main toolbar: Today, previous/next, date picker; Day/Agenda; service filters; search; primary **New booking** and secondary **Block time**.
- Compact operational summary: booked rigs now, checked-in rigs, next arrivals, attention required. Each metric has a definition; no percentage “health score” and no cafe-open inference.
- Chart begins in the first viewport. Sticky time axis and 160px resource-label column. Each resource row approximately 64px, enough for clear label/state. Render full actual operating window, including noon opening and next-day end.
- Current-time marker calculated from server clock, visible only when viewing relevant interval. Booking blocks show customer or group label, time and lifecycle. Narrow blocks show a short label and accessible details; never require hover to identify a booking.
- Resource selection opens a roughly 360px inspector; empty selection leaves chart wide. Below 1280px use a drawer overlay instead of squeezing the chart into a tiny central column.
- Booking inspector order: customer + status → date/time/countdown → allocated resources → locked price/offer → primary context action → secondary actions → notes/activity. Hide full phone in chart; reveal in authorized details. Group selection highlights every linked resource block.
- Remove promotional equipment photo strip from Schedule. Photos belong in Resources / Website Content.
- Drag-to-reschedule is deferred; use explicit action form with preview and confirmation first.

### Forms and settings

- Page title 28–32px; section titles 18–20px; body/input 16px; table data 14–16px; secondary metadata at least 12–13px. Numbers use tabular figures; names/details use Barlow, not italic display type.
- Use DESIGN.md black/panel/line/warm-white tokens. Action red for primary CTA. Warm-white border for selected booking, focus amber for keyboard focus, warning tokens + pattern/icon for maintenance; text labels distinguish every state.
- Main controls at least 44px touch targets, preferably existing 52px control height for forms; visible focus ring must survive clipped button decoration.
- Settings forms max readable width ~800px with supporting preview ~320px when space allows. Label over control; helper below; errors adjacent and in a summary linked to fields.
- Resource table: Name, Type, Availability state, Calendar connection, Next booking, Actions. Show aggregate active/paused/retired counts above. Edit opens detail drawer; destructive actions in labelled menu, not an exposed trash icon on every row.
- Hours: seven daily rows with Open switch, start/end fields, “next day”; copy selected days; exception list. Switching a day closed edits a draft, not instant operational closure.
- Pricing: one service row each, amount/currency/unit, effective time, add-on rules. Preview an actual configured duration; currency input converts exactly to integer sen.
- Offers: list cards/table with eligibility, price effect, state, competing-offer warning; editor and quote simulator side by side.
- Advanced rules: collapsed sections for customer timing, duration/buffer, group limits; show current public impact. No generic editable JSON field.
- Sticky draft bar: **Saved draft · N changes**, Preview, **Review changes**. Do not say “Live” on draft toggles. Review page shows diffs and booking impacts, then **Publish changes** only when valid. During publish show progress; success displays revision/time; failure preserves draft.
- Activity page separates settings publications, booking actions and unresolved operations. Filters and actionable Retry/Review; never rely on a transient toast for failures.
- Connection page gives connected venue account, per-resource health, last successful operation, Reconnect Google and retry guidance. Calendar IDs/secrets remain hidden.

### Website content editor

- Fixed structured sections matching existing public pages, not a freeform page builder: homepage copy/approved images, experiences copy, venue/contact/directions, pricing explanatory copy and photo gallery.
- Facts such as rates/hours/resource counts are referenced tokens/structured fields, not duplicate editable sentences. Public navigation/booking links remain validated routes.
- Preview desktop and mobile using the same public components and draft revision, authenticated and `noindex/no-store`. Public routes cannot request draft revisions.
- Allow safe text and constrained formatting only; reject scripts, arbitrary HTML and unsafe link schemes. No arbitrary remote URL fetch/import.
- Upload JPG/PNG/WebP with proposed 10MB limit; verify actual file signature/dimensions, enforce pixel/decode limits, strip metadata, generate bounded derivatives, require alt text and rights confirmation. Do not permit untrusted SVG/HTML uploads. Keep official logo locked.
- Persist focal point and stable asset ID; public assets use content-hash URLs and immutable cache headers. Do not try to feed runtime uploads through Astro's compile-time asset imports.
- Upload does not publish. Publishing media references and public copy is one config revision. Garbage collection must preserve active/draft/history references; media deletion is separate from config rollback.

### Tablet and phone

- 1024px landscape: compact/collapsible navigation, chart remains primary; inspector is a dismissible overlay; all operations touch-accessible.
- 768px portrait: Day/Agenda toggle, compact toolbar, horizontally scrollable chart with sticky resource labels; no automatic scroll that hides identity. Resource rows remain comfortably tappable.
- 375/390/430px: default Agenda grouped by start time with persistent date and New booking action; optional chart. Forms single column and inspector full-screen with Back. Review changes uses stacked before/after cards.
- Sheet/dialog opens with focus inside, traps focus, Escape/Back closes safely and returns focus to trigger. Announce loading/success/errors; provide semantic agenda alternative to any ARIA grid. No pretend grid without complete keyboard behavior.
- Proposed motion 120–180ms opacity/translation for drawers only; reduced motion removes transitions. Never animate chart geometry as if a reservation moved when data refreshes.

## 11. API contract proposal

Names below are proposed endpoints, not currently implemented. Use shared Zod schemas and generated/checked TS types. All mutation requests require an idempotency key. Versioned edits require expectedRevision or opaque bookingVersion; server resolves private event IDs/ETags.

| Endpoint | Contract |
| --- | --- |
| `GET /api/public-config` | Sanitized live config + revision only; no-store |
| `POST /api/quotes` | Items/start/duration/channel derived from endpoint identity; returns authoritative quote/hash/expiry |
| Existing public availability/bookings | Migrate to runtime config, quote review and current coordinator; preserve public privacy |
| `GET /api/admin/schedule?businessDate=` | Grouped events/resources/blocks, per-calendar freshness, serverNow, operation fences; no-store |
| `GET /api/admin/bookings?from=&to=&query=` | Bounded/paginated owner search; dates required, no permanent customer directory |
| `POST /api/admin/bookings` | Owner create/walk-in; server actor/source; complete confirmation or operation status |
| `POST /api/admin/bookings/:id/actions` | Discriminated action, expected version, optional proposal/quote and reason |
| `POST /api/admin/blocks/review`, `/blocks` | Impact preview then confirmed maintenance/closure command |
| `GET/PUT /api/admin/config/draft` | Draft + ETag; bounded field update or full validated document; expected version |
| `POST /api/admin/config/review` | Draft revision/hash → errors, impact list, review token |
| `POST /api/admin/config/publish` | Review token + expected revision → published revision or 409/review-required |
| `POST /api/admin/config/restore` | Old revision → new draft, never direct activation |
| `POST /api/admin/resources/provision-review`, `/provision` | Confirmation preview then create operation; no raw calendar ID input |
| `POST /api/admin/resources/:id/delete-review`, `/delete` | Deletion eligibility and bound confirmation token; asynchronous result |
| `GET /api/admin/operations/:id` | pending/running/succeeded/failed/needs_review with safe next action |
| `POST /api/admin/media` | Authenticated bounded upload → draft asset ID/derivatives |
| `GET /api/admin/connection`, OAuth start/callback | Owner identity, health and one-time connection |

Response envelope: `{data, configRevision?, serverNow?, operationId?}` or `{error:{code,message,fieldErrors?,retryable}, operationId?}`. Public errors never disclose private event/resource/calendar details.

Status conventions: 200 read/replay, 201 complete create, 202 durable accepted operation (NOT booking success), 400 invalid, 401/403 denied, 409 stale version/slot/changed quote/review, 413 too large, 429 throttled, 503 dependency unavailable. A 202 client polls and reports success only after verified `succeeded`; closing the tab must not abandon server recovery.

## 12. Delivery sequence and acceptance gates

Each phase ends with a reviewable diff, tests and documented evidence. Do not connect mockup controls directly to Google from the browser.

| Phase | Deliverable | Gate |
| --- | --- | --- |
| 0 — Capability spike | Verify deployment bindings, owner OAuth/ACL/create/delete on isolated calendars, R2 conditional writes, coordinator timeout/recovery model; read existing engineering TODO | No production Calendar mutation; proven ownership and recoverable provisioning; document precise account/scopes/setup |
| 1 — Domain + security | Shared config/quote/operation schemas, owner auth, private R2 repository, seed importer, coordinator dispatcher and fences | Unauthorized access denied including alternate hosts; no secrets in public projections; stale-write and restart tests pass |
| 2 — Runtime public data | Replace compiled live prices/hours/capacity/content reads, inject config into domain functions, public quotes | Publish test revision without deployment; public pages/API/JSON-LD agree; old booking snapshots unchanged |
| 3 — Owner settings UI | Resource, hours, rates, offers, advanced rules, draft/review/publish, quote simulator and history | Complete representative tasks with synthetic data; review blocks conflicting hours; verify responsive comp before final visual documentation |
| 4 — Schedule + bookings | Read grouped Calendar schedule, inspector, create/walk-in/check-in/reschedule/extend/cancel/complete/no-show | All actions support failure/retry; exactly one final-resource success; grouped edits rollback or fence safely |
| 5 — Provisioning + content | Confirmed resource Calendar lifecycle, connection UX, content/media upload/preview/publish | No duplicate calendar on retry; deletion guards; media safely published without build; retired history preserved |
| 6 — Recovery + launch | Reconciliation screen, operational guide, test-account migration rehearsal, full E2E/security/visual QA | Owner can recover known failures; no test credentials/widget/calendar data in production; production launch separately controlled |

Feature-complete release requires all phases. Settings-only or read-only schedule is a milestone, not fulfillment of the whole request.

### Migration / cutover

1. Preserve current live deployment; test against separate Google calendars and R2 environment.
2. Import confirmed config as draft; migrate existing fixed environment-calendar mappings into private stable resource registry. Never recreate the seven existing calendars.
3. Preserve original event IDs. Read legacy events with missing stable resource IDs/pricing snapshots conservatively. Do not guess a legacy price from today's rate; show “Legacy price unavailable” and require owner review before repricing.
4. Validate all current future bookings against imported config. Existing compare-at prices, Instagram promotion and controller add-ons remain gated by CONTENT_TODO.
5. Wire every public page, quote, availability and coordinator to the same active pointer. Remove independent compiled capacity limits only after tests prove parity.
6. Use one venue coordinator namespace/name for all live app writes; no parallel old/new write engines. During cutover briefly disable booking mutations, drain/reconcile pending operations, activate config-aware code and registry, verify, then reopen. A code rollback must remain compatible with active schema; do not roll back into hard-coded inventory after equipment changes.
7. Initial deployment establishes runtime editing. Subsequent business edits perform no build, deploy, Git commit or Cloudflare secret rewrite.

## 13. Test and verification matrix

### Domain tests

- Seed hours, midnight boundaries, previous-business-day checks, date overrides, closed day, buffers, adjacency, malformed dates and horizon modes.
- Dynamic 0/1/N resource counts, retirement windows, controller per-lounge limits, group limits, duplicate line items and resource mapping uniqueness.
- Promotion eligibility: each weekday, overnight service day, date/time boundary, whole interval, quantity, service, channel, package duration, same-price tie, no stacking, integer rounding, add-on exclusion and expired offers.
- Price snapshot survives edits; extension charges added time only; changed quote requires reconfirmation; invalid config fails closed.

### Adapter/coordinator integration tests (failure injection mandatory)

- Missing FreeBusy calendar entry, errors inside 200, revoked access, pagination, recurring/all-day events, stale ETag, external overlap and manually edited group divergence.
- Two final-resource creates: exactly one succeeds. Also public versus walk-in, extension versus new booking, publish versus create, retirement versus create, two owner tabs publishing same base.
- Lost response after insert; 409 for mismatched existing event; crash before/after journal checkpoint; duplicate operation; restart with pending mutation; partial group patch and unsafe compensation.
- Pending operations fence availability; reconciliation restores safety before unfencing; no success until all required events verified.
- Calendar-create lost response does not duplicate; failed ACL setup cannot activate; deletion requires bound unexpired confirmation; missing/primary/control/nonempty/active resource deletion denied.
- R2 revision write failure, pointer condition conflict, crash after pointer activation, invalid active schema and wrong environment.
- Hours review catches future reservations beyond public horizon, recurring series, overnight sessions and new reservation during review.

### Browser/user acceptance

- Owner logs in; creates walk-in; selects group; checks in; sees countdown; extends if free; sees conflict if next booking exists; completes/no-shows/cancels explicitly.
- Owner adds rig with Calendar confirmation, then publishes; all capacity displays agree. Retirement retains history. Permanent deletion of an empty retired test calendar requires separate confirmation.
- Owner shortens hours; sees outside-hours bookings; resolves them; refreshes review; publishes. No reservation is silently cancelled.
- Owner configures competing synthetic offers and sees deterministic quote explanations; no inactive/unconfirmed offer leaks to public pages.
- Owner uploads approved image, previews mobile, publishes; image/text changes visible with same deployed code version.
- 375, 390, 430, 768, 1024, 1440+ widths, keyboard, visible focus, screen-reader semantics, reduced motion, no accidental page overflow, no lost draft on refresh/auth expiry, useful loading/empty/stale/error states.
- Inspect console, failed requests, broken links/404 assets and privacy leakage. Test no-script public rendering of prices/hours where server rendering applies.

Run project `npm run lint`, `npm run check`, `npm test`, `npm run build`, `npm run test:e2e` (use actual installed package manager/lockfile convention). Add meaningful coordinator integration harness; do not substitute unit arithmetic tests for the race test. Record date/environment/commands/results/screenshots in QA_REPORT.md. Never mark unrun live Calendar or browser checks passing.

## 14. Owner/setup inputs still needed (not a reason to invent defaults)

- Owner login identity and venue Google account/account type; OAuth consent/configuration and production hostname.
- Actual offer amounts, active windows and selected weekday/weekend days. Engine can be built/tested with labelled synthetic fixtures first.
- Controller maximum and RM3 billing basis (per session versus per hour) before online add-ons publish.
- Calendar history retention/export policy before deleting a nonempty resource calendar. Empty test-resource lifecycle can be implemented and verified first.
- Confirm public horizon wording (current implementation uses rolling 72 hours); expose current mode clearly and do not silently switch it.
- Existing CONTENT_TODO items: actual holiday dates/hours, verified public facts, customer policy/privacy content, final hero/OG media and production Turnstile.

## 15. Definition of done

Owner can operate every requested front-desk action, change all scoped business/content fields and publish safely without deployment. Public booking and dashboard share runtime config and fresh Calendar validation. Automatic resource setup is owner-confirmed and recoverable. Real business values stay confirmed, secrets stay server-side, Calendar stays authoritative, and failed multi-resource actions cannot present success or sell uncertain capacity.

This document specifies intended behavior. It is not evidence that any feature, integration or test is already implemented.
