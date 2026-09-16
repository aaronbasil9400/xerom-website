# Agent Handoff

Last updated: 2026-09-16

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

## Race Control planning handoff — 2026-09-15

Owner discovery is complete. Start dashboard implementation with [RACE_CONTROL_HANDOFF.md](RACE_CONTROL_HANDOFF.md), then follow [the complete plan](../RACE_CONTROL_PLAN.md). Begin with RC-00 capability spike and RC-01 shared contracts; preserve the existing public site and user-owned `docs/mockups/index.html`. No dashboard code, deployment, Google mutation or new storage was performed during planning.

Do not repeat the nine scope questions: answers are recorded in PRODUCT.md and the plan. Remaining real values/identity/retention inputs are in CONTENT_TODO.md. Historical status above describes earlier work and must not be mistaken for verification of these new features.

## Race Control implementation checkpoint — 2026-09-16

RC-00 and the first RC-01/RC-02/RC-03 foundations are implemented locally. See `docs/agent/RC00_CAPABILITY_SPIKE.md`. Shared strict schemas cover config, public projection, quotes, booking actions and operations; the seed contains confirmed hours/prices/resources and no active offer. Owner auth fails closed outside localhost development. The private config repository implements stale-draft rejection, immutable revisions and conditional pointer activation behind an unbound R2 gate. Google FreeBusy and insert replay now fail closed. A typed operation journal/dispatcher prototype persists idempotency state and recovery fences. Runtime pricing tests the no-stacking winner rule with synthetic offers only.

The owner dashboard shell and all stable navigation routes exist under `/race-control`, use the official logo and current design system, default to a phone agenda, and are explicitly labelled as non-live fixtures. The shell is not a complete front desk: actions, settings review/publish, Calendar schedule reads, OAuth/provisioning, media upload and public runtime cutover remain unimplemented.

Local evidence: `npm run check` passed; `npm test` passed 51/51; `npm run build` passed; the Race Control Playwright suite passed 12/12 across all six required widths after fixing 768/1024 overflow. Screenshots are in `.impeccable/review/race-control/`. No production deployment, R2 write, Google mutation, calendar creation or deletion occurred.

Continue in dependency order: finish RC-02 API review/publish and authenticated preview, integrate RC-03 journal/fences into the live coordinator with alarm recovery and failure injection, then RC-04 runtime cutover behind isolated bindings. Do not treat the present static shell as RC-05/RC-06/RC-07 completion.
