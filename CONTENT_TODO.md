# Content and Owner TODO

Only unresolved or replaceable items belong here. Remove an item only after its replacement is verified and its source is recorded in `RESEARCH.md` or configuration.

## Blocking production launch

- [ ] Confirm the full official address and exact Google Maps place/directions URL.
- [ ] Resolve the hours conflict: the pricing image says 12:00 PM–1:00 AM every day, while a September 7 Instagram post advertises Monday–Thursday 2:00 PM–1:00 AM and Friday–Sunday 12:00 PM–1:00 AM. Also define public-holiday and shortened-hour handling.
- [ ] Confirm whether the advertised 5% Instagram follow-and-tag discount is currently active, how staff verify it, whether it applies during booking or at the venue, which services/add-ons it covers, and whether it can combine with sales.
- [ ] Confirm the maximum controllers supported by each PS5 lounge.
- [ ] Confirm whether `012-940 1440` is both the public call and WhatsApp number, and provide the preferred international display/link format.
- [x] Official logo supplied and converted to a transparent two-color SVG; original retained at `src/assets/brand/xerom-logo-source.png`.
- [ ] Supply or approve production-quality venue, rig, PS5, cafe, and group photography with usage rights.
- [ ] Confirm the cancellation/no-show/late-arrival wording customers should see.
- [ ] Confirm the precise three-day horizon rule: rolling 72 hours or through the third local calendar day.
- [ ] Confirm the current domain and preferred canonical hostname.
- [ ] Provide a privacy contact and approve the short booking/privacy notice.

## Required before booking integration

- [ ] Create and share the 3 Regular Sim, 1 Pro Sim, 2 PS5 Lounge, and Booking Control calendars.
- [ ] Provide server-side calendar IDs through secrets; never paste them into documentation or client code.
- [ ] Create the dedicated Google service account and agree on its calendar permissions.
- [ ] Create Cloudflare Pages, Turnstile, and booking-coordinator Worker resources.
- [ ] Confirm whether optional customer notes should be collected.
- [ ] Confirm event reminder behavior and whether staff want a Calendar event color convention.
- [ ] Confirm the staff-readable booking-title format.

## Content enrichment

- [ ] Confirm the exact Regular and Pro equipment wording from the current pricing image.
- [ ] Provide verified PS5 game titles only if the site should list them.
- [ ] Provide verified sim titles only if the site should list them.
- [ ] Provide cafe menu/highlights and current prices, or approve cafe as atmosphere-only copy with no menu claims.
- [ ] Provide accessibility/parking/transit/landmark information for the Visit page.
- [ ] Select owner-approved Instagram posts or original photos for gallery use.
- [ ] Provide real testimonials only if permission and wording can be verified.

## Temporary asset policy

Mockups and early builds may use clearly labeled placeholders. Placeholder filenames, alt text, and component boundaries must make replacement easy. Do not publish scraped Instagram images or the supplied pricing screenshot as final production assets.
