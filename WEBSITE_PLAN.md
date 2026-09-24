# Xerom Website Plan

Status: client-owned Workers staging is implemented and connected to live Google Calendars. The current social hero/OG photos and canonical domain remain owner inputs; see `CONTENT_TODO.md`.

Mobile is a first-class authored surface. The mobile concept must preserve the social-first story and booking clarity rather than merely stacking a desktop layout.

## Outcome

Deliver a mobile-first marketing website and booking flow that accurately represents Xerom, reads availability from private Google resource calendars, prevents double bookings, creates complete Calendar reservations, and deploys through Cloudflare Workers or Pages without a conventional application database. The current client demo uses the existing `xerom-website` Worker.

## Planned experience

The site will use a small number of focused routes rather than duplicating every topic into a thin page:

- `/` — venue proposition, experiences, current prices, proof/gallery, hours, location, and primary booking CTA.
- `/experiences` — Regular Sim, Pro Sim, PS5 lounges, and cafe context with verified equipment details.
- `/pricing` — current rates and promotions sourced from centralized configuration.
- `/book` — the complete booking flow and confirmation state.
- `/visit` — address, hours, directions, phone, WhatsApp, Instagram, and practical visit information.
- `/events` and `/whats-new` — direct visitors to Instagram for current announcements until a website announcement feature is implemented.
- `/booking-policy` and `/privacy` — customer-facing booking and data-use notices linked from the booking flow and footer.

This information architecture is a planning baseline. The approved visual concept may combine or re-sequence marketing content, but it must preserve clear entry points for pricing, booking, and visiting.

## Booking UX baseline

1. Choose Regular Sim, Pro Sim, PS5, or a mixed Regular + Pro group.
2. Choose quantity by tier. Never display quantities beyond configured capacity.
3. Choose 30, 60, 90, or 120 minutes.
4. Choose a date within the rolling 72-hour horizon and at least one hour ahead.
5. Load server-calculated start times.
6. Choose an available time.
7. Enter name and mobile/WhatsApp number; email is optional. Public free-text notes are not collected.
8. Review service, resources, duration, start/end, and authoritative price.
9. Complete Turnstile and submit once with an idempotency key.
10. Server serializes, revalidates, allocates, and creates every Calendar event.
11. Show confirmed booking ID only after full success, then offer WhatsApp, directions, and add-to-calendar actions.

Material states: initial, loading, no availability, invalid input, Turnstile failure, slot taken (409), external service failure, partial-create rollback failure requiring staff attention, success, and network retry.

## Configuration strategy (original baseline; expanded below)

Business data will be typed and centralized, likely under:

- `src/config/business.ts` — name, address, timezone, contact, coordinates, social and map links.
- `src/config/resources.ts` — resource types and server-side calendar environment keys.
- `src/config/services.ts` — tier selection, capacities, duration options, controller rules, and display copy.
- `src/config/pricing.ts` — base prices, no active discounts/compare-at prices, and PS5 controller add-ons.
- `src/config/booking.ts` — hours, notice, horizon, slot interval, duration limits, and buffer.

Future promotion records should have an identifier, label, terms, start/end timestamps when applicable, applicability, and active flag. No promotion is active now. The server calculates totals from configuration; the browser only displays returned totals. Equipment copy is content configuration, not embedded in components.

## Visual design sequence

1. Complete source inspection and assemble a small approved photo/logo asset set.
2. Use the approved Race Control Broadcast direction and the `Race · Play · Refuel` composition at `.impeccable/mocks/home/race-play-refuel.png`.
3. Replace mockup-only people, equipment, cafe, and venue imagery with owner-approved assets when supplied.
4. Implement the approved mockup with responsive booking states, preserving its separately authored mobile composition.
5. Write `DESIGN.md` from the verified implementation so tokens and guidance describe reality.

## Delivery phases and gates

### 1. Evidence and owner readiness

- Complete interactive Instagram and Maps review.
- Resolve critical items in `CONTENT_TODO.md`.
- Acquire official logo and production photography, or approve named temporary placeholders.

Gate: no unverified claim enters production copy.

### 2. Concept and mockup

- Select a visual direction through an explicit user decision.
- Produce desktop and mobile mockups, including booking selection and confirmation.
- Confirm hierarchy, tone, content density, and asset strategy.

Gate: user approves the mockup before application scaffolding.

### 3. Foundation and content

- Scaffold Astro + TypeScript with the official Cloudflare adapter.
- Add typed configuration, reusable layout/components, metadata, sitemap, robots, canonical URLs, and LocalBusiness JSON-LD.
- Add optimized placeholder/approved media with provenance.

Gate: static production build, lint, and typecheck pass; facts match sources.

### 4. Availability and booking

- Implement Google authentication, FreeBusy adapter, control-calendar logic, local-time slot generation, allocation, validation, Turnstile, pricing, and confirmation.
- Implement the separate booking-coordinator Worker and bind it to Pages.
- Add deterministic idempotency and multi-event rollback.

Gate: contract and integration tests cover all booking invariants.

### 5. Operational readiness

- Create `BOOKING_OPERATIONS.md`, `GOOGLE_CALENDAR_SETUP.md`, `.dev.vars.example`, and `CLOUDFLARE_DEPLOYMENT.md` from the working implementation.
- Validate manual booking, maintenance, full closure, lookup, cancellation, and secret rotation procedures.

Gate: a non-developer can follow the staff guide in a test Calendar.

### 6. QA and deployment preparation

- Run Playwright at 375, 390, 430, 768, 1024, and 1440+ widths.
- Test keyboard and screen-reader semantics, reduced motion, console/network errors, broken links, 404s, overflow, failure states, and the full mobile flow.
- Run simultaneous final-resource requests and prove one success/one conflict.
- Run Lighthouse-style checks and production build.
- Record evidence in `QA_REPORT.md`.

Gate: acceptance checklist passes or every exception is explicitly documented and approved.

## Testing layers

- Unit: timezone math, overnight hours, interval overlap, slot generation, mixed-tier allocation, authoritative pricing, booking IDs, validation, and idempotency identifiers.
- Contract: Google FreeBusy/event adapters, Turnstile verification, coordinator protocol, and sanitized public responses.
- Integration: manual busy events, maintenance, closure calendar, partial creation rollback, retry recovery, and Google failures.
- E2E: discovery-to-booking journeys, empty/error/success states, WhatsApp and directions links, duplicate clicking, and responsive behavior.
- Concurrency: two requests for the final same resource and overlapping mixed-tier requests.

## Performance and accessibility targets

- Lighthouse-style targets: Performance 90+, Accessibility 95+, Best Practices 95+, SEO 95+.
- Keep the marketing shell primarily static; hydrate only interactive booking and purposeful motion.
- Optimize and size images, minimize third-party scripts, defer maps, self-host/subset fonts when licensing permits, and maintain visible content without JavaScript where practical.
- Meet WCAG 2.2 AA for contrast and interaction behavior.

## Explicit non-goals

No customer accounts, passwords, custom admin portal, traditional database, payment processing, deposit collection, loyalty program, membership management, promo-code engine, automated WhatsApp messaging, CRM, or leaderboard in the MVP.

## 2026-09-15 — Owner dashboard expansion

The owner approved Race Control as the primary front desk plus live business/content editing. The original configuration and delivery sections above describe the baseline; the new runtime configuration, dashboard UI, booking mutations, automatic Calendar provisioning and acceptance sequence are specified in [docs/RACE_CONTROL_PLAN.md](docs/RACE_CONTROL_PLAN.md). Business changes must not trigger builds/deployments. Initial integration/code deployment remains required. Preserve the public site's existing composition and booking invariants.

Use [docs/agent/RACE_CONTROL_HANDOFF.md](docs/agent/RACE_CONTROL_HANDOFF.md) to start building in dependency order. Dashboard scope is planned, not implemented.
