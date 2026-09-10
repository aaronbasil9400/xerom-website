---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: []
---

# Homepage Surface Brief

## Scope and mode

Homepage marketing surface in Persuade mode with an embedded path into the Operate-mode booking flow. Primary targets are `src/pages/index.astro` and its future responsive components.

## Audience, job, action and proof

Local casual groups arrive mostly on phones from Instagram, Google Maps, Search, WhatsApp, or shared links. Within seconds they should see a welcoming group experience, understand that Xerom offers Regular Sim, Pro Sim, PS5 lounges, and a cafe, see current value, and choose `Book a Session`. Proof comes from real people enjoying the venue, close hardware photography, authoritative prices, and practical visit information.

## Approved direction

Race Control Broadcast with a social rather than competitive interpretation. Approved comp: `.impeccable/mocks/home/race-play-refuel.png`.

The first viewport is dominated by a candid group at the rigs, the `RACE TOGETHER` message, and one strong red booking action. The original fake leaderboard is prohibited. Its replacement is a numbered `01 Race / 02 Play / 03 Refuel` itinerary with small photographic proof and track-like connectors. The second visual band contains independently replaceable Regular Rig, Pro Rig, PS5 Lounge, and Cafe media modules with semantic labels and current pricing.

Mobile is independently composed: compact brand/navigation, group hero, headline, primary action, the three-step itinerary, service modules, and cafe proof. It must not inherit desktop proportions blindly or introduce horizontal page overflow.

## Visual grammar

- Dominant palette: near-black ground, racing red fields, warm white type, restrained graphite dividers.
- Typography: compressed, forward-driving display lettering for short headlines and large numerals; highly legible condensed sans-serif for navigation, labels, prices, forms, and body copy.
- Components: matte broadcast panels, clipped/angled red action shapes, thin track-line connectors, minimal corner rounding, strong active/focus states.
- Depth: real photographic lighting and controlled tonal layering; avoid glass, generic glowing cards, large soft shadows, or corporate whitespace.
- Motion: one purposeful broadcast cue—such as a route line or status sweep—plus clear booking feedback. Respect reduced motion.

## Ingredient and implementation inventory

| Ingredient | Intended medium | Boundary |
|---|---|---|
| XEROM wordmark | Official SVG/transparent PNG | Temporary mockup rendering must be replaced with owner-supplied master |
| Social group hero | Approved optimized raster | Current generated people/venue are placeholders, never presented as documentary proof |
| `RACE TOGETHER` headline | Semantic HTML/CSS | Do not bake core text into imagery |
| `01/02/03` itinerary | Semantic HTML plus authored SVG connector | No fake live status or availability |
| Regular Rig image | Replaceable optimized raster | Use approved real photo before launch |
| Pro Rig image | Replaceable optimized raster | Use approved real photo before launch |
| PS5 Lounge image | Replaceable optimized raster | Use approved real photo before launch |
| Cafe image | Replaceable optimized raster | Visible but secondary; no unverified menu claims |
| Prices and service labels | Typed config rendered as HTML | Server-authoritative and easy to update |
| Primary CTA | Semantic link/button with CSS/SVG treatment | Maintain touch target, focus state and contrast |
| Mobile navigation | Semantic disclosure/dialog pattern | Keyboard, focus trap, escape and screen-reader state required |

Exact palette samples, typeface choices, spacing, component tokens, and motion timings will be extracted from the faithful implementation and recorded in `DESIGN.md` after visual QA.

## Constraints and unresolved decisions

- Black, red, and white remain dominant.
- Avoid corporate minimalism and generic purple/blue gaming aesthetics.
- Do not ship generated slogans, equipment, food, people, or venue scenes as verified facts.
- Resolve hours, promotion rules, cafe content, official logo, and production photography through `CONTENT_TODO.md`.
- The booking UI inherits the same broadcast grammar but prioritizes task clarity, accessibility and error recovery over visual density.
