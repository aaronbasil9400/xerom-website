# Decision Log

## 2026-09-24 — Client Cloudflare staging protection and rate limits

- The transferred repository deploys in the client's Cloudflare account at `xerom-website.xerombookings.workers.dev` while the canonical domain remains undecided. Staging builds use that hostname for canonical metadata and `noindex`/`Disallow` so the temporary URL is not indexed.
- Cloudflare Access protects only `/race-control/*` and `/api/admin/*`; its allow policy is scoped to the verified client owner identity. The public marketing and booking surfaces remain reachable for verification.
- The website Worker uses a separate managed Turnstile widget restricted to the temporary hostname. The first unused widget was deleted after its secret appeared in CLI output; only the replacement secret is stored as an encrypted Worker secret.
- Five Cloudflare Rate Limiting bindings are enabled in the Worker config with unique account namespace IDs and the documented per-route limits. The Durable Object remains responsible for booking serialization and final Calendar revalidation.
- Google Calendar remains the business record. Seven private calendars are owned by the client's Google account, shared with the client-owned service account using “Make changes and see all event details,” and validated in Kuala Lumpur time.

## 2026-09-23 — Compact homepage hours summary

- The hours card beside Pick Your Pace shows only today's Malaysia-local opening window and links to the complete weekly schedule on `/visit#hours`. This keeps the card short at phone and desktop widths even when the owner gives each weekday a different schedule.
- Derive today's window from the active runtime configuration, with a matching date exception taking precedence over weekly hours. The card makes no live open/closed claim; overnight close times belong to the following day.
- Keep the full weekly rows in the homepage visit section and Visit page. Neither booking rules nor owner settings publication changes as part of this presentation update.

## 2026-09-23 — Owner-confirmed private calendar provisioning

- Increasing a resource quantity can no longer be published by hand: the readiness gate requires every non-retired resource to carry an active private Calendar. Race Control now provisions that Calendar itself instead of asking the owner to paste a Calendar ID.
- `POST /api/admin/resources/provision` creates one private secondary calendar per resource, owned by the existing booking service account, gated behind owner auth, CSRF, bounded input, an explicit confirmation prompt, and the draft's expected ETag.
- Calendar creation is not transactional. Each calendar carries a stable `xerom-resource:<resourceId>` marker in its description so a lost or failed response is reconciled by listing the booking identity's calendars rather than retried blindly. Multiple marker matches fail closed for review.
- The booking identity verifies read/write with a private probe event that is removed immediately, and provisioning writes `calendarRef` server-side only. Calendar identifiers never reach the browser.
- If `VENUE_GOOGLE_ACCOUNT_EMAIL` is set, the venue's own Google account is granted owner access so staff can manage the calendar in Google. Absent that secret, provisioning still succeeds and the owner shares the calendar manually.
- Provisioning only links the draft. Publication still requires save, review, and a reviewed activation. Ownership remains service-account-based for now; venue-owner OAuth provisioning is a later upgrade.
- Client-supplied Google event IDs must satisfy Google's base32hex rule (lowercase `a-v`, digits `0-9`). Deterministic application IDs are derived as hex digests; the write-verification probe follows the same rule.

## 2026-09-23 — Bound configuration review inventory

- The review inventory now lists only events that end after the review instant (`singleEvents=true`, `timeMin=now`, no `timeMax`) instead of walking each calendar's entire history. Unbounded listings risked Worker CPU/memory exhaustion and Google quota errors, which surfaced as intermittent 503s and blocked publication.
- Recurring series are expanded into concrete instances for conflict checks. Any series without `UNTIL`/`COUNT` is fetched by its master ID and returned explicitly so open-ended schedules still fail closed.
- Review and publish failures now log a structured, identifier-free cause and return a safe reason to the owner. Calendar IDs, event contents, and customer data are never logged or returned.

## 2026-09-23 — Production deployment order and shared review secret

- Deploy the coordinator before the website, because the website emits the updated `activate-config` command (`draftEtag`) and the booking `configRevision` contract that the coordinator must already accept.
- Keep one shared `RACE_CONTROL_TOKEN_ENCRYPTION_KEY` value on both Workers so the website can sign review tokens and the coordinator can verify them inside serialization. When rotating, set both sides together and treat the interval between updates as a publication freeze.
- Do not manually seed `active.json` during deployment. An empty config bucket keeps the compiled bootstrap live; publication stays an explicit authenticated owner action.

## 2026-09-23 — Serialized configuration publication and rollback

- Bind each publication attempt to the saved draft ETag, normalized draft hash, active base revision and a five-minute signed review token. Derive a stable operation ID from that reviewed attempt, not from configuration content alone, so a lost response replays while a later publication of identical content remains a new revision.
- Persist publication intent in the venue coordinator before writing the immutable R2 revision. Recheck the complete Calendar impact inside coordinator serialization, then conditionally replace and verify `active.json`. A pointer race fails closed; an already-activated intended revision is recovered without another revision or pointer write.
- Treat an empty/unbound config bucket as the pre-cutover compiled bootstrap. Once `active.json` exists, a missing referenced revision is an outage and must fail closed rather than silently restoring compiled business rules.
- Rollback prepares a new private draft from the previous revision. Preserve the current private resource registry, retire resources introduced later, and leave missing historical mappings in draft state so normal review blocks unsafe resurrection. Rollback never rewinds `active.json` directly.
- Public booking pages carry the configuration revision they displayed. Availability and final serialized booking creation reject a changed revision, preventing a publication from silently changing prices, capacities or rules underneath an open checkout.

## 2026-09-22 — Configuration review scans fail closed

- Scan all server-known resource calendars plus Booking Control when hours, resources, allowed durations, or booking buffers change.
- Paginate complete Calendar inventories. Expand finite recurring series through Calendar instances; require explicit resolution for open-ended series and unrecognized manual blocks.
- Skip Calendar reads for pricing/content-only changes because existing bookings retain locked prices and those edits cannot invalidate availability.
- Issue short-lived review tokens only after a complete conflict-free scan. Keep publication unavailable until token verification and R2 activation run inside booking-coordinator serialization.

## 2026-09-22 — Private R2 activation approved

- Use separate private `xerom-race-control-config` and `xerom-race-control-media` buckets, both accessed only through Worker bindings.
- Do not enable `r2.dev`, a public custom domain, or browser CORS. Public media remains constrained by the active-config asset allowlist.
- Keep compiled public configuration as the fallback while R2 is empty or unavailable. R2 activation alone does not enable settings publication; impact review and conditional activation remain required.
- R2 was activated the same day. Both APAC buckets and Worker bindings are live; initial reversible storage probes were removed, leaving both buckets empty.

## 2026-09-22 — Compact availability and synchronized booking contract

- Render time selection as four columns on wide desktop, three on tablet, and one on phones while retaining all selected resource signals on one horizontal line inside each slot.
- Invalidate a chosen time whenever date, duration, or resource quantities change so stale Calendar availability cannot be submitted.
- Keep public and coordinator command schemas synchronized for 30/60/90/120-minute sessions, optional email, and PS5 additional-controller metadata.
- Deploy coordinator contract changes before the website that emits them. Google Calendar remains authoritative and the Durable Object remains final allocation authority.

## 2026-09-09 — Product and booking baseline

- Use Astro + TypeScript on Cloudflare Pages.
- Keep Google Calendar as the persistent booking record; use no conventional application database.
- Model resources as 3 Regular Sim calendars, 1 Pro Sim calendar, and 2 PS5 lounge calendars.
- Allow customers to choose tiers and create mixed Regular + Pro group bookings.
- Offer 60- or 120-minute bookings; sessions are one-hour units and may be back-to-back.
- Use instant confirmation, no deposit, one-hour minimum notice, and a three-day booking horizon.
- Support multi-resource booking.
- Serve the MVP in English to a primarily local casual-group audience.
- Use a comp-first visual workflow; Playwright QA follows implementation.
- Keep black, red, and white dominant. Lead the marketing story with social group experience, followed by racing hardware, pricing/value, and booking. Avoid corporate minimalism and use the public Instagram as a primary design reference.
- Treat mobile as a separately composed first-class surface, not a desktop afterthought.

## 2026-09-09 — Concurrency deployment shape

Use a single booking-coordinator Durable Object for final booking serialization and short-lived idempotency state. Google Calendar remains authoritative. Because Cloudflare Pages cannot deploy a Durable Object class inside the Pages project, deploy the coordinator as a small separate Cloudflare Worker and bind it to Pages.

## Open decisions

- Exact interpretation of the three-day horizon.
- Promotion rules and controller maximum.
- Final photo/logo asset set.
- Remaining owner content in `CONTENT_TODO.md`.

## 2026-09-11 — Official logo integration

- Replaced the temporary CSS wordmark with `src/assets/brand/xerom-logo.svg` in the shared header and footer.
- The SVG is a deterministic red/white path trace of the owner-supplied official raster, not a generative recreation.
- The original PNG remains at `src/assets/brand/xerom-logo-source.png`; QA render is stored under `.impeccable/review/`.

## 2026-09-12 — Production service imagery and site icon

- Replaced AI placeholders for Regular Rig, Pro Rig, PS5 Lounge, and Cafe with owner-supplied photography.
- Each source uses a focal 4:3 crop and proportional 480×360, 800×600, and 1200×900 derivatives; no image is stretched.
- The social-group hero remains the only AI placeholder.
- The favicon and application icons reuse the official wordmark’s exact X path geometry without redrawing it.

## 2026-09-09 — Approved homepage direction

- Direction: Race Control Broadcast.
- Approved composition: `.impeccable/mocks/home/race-play-refuel.png`.
- Remove the leaderboard pattern from the original direction concept.
- Replace it with a numbered `01 Race / 02 Play / 03 Refuel` visual itinerary connected by track-like linework.
- Keep a large social-group hero as the dominant first impression.
- Include independent, replaceable media modules for Regular Rig, Pro Rig, PS5 Lounge, and Cafe.
- Keep Cafe secondary to racing but unmistakably present through the Refuel step and a dedicated proof module.
- Treat the 390px mobile composition as a first-class reference, not a stacked desktop fallback.
- Generated people, venue, food, and equipment imagery is placeholder material only. Generated slogans and menu language are not approved business facts.

## 2026-09-12 — Confirmed opening hours and homepage hours module

- Owner confirmed Monday–Thursday 2:00 PM–1:00 AM and Friday–Sunday 12:00 PM–1:00 AM, resolving the pricing-image/Instagram conflict in favour of the Instagram weekday schedule.
- `bookingRules.weeklyHours` remains the single source of truth for availability; `src/config/hours.ts` derives grouped display hours from it so published hours and bookable slots cannot drift.
- Opening hours surface once as a compact strip inside the hero, visible without scrolling at every breakpoint, and again as a row list on the Visit page. An earlier standalone homepage hours panel was removed as redundant.
- Public-holiday and shortened-hour handling remain open in `CONTENT_TODO.md`.

## 2026-09-13 — Live integration resources

- Created a dedicated Google Cloud project and Calendar API integration for the booking coordinator.
- Created seven private calendars (three Regular Sim, one Pro Sim, two PS5 Lounge, and Booking Control) in `Asia/Kuala_Lumpur` and shared each with a dedicated service account using `Make changes and see all event details`, the minimum role that can create/delete the private booking events used by this integration.
- Created and deployed `xerom-booking-coordinator` as a separate Cloudflare Worker with the `BookingCoordinator` SQLite Durable Object. The website Worker remains the public surface and binds to that external Durable Object.
- Keep the public Worker in `BOOKING_MODE=disabled` until encrypted Google credentials, calendar IDs, and a hostname-appropriate Turnstile widget are configured and the deployed smoke/race checks pass.
- For the client demo, the public Worker is temporarily in `BOOKING_MODE=live` with Cloudflare's documented always-pass Turnstile test pair; a real hostname-scoped widget must replace it before public launch.

## 2026-09-15 — Cinematic homepage composition

- Implement the approved social-first reference as a cinematic full-width hero followed by session proof, a Race / Play / Refuel experience dock, social gallery, practical visit information, and a final booking action.
- Lock the semantic and visible hero headline to exactly `Race Together`; keep Klang as separate location information.
- Preserve independent mobile ordering instead of compressing the desktop overlap composition.
- Keep the existing AI social-group image as an explicit, replaceable placeholder and use owner-supplied photographs for Regular Rig, Pro Rig, PS5 Lounge, and Cafe proof.
- Serve the hero through deterministic responsive AVIF/WebP derivatives and inline built CSS; preserve one eager image while all supporting images remain lazy.
- Do not alter booking routes, configuration, coordinator behavior, request contracts, or Calendar semantics as part of the homepage change.

## 2026-09-15 — Restore Choose Your Setup homepage section

- Per owner direction, replace only the redundant More Than Racing gallery with the previous Choose Your Setup split section.
- Retain the Pro Rig image, confirmed Regular/Pro/PS5 resource facts, and Compare Experiences link to `/experiences`.
- Leave the cinematic hero, Pick Your Pace cards, Race / Play / Refuel dock, visit information, final CTA, and booking behavior unchanged.

## 2026-09-15 — Hide duplicate experience dock on phones

- Per owner direction, hide the Race / Play / Refuel dock at 560px and below because Pick Your Pace already presents the service choices.
- Retain the dock from tablet widths upward and preserve all underlying service destinations and booking behavior.

## 2026-09-15 — Explicit booking modes and current Worker demo

- Treat only `live`, `mock`, and `disabled` as valid runtime booking modes; unknown values fail closed to `disabled` so a configuration typo cannot return a fake confirmation.
- Set the production Worker configuration to `BOOKING_MODE=live` so successful public bookings must pass Turnstile and the serialized Google Calendar coordinator.
- Use the existing `xerom-website` Worker for the requested controlled client demo, with the previously configured Google Calendar and coordinator bindings. Any demo booking is a real operational Calendar event and must be cleaned up after validation.
- Keep branch previews disabled or on separately provisioned test calendars; do not point unattended previews at the live resource calendars.

## 2026-09-15 — Malaysian mobile validation

- Validate Malaysian mobile numbers as local `01X` numbers, including the 11-digit `011` and `015` exceptions, plus common `+60`/`0060` international input.
- Normalize accepted phone values to E.164 `+60...` before placing them in Calendar event descriptions so staff have one searchable format.
- Treat format validation as syntax validation only; it cannot prove that a number is active or registered for WhatsApp.

## 2026-09-15 — Design reference authority

- Use `DESIGN.md` as the sole authoritative source for current visual design references.
- Treat `.impeccable/design.json` and other generated Impeccable sidecars as derived artifacts only; they must not override `DESIGN.md` when stale or inconsistent.

## 2026-09-15 — Race Control owner scope and implementation proposal

- Owner approved owner-only Race Control as the main desktop front desk, tablet schedule support, full booking lifecycle actions, business/content editing and runtime publication with no rebuild.
- Google Calendar remains the booking record. Calendar creation/deletion must be automatically executed only after explicit owner confirmation. Confirmed booking prices survive settings edits; proposed hours must review outside-hours existing bookings.
- The plan recommends private R2 versioned config/media plus existing DO serialization/recovery metadata instead of a separate database; prove capability/ownership/security in an isolated spike before infrastructure changes.
- Proposed pricing default: lowest eligible per-resource price among base, percentage and exact-duration packages; no stacking, deterministic ties, additions separate. Actual offers stay draft until entered.
- Proposed resource lifecycle: retire preserves history; permanent deletion is separate and initially limited to empty retired calendars pending retention policy.
- Build specification: `docs/RACE_CONTROL_PLAN.md`; entry handoff: `docs/agent/RACE_CONTROL_HANDOFF.md`. This change is documentation only; proposed UI, APIs and storage are not implemented or tested integrations.

## 2026-09-16 — Race Control capability and contract baseline

- Preserve the existing live deployment and seven calendars. RC-00 is a local, side-effect-free spike; it does not bind R2, perform OAuth, mutate Google, or deploy.
- Use immutable private config revisions plus a conditionally written `active.json` pointer. A stale draft or pointer write returns a conflict; public config is constructed through an explicit allowlist.
- Keep Cloudflare Access owner identity separate from venue-owner Google OAuth. Origin verification requires the Access assertion signature/issuer/audience and exact email allowlist; missing configuration fails closed. Local fixture identity is permitted only on `localhost`/`127.0.0.1` in Astro development mode.
- Calendar-create recovery uses a durable operation/resource marker and owner-calendar listing. Exactly one owned secondary-calendar match may be reconciled; ambiguity remains fenced for review. Primary calendars are never candidates.

## 2026-09-16 — Manual owner booking time policy

- Apply the owner's requested timing change to Race Control/manual bookings: no one-hour notice floor, any future minute within opening hours, and 30/60/120-minute durations.
- Keep the public customer flow unchanged at 60/120 minutes, one-hour notice and hourly availability until the owner explicitly requests a customer-facing policy update; this avoids silently changing the published product contract.
- Keep the three-day horizon, future-start guard, Calendar busy/control checks, and serialized coordinator path unchanged.
- Use integer sen and the planned lowest-eligible-price algorithm. Synthetic offers exist only in tests; seed configuration contains no active promotion. Controller add-ons remain gated until the owner confirms capacity and billing unit.
- Missing FreeBusy calendar entries now fail closed. A Google event insert `409` counts as an idempotent replay only after the existing deterministic event matches the interval and private operation properties.
- The first dashboard surface is an authenticated, `noindex` Operate shell with explicit demo fixtures. It is not evidence that booking mutations, settings publication, or Google connection are complete.
## 2026-09-19 — Fence and compensate grouped Calendar mutations

- Replace request-wide `blockConcurrencyWhile` network locks with a per-instance mutation queue. Persist safety state before external Calendar writes so an isolate restart cannot silently reopen capacity.
- For grouped owner actions, patch events conditionally with ETags and compensate already-applied patches in reverse order if a later patch fails.
- Persist per-resource recovery fences before grouped writes. Clear them only after complete success or verified compensation; retain them when compensation is uncertain.
- Make both public availability and final coordinator allocation consult active fences. This deliberately prefers temporary unavailability over exposing capacity that may be partially modified.
- Treat all-day Google Calendar events as Malaysia-local blocking intervals and apply the same opening-hours, horizon, venue-control, lifecycle-state, and conflict checks to owner reschedules/extensions.
- Keep edge rate limiting as a high-priority, explicitly deferred post-demo launch task per owner instruction; the deferral does not satisfy the public-launch gate.
- Enable website Worker logs at full sampling and traces at 10%, matching the coordinator, so the production cutover has searchable failure evidence without logging booking payloads or personal data.

## 2026-09-22 — Website upgrade contract

- Adopt the supplied Feature Upgrade & Implementation Brief as the new product requirement for public 30/60/90/120-minute sessions, 30-minute slots, optional booking email, and online PS5 controller selection.
- Charge RM3 once per additional controller per booking. A PS5 booking includes two controllers and permits up to six additional controllers.
- Keep Google Calendar as the booking system of record. Do not introduce a conventional database; continue with private R2 revisions for runtime business configuration/media and Durable Object state for serialization/recovery.
- Implement the R2 integration in code but do not activate R2, accept billing terms, or change the Cloudflare account without a separate owner approval.
- Preserve the hard availability-UI approval gate: produce desktop and mobile mockups, then stop before implementing the production indicator component.

## 2026-09-22 — Calendar booking projection and CSV shape

- Continue treating grouped Google Calendar events as the booking record. Race Control derives one normalized record from private metadata with description fallbacks for legacy events; no customer directory or booking database is introduced.
- Export one CSV row per booking/service line so mixed-service reservations remain analytically usable. Customer/booking fields repeat per line, while quantity, controller and Calendar event ID values stay attributable to the service.
- Store new booking customer/contact and total-price metadata in private Calendar extended properties as well as the human-readable description. Do not send these fields to analytics or logs.

## 2026-09-22 — Private draft/media security boundary

- Never return resource Calendar references from the owner draft API. The browser receives a redacted projection; managed references are restored server-side by resource ID before schema validation and conditional R2 writes.
- Preserve the existing homepage hero contract: exact 16:9 composition, 1600×900 upload master minimum/recommendation, JPEG/PNG/WebP, and 8 MB maximum. Uploaded objects remain private R2 data and are served through an allowlisted immutable media route only after publication references the asset.
- R2 remains an explicit owner gate. Code may show an unsaved seed and validation UI, but must not claim persistence or publication without configured bindings and a completed impact scan.

## 2026-09-22 — Edge rate limiting

- Use Cloudflare Workers Rate Limiting bindings as permissive abuse protection, not as concurrency control. Public anonymous limits use generous route-plus-IP keys; owner actions use the authenticated Access actor ID.
- Keep bindings optional for local development and document the production namespace setup separately. The Durable Object serialized reread remains the only final-resource allocation authority.

## 2026-09-24 — Client-owned Workers Builds

- Connect Cloudflare Workers Builds to the transferred `xerombookings-dev/xerom-website` repository with GitHub App access limited to that repository.
- Deploy pushes to `main` with `npm run build:staging` and `npx wrangler deploy`; keep the temporary Workers hostname, real hostname-scoped Turnstile widget, and `noindex` behavior until the owner supplies the canonical domain.
- Disable branch and pull-request preview builds while the Worker uses the seven production-named reservation calendars. Revisit previews only after they use disabled bookings or dedicated test calendars.

## 2026-09-24 — Protect the Race Control entry route

- Include the exact `/race-control` redirect entry in the existing owner-only Cloudflare Access application alongside `/race-control/*` and `/api/admin/*`.
- The site middleware rejects owner routes without a verified Access identity; protecting the exact entry path sends an unauthenticated owner to Access before the redirect to the live schedule.

## 2026-09-24 — Owner business configuration close-out

- Set customer bookings to a rolling 72-hour horizon, with one-hour minimum notice and 30/60/90/120-minute durations on 30-minute starts. Manual Race Control bookings may start at any future minute within the same horizon.
- Keep only the published base prices; do not activate discounts or display compare-at amounts. Preserve the existing private Calendar inventory and use explicit date exceptions for holiday/short-hour changes.
- Announce closures and other updates through `@xerom.my` until a site announcement feature is implemented. Add booking-policy and privacy pages; use WhatsApp/phone for policy requests.
- Do not collect free-text notes in public booking. Email remains optional; the website sends no email confirmation.
- Use a 15-minute no-contact late grace period with no automatic extension; retain the session's original end. Race Control now gates the action in the UI and coordinator. Do not publish fees, refunds or deposits.
- Preserve the current hero and share-image placeholders while final owner photos are pending. The canonical domain and those photos remain owner launch inputs.
- Publish the connection and Race Control notices as live/accurate status. The activity-history page explicitly reports its remaining engineering limitation rather than showing fixture events.

## 2026-09-25 — Membership CTA placeholder

- Per owner direction, label the white desktop header button and matching mobile menu item “BECOME A MEMBER!” and link both to `/membership`. The route is a clear placeholder because the membership program and registration are not set up; do not invent membership terms or imply purchase/registration is available.
- Keep the red booking button labeled “BOOK A SESSION” and routed to `/book`.

## 2026-09-25 — Choose Your Setup temporary photo slideshow

- Use the existing owner-supplied Pro Rig, Regular Rig, and PS5 Lounge photos as temporary slides in one fixed 4:3 frame. Replace the slide sources when the owner supplies the next photo set.
- Advance every 3.5 seconds with a short opacity crossfade. Preload and decode the slide images before autoplay starts and keep the frame dimensions fixed. Provide touch swipe and left/right arrow-key navigation without visible slideshow controls.
- Pause rotation when the frame is offscreen, the document is hidden, a mouse hovers over the frame, or keyboard focus enters it; resume when those conditions end. Reduced-motion preference disables autoplay by default and removes the crossfade.

## 2026-09-25 — Slightly taller setup slideshow frame

- Per owner direction, change the fixed image frame from 4:3 to 5:4. This adds about 19px of height at a 390px viewport while preserving a consistent crop across desktop and mobile.

## 2026-09-25 — Taller Choose Your Setup image frame

- Per owner direction, change the slideshow frame from 4:3 to 5:4 to make the images slightly taller while preserving a fixed ratio across desktop and mobile widths.
