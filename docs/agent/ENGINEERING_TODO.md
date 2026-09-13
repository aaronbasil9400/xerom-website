# Engineering and Security TODO

Tracked from the 2026-09-12 local security/consistency test (mock mode, Astro 7.3.2). Business and owner facts live in `CONTENT_TODO.md`. Close an item only after the fix is verified and, where relevant, recorded in `QA_REPORT.md`.

## High priority

- [x] **Serialize the booking-coordinator critical section.** `coordinator/src/index.ts` now wraps idempotency, FreeBusy revalidation, allocation, and multi-event creation in `this.ctx.blockConcurrencyWhile(...)`. The deployed final-resource race test remains a launch gate.
- [x] **Restore the `BOOKING_COORDINATOR` Durable Object binding in the active config.** `wrangler.jsonc` now declares the external `xerom-booking-coordinator` binding, and the root dry-run shows the binding. The stray `wrangler.jsonc copy` was removed.
- [x] **Enforce business hours and slot alignment server-side.** `validateBookingWindow` now checks Malaysia-local opening windows (including overnight carry-over), whole-session containment, and hourly alignment; unit coverage includes off-grid, closed, and midnight cases.
- [x] **Prevent production from running mock mode.** Production mode still defaults to `disabled`, and only development builds force mock mode. Live remains explicitly opt-in after external prerequisites pass.

## Medium priority

- [x] **Sanitize customer name and notes for Calendar output.** Calendar-facing name, phone, and notes now pass through `sanitizeCalendarText`, which removes control characters and structured delimiters before event summary/description construction. (No site XSS: the UI renders via `textContent`.)
- [ ] **Harden the Content-Security-Policy.** `public/_headers:7` uses `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` (needed today for JSON-LD and inlined CSS). Move to nonces or hashes where practical.
- [ ] **Complete security headers and verify on the deployed origin.** `public/_headers` omits `Strict-Transport-Security` and `Cross-Origin-Resource-Policy`; `_headers` is not applied by the dev server. Confirm all headers on the Cloudflare Pages origin before launch.
- [x] **Harden Turnstile verification.** Siteverify now has an eight-second abort timeout and optional expected-hostname/action checks supplied by encrypted Worker configuration.
- [ ] **Configure edge rate limiting.** `BOOKING_ARCHITECTURE.md:156` and `CLOUDFLARE_DEPLOYMENT.md:68` require Cloudflare rate limits on `/api/availability` and `/api/bookings`; none is implemented in code. Configure and record evidence.
- [ ] **Review schema strictness.** Zod objects are non-strict, so unknown fields are silently stripped (client-sent `total`/`admin` are correctly ignored, but typos also pass). Consider `.strict()` on the public booking schema.

## Low priority / hygiene

- [x] **Remove tracked junk.** The duplicate `wrangler.jsonc copy` was removed; no `.impeccable/questions/*.log` files remain.
- [x] **Remove dead configuration.** The unused `bookingMode` export was removed so the coordinator bundle does not evaluate `import.meta.env` at Worker runtime.
- [ ] **Make the additional-controller charge reachable or documented.** `calculateTotal` prices `additionalControllers` (`src/lib/booking/pricing.ts:9-11`), but the booking UI never collects it, so the advertised RM3 add-on cannot be booked. See `CONTENT_TODO.md`.
- [ ] **Replace the placeholder OG/social image.** `og-placeholder.jpg` is used as `og:image` on every page (`src/layouts/BaseLayout.astro:22,43`).

## Verification gate

Do not enable `BOOKING_MODE=live` until the coordinator race test, business-hours enforcement, Turnstile, DO binding, rate limiting, and deployed-origin header checks pass and are recorded in `QA_REPORT.md`.
