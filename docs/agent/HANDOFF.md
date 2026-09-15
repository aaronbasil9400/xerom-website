# Agent Handoff

Last updated: 2026-09-15

## Current state

The responsive Astro site, mock booking flow, Google Calendar adapters, booking coordinator Worker, official SVG logo, and operational documentation are implemented. The independent Impeccable review closed with `ship`; `DESIGN.md` and `.impeccable/design.json` reflect the reviewed interface. Google Cloud Calendar resources are created and shared, and the coordinator Worker is deployed; encrypted secret entry and live smoke testing remain.

## Next action

Google service-account credentials and calendar IDs are stored as encrypted secrets on both Workers, the coordinator is deployed, and live availability/booking, idempotency, and concurrency smoke tests have passed. The client demo Worker is live with Cloudflare's always-pass Turnstile test pair; replace those test values with a hostname-scoped widget before public launch. Resolve the remaining owner items in `CONTENT_TODO.md` before public launch.

## Tooling note

Project Playwright Chromium is installed and the six-width local suite passes. The separate Playwright MCP remained configured for a system Chrome path that was unavailable; local QA used the project Playwright runtime instead.

## Known blockers

See `CONTENT_TODO.md`. Most items do not block concept work, but verified address/contact, public-holiday hours, promotion behavior, production media, and Cloudflare/Google credentials block launch.

## Homepage upgrade continuation

The cinematic homepage upgrade is implemented, locally verified, committed, and pushed on `exp/homepage-cinematic-v1` through `7b313df`. The exact hero headline is `Race Together`; booking production files are unchanged from baseline `4e9787c`. Before/after evidence and Lighthouse JSON live in `.impeccable/review/homepage-upgrade/`, and the complete chronology is in `docs/agent/HOMEPAGE_UPGRADE_WORKLOG.md`.

The remaining gate is external: deploy the pushed branch with a valid `CLOUDFLARE_API_TOKEN`, run `VISUAL_VARIANT=deployed PLAYWRIGHT_BASE_URL=<staging-origin> npx playwright test tests/e2e/visual.spec.ts --workers=1`, run Lighthouse against that origin, and perform the non-destructive staging checks permitted by the owner. The 2026-09-15 deployment attempt stopped before upload because the token was absent; the existing staging Worker was not changed. Do not merge to `main` without owner approval.
