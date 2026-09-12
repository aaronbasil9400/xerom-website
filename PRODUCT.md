# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro + TypeScript, deployed on Cloudflare Pages with Cloudflare server-side runtime capabilities. Google Calendar is the booking system of record. A small separately deployed Cloudflare Worker may host the Durable Object required for booking serialization; it is not a business-data database.

## Users

The primary customers are local casual groups visiting from phones after discovering Xerom through Instagram, Google Maps, Google Search, WhatsApp, or shared links. Secondary audiences are families and serious sim racers. The public website is English-only for the MVP.

Staff operate bookings through normal private Google Calendars rather than a custom admin portal.

## Product Purpose

The website helps visitors quickly understand what Xerom offers, see current prices and hours, find the Klang venue, and reserve available sim-racing rigs or PS5 lounges. It also reduces staff coordination work by making private Google Calendar the shared operational view for website bookings, walk-ins, telephone bookings, maintenance, and closures.

Success means a customer can complete an accurate mobile booking with minimal personal data, and staff can manage daily availability without learning a custom back office.

## Positioning

Xerom combines approachable social sim racing, a distinct Pro Sim option, PS5 lounge gaming, and a cafe in one late-opening local venue. The booking mechanism maps each physical rig or lounge to a private resource calendar so staff actions in Google Calendar immediately affect public availability.

## Operating Context

- Business: Xerom SimRacing & Cafe.
- Address supplied in the project brief: 30-1, 3/KS06, Jalan Batu Nilam, Bandar Bukit Tinggi 1, 41200 Klang, Selangor, Malaysia. Owner verification remains open.
- Phone and WhatsApp: `012-940 1440`, as shown in the supplied current pricing image.
- Advertised opening hours: every day, 12:00 PM–1:00 AM. Owner verification remains open because the hours cross midnight.
- Resources: 3 Regular Sim rigs, 1 Pro Sim rig, and 2 PS5 lounges.
- Customers choose Regular Sim, Pro Sim, or PS5. A mixed Regular + Pro group booking is permitted.
- Sessions are one hour. A booking may contain one or two consecutive hours; longer visits require another booking.
- Multiple resources may be booked together, subject to pool capacity.
- Sessions may run back-to-back with no reset buffer.
- Bookings require at least one hour of notice and may be made up to three days ahead.
- Available slots receive instant confirmation. Deposits are not required for the MVP.
- Customer-facing changes and cancellations are handled through WhatsApp using the booking ID.

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
- Payment processing, deposits, memberships, customer accounts, promo-code engines, WhatsApp Business API automation, leaderboards, and custom administration are outside MVP scope.

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
2. Let staff operate from Google Calendar; avoid duplicating operational state in a custom system.
3. Confirm only what is actually reserved; serialize, recheck, create all resources, and roll back partial failures.
4. Make changing prices, promotions, equipment copy, hours, and inventory a small configuration edit.
5. Prefer fast, legible mobile interactions over decorative complexity.

## Accessibility & Inclusion

Target WCAG 2.2 AA for the public experience. Booking must support keyboard navigation, screen readers, visible focus, accessible validation, reduced motion, high contrast, and touch targets suitable for phones.
