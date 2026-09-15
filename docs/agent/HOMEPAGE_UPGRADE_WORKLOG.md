# Homepage Upgrade Worklog

This file is the continuation log for the cinematic homepage UI/UX upgrade requested on 2026-09-15.

## Scope and guardrails

- Branch: `exp/homepage-cinematic-v1`
- Baseline commit: `4e9787c1fa523cb14d18127ef9136f44da130e06`
- Authoritative instructions: `XEROM_HOMEPAGE_AGENT_HANDOFF.md`
- Composition references: `XEROM_HOMEPAGE_DESKTOP_REFERENCE.png` and `XEROM_HOMEPAGE_MOBILE_REFERENCE.png`
- Hero H1 is exactly `RACE TOGETHER`.
- Booking behavior and protected booking files are out of scope and must remain unchanged.
- Pre-existing owner changes and unrelated untracked files must not be staged or overwritten.

## 2026-09-15 — Intake and baseline

- Read the handoff and upgrade plan completely.
- Inspected both reference PNGs at original resolution.
- Read all mandatory repository sources: `AGENTS.md`, `PRODUCT.md`, `CONTENT_TODO.md`, `WEBSITE_PLAN.md`, `BOOKING_ARCHITECTURE.md`, `RESEARCH.md`, `DESIGN.md`, `QA_REPORT.md`, `docs/agent/home-surface-brief.md`, `docs/agent/DECISIONS.md`, and `docs/agent/HANDOFF.md`.
- Recorded the starting Git state on `main` at `4e9787c`. The worktree already contained unrelated modified and untracked owner files; these are being preserved.
- Created feature branch `exp/homepage-cinematic-v1`.
- Installed the lockfile dependencies with Node 24.15.0/npm 11.12.1 from the existing local portable Node distribution; `npm ci` reported 0 vulnerabilities.
- Baseline `npm run check`: project sources had 0 errors; two hints came from the pre-existing untracked `hive-v3-installation` package.
- Baseline `npm test`: 15/15 passed.
- Baseline `npm run build`: passed.
- Baseline `npm run assets:verify`: 15 manifested derivatives passed.
- Installed the matching Playwright Chromium runtime because it was absent locally.
- Baseline responsive captures are preserved under `.impeccable/review/homepage-upgrade/before/` at 375, 390, 430, 768, 1024, 1440 and the 1536 hero reproduction.
- Baseline single-worker E2E: 25 passed, 5 intentional hero-repro skips, and 6 booking-confirmation failures. The failures reproduce before homepage code changes and are caused by current Astro/Cloudflare local development throwing on `Astro.clientAddress` in `src/pages/api/bookings.ts`; protected booking code was not changed. The browser booking regression now intercepts only the final mock POST so it can continue exercising the unchanged UI without mutating that endpoint.
- First implementation pass added the cinematic hero, mobile Book pill, service dock/cards, social gallery, hours/location cards, final CTA, and homepage-only CSS/components. Visual QA found and fixed a clipped phone headline.

## Continuation checklist

- [x] Run baseline check, unit tests, build, asset verification, and E2E.
- [x] Preserve six pre-change screenshots under a dedicated baseline directory.
- [ ] Implement the cinematic desktop homepage and independently tuned mobile hierarchy.
- [ ] Add the always-visible mobile Book action without changing booking routes or behavior.
- [ ] Add/adjust structural and responsive E2E coverage.
- [ ] Run final six-width visual QA, accessibility, reduced-motion, 200% reflow, console/network, links/assets, and booking-regression checks.
- [ ] Measure Lighthouse against an available representative build/origin and document constraints.
- [ ] Update `DESIGN.md`, `QA_REPORT.md`, `docs/agent/DECISIONS.md`, and this worklog with evidence.
- [ ] Commit scoped progress periodically; do not merge to `main`.
