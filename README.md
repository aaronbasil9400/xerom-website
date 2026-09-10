# Xerom SimRacing & Cafe Website

Production website and database-free booking system for Xerom SimRacing & Cafe in Klang, Malaysia.

## Current status

The responsive Astro site and mock-mode booking flow are implemented against the approved Race · Play · Refuel design. The Google Calendar, Turnstile, and Durable Object production adapters are implemented but require owner credentials and Cloudflare/Google setup before live acceptance testing.

## Planned stack

- Astro + TypeScript.
- Cloudflare Pages and Pages Functions.
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

`DESIGN.md`, integration runbooks, deployment instructions, and `QA_REPORT.md` will be produced from the approved and tested implementation rather than as generic placeholders.

## Local development

```bash
npm install
npm run dev
```

Local development uses mock availability and booking confirmation. Production defaults to disabled booking until Cloudflare sets `BOOKING_MODE=live` and the required integrations are configured.

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
