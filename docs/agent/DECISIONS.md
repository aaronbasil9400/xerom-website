# Decision Log

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
