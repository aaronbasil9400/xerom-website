# Engineering and Security TODO

Tracked from the 2026-09-12 local security/consistency test (mock mode, Astro 7.3.2). Business and owner facts live in `CONTENT_TODO.md`. Close an item only after the fix is verified and, where relevant, recorded in `QA_REPORT.md`.

## High priority

- [ ] **Serialize the booking-coordinator critical section.** `coordinator/src/index.ts` has no `blockConcurrencyWhile`, transaction, or queue, yet the read-allocate-create path awaits external I/O (`queryFreeBusy`, `insertEvent`). Concurrent requests for the last resource can interleave and double-book. Wrap the critical section in `this.ctx.blockConcurrencyWhile(...)` (or equivalent serialization) and prove the `BOOKING_ARCHITECTURE.md` final-resource race test: two simultaneous requests → exactly one `201`, one `409`.
- [ ] **Restore the `BOOKING_COORDINATOR` Durable Object binding in the active config.** `wrangler.jsonc` has no `durable_objects` binding; generated `dist/server/wrangler.json` shows `"durable_objects":{"bindings":[]}`. Live mode returns `503` because `env.BOOKING_COORDINATOR` is undefined (`src/pages/api/bookings.ts:35`). The intended binding currently sits in the stray tracked file `wrangler.jsonc copy`. Merge it into `wrangler.jsonc` and delete the copy.
- [ ] **Enforce business hours and slot alignment server-side.** `validateBookingWindow` (`src/lib/booking/time.ts:36-43`) checks only notice, horizon, and duration. Neither `/api/bookings` nor the coordinator confirms the interval lies inside the overnight window or on a slot boundary (`BOOKING_ARCHITECTURE.md:68` step 3). A direct API call can book outside hours (observed: `03:37` and a `2020` date both returned `201` in mock). Add the hours/slot check to the authoritative create path.
- [ ] **Prevent production from running mock mode.** Mode is `import.meta.env.DEV ? "mock" : (env.BOOKING_MODE ?? "disabled")` (`src/pages/api/bookings.ts:29`, `src/pages/api/availability.ts:37`). Mock skips window validation, capacity checks, Turnstile, and idempotency. Keep `BOOKING_MODE=disabled` in `wrangler.jsonc` and fail closed if `live` prerequisites are missing.

## Medium priority

- [ ] **Sanitize customer name and notes for Calendar output.** `customer.name` (`src/lib/booking/schema.ts:24`) allows newlines and `|`; `notes` is free text. Both are interpolated raw into the staff summary/description (`coordinator/src/index.ts:66-75`), allowing forged `Phone:`, `Booking ID:`, or `Total booking price:` lines. Strip control characters/newlines and delimiters before building the event. (No site XSS: the UI renders via `textContent`.)
- [ ] **Harden the Content-Security-Policy.** `public/_headers:7` uses `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` (needed today for JSON-LD and inlined CSS). Move to nonces or hashes where practical.
- [ ] **Complete security headers and verify on the deployed origin.** `public/_headers` omits `Strict-Transport-Security` and `Cross-Origin-Resource-Policy`; `_headers` is not applied by the dev server. Confirm all headers on the Cloudflare Pages origin before launch.
- [ ] **Harden Turnstile verification.** `src/lib/security/turnstile.ts` does not validate `hostname`/`action` and has no request timeout. Add both.
- [ ] **Configure edge rate limiting.** `BOOKING_ARCHITECTURE.md:156` and `CLOUDFLARE_DEPLOYMENT.md:68` require Cloudflare rate limits on `/api/availability` and `/api/bookings`; none is implemented in code. Configure and record evidence.
- [ ] **Review schema strictness.** Zod objects are non-strict, so unknown fields are silently stripped (client-sent `total`/`admin` are correctly ignored, but typos also pass). Consider `.strict()` on the public booking schema.

## Low priority / hygiene

- [ ] **Remove tracked junk.** `wrangler.jsonc copy` (also a config hazard, see above) and `.impeccable/questions/*.log`.
- [ ] **Remove dead configuration.** `bookingMode` in `src/config/booking.ts:20` is unused; `PUBLIC_BOOKING_MODE` is set in `package.json` but never read.
- [ ] **Make the additional-controller charge reachable or documented.** `calculateTotal` prices `additionalControllers` (`src/lib/booking/pricing.ts:9-11`), but the booking UI never collects it, so the advertised RM3 add-on cannot be booked. See `CONTENT_TODO.md`.
- [ ] **Replace the placeholder OG/social image.** `og-placeholder.jpg` is used as `og:image` on every page (`src/layouts/BaseLayout.astro:22,43`).

## Verification gate

Do not enable `BOOKING_MODE=live` until the coordinator race test, business-hours enforcement, Turnstile, DO binding, rate limiting, and deployed-origin header checks pass and are recorded in `QA_REPORT.md`.
