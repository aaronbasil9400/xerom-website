# Content and Owner TODO

Only owner-supplied inputs that cannot be safely chosen from the existing business profile remain here. The owner asked to keep the current site photos while replacement photos are pending. Engineering work is tracked separately in `docs/agent/ENGINEERING_TODO.md`.

## Remaining owner inputs

- [ ] Provide the canonical domain and preferred hostname for production cutover. Until then, keep `https://xerom-website.xerombookings.workers.dev`, `noindex`, and the hostname-scoped Turnstile widget.
- [ ] Provide final owner-approved social-group hero and social-share/OG photography with usage rights. Keep the current clearly labelled hero placeholder and OG image until supplied.
- [ ] Provide replacement owner-approved photos for the homepage Choose Your Setup slideshow. Keep the existing Pro Rig, Regular Rig, and PS5 Lounge photos as replaceable interim slides.

## Closed business configuration

- [x] Address and directions: adopt the existing business profile in `src/config/business.ts` — 30-1, 3/KS06, Jalan Batu Nilam, Bandar Bukit Tinggi 1, 41200 Klang, Selangor, Malaysia; `https://maps.app.goo.gl/aPavdDoFPr1ywc9W8`. Accepted under the owner's 2026-09-24 close-out direction; not independently reverified.
- [x] Public phone and WhatsApp: `012-940 1440` / `+60129401440`, owner-confirmed 2026-09-24.
- [x] Weekly opening hours: Monday–Thursday 2:00 PM–1:00 AM; Friday–Sunday 12:00 PM–1:00 AM, owner-confirmed 2026-09-12.
- [x] Public-holiday, short-hour, and closure handling: weekly hours apply unless a date-specific exception is configured in Race Control; announce changes on Instagram `@xerom.my` until the website announcement feature is built.
- [x] Booking window: rolling 72 hours (4,320 minutes), owner-confirmed 2026-09-24. Public bookings retain 60-minute minimum notice; owner bookings may start at any future minute.
- [x] Public durations and slots: 30/60/90/120-minute sessions on 30-minute start intervals.
- [x] Prices: Regular RM20/hour; Pro RM30/hour; PS5 RM18/lounge-hour with two included controllers; extra controllers RM3 each once per booking, maximum six.
- [x] Discounts and compare-at prices: none active or displayed. The advertised follow-and-tag discount and previous prices RM22/RM35/RM20 are not used.
- [x] Cancellation and late arrival: request changes/cancellations on WhatsApp with the booking ID as early as possible; staff confirmation completes the change. Race Control disables no-show until the 15-minute grace ends and the coordinator enforces the same boundary. Booked end time stays fixed; extensions depend on availability and staff confirmation. No fee/refund claims are made.
- [x] Privacy contact and notice: WhatsApp/phone at `012-940 1440`; public notes are not collected, email remains optional, and the notice describes private Calendar storage, Cloudflare security, and the current absence of email confirmations.
- [x] Staff titles and reminders: event titles use `{bookingId} | {SERVICE} | {customerName} | {duration}m`; the system sends no customer reminders and uses no special Calendar color convention.
- [x] Resource/history policy: retain historical Calendar records; permanent deletion remains blocked for non-empty calendars.
- [x] Operation journal retention: completed operation records may be retained for 30 days; unresolved recovery records and fences remain until reconciled. Enforcement is tracked as engineering work.
- [x] Equipment: keep the existing general Regular/Pro descriptions. Omit part/model-level hardware claims until current equipment is confirmed.
- [x] Cafe, games, accessibility, parking/transit, gallery and testimonials: publish no unverified menu, game, amenity, social-photo or review claims. Add them only when sourced material is supplied.
- [x] Membership: the program and registration are not set up. Per owner direction on 2026-09-25, the white header button says “BECOME A MEMBER!” and links to `/membership`, a placeholder that clearly states registration and purchase are unavailable. Keep the red booking button labeled “BOOK A SESSION” and routed to `/book`; do not invent membership terms.

## Connected business systems

- [x] Seven private client-owned Google Calendars (three Regular Sim, one Pro Sim, two PS5 Lounge, one Booking Control) use `Asia/Kuala_Lumpur` and are shared with the client-owned booking service account.
- [x] Calendar IDs and service-account credentials are stored only in encrypted Worker configuration.
- [x] Real managed Turnstile is restricted to the current Workers hostname. Add the future hostname to the widget and update the build/secret configuration during domain cutover.
- [x] Cloudflare R2 is enabled for private versioned Race Control configuration and media. `r2.dev` and custom bucket domains remain disabled.
- [x] Five Cloudflare Rate Limiting bindings are configured for public booking/availability and owner mutations.

Engineering and email-delivery follow-ups remain separate; see `docs/agent/ENGINEERING_TODO.md`.
