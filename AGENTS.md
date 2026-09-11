# XEROM Website Agent Guide

## Mission

Build and maintain the production website and database-free booking system for Xerom SimRacing & Cafe in Klang, Malaysia. The website is a real business surface: never invent prices, hours, equipment, policies, reviews, promotions, or capacities.

## Sources of truth

Read these files before changing the project:

1. `PRODUCT.md` — confirmed product facts and durable constraints.
2. `CONTENT_TODO.md` — unresolved facts and assets that require owner confirmation.
3. `WEBSITE_PLAN.md` — approved delivery sequence and acceptance gates.
4. `BOOKING_ARCHITECTURE.md` — booking invariants, API boundaries, and failure handling.
5. `RESEARCH.md` — evidence, provenance, and source limitations.
6. `DESIGN.md` — visual system after the visual direction has been approved and implemented. It is intentionally absent during the planning/concept phase.

If documents conflict, confirmed owner input in `PRODUCT.md` wins over public promotional material. Security and booking invariants in `BOOKING_ARCHITECTURE.md` win over presentation preferences.

## Mandatory working rules

- Use Astro + TypeScript and target Cloudflare Pages.
- Use Google Calendar as the persistent booking system of record. Do not introduce D1, Firebase, Supabase, PostgreSQL, MySQL, MongoDB, or another application database without an explicit new requirement and owner approval.
- Keep secrets and calendar IDs server-side. Never place them in browser bundles, logs, analytics, fixtures, screenshots, or commits.
- Treat all busy events on a resource calendar as unavailable, including manual bookings and maintenance blocks.
- Revalidate availability inside the serialized booking operation before creating any event.
- Never report success until every required Google Calendar event has been created. Roll back partial multi-resource creation on failure.
- Preserve idempotency: retries of one booking attempt must not create a second booking.
- Do not send names, phone numbers, booking IDs, notes, or slot details to analytics.
- Keep business data centralized and editable; do not repeat prices, hours, resource counts, or promotions across components.
- Add every unknown or stale business fact to `CONTENT_TODO.md` instead of substituting plausible copy.
- Do not scrape and republish Instagram imagery as production assets. Temporary placeholders must be marked and replaceable.

## Design workflow

- The project uses Impeccable in comp-first mode. Read `PRODUCT.md` before design work.
- Do not create or finalize `DESIGN.md` before the owner selects a visual concept and the implemented surface is visually verified. `DESIGN.md` must describe the shipped world, not an aspiration.
- Preserve the official Xerom wordmark at `src/assets/brand/xerom-logo.svg`. Its red and white paths were traced from the owner-supplied raster; do not redraw, typeset, recolor, or distort it without explicit owner approval.
- Visual concept selection is an explicit approval gate. Do not silently choose a generic neon gaming template.
- Meet WCAG 2.2 AA where applicable, support reduced motion, and keep booking usable with keyboard and screen readers.
- Visual QA must cover 375, 390, 430, 768, 1024, and 1440+ CSS-pixel widths.

## Verification expectations

Before calling an implementation complete, run lint, typecheck, unit/integration tests, production build, and Playwright end-to-end checks. Inspect browser console errors, failed network requests, broken links, 404 assets, keyboard flow, focus visibility, mobile overflow, reduced motion, and booking error states. Test the final-resource concurrency race and prove exactly one request succeeds.

Keep `QA_REPORT.md` evidence-based. Record commands, dates, environments, results, known limitations, and screenshot paths. Do not mark unrun checks as passing.

## Change discipline

- Preserve user changes and unrelated work.
- Update relevant documentation in the same change as behavior or configuration.
- Add an entry to `docs/agent/DECISIONS.md` for material architecture, policy, integration, or design decisions.
- Leave a concise update in `docs/agent/HANDOFF.md` when stopping with incomplete work.
- Use explicit placeholders such as `TODO(owner): ...`; never disguise a placeholder as final business copy.
