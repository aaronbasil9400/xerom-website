# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro + TypeScript, deployed to the client-owned Cloudflare Workers account through Workers Builds. Google Calendar is the booking system of record. A separate Cloudflare Worker hosts the Durable Object required for booking serialization; it is not a business-data database.

## Users

The primary customers are local casual groups visiting from phones after discovering Xerom through Instagram, Google Maps, Google Search, WhatsApp, or shared links. Secondary audiences are families and serious sim racers. The public website is English-only for the MVP.

The owner operates bookings through Race Control, a private owner-only front-desk dashboard. Google Calendar remains the persistent booking system of record. The client-owned staging deployment is live on a temporary `workers.dev` hostname; canonical domain cutover is pending.

## Product Purpose

The website helps visitors quickly understand what Xerom offers, see current prices and hours, find the Klang venue, and reserve available sim-racing rigs or PS5 lounges. It also reduces staff coordination work by making private Google Calendar the shared operational view for website bookings, walk-ins, telephone bookings, maintenance, and closures.

Success means a customer can complete an accurate mobile booking with minimal personal data, and the owner can manage daily operations and publish business settings through Race Control without rebuilding the website.

## Positioning

Xerom combines approachable social sim racing, a distinct Pro Sim option, PS5 lounge gaming, and a cafe in one late-opening local venue. The booking mechanism maps each physical rig or lounge to a private resource calendar so staff actions in Google Calendar immediately affect public availability.

## Operating Context

- Business: Xerom SimRacing & Cafe.
- Address and directions: use the existing business profile at 30-1, 3/KS06, Jalan Batu Nilam, Bandar Bukit Tinggi 1, 41200 Klang, Selangor, Malaysia and `https://maps.app.goo.gl/aPavdDoFPr1ywc9W8`; accepted by owner direction on 2026-09-24, not independently reverified.
- Public phone and WhatsApp: `012-940 1440` / `+60129401440`; owner-confirmed on 2026-09-24.
- Opening hours (owner-confirmed 2026-09-12): Monday–Thursday 2:00 PM–1:00 AM, Friday–Sunday 12:00 PM–1:00 AM. Hours cross midnight, so the close time belongs to the following day. Weekly hours apply unless a date-specific exception is entered in Race Control. Closures and hour changes are announced on Instagram `@xerom.my` until the website announcement feature is implemented.
- Resources: 3 Regular Sim rigs, 1 Pro Sim rig, and 2 PS5 lounges.
- Customers choose Regular Sim, Pro Sim, or PS5. A mixed Regular + Pro group booking is permitted.
- Public and owner bookings support 30, 60, 90, and 120 minutes in 30-minute time increments.
- Multiple resources may be booked together, subject to pool capacity.
- Sessions may run back-to-back with no reset buffer.
- Public bookings require at least one hour of notice and may be made up to a rolling 72 hours ahead. Race Control owner bookings may start at any future minute within opening hours and the same rolling 72-hour horizon.
- Available slots receive instant confirmation. Deposits are not required for the MVP.
- Customer-facing change/cancellation requests may arrive through WhatsApp using the booking ID; the owner performs the reservation change in Race Control under the expanded scope.

## Capabilities and Constraints

- Current base prices: Regular Sim RM20/hour, Pro Sim RM30/hour, PS5 lounge RM18/hour for two controllers; each additional PS5 controller is RM3 once per booking. No discounts or compare-at prices are active or displayed per owner direction on 2026-09-24.
- Public bookings collect customer name and mobile/WhatsApp number; email is optional. Public free-text notes are not collected. Race Control may keep operational notes.
- Booking calendars and customer data remain private.
- Server-side availability is authoritative. Client values, displayed availability, price calculations, and resource IDs are never trusted.
- Google Calendar busy intervals, including manually created events, block a resource.
- A dedicated control calendar blocks full-venue closures and special events.
- Cloudflare Turnstile, strict validation, rate limiting, duplicate-submit prevention, and server-side idempotency protect public endpoints.
- Timezone is `Asia/Kuala_Lumpur`.
- Payment processing, deposits, memberships, customer accounts, customer-entered promo codes, WhatsApp Business API automation, automated email confirmations, and leaderboards remain outside this phase. Race Control supports configurable offers, but none are active until the owner supplies and publishes terms.

## Owner update — 2026-09-16 manual booking policy (superseded where noted)

- Race Control/manual owner bookings may start at any future minute inside the configured opening window and do not require the public one-hour notice floor. They retain Calendar availability/control-calendar checks and the rolling 72-hour horizon.
- The 2026-09-22 duration update supersedes this section's earlier manual duration list.

## Brand Commitments

- Use the name “Xerom SimRacing & Cafe.”
- Preserve the recognizable supplied XEROM wordmark. Black, red, and white must remain the dominant identity colors.
- Instagram `@xerom.my` is a primary public identity and photography reference.
- The owner supplied the official XEROM logo raster on 2026-09-11. A deterministic red/white vector trace is stored at `src/assets/brand/xerom-logo.svg`; the original supplied PNG is retained beside it as provenance.
- Tone should welcome casual local groups without alienating families or serious sim racers.
- The marketing sequence should lead with the social group experience, then reveal racing hardware, pricing/value, and booking.
- Avoid an overly corporate or sparse/minimalist presentation. The public Instagram’s energetic posters, close hardware crops, social footage, and illuminated venue geometry are binding reference cues, not production assets to copy blindly.

## Evidence on Hand

- Owner-helper confirmations recorded in the project conversation on 2026-09-09.
- Current pricing promotional image: `/Users/aaronbasil/Desktop/Screenshot 2026-09-09 at 9.13.58 PM.png`.
- Instagram source: `https://www.instagram.com/xerom.my`.
- Google Maps source supplied in the brief: `https://www.google.com/maps/place/Xerom+SimRacing+%26+Cafe/@3.0095979,101.4357844,17z/`.
- The official logo and owner-supplied Regular Rig, Pro Rig, PS5 Lounge, and cafe photography are available in the repository. A new owner photo set supplied on 2026-09-26 provides replacement rig/PS5 imagery and four Xerom Experience photos for the homepage slideshow. The social-group hero and social-share image remain temporary media pending final owner photos; the current cafe image remains while cafe/menu material is pending.
- The public Instagram profile was inspected in an interactive browser on 2026-09-09. Visible cues included black/red/white promotional graphics, close-up racing hardware, casual groups, the venue’s red/white crossed light lines, and the profile language “Where speed meets comfort” and “FIRST EVER in Klang, Selangor.”

## Product Principles

1. Make the next visit obvious: experience, current price, availability, directions, and contact should be reachable within seconds.
2. Let the owner operate through Race Control while retaining Google Calendar as the booking system of record; avoid a duplicate booking database.
3. Confirm only what is actually reserved; serialize, recheck, create all resources, and roll back partial failures.
4. Make changing prices, promotions, equipment copy, hours, and inventory a small configuration edit.
5. Prefer fast, legible mobile interactions over decorative complexity.

## Accessibility & Inclusion

Target WCAG 2.2 AA for the public experience. Booking must support keyboard navigation, screen readers, visible focus, accessible validation, reduced motion, high contrast, and touch targets suitable for phones.

## Race Control scope expansion — owner-confirmed 2026-09-15

- Desktop-first owner front desk, with tablet booking chart and usable mobile agenda. Create/walk-in, check-in, countdown, extension, reschedule, completion, no-show and cancellation are in scope.
- All scoped business information becomes editable: resources, pricing/add-ons, weekly and exception hours, promotions/packages, advanced booking rules, and structured website content/contact/photos. Current confirmed values remain seed defaults until owner changes them.
- Business edits publish without rebuilding/redeploying the website. Evaluate avoiding a separate application database; private versioned object storage plus existing coordination storage is the proposed architecture, not a claim of no persistence.
- Confirmed prices are preserved. Hours changes must review existing bookings outside proposed hours; unresolved conflicts block publishing. No automatic cancellation/customer notification.
- Adding resources automatically provisions calendars after explicit confirmation. Calendar deletion also requires explicit confirmation; history-preserving retirement and nonempty-calendar deletion policy are specified in the plan.
- Preserve the existing visual direction and official wordmark.
- Implementation specification and operating notes: [Race Control plan](docs/RACE_CONTROL_PLAN.md). Agent entry point: [Race Control handoff](docs/agent/RACE_CONTROL_HANDOFF.md). The current client-owned Worker supports live Calendar reads/bookings and reviewed R2 business-settings publication; the activity-history screen remains unavailable.

## Owner update — 2026-09-22 website upgrade

- Public and owner bookings support 30, 60, 90, and 120 minutes in 30-minute availability increments. This supersedes the earlier public 60/120-minute and manual 30/60/120-minute defaults.
- Public bookings may collect an optional email address. If supplied, it must be validated and stored with the private Calendar booking for Race Control and CSV export. Email delivery remains out of scope: `TODO: Implement booking confirmation email backend.`
- A PS5 lounge includes two controllers. Customers may select up to six additional controllers. Each additional controller costs RM3 once per booking, regardless of session length.
- Private R2 configuration/media storage is enabled and bound to the website Worker. Business settings are published through save, impact review and explicit publish; empty storage falls back to the compiled seed.

## Owner close-out — 2026-09-24

- Adopt the current address and Maps URL already in the business profile, and use the confirmed phone/WhatsApp contact. The canonical domain is still pending.
- Use a rolling 72-hour public booking horizon. Date-specific hours in Race Control control availability; announce closures/hour changes on Instagram until an on-site announcement feature is delivered.
- Do not apply discounts or display previous/compare-at prices. Base prices remain Regular RM20/hour, Pro RM30/hour, and PS5 RM18/hour with two controllers; extra controllers are RM3 each per booking, up to six.
- Keep general Regular and Pro equipment descriptions. Omit part/model-level hardware claims until current equipment is confirmed. Do not list game titles, cafe menu/prices, access/parking details, or testimonials without verified source material.
- Cancellation/change requests go to WhatsApp with the booking ID. Use a 15-minute late-arrival grace period; staff may mark a booking as no-show after that without contact. The booked end time remains fixed, and extensions depend on availability and staff confirmation. No cancellation fees, refunds or deposits are claimed.
- Use WhatsApp/phone as the privacy contact. Public booking notes are disabled to minimize collected information; email remains optional and no confirmation email is sent.
- The social-group hero and social-share photos remain owner-input items by explicit direction; keep the current clearly labelled placeholders. The temporary worker hostname remains noindex until the owner supplies the canonical domain.
- No customer reminders or Calendar color convention are configured. Calendar event titles use the existing format `{bookingId} | {SERVICE} | {customerName} | {duration}m`. Historical Calendar events are retained; deletion remains blocked for non-empty resource calendars.
- Terminal Race Control operation records may be retained for 30 days; any unresolved recovery record and its capacity fence must remain until reconciled.
