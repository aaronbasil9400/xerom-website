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
