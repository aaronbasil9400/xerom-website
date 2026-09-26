# Engineering and Security TODO

Tracked from the 2026-09-12 local security/consistency test (mock mode, Astro 7.3.2). Business and owner facts live in `CONTENT_TODO.md`. Close an item only after the fix is verified and, where relevant, recorded in `QA_REPORT.md`.

## High priority

- [x] **Serialize the booking-coordinator critical section.** `coordinator/src/index.ts` now wraps idempotency, FreeBusy revalidation, allocation, and multi-event creation in `this.ctx.blockConcurrencyWhile(...)`. The deployed final-resource race test remains a launch gate.
- [x] **Restore the `BOOKING_COORDINATOR` Durable Object binding in the active config.** `wrangler.jsonc` now declares the external `xerom-booking-coordinator` binding, and the root dry-run shows the binding. The stray `wrangler.jsonc copy` was removed.
- [x] **Enforce business hours and slot alignment server-side.** `validateBookingWindow` checks Malaysia-local opening windows (including overnight carry-over), whole-session containment, and the public hourly grid; the owner-confirmed manual-booking policy intentionally bypasses hourly alignment while retaining future/opening-hours/Calendar checks.
- [x] **Prevent production from running mock mode.** Production mode still defaults to `disabled`, and only development builds force mock mode. Live remains explicitly opt-in after external prerequisites pass.
- [x] **Configure edge rate limiting.** Five Cloudflare Rate Limiting bindings are configured on the client Worker and verified in the 2026-09-24 deployment record. Recheck thresholds during domain cutover if route traffic changes.
- [ ] **Add operator recovery for durable mutation fences.** Grouped Calendar writes now persist recovery fences before mutation, compensate safe partial updates, and keep capacity closed when compensation is uncertain. Add the authenticated reconciliation view/alarm workflow before public launch so staff can inspect and clear only verified operations.

## Medium priority

- [x] **Sanitize customer name and notes for Calendar output.** Calendar-facing name, phone, and notes now pass through `sanitizeCalendarText`, which removes control characters and structured delimiters before event summary/description construction. (No site XSS: the UI renders via `textContent`.)
- [ ] **Harden the Content-Security-Policy.** `public/_headers:7` uses `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'` (needed today for JSON-LD and inlined CSS). Move to nonces or hashes where practical.
- [x] **Complete security headers and verify on the deployed origin.** Runtime middleware now applies the security header set for the direct Worker (including HSTS on HTTPS), and `public/_headers` covers Pages/static hosting. The deployed Worker response was checked on 2026-09-13; CSP still intentionally allows the inline Astro JSON-LD/CSS and Turnstile script.
- [x] **Harden Turnstile verification.** Siteverify now has an eight-second abort timeout and optional expected-hostname/action checks supplied by encrypted Worker configuration.
- [x] **Replace demo Turnstile credentials.** A real managed widget is scoped to `xerom-website.xerombookings.workers.dev`; deployed submissions pass Siteverify. Add the canonical hostname and update its build/secret configuration at domain cutover.
- [ ] **Review schema strictness.** Zod objects are non-strict, so unknown fields are silently stripped (client-sent `total`/`admin` are correctly ignored, but typos also pass). Consider `.strict()` on the public booking schema.
- [ ] **Implement email confirmation delivery.** Public email remains optional and is stored with the Calendar booking. No provider or delivery path is configured; the public privacy notice states that no email confirmation is sent.

## Low priority / hygiene

- [x] **Remove tracked junk.** The duplicate `wrangler.jsonc copy` was removed; no `.impeccable/questions/*.log` files remain.
- [x] **Remove dead configuration.** The unused `bookingMode` export was removed so the coordinator bundle does not evaluate `import.meta.env` at Worker runtime.
- [x] **Make the additional-controller charge reachable.** The public PS5 booking step collects 0–6 additional controllers and prices RM3 once per booking.
- [ ] **Replace the placeholder OG/social image.** The current image remains in place per the owner's 2026-09-24 direction while final approved photos are pending. See `CONTENT_TODO.md`.
- [x] **Implement Race Control activity history.** Owner-only history now records booking creates/actions, maintenance and closure blocks, settings publications, failures and recovery state in the existing serialized coordinator. The feed omits customer contact details and keeps unresolved operations until reconciled.
- [ ] **Enforce operation-journal retention.** Prune succeeded/failed operation records after the owner-approved 30 days; never expire pending, review-required, or fenced recovery records.

## Verification gate

The temporary worker hostname remains `noindex`. Before a canonical-domain cutover, verify the new hostname is added to Turnstile, inspect deployed security headers and public workflows on that hostname, and keep the engineering follow-ups above visible. The final-resource race test has passed once and its synthetic event was removed.
