# Engineering and Security TODO

Tracked from the 2026-09-12 local security/consistency test (mock mode, Astro 7.3.2). Business and owner facts live in `CONTENT_TODO.md`. Close an item only after the fix is verified and, where relevant, recorded in `QA_REPORT.md`.

## High priority

- [x] **Serialize the booking-coordinator critical section.** `coordinator/src/index.ts` now wraps idempotency, FreeBusy revalidation, allocation, and multi-event creation in `this.ctx.blockConcurrencyWhile(...)`. The deployed final-resource race test remains a launch gate.
- [x] **Restore the `BOOKING_COORDINATOR` Durable Object binding in the active config.** `wrangler.jsonc` now declares the external `xerom-booking-coordinator` binding, and the root dry-run shows the binding. The stray `wrangler.jsonc copy` was removed.
- [x] **Enforce business hours and slot alignment server-side.** `validateBookingWindow` checks Malaysia-local opening windows (including overnight carry-over), whole-session containment, and the public hourly grid; the owner-confirmed manual-booking policy intentionally bypasses hourly alignment while retaining future/opening-hours/Calendar checks.
- [x] **Prevent production from running mock mode.** Production mode still defaults to `disabled`, and only development builds force mock mode. Live remains explicitly opt-in after external prerequisites pass.

## Medium priority

- [x] **Sanitize customer name and notes for Calendar output.** Calendar-facing name, phone, and notes now pass through `sanitizeCalendarText`, which removes control characters and structured delimiters before event summary/description construction. (No site XSS: the UI renders via `textContent`.)
- [ ] **Harden the Content-Security-Policy.** `public/_headers:7` uses `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` (needed today for JSON-LD and inlined CSS). Move to nonces or hashes where practical.
- [x] **Complete security headers and verify on the deployed origin.** Runtime middleware now applies the security header set for the direct Worker (including HSTS on HTTPS), and `public/_headers` covers Pages/static hosting. The deployed Worker response was checked on 2026-09-13; CSP still intentionally allows the inline Astro JSON-LD/CSS and Turnstile script.
- [x] **Harden Turnstile verification.** Siteverify now has an eight-second abort timeout and optional expected-hostname/action checks supplied by encrypted Worker configuration.
- [ ] **Replace the demo Turnstile credentials before public launch.** The current client-demo widget uses Cloudflare's documented always-pass test pair and visibly renders a “For testing only” warning. Create a hostname-scoped widget, update the public site key build variable and encrypted Worker secret, and verify the warning is absent on the canonical hostname. See `CONTENT_TODO.md` for the owner-facing setup item.
- [ ] **Configure edge rate limiting.** `BOOKING_ARCHITECTURE.md:156` and `CLOUDFLARE_DEPLOYMENT.md:68` require Cloudflare rate limits on `/api/availability` and `/api/bookings`; none is implemented in code. Configure and record evidence.
- [ ] **Review schema strictness.** Zod objects are non-strict, so unknown fields are silently stripped (client-sent `total`/`admin` are correctly ignored, but typos also pass). Consider `.strict()` on the public booking schema.

## Low priority / hygiene

- [x] **Remove tracked junk.** The duplicate `wrangler.jsonc copy` was removed; no `.impeccable/questions/*.log` files remain.
- [x] **Remove dead configuration.** The unused `bookingMode` export was removed so the coordinator bundle does not evaluate `import.meta.env` at Worker runtime.
- [ ] **Make the additional-controller charge reachable or documented.** `calculateTotal` prices `additionalControllers` (`src/lib/booking/pricing.ts:9-11`), but the booking UI never collects it, so the advertised RM3 add-on cannot be booked. See `CONTENT_TODO.md`.
- [ ] **Replace the placeholder OG/social image.** `og-placeholder.jpg` is used as `og:image` on every page (`src/layouts/BaseLayout.astro:22,43`).

## Verification gate

Do not keep `BOOKING_MODE=live` on a public hostname until the coordinator race test, business-hours enforcement, a real hostname-scoped Turnstile widget, rate limiting, and deployed-origin header checks pass and are recorded in `QA_REPORT.md`. The temporary client demo uses documented Turnstile test credentials.
