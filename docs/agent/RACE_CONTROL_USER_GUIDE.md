# Xerom Race Control user guide

Status: branch-preview operating guide, 2026-09-16. This guide describes the protected non-production preview, not a production cutover.

## Open the preview

- Public site: <https://codex-race-control-working-xerom-website.aaronbasil9400.workers.dev/>
- Race Control schedule: <https://codex-race-control-working-xerom-website.aaronbasil9400.workers.dev/race-control/schedule>
- Race Control bookings: <https://codex-race-control-working-xerom-website.aaronbasil9400.workers.dev/race-control/bookings>

The homepage and public booking pages are open. `/race-control/*` and `/api/admin/*` are protected by Cloudflare Access. Enter the approved owner email, request the One-time PIN, and return to the preview. The current Access policy is intentionally owner-only; add a client viewer only after an explicit policy decision.

## Read the schedule

1. Open **Schedule** and confirm the top banner says **Owner workspace · shared Google Calendar connection active**.
2. Confirm the summary reads **Shared record: Google**, **Calendar health: Live read**, and **Timezone: MYT / Asia/Kuala_Lumpur**.
3. Use **Previous**, **Today**, **Next**, or the date field to move between business dates. The heading updates to the selected date.
4. Every opaque/busy event returned by the private resource or control calendars is shown as unavailable. Transparent/cancelled historical records do not block the live schedule.
5. Select a live event to populate the inspector with booking/block status, resource, time and Calendar summary. For an active grouped booking, the inspector exposes conditional **Check in**, **Complete**, **No-show** and **Cancel** actions; each asks for confirmation and updates all linked Calendar events with the expected version.
6. Use the refresh icon after a Calendar change or owner booking. A live read failure shows **No availability is being claimed**; do not treat a failed read as an open schedule.

On phones the schedule becomes a chronological agenda. On wider screens it is a resource timeline: each row is a real rig/lounge/control Calendar, the hour axis covers that day’s opening window, and each block’s left edge/width represents its actual start/end. The schedule is server-authoritative; a gap in the chart is not a promise of availability until the read succeeds.

## Create a manual owner booking

Use the **New booking** form on Schedule.

- **Start time:** any future minute inside the configured opening hours, for example `4:11 PM`.
- **Duration:** 30, 60 or 120 minutes.
- **Resources:** choose Regular rigs, Pro rigs and/or PS5 lounges; the coordinator allocates the actual free Calendar resources.
- **Customer details:** enter the real walk-in/telephone customer details only when creating a real reservation. Notes are optional.

Manual bookings have no one-hour notice floor, but they still must be in the future, within the existing three-day horizon, inside opening hours, and free on every affected resource/control Calendar. The public customer flow remains on its separately confirmed 60/120-minute and one-hour-notice policy.

The form reports success only after the coordinator verifies all required Calendar events. Refresh the schedule after creation and confirm the new grouped event appears.

## Search and cancel a booking

1. Open **Bookings**.
2. Enter a bounded **Date from** and **Date to** range; optionally enter a booking ID or customer search term.
3. Select **Search Calendar**. Results group linked resource events by private booking ID and show unrecognized manual events as **Calendar block**.
4. For a cancellable reservation, select **Cancel** and confirm the prompt. Cancellation makes all linked events transparent and keeps the historical Calendar record, so the interval is released without erasing the audit trail.

Check-in, completion, no-show and cancellation are available from the inspector for active grouped bookings. Reschedule and extension remain review-driven until quote inputs are available; do not improvise those changes directly in Google Calendar during the demo.

## Block maintenance or a venue closure

Use **Block time** on Schedule. Select **Maintenance** for specific resources or **Venue closure** for the Booking Control calendar, enter an exact start/end and a factual reason, then review before creating. The coordinator checks every affected Calendar and best-effort rolls back partial creation. A block does not automatically cancel customers; resolve conflicts through the owner review flow.

## Settings and content

Resources, Hours & Closures, Pricing, Offers & Packages, Advanced Rules, Website Content, Changes & Activity and Connection are visible in the navigation. Any page marked **Draft surface**, **Not published** or **Setup required** is not live configuration. Do not present a draft value as an active price, offer, hour, capacity or public claim.

## Client demo script

1. Start on the public homepage and show the existing brand, services, prices and visit information.
2. Open the protected Schedule in a second tab and explain that it is the owner front desk over the same private Calendar resources used by booking.
3. Change dates, select one live event, refresh, and show the live-read/error-safe states.
4. If a write demo is required, obtain approval immediately before creating one clearly labelled synthetic booking. Use a future empty slot, verify it appears in Schedule and Bookings, cancel it, then verify the date reports no busy event. Never use a real customer’s details for a demo.
5. End on the public booking page without submitting a real reservation.

For a remote client, screen-share the owner session. Do not send Calendar IDs, service-account credentials, Access tokens/PINs, customer details, or screenshots containing them.

## Troubleshooting

- **Access redirect/302:** the route is protected. Complete the owner One-time PIN flow; a non-allowlisted identity is expected to be denied.
- **Demo fixture banner:** the preview is missing its live server-side bindings or the request is running locally. Local development intentionally uses fixtures.
- **Live Calendar unavailable:** retry once. If it persists, stop; no availability is being claimed and settings publication is not available.
- **Settings say Not published:** this is expected while the R2/runtime-publication gate is closed.
- **A booking is not visible:** confirm the date range/business date, refresh, and search by the grouped booking ID. Never create a second reservation just to probe a missing record.

## Current release boundary

The preview uses a separately deployed coordinator Worker and the existing private Calendars. The production website/coordinator remain unchanged. R2 activation, runtime settings/content publication, Calendar OAuth provisioning, the remaining front-desk action UI, recovery/failure-injection validation, production Turnstile/rate limits and production cutover are still open; see [HANDOFF.md](HANDOFF.md) and [CLIENT_RACE_CONTROL_SETUP.md](CLIENT_RACE_CONTROL_SETUP.md).
