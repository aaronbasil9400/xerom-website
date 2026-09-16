# RC-00 capability spike

Date: 2026-09-16  
Status: isolated local capability spike; no production binding or external mutation

## Outcome

The spike establishes a reviewable contract for three risky boundaries before any Race Control mutation is wired to production:

1. Runtime configuration activation uses immutable revision objects plus a conditional `active.json` pointer. A create-only write uses `etagDoesNotMatch: "*"`; an update uses `etagMatches` with the previously read ETag. A failed conditional write returns a conflict and reloads the current pointer.
2. Calendar provisioning writes an operation/resource marker into a supported secondary-calendar description. After an ambiguous create response, reconciliation lists calendars owned by the connected venue identity. Exactly one non-primary owner match is adopted; zero is safe to retry through the same durable operation; multiple matches require owner review and remain fenced.
3. Owner access and Google connection stay separate. Cloudflare Access protects `/race-control/*` and `/api/admin/*`; the origin verifies the `Cf-Access-Jwt-Assertion` signature, issuer, audience, expiry and exact owner allowlist. Google owner OAuth is proposed only for calendar lifecycle/ACL operations. The service account remains the event writer.

## Implemented evidence

- `src/lib/race-control/capability-spike.ts` contains platform-shaped, side-effect-free contracts for conditional pointer activation, provisioning-marker reconciliation, Access setup validation and the proposed Google OAuth scopes.
- `tests/race-control/capability-spike.test.ts` covers first activation, stale conditional activation, successful compare-and-swap, unique lost-create reconciliation, primary-calendar exclusion and ambiguous-create review.
- `src/lib/config/schema.ts`, `src/lib/config/public-projection.ts`, `src/lib/config/seed.ts` and `src/lib/race-control/contracts.ts` are the RC-01 typed proposal built on the spike. They are not wired into public or admin runtime paths yet.

## Selected binding/deployment proposal

- Preserve the current website Worker and separately deployed booking-coordinator Worker. Do not migrate the live surface as a side effect of Race Control.
- Add private configuration and media R2 bindings only when RC-02 begins and environment bucket names are supplied. No placeholder production bucket IDs belong in `wrangler.jsonc`.
- Keep one venue coordination atom, but replace long external-I/O `blockConcurrencyWhile` sections with short journal transitions, version checks and persistent fences. Resume durable jobs with alarms; browser polling is observational only.
- Generate Worker binding types after binding changes. Enable logs and traces before a future deployment. No deployment is authorized by this spike.

## External capability gates not claimed

The following require owner identity, OAuth consent, isolated Google calendars and provisioned R2 test buckets. They were not run and are not marked passing:

- owner-owned calendar create, ACL share, probe event, cleanup and delete;
- lost-response reconciliation against the real Calendar list API;
- encrypted refresh-token persistence and revocation;
- live R2 conditional writes and read-after-write behavior;
- Access JWT validation against the real team domain/audience;
- coordinator restart/alarm behavior in the Workers runtime.

The existing seven live Xerom calendars were not created, modified or deleted. Historical smoke-test claims in `QA_REPORT.md` are not reused as RC-00 evidence.

## Setup values required before RC-02/RC-08 integration

- Cloudflare Access team domain, application audience and exact owner email allowlist.
- Venue Google account and consent configuration, client ID/secret and exact callback hostname.
- Separate non-production Calendar account/resources authorized for lifecycle tests.
- Private R2 config/media bucket names for a non-production environment.
- Encryption key secret for the OAuth token envelope.

## Verification

Run `npm test -- tests/race-control/capability-spike.test.ts tests/race-control/contracts.test.ts`, `npm run check`, and `npm run build`. Record actual results in `QA_REPORT.md`; do not infer live integration coverage from these local tests.

## Next package

Review and merge RC-01 contracts, then implement RC-02 owner auth and the private conditional config repository behind unbound/test doubles. Production mutations remain disabled until external capability gates are exercised with isolated resources.
