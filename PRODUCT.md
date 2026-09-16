# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro + TypeScript, deployed on Cloudflare Pages with Cloudflare server-side runtime capabilities. Google Calendar is the booking system of record. A small separately deployed Cloudflare Worker may host the Durable Object required for booking serialization; it is not a business-data database.

## Users

The primary customers are local casual groups visiting from phones after discovering Xerom through Instagram, Google Maps, Google Search, WhatsApp, or shared links. Secondary audiences are families and serious sim racers. The public website is English-only for the MVP.

The owner will operate bookings through Race Control, a private owner-only front-desk dashboard. Google Calendar remains the persistent booking system of record. This expanded scope was confirmed on 2026-09-15; dashboard implementation is planned, not shipped.

## Product Purpose

The website helps visitors quickly understand what Xerom offers, see current prices and hours, find the Klang venue, and reserve available sim-racing rigs or PS5 lounges. It also reduces staff coordination work by making private Google Calendar the shared operational view for website bookings, walk-ins, telephone bookings, maintenance, and closures.

Success means a customer can complete an accurate mobile booking with minimal personal data, and the owner can manage daily operations and publish business settings through Race Control without rebuilding the website.

## Positioning

Xerom combines approachable social sim racing, a distinct Pro Sim option, PS5 lounge gaming, and a cafe in one late-opening local venue. The booking mechanism maps each physical rig or lounge to a private resource calendar so staff actions in Google Calendar immediately affect public availability.

## Operating Context

- Business: Xerom SimRacing & Cafe.
- Address supplied in the project brief: 30-1, 3/KS06, Jalan Batu Nilam, Bandar Bukit Tinggi 1, 41200 Klang, Selangor, Malaysia. Owner verification remains open.
- Phone and WhatsApp: `012-940 1440`, as shown in the supplied current pricing image.
- Opening hours (owner-confirmed 2026-09-12): Monday–Thursday 2:00 PM–1:00 AM, Friday–Sunday 12:00 PM–1:00 AM. Hours cross midnight, so the close time belongs to the following day. Public-holiday and shortened-hour handling remain unconfirmed.
- Resources: 3 Regular Sim rigs, 1 Pro Sim rig, and 2 PS5 lounges.
- Customers choose Regular Sim, Pro Sim, or PS5. A mixed Regular + Pro group booking is permitted.
- Sessions are one hour. A booking may contain one or two consecutive hours; longer visits require another booking.
- Multiple resources may be booked together, subject to pool capacity.
- Sessions may run back-to-back with no reset buffer.
- Bookings require at least one hour of notice and may be made up to three days ahead.
- Available slots receive instant confirmation. Deposits are not required for the MVP.
- Customer-facing change/cancellation requests may arrive through WhatsApp using the booking ID; the owner performs the reservation change in Race Control under the expanded scope.

## Capabilities and Constraints

- Current base prices: Regular Sim RM20/hour, Pro Sim RM30/hour, PS5 lounge RM18/hour for two controllers; each additional PS5 controller is RM3. Pricing must be centralized and easy to change for sales or equipment changes.
- A supplied promotion advertises an additional 5% discount for following and tagging Xerom on Instagram. Its active dates, redemption timing, and booking treatment remain open.
- Public bookings collect customer name and mobile/WhatsApp number. Notes may be optional. Email and customer accounts are out of scope unless a later requirement justifies them.
- Booking calendars and customer data remain private.
- Server-side availability is authoritative. Client values, displayed availability, price calculations, and resource IDs are never trusted.
- Google Calendar busy intervals, including manually created events, block a resource.
- A dedicated control calendar blocks full-venue closures and special events.
- Cloudflare Turnstile, strict validation, rate limiting, duplicate-submit prevention, and server-side idempotency protect public endpoints.
- Timezone is `Asia/Kuala_Lumpur`.
- Payment processing, deposits, memberships, customer accounts, customer-entered promo codes, WhatsApp Business API automation, and leaderboards remain outside this phase. Owner-only administration, percentage/day-based promotions and duration packages are included in the 2026-09-15 expansion; actual offer values require owner input.

## Owner update — 2026-09-16 manual booking policy

- Race Control/manual owner bookings may start at any minute inside the configured opening window and no longer require one hour of advance notice. The start must still be in the future, within the existing three-day horizon, and pass Calendar availability/control-calendar checks.
- Manual owner bookings support 30, 60, and 120 minutes. This is an owner front-desk policy; the public customer flow remains 60/120 minutes with one-hour notice until the owner explicitly changes and publishes that customer-facing rule.

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
- The official logo and owner-supplied Regular Rig, Pro Rig, PS5 Lounge, and cafe photography are available in the repository. Only the social-group hero remains placeholder media pending the final owner photo.
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
- Implementation specification and proposed engineering defaults: [Race Control plan](docs/RACE_CONTROL_PLAN.md). Agent entry point: [Race Control handoff](docs/agent/RACE_CONTROL_HANDOFF.md). These documents describe planned behavior; they do not certify implementation.
