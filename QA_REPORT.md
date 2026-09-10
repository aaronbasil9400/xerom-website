# QA Report

Last updated: 2026-09-10

## Current result

The local mock-mode website builds successfully and the implemented responsive/booking test suite passes. Live Google Calendar, Turnstile, Durable Object, and production deployment acceptance tests remain blocked on external credentials and owner setup.

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| Astro/TypeScript diagnostics | Pass | `npm run check`: 0 errors, 0 warnings; two Zod deprecation hints |
| Booking unit tests | Pass | `npm test`: 12 tests across time, overlap, capacity, closure, pricing, and validation |
| Responsive/booking E2E | Pass | `npm run test:e2e`: homepage and complete mock booking flow at 375, 390, 430, 768, 1024, and 1440 widths |
| Visual captures | Pass | Six full-page captures under `.impeccable/review/` with reduced motion and lazy media loaded |
| Mobile overflow | Pass | Automated document-width assertion at 375, 390, and 430 pixels |
| Production build | Pass | `npm run build`, Cloudflare server output in `dist/` |
| Coordinator Worker dry run | Pass | `npx wrangler deploy --dry-run --config coordinator/wrangler.jsonc`; Durable Object bundle compiled |
| Direction contract retention | Pass | Seed `5323fcd4` present in built server output |
| Impeccable detector | Pass | `detect.mjs --json src` returned `[]` |
| Production dependency audit | Pass | `npm install` after the `sharp` override reported 0 vulnerabilities |

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

- Real Google service-account authentication and Calendar permissions.
- Real FreeBusy results and Calendar event insertion.
- Real partial multi-resource failure and rollback.
- Real final-resource concurrency race through the deployed Durable Object.
- Turnstile validation, token expiry, and production hostname rules.
- Cloudflare Pages/Worker production bindings and custom domain.
- Production analytics provider integration.
- Lighthouse scores on the deployed origin.
- Live contact, Maps, and canonical-domain accuracy after owner confirmation.

These items must not be marked passed until the required accounts, calendars, secrets, and confirmed business content are available.
