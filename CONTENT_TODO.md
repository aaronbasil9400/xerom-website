# Content and Owner TODO

Only unresolved or replaceable items belong here. Remove an item only after its replacement is verified and its source is recorded in `RESEARCH.md` or configuration. Engineering and security follow-ups from the 2026-09-12 test are tracked in `docs/agent/ENGINEERING_TODO.md`.

## Blocking production launch

- [ ] Confirm the full official address and exact Google Maps place/directions URL.
- [x] Owner-confirmed opening hours (2026-09-12): Monday–Thursday 2:00 PM–1:00 AM, Friday–Sunday 12:00 PM–1:00 AM. Resolves the earlier pricing-image/Instagram conflict in favour of the Instagram weekday schedule.
- [x] Publish the confirmed hours from centralized config (`src/config/booking.ts` via `src/config/hours.ts`) on the homepage and the Visit page.
- [ ] Define public-holiday and shortened-hour handling, and how closures are announced.
- [ ] Confirm whether the advertised 5% Instagram follow-and-tag discount is currently active, how staff verify it, whether it applies during booking or at the venue, which services/add-ons it covers, and whether it can combine with sales.
- [ ] Confirm the displayed previous/compare-at prices (Regular RM22, Pro RM35, PS5 RM20) are currently valid and may be shown as struck-through anchors on `/pricing`; otherwise remove them.
- [x] Owner-confirmed in the 2026-09-22 upgrade brief: each PS5 booking includes 2 controllers and may add 0–6 additional controllers at RM3 each.
- [ ] Confirm whether `012-940 1440` is both the public call and WhatsApp number, and provide the preferred international display/link format.
- [x] Official logo supplied and converted to a transparent two-color SVG; original retained at `src/assets/brand/xerom-logo-source.png`.
- [x] Supply owner-approved Regular Rig, Pro Rig, PS5 Lounge, and cafe photography.
- [ ] Supply the final owner-approved social-group hero/venue photograph with usage rights.
- [ ] Supply an owner-approved social share/OG image to replace `public/og-placeholder.jpg`, which is currently used as `og:image` on every page.
- [ ] Confirm the cancellation/no-show/late-arrival wording customers should see.
- [ ] Confirm the precise three-day horizon rule: rolling 72 hours or through the third local calendar day.
- [ ] Confirm the current domain and preferred canonical hostname.
- [ ] Provide a privacy contact and approve the short booking/privacy notice.

## Required before booking integration

- [x] Create and share the 3 Regular Sim, 1 Pro Sim, 2 PS5 Lounge, and Booking Control calendars (created in client-owned project/account on 2026-09-24; all seven are private, `Asia/Kuala_Lumpur`, and shared with the coordinator at Make changes and see all event details).
- [x] Provide server-side calendar IDs through encrypted Worker secrets; never paste them into documentation or client code.
- [x] Create the dedicated Google service account and agree on its calendar permissions (client-owned Xerom Booking project and coordinator identity created on 2026-09-24; event-writer access verified).
- [ ] **Add the final domain to Turnstile before domain cutover.** The always-pass demo pair has been replaced by a real managed widget scoped to `xerom-website.xerombookings.workers.dev`; deployed booking submissions pass real Siteverify. When the owner supplies the canonical hostname, add it to the widget and update the `PUBLIC_TURNSTILE_SITE_KEY` build variable and encrypted `TURNSTILE_SECRET_KEY` if the widget is replaced. The original unused widget whose secret appeared in Wrangler output was deleted.
- [ ] Confirm whether optional customer notes should be collected.
- [ ] Confirm event reminder behavior and whether staff want a Calendar event color convention.
- [ ] Confirm the staff-readable booking-title format.

## Content enrichment

- [ ] Confirm the exact Regular and Pro equipment wording from the current pricing image.
- [ ] Provide verified PS5 game titles only if the site should list them.
- [ ] Provide verified sim titles only if the site should list them.
- [ ] Provide cafe menu/highlights and current prices, or approve cafe as atmosphere-only copy with no menu claims.
- [ ] Provide accessibility/parking/transit/landmark information for the Visit page.
- [ ] Select owner-approved Instagram posts or original photos for gallery use.
- [ ] Provide real testimonials only if permission and wording can be verified.

## Temporary asset policy

Mockups and early builds may use clearly labeled placeholders. Placeholder filenames, alt text, and component boundaries must make replacement easy. Do not publish scraped Instagram images or the supplied pricing screenshot as final production assets.

## Race Control owner/setup inputs — 2026-09-15

Scope answers are recorded in PRODUCT.md; do not ask them again. The implementation plan can proceed with draft fields and isolated synthetic fixtures while these remain unresolved.

- [ ] Supply/authorize owner login identity, venue Google account/account type and owner OAuth connection for automated calendar lifecycle. Keep credentials out of documents.
- [ ] Enter actual percentage offer amounts, selected weekday/weekend days, active dates/windows, package durations/prices and eligible services. Support is approved; real offers are not yet supplied.
- [ ] Confirm resource-calendar history retention/export policy before allowing permanent deletion of a calendar containing historical events. Empty retired test calendars can exercise the confirmed deletion flow.
- [ ] Confirm proposed completed operation-journal retention (30 days); unresolved recovery data must remain until reconciled.
- [x] Owner-confirmed 2026-09-22: the RM3 additional-controller charge applies once per controller per booking, not per hour.

## Explicitly deferred engineering

- [ ] TODO: Implement booking confirmation email backend. The current upgrade captures, validates and stores optional email only; no email provider or delivery path is approved.
- [x] R2 enabled on 2026-09-22. Private APAC buckets `xerom-race-control-config` and `xerom-race-control-media` are bound to the deployed Worker. `r2.dev` is disabled, no custom domains exist, and no browser CORS is configured.
- [x] Configure five Cloudflare Rate Limiting bindings on the client Worker using the documented route limits and unique account namespace IDs.

Holiday editing and conflict review are approved features; actual holiday dates/hours still require owner input. Current confirmed booking durations are 30/60/90/120 minutes.
