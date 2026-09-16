# Client Race Control setup

Status: working runbook; update after each verified external setup step.  
Scope: configure an owner-only Race Control preview and later a production deployment while preserving the existing Google Calendar booking record.

## 1. Prerequisites

- An active Cloudflare account that owns the Worker service and its public hostname.
- A Git repository connected to the Worker build system, with non-production branch builds enabled.
- One owner email address for the first Access policy.
- Google account ownership of the resource/control calendars.
- A Google service account with **Make changes and see all event details** on each resource/control calendar.
- Existing encrypted Worker secrets for the service-account credentials and calendar IDs. Never copy them into Git, a build variable, browser code, screenshots, or this document.

## 2. Feature branch and build

1. Create a branch such as `codex/race-control-working` from the current website baseline.
2. Commit and push the branch. Confirm Cloudflare records a successful non-production build for the branch.
3. Confirm the build uses the project’s server build command and uploads a version without changing production traffic.
4. Do not deploy a branch version to production traffic. Keep the active production version unchanged until a dedicated cutover review.

Note: Cloudflare dashboard edits to Worker runtime variables can themselves create a production version/deployment. Record that version in the client change log and verify its source code before assuming only configuration changed. In this setup, the Access variables produced `f3cefffa` from the prior production code; the Race Control branch remained on its alias.

Coordinator note: a website branch binding to the existing coordinator does not automatically execute newer coordinator source. Dry-run the coordinator separately, then either promote an additive coordinator version after the main-site race/rollback suite passes or create a separate Worker and provision its encrypted Google secrets. Do not point a preview at live calendars with an unverified coordinator.

## 3. Cloudflare Zero Trust / Access

1. In the Worker dashboard, open **Access**. If the account has no Zero Trust organization, select **Set up Zero Trust**.
2. Select **Zero Trust Free** only after the account owner accepts the current billing/terms screen. The free plan may still require a saved payment method and acknowledgement of charges beyond free limits.
3. Choose a unique team name based on the client/venue, for example `xerom-race-control`. Record the resulting `https://<team>.cloudflareaccess.com` issuer privately as `ACCESS_TEAM_DOMAIN`.
4. Under **Integrations → Identity providers**, enable One-time PIN if it is not already available.
5. Under **Access controls → Applications**, create a self-hosted public application for the actual Worker hostname. Scope it to `/race-control/*` and `/api/admin/*`; do not protect the public booking pages.
6. Create a reusable **Allow** policy scoped initially to the verified owner email only. Access is default-deny, so do not add a broad email-domain rule without owner approval.
7. Copy the application audience tag privately as `ACCESS_AUDIENCE`, and supply the owner email list privately as `OWNER_EMAILS`. Add these as encrypted runtime secrets/variables through the Worker configuration flow, never as build variables.
8. Test with the allowed owner email: request OTP, sign in, load `/race-control`, and confirm a non-allowed account is denied. Record the test result without copying tokens or PINs.

### Current account setup (2026-09-16)

- Zero Trust plan: Free (activated; due today $0/month).
- Team name: `lingering-sky-58df`.
- Access application: `Xerom Race Control Branch Preview` (application ID `6cbb336f-5aff-4659-b1e2-97982924b3aa`).
- Reusable policy: `Xerom Race Control Owner` (policy ID `57014aed-34b5-4b9b-967a-bce1e926400f`).
- Protected destinations: `codex-race-control-working-xerom-website.aaronbasil9400.workers.dev/race-control/*` and the same host at `/api/admin/*`.
- Worker runtime variables: `ACCESS_TEAM_DOMAIN` and `ACCESS_AUDIENCE`; encrypted secret `OWNER_EMAILS`. The AUD value is intentionally not repeated in this runbook; retrieve it from the application’s **Additional settings → Application Audience (AUD) Tag** when recreating the setup.
- The policy is an email allowlist for the owner identity, not a broad domain rule. No non-owner email was added.

The branch build alias currently resolves at `https://codex-race-control-working-xerom-website.aaronbasil9400.workers.dev`. Access redirects only the two configured Race Control/admin paths; the public homepage remains open.

## 4. Google Calendar connection model

- Keep the existing six resource calendars plus the Booking Control calendar private.
- The public booking site and Race Control both call the same booking coordinator. A successful booking creates the same linked opaque events and therefore immediately blocks capacity everywhere.
- Race Control schedule reads list those same calendars server-side. Calendar IDs never leave the Worker response.
- Do not create, delete, or unshare production calendars merely to test. Use a separate owned test calendar account for lifecycle testing.
- Calendar lifecycle automation needs venue-owner OAuth, distinct from the service-account event writer. Obtain client credentials and consent only when RC-08 provisioning begins.

## 5. Runtime configuration and media

1. Create private, non-production R2 buckets for configuration and media.
2. Bind them only to the preview environment first; generate Worker binding types after adding the binding.
3. Provide the encryption key for the OAuth token envelope as a Worker secret.
4. Test immutable revision writes, conditional `active.json` updates, stale drafts, and rollback from an isolated environment before enabling runtime publication on the public site.

Current gate: `wrangler r2 bucket list` reports that R2 must first be enabled through the Cloudflare Dashboard. No R2 bucket or binding has been created; confirm any additional billing/terms impact before enabling it.

## 6. Release checklist

- Run check, unit/contract tests, build and the six-width browser suite.
- Run a non-production Calendar schedule read and owner booking creation. Verify the linked event appears in the correct resource calendar and availability changes on the main booking site. Clean up only an explicitly authorized test booking.
- Test Access allow/deny and token validation at the Worker origin.
- Review rate limits, Turnstile production configuration, observability, privacy, and all owner-content gates before production cutover.
- Use a planned maintenance window for the runtime-config cutover; drain/reconcile pending coordinator operations first.
