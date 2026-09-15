# Race Control — AI agent handoff

Prepared: 2026-09-15  
Status: planning complete; implementation not started.  
Primary specification: [Race Control implementation and UX plan](../RACE_CONTROL_PLAN.md).

## Copy-paste starting instruction

> Implement Xerom Race Control using `docs/RACE_CONTROL_PLAN.md` and this handoff. First read AGENTS.md and the source-of-truth files listed below. Start with Phase 0 and produce an isolated, reviewable capability spike and typed contract proposal before implementing production mutations. Continue in dependency order. Preserve the current site, official logo, existing live calendars and unrelated changes. Do not invent business data, enable synthetic offers, deploy to production, or create/delete live calendars merely to test the integration. Treat missing owner values as draft configuration gates. Complete the full owner front-desk and business/content editing scope; do not call a static dashboard or settings-only milestone complete. Record tests, unresolved limitations and next steps at every stopping point.

## What the owner approved

- Race Control is the main front desk. Google Calendar remains the reservation system of record.
- Owner-only access initially. Booking changes happen in Race Control.
- Desktop-first; tablet chart and usable mobile fallback.
- Walk-in, create, check-in, countdown, extend, reschedule, complete, no-show, cancel, maintenance and closure workflows.
- Editable resource inventory, prices/add-ons, weekly/exception hours, promotions/packages, advanced booking rules, and structured website text/contact/photos.
- Publish business edits at runtime without rebuilding/redeploying the website; avoid a separate application database where practical.
- Preserve confirmed booking prices. Review conflicting bookings before shortening hours or retiring resources. No automatic cancellation or customer notification.
- Percentage, weekday/weekend offers and multi-hour packages with explicit conflict logic.
- Automatic Google Calendar provisioning and deletion, with explicit confirmation before each calendar creation/deletion.
- Retain current Race Control visual direction.

## Read these before changing code

1. `AGENTS.md` — mandatory project rules.
2. `PRODUCT.md` — confirmed facts and scope update.
3. `CONTENT_TODO.md` — unknown facts; never fabricate them.
4. `WEBSITE_PLAN.md` and `BOOKING_ARCHITECTURE.md` — baseline and linked expansion.
5. `RESEARCH.md` — provenance and current technical references.
6. `DESIGN.md` — implemented brand authority. Derived Impeccable caches may be stale.
7. `docs/RACE_CONTROL_PLAN.md` — detailed domain, APIs, UI hierarchy, errors, migration and acceptance criteria.
8. `docs/agent/ENGINEERING_TODO.md`, `QA_REPORT.md`, `GOOGLE_CALENDAR_SETUP.md`, `BOOKING_OPERATIONS.md`, `CLOUDFLARE_DEPLOYMENT.md` — existing operational context.
9. `docs/mockups/index.html` — visual reference only; preserve it. It was untracked at planning time and is user work.

Do not treat older “custom admin is out of scope” or “compiled config only” text as current scope. The dated owner expansion supersedes those restrictions; other booking/security invariants still apply.

## Recommended architecture to implement and verify

- Astro + TypeScript, respecting the Pages target and existing Worker demo deployment context; no unrelated platform migration.
- Private R2 immutable config revisions + active pointer, draft, minimal audit, and encrypted integration token envelope. Separate media storage. No D1/Postgres/Supabase.
- Existing named venue Durable Object serializes app booking writes, blocking operations and configuration activation; persistent journals/fences handle ambiguous partial work. It is not the permanent booking store.
- Google resource calendars retain reservations and operational metadata. Dedicated venue-owner OAuth identity provisions calendars; existing service-account event access remains narrow.
- Cloudflare Access + backend JWT verification + exact owner allowlist. Separate this login from Google integration consent.
- All public content and booking validation resolve the same runtime revision. Cache immutable revisions/assets only; active config/HTML reads initially no-store. Public payload is an explicit sanitized projection.
- No settings publication runs a build, changes secrets or commits to Git. Initial infrastructure/code setup still needs deployment.

These are engineering recommendations in the plan, not claims about deployed infrastructure. Prove OAuth ownership, permissions, R2 pointer semantics and coordinator recovery in test environments before expanding live behavior.

## Non-negotiable domain rules

1. Stable physical resource IDs; count derives from active registry entries. Never invent calendars or silently sell unverified resources.
2. All busy Calendar events block, including manual/maintenance/control events. Missing calendar data is unknown, never free.
3. Final price/rule/availability validation occurs inside the coordinator. Owner walk-ins bypass customer notice/horizon only, not availability/closures.
4. Every mutation has a durable operation ID and payload hash. Lost-response retries must not duplicate bookings or calendars.
5. No success until every linked event is verified. Partial failure compensates safely or fences affected capacity and requires review.
6. ETags protect edits from overwriting external changes. Direct Google UI writes bypass app serialization; detect conflicts without promising a global Calendar lock.
7. MYT overnight business date, half-open intervals and consistent buffers; current seed 60/120-minute sessions and existing hours remain until owner publishes changes.
8. Promotions: compare base, eligible percentage and exact-duration package per resource; lowest price wins, no stacking. Ties: base, then offer priority, then stable ID. Add-ons excluded initially. Integer-sen arithmetic. Synthetic examples are tests only.
9. Existing confirmed price snapshots remain immutable. Identical-shape reschedules retain price. Extensions price added time only; altered service/quantity/duration requires explicit quote review.
10. Hours review covers relevant future bookings beyond the public horizon, including recurring/manual bookings. Unresolved conflicts block publish. Explicit date exceptions can preserve a reservation.
11. Operational check-in/completion/no-show badges do not automatically release capacity or send messages.
12. Calendar creation and permanent deletion require separate reviewed confirmations. Retire preserves history; nonempty calendar deletion waits for owner retention/export policy. Never delete primary/control calendars.
13. Keep credentials/calendar IDs private. No customer data in analytics, public payloads, mock fixtures or shared caches.

## UI implementation contract

Navigation: Schedule / Bookings / Business Settings (Resources, Hours & Closures, Pricing, Offers & Packages, Advanced Rules) / Website Content / Changes & Activity / Connection.

- Desktop: compact ~64px header, ~200px collapsible nav, wide chart, sticky time axis and resource column. ~360px booking inspector on selection; below 1280px use overlay drawer.
- Hierarchy: toolbar and New booking → compact operational summary → chart → selected booking actions. No oversized marketing headline or equipment photo gallery in Schedule.
- Inspector: customer/status → schedule/countdown → resources → price → context action → secondary actions → notes/history.
- Use DESIGN.md tokens and official SVG unchanged. Page titles 28–32px, section titles 18–20px, data 14–16px, body 16px. Amber for focus, warm-white selection outline, labelled patterned maintenance treatment.
- Tablet: chart with sticky resource labels and touch targets. Phone: Agenda default, single-column forms and full-screen details.
- Forms: persistent drafts, plain labels, field errors, preview, before/after review, blocking booking impacts, publish result with revision/time. Draft switches never imply immediate live changes.
- Owner-only structured website editor; fixed page sections, approved images, shared facts; no arbitrary HTML/JS or freeform page builder.
- Build functional UI states, including empty/loading/stale/offline/partial-failure/auth-expired. Do not equate a mockup's green badge with actual health.

## Ordered work packages

These packages may be assigned to separate agents by the user/coordinating agent. Do not allow simultaneous uncoordinated edits to shared schemas/coordinator files.

| Package | Owner area / suggested files | Depends on | Required output |
| --- | --- | --- | --- |
| RC-00 capability spike | Google test adapter, R2/Access setup notes, coordinator prototype | None | Demonstrated owner-owned calendar create/share/delete, lost-response strategy, selected runtime/deployment binding plan; no live mutation |
| RC-01 contracts | Proposed `src/lib/config/*`, `src/lib/race-control/*` schemas | RC-00 | Config/public projection/quote/action/operation contracts, seed migration and fixtures |
| RC-02 persistence/security | Config repository, `src/lib/security/owner.ts`, admin route guard | RC-01 | R2 revisions/draft/conditional pointer, authenticated preview, auth bypass tests |
| RC-03 coordinator | `coordinator/src/index.ts`, Google adapters, proposed journal/reconciliation modules | RC-01/02 | Typed command dispatcher, dynamic validation, conditional group mutations, recovery fences and race tests |
| RC-04 public runtime | Existing config consumers, availability/bookings, quote API | RC-02/03 | Runtime pages/JSON-LD/booking parity; published update without build; old-price preservation |
| RC-05 dashboard shell | Proposed `src/layouts/RaceControlLayout.astro`, `src/components/race-control/*`, admin pages | RC-01; mocks first | Desktop/tablet/phone hierarchy and accessible stateful components |
| RC-06 settings | Admin config routes + settings/offer/impact-review pages | RC-02/03/05 | Complete draft→review→publish, pricing simulator and hours conflict resolution |
| RC-07 operations | Schedule/read API, booking actions and inspector | RC-03/05 | Full front-desk flows, freshness/reconciliation states |
| RC-08 resources/content | Provisioning/OAuth, media/content routes/UI | RC-00/02/03/05/06 | Confirmed resource lifecycle; upload/preview/runtime content publication |
| RC-09 acceptance/cutover | Tests, migration/runbooks, QA_REPORT | All | Full acceptance matrix and safe rollout/rollback rehearsal |

Contract owner merges RC-01 first. Parallel UI work can use matching labelled fixtures after contracts settle. Never allow fixture implementations into production auth or live confirmation paths.

## Known code pitfalls to fix early

- `src/lib/booking/schema.ts` hard-codes capacities and durations.
- `src/config/service-core.ts` includes fixed resource lists; counts/maps must migrate together.
- `src/lib/google/calendar.ts` missing FreeBusy entries currently appear free; insert 409 currently accepted without verifying existing event identity.
- `coordinator/src/index.ts` uses allocation index as resource ID, has incomplete ambiguous-write recovery and imports compiled prices/rules.
- Current coordinator network work runs inside `blockConcurrencyWhile`; verify execution limits before adding long multi-page scans. Durable jobs/fences must preserve exclusivity during recovery.
- `astro.config.mjs` uses compile-time image processing; runtime uploads need their own safe processing/delivery path.
- Read existing ENGINEERING_TODO; do not assume past smoke-test claims cover newly added branches.

## Verification and reporting

Follow plan section 13. Run lint/check/unit/integration/build/E2E appropriate to each package and the full suite before release. `lint` currently aliases Astro check; identify it honestly.

Critical scenarios: final-resource race; extension versus booking; config publish versus booking; group partial edit; crash after Google write; no duplicate calendar after lost create response; missing calendar fail-closed; outside-hours review beyond three days; competing offers; auth bypass; no secret leakage; runtime publication with unchanged deployment ID.

Visual QA widths: 375, 390, 430, 768, 1024, 1440+. Inspect keyboard/focus, accessible agenda, reduced motion, console/network failures, 404s and overflow. Update DESIGN.md only from verified implemented UI. Record screenshots and exact environment in QA_REPORT.md, never fabricated passes.

Each package handoff must include: files changed; behavior implemented; commands/results; mock versus real integration coverage; unresolved blockers; next package. Update DECISIONS.md for material changes. Keep customer/calendar secrets out of handoffs.

## Inputs agents must not invent

Owner login/Google identity and consent; actual offer amounts/days/dates; controller count/billing basis; retention before nonempty calendar deletion; final public booking-horizon wording; existing venue/privacy/holiday/media/Turnstile launch items in CONTENT_TODO.

Build valid draft forms and isolated synthetic tests without those inputs. Ask only when the missing input blocks the next real integration/publication step. Never ask the owner to reconfirm scope already listed here.
