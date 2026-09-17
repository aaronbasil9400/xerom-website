# Cloudflare Worker change runbook for agents

Use this runbook for safe Race Control changes on the Xerom feature branch. It describes the verified preview workflow, not a production-release authorization.

For account setup, Access configuration and Google prerequisites, see [CLIENT_RACE_CONTROL_SETUP.md](CLIENT_RACE_CONTROL_SETUP.md). For the broader website deployment model, see [CLOUDFLARE_DEPLOYMENT.md](../../CLOUDFLARE_DEPLOYMENT.md).

## What an agent may change

- Application source, tests, and non-secret documentation on a feature branch.
- The Race Control branch preview through the repository's existing Cloudflare Git integration.
- Read-only Cloudflare status checks with the project-local Wrangler CLI.

Do not directly deploy the website Worker, change production traffic, change bindings or runtime variables, add/remove secrets, alter Access policies, enable R2 billing, or write to Google Calendar without separate explicit owner approval. Those actions can affect the live public site, authorization, costs, or reservations.

## Deployment model

The repository has two Worker concerns:

1. `xerom-website` serves the Astro website and the protected Race Control preview.
2. `xerom-race-control-coordinator` is a separate Worker that serializes booking operations and holds the private Google integration configuration.

The website's `BOOKING_COORDINATOR` binding is configured in [wrangler.jsonc](../../wrangler.jsonc). Do not rename or rebind it as part of normal UI work. Google Calendar remains the booking system of record; the coordinator is not a booking database.

## Safe feature-branch workflow

1. Start from the current `codex/race-control-working` branch. Preserve unrelated work and the official Xerom SVG logo.
2. Make scoped source changes using `apply_patch`; never place secrets, Calendar IDs, owner emails, Access audience values, or customer data in source, fixtures, screenshots, commits, or logs.
3. Run the standard checks:

   ```bash
   npm run check
   npm test
   npm run build
   ```

4. Run responsive browser verification at the required 375, 390, 430, 768, 1024, and 1440px project configurations:

   ```bash
   npm run dev -- --host 127.0.0.1
   PLAYWRIGHT_BASE_URL=http://127.0.0.1:4321 npx playwright test tests/e2e/race-control.spec.ts --workers=1
   npm exec astro dev stop
   ```

   The E2E suite writes review screenshots under `.impeccable/review/race-control/`. Restore those tracked generated images after inspection unless a visual-baseline update is explicitly requested.

5. Inspect the diff, then commit only the intended implementation, tests, and records. A user-supplied patch file is an input artifact; do not silently commit it unless the owner explicitly asks.

   ```bash
   git diff --check
   git status --short
   git add <explicit files>
   git commit -m "<scoped change>"
   git push origin codex/race-control-working
   git ls-remote --heads origin codex/race-control-working
   ```

6. The connected Cloudflare branch build uploads a non-production preview version under the `codex-race-control-working` alias. Verify the upload read-only:

   ```bash
   WRANGLER_LOG_PATH=/tmp/xerom-wrangler.log \
     npx wrangler versions list --name xerom-website --json
   ```

   Look for a recent version with `workers/alias: codex-race-control-working` and `has_preview: true`. `wrangler deployments list` describes production traffic, so use it only to confirm production was not changed—not as evidence of a branch build.

7. Open the protected preview only after Cloudflare reports the branch version. A fresh browser session may stop at Cloudflare Access. Never request, enter, forward, or log a one-time code unless the owner explicitly authorizes the specific login. Treat the Access gate as expected, not a deployment failure.

## Verification and reporting

Record commands, results, screenshot inspection, known limitations, branch commit, and preview-version evidence in [QA_REPORT.md](../../QA_REPORT.md) and [HANDOFF.md](HANDOFF.md). State the difference between local visual verification and an authenticated remote preview check.

For any booking or Calendar integration test, first obtain action-time approval for a clearly labelled test reservation and its cleanup. Do not create, cancel, reschedule, or delete Calendar records just to prove that a UI-only change deployed.

## Escalation points

- **Production cutover:** requires a planned owner review and a separate explicit instruction. Do not use `wrangler deploy` for the website as a shortcut around the branch build.
- **Coordinator source/binding change:** requires its own test and rollback plan because it can affect the main booking site.
- **Secrets, Access, OAuth, R2, billing, or Calendar lifecycle:** require an explicit owner-approved change request and the relevant setup runbook. Do not infer permission from access to the dashboard.
- **Cloudflare or GitHub networking failure:** retry a read-only verification with the approved network path; do not declare a deployment successful from a local commit alone.
