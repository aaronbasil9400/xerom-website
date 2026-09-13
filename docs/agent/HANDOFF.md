# Agent Handoff

Last updated: 2026-09-13

## Current state

The responsive Astro site, mock booking flow, Google Calendar adapters, booking coordinator Worker, official SVG logo, and operational documentation are implemented. The independent Impeccable review closed with `ship`; `DESIGN.md` and `.impeccable/design.json` reflect the reviewed interface. Google Cloud Calendar resources are created and shared, and the coordinator Worker is deployed; encrypted secret entry and live smoke testing remain.

## Next action

Store the Google service-account credentials and calendar IDs as encrypted secrets on both Workers, configure a hostname-appropriate Turnstile widget, run the live integration and concurrency acceptance tests from `QA_REPORT.md`, then enable `BOOKING_MODE=live`. Resolve the remaining owner items in `CONTENT_TODO.md` before public launch.

## Tooling note

Project Playwright Chromium is installed and the six-width local suite passes. The separate Playwright MCP remained configured for a system Chrome path that was unavailable; local QA used the project Playwright runtime instead.

## Known blockers

See `CONTENT_TODO.md`. Most items do not block concept work, but verified address/contact, public-holiday hours, promotion behavior, production media, and Cloudflare/Google credentials block launch.
