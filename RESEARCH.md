# Xerom Research Record

Last updated: 2026-09-09

## Research standard

This file distinguishes owner-supplied facts, supplied promotional material, and independently checked technical documentation. Public business facts that cannot be verified are not treated as final. Unknowns are mirrored in `CONTENT_TODO.md`.

## Business evidence

### Confirmed through the owner’s helper

- Inventory: 3 Regular Sim rigs, 1 Pro Sim rig, 2 PS5 lounges.
- Customers choose the sim tier; mixed Regular + Pro group bookings are allowed.
- Sessions are one hour, with a maximum of two hours in one booking.
- Back-to-back sessions are allowed; no reset buffer.
- Instant confirmation when capacity exists; no deposit.
- Multi-resource bookings are required.
- Minimum booking notice: one hour.
- Maximum booking horizon: three days.
- Primary audience: local casual groups; secondary audiences include families and serious sim racers.
- Language: English only for MVP.
- Workflow: visual mockups before code; Playwright-based QA later.

### Supplied current pricing image

The image shows:

- Regular Sim: RM20/hour, displayed previous price RM22/hour.
- Pro Sim: RM30/hour, displayed previous price RM35/hour.
- PS5: RM18/hour for two controllers, displayed previous price RM20/hour.
- Additional PS5 controller: RM3 per controller.
- Advertised additional 5% discount for following and tagging Xerom on Instagram.
- “Open everyday” and “12PM to 1AM.”
- Location shorthand: Bukit Tinggi, Klang.
- Instagram: `xerom.my`.
- Phone/WhatsApp: `012-940 1440`.
- Regular Sim equipment copy: Fanatec wheelbase, modified Fanatec pedals, Fanatec GT3 wheel.
- Pro Sim equipment copy: Fanatec wheelbase, load-cell pedals with haptics, Fanatec GT cockpit, Porsche GT wheel.

The image is suitable for factual reference and concept exploration, but not as the final logo or website photography.

### Official logo

On 2026-09-11 the owner-helper supplied the official XEROM wordmark as a 1548×690 PNG. The visible two-color mark was cropped to an 1119×209 boundary and traced deterministically into separate red and white vector paths at `src/assets/brand/xerom-logo.svg`. The original is retained at `src/assets/brand/xerom-logo-source.png`, and a rasterized vector QA render is stored at `.impeccable/review/logo-vector-preview.png`.

### Owner-supplied production photography

On 2026-09-12 the owner-helper supplied four edited portrait photographs for Regular Rig, Pro Rig, PS5 Lounge, and cafe use. Each was focal-cropped to 4:3 without stretching and exported at 480×360, 800×600, and 1200×900. Exact input hashes, crop offsets, output hashes, alt guidance, and focal guidance are recorded in `src/assets/images/media-manifest.json`. The social-group hero remains an explicitly labelled AI placeholder.

### Public Instagram inspection

The supplied Instagram profile was inspected in the Codex in-app browser on 2026-09-09. The public profile showed 673 followers, 10 following, the display name “XEROM Sim Racing | PS5 | Cafe,” the phrases “Where speed meets comfort” and “FIRST EVER in Klang, Selangor,” and a Google Maps link.

Visible brand/content patterns:

- Dominant black, red, and white.
- Angular X/chequered-racing motifs and red/white illuminated ceiling lines.
- Tight wheel, pedal, cockpit, and racing-screen crops.
- Casual groups visibly smiling and playing together.
- Fast-cut reel-led content mixed with dense promotional posters.
- Community language including “Practice · Improve · Belong.”

A September 7, 2026 promotional post appears to advertise Monday–Thursday 2:00 PM–1:00 AM and Friday–Sunday 12:00 PM–1:00 AM. This conflicts with the supplied pricing image’s “open everyday / 12PM to 1AM” message and therefore remains unresolved.

The supplied Instagram and Google Maps URLs remain the intended primary business sources. The Google Maps page still requires a fuller interactive inspection. Reviews, exact listing details, and asset usage rights remain unverified.

### Owner-confirmed opening hours (2026-09-12)

The owner confirmed opening hours of Monday–Thursday 2:00 PM–1:00 AM and Friday–Sunday 12:00 PM–1:00 AM. This resolves the conflict between the supplied pricing image’s “open everyday / 12PM to 1AM” message and the September 7, 2026 Instagram post in favour of the Instagram weekday schedule. Hours cross midnight, so the close time belongs to the following day. Public-holiday and shortened-hour handling remain unconfirmed and are tracked in `CONTENT_TODO.md`.

Do not substitute similarly named Klang businesses returned by broad search.

## Technical findings

- Cloudflare Pages Functions run server-side logic on the Workers runtime and support bindings.
- Current Cloudflare documentation states that Pages can bind to a Durable Object, but the Durable Object must be created and deployed in a separate Worker; it cannot be deployed inside the Pages project.
- Astro has an official Cloudflare adapter and can access Cloudflare bindings through its server runtime.
- Google Calendar FreeBusy accepts multiple calendar IDs and returns only busy intervals, which fits public availability calculation without exposing event content.
- Google Calendar events support private extended properties and event insertion, which fits searchable application metadata without a separate booking database.
- A service account supports server-to-server Google API access. Resource calendars must be shared with the service account using only the permissions required.

## Primary technical references

- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- Cloudflare Pages bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Astro deployment: https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Google Calendar API reference: https://developers.google.com/workspace/calendar/api/v3/reference
- Google Calendar FreeBusy: https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
- Google Calendar extended properties: https://developers.google.com/workspace/calendar/api/guides/extended-properties
- Google service-account OAuth: https://developers.google.com/identity/protocols/oauth2/service-account

## Research still required

- Reinspect Instagram through project Playwright tests after its browser runtime is configured, and complete the live Google Maps review.
- Confirm the exact formatted address, map place ID/directions link, public-holiday/shortened-hour handling, promotion rules, equipment wording, controller limits, cafe offer, and current imagery with the owner.
- Obtain original or explicitly licensed production assets.

## Race Control technical research — 2026-09-15

Reviewed primary documentation to support the proposed dashboard architecture (not live account verification):

- [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/): direct object access is strongly consistent; caching adds separate freshness considerations.
- [R2 Workers conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/): conditional puts support revision-safe pointer changes; application recovery still handles multi-step publication.
- [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/): eventual consistency makes it unsuitable as the sole authoritative immediate-publication pointer in this design.
- [Calendar ownership](https://developers.google.com/workspace/calendar/api/concepts/events-calendars): creator identity determines initial ownership; avoid inadvertently making the service account the owner of newly provisioned business calendars.
- [Calendar insert](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert) and [delete](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/delete): separate resource lifecycle operations; capabilities/authorization need an isolated-account spike.
- [Conditional Calendar mutations](https://developers.google.com/workspace/calendar/api/guides/version-resources): ETags/If-Match protect updates from stale writers; they do not supply multi-event transactions or conditional insert semantics.
- [Events list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list): dashboard scans must handle pagination, recurrence and cancellations.
- [Owner web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) and [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/): proposed setup and origin-authentication basis.

Owner answers dated 2026-09-15 authorize the expanded front-desk/editing feature scope recorded in PRODUCT.md. Storage selection, no-stacking pricing and deletion-retention guard details are proposed engineering defaults in `docs/RACE_CONTROL_PLAN.md`, not additional confirmed business facts.

## Owner close-out — 2026-09-24

- The owner set the public booking window to rolling 72 hours. The seed uses 4,320 minutes and the deployed policy message now says 72 hours.
- No discounts or previous/compare-at prices are active. Keep the base prices from the supplied current pricing image and the separately confirmed PS5 controller terms.
- The owner confirmed `012-940 1440` as the public phone/WhatsApp. The owner directed us to adopt the existing project address and Maps URL for the current release; they have not been independently verified against the live map listing.
- Weekly hours remain owner-confirmed. Date exceptions in Race Control control booking availability; the owner will announce closures/hour changes on Instagram until a website announcement feature is built.
- Customer policy uses WhatsApp for change/cancellation requests, a 15-minute no-contact late grace period, and the original scheduled end time. No fee, refund, or deposit terms are advertised.
- Keep general Regular and Pro equipment descriptions. The supplied pricing image contains detailed equipment claims, but their current accuracy has not been confirmed; omit those claims along with game titles, menu/prices, amenities, and testimonials until verified.
- The owner asked to leave the current hero and social-share images in place while replacement photos are pending. These and the canonical domain are the only remaining owner launch inputs.
