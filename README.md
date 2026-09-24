# Xerom SimRacing & Cafe Website

Production website and database-free booking system for Xerom SimRacing & Cafe in Klang, Malaysia.

## Current status

The responsive Astro site is deployed in the client-owned Cloudflare account at [xerom-website.xerombookings.workers.dev](https://xerom-website.xerombookings.workers.dev). Live availability and booking use the client-owned private Google Calendars, a serialized coordinator Worker, real hostname-scoped Turnstile, and five rate-limit bindings. Race Control and owner APIs require Cloudflare Access. Cloudflare Workers Builds is connected to `xerombookings-dev/xerom-website` on `main`; build automation is configured for the temporary Workers hostname. The hostname remains `noindex` until the owner provides the canonical domain.

## Planned stack

- Astro + TypeScript.
- Cloudflare Workers (the same Astro output remains Pages-compatible).
- Google Calendar as the booking system of record.
- A small Cloudflare Worker hosting a Durable Object for booking serialization and idempotency coordination.
- Cloudflare Turnstile for bot protection.
- WhatsApp click-to-chat for customer support and booking changes.
- No conventional application database.

## Start here

- [`PRODUCT.md`](PRODUCT.md) — confirmed business and product truth.
- [`WEBSITE_PLAN.md`](WEBSITE_PLAN.md) — experience, delivery phases, and gates.
- [`BOOKING_ARCHITECTURE.md`](BOOKING_ARCHITECTURE.md) — booking design and invariants.
- [`RESEARCH.md`](RESEARCH.md) — evidence and source limitations.
- [`CONTENT_TODO.md`](CONTENT_TODO.md) — owner inputs and assets still required.
- [`AGENTS.md`](AGENTS.md) — rules for coding agents working in this repository.
- [`docs/agent/DECISIONS.md`](docs/agent/DECISIONS.md) — material decisions and rationale.
- [`docs/agent/HANDOFF.md`](docs/agent/HANDOFF.md) — current state and next action.
- [`src/assets/brand/README.md`](src/assets/brand/README.md) — official logo source and SVG conversion provenance.

Integration runbooks, deployment instructions, and `QA_REPORT.md` are maintained from the tested implementation. `DESIGN.md` is generated from the final reviewed visual system.

## Local development

```bash
npm install
npm run dev
```

Local development uses mock availability and booking confirmation. The temporary Worker is configured with `BOOKING_MODE=live` and currently uses the production-named resource calendars. Any additional preview that is not intended to accept customer reservations must use `BOOKING_MODE=disabled` or its own dedicated test calendars.

Verification:

```bash
npm run check
npm test
npm run test:e2e
npm run build
npx wrangler deploy --dry-run --config coordinator/wrangler.jsonc
```

## Confirmed booking baseline

- 3 Regular Sim rigs, 1 Pro Sim rig, and 2 PS5 lounges.
- One-hour sessions; one or two hours per booking.
- Mixed Regular + Pro group bookings supported.
- Instant confirmation when capacity exists; no deposit.
- One-hour minimum notice and three-day booking horizon.
- Back-to-back bookings; no reset buffer.
- English-only MVP, designed primarily for mobile visitors.

## Safety

Never commit real Google credentials, Calendar IDs, Turnstile secrets, or customer data. Never invent business facts; add unresolved items to `CONTENT_TODO.md`.
