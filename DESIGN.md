---
version: alpha
name: Xerom Race Control Broadcast
description: A crew-first race-night identity built from broadcast panels, racing red, compressed type, and track-line navigation.
colors:
  primary-racing-red: "#f02f2a"
  action-racing-red: "#d12a25"
  action-racing-red-hover: "#b92320"
  primary-red-dark: "#a91616"
  official-logo-red: "#ff4939"
  canvas-black: "#080808"
  panel-black: "#111111"
  panel-raised: "#181818"
  structural-line: "#383838"
  text-muted: "#bcb8b0"
  text-warm-white: "#f5f2ea"
  text-on-red: "#ffffff"
  focus-amber: "#ffd166"
  error-coral: "#ff9d97"
  warning-panel: "#221d0d"
  warning-line: "#8b732b"
  warning-text: "#fff1b7"
typography:
  display-hero:
    fontFamily: "Racing Sans One, Barlow Condensed, sans-serif"
    fontSize: "10.5rem"
    fontWeight: 400
    lineHeight: 0.68
    letterSpacing: "-0.03em"
  display-section:
    fontFamily: "Racing Sans One, Barlow Condensed, sans-serif"
    fontSize: "5.5rem"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  title-control:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "2rem"
    fontWeight: 900
    lineHeight: 0.9
  label-action:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  body-lede:
    fontFamily: "Barlow, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 400
    lineHeight: 1.55
  label-data:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.06em"
rounded:
  none: "0px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.25rem"
  xl: "2rem"
  xxl: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.action-racing-red}"
    textColor: "{colors.text-on-red}"
    typography: "{typography.label-action}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1.7rem"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.action-racing-red-hover}"
    textColor: "{colors.text-on-red}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-warm-white}"
    typography: "{typography.label-action}"
    rounded: "{rounded.none}"
    padding: "0.75rem 1.25rem"
    height: "3.25rem"
  field:
    backgroundColor: "{colors.canvas-black}"
    textColor: "{colors.text-warm-white}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.8rem 1rem"
    height: "3.25rem"
  booking-progress-current:
    backgroundColor: "{colors.action-racing-red}"
    textColor: "{colors.text-on-red}"
    typography: "{typography.label-action}"
    rounded: "{rounded.none}"
    padding: "1rem"
---

# Design System: Xerom Race Control Broadcast

## Overview

**Creative North Star: "Race Control Broadcast"**

Xerom should feel like the shared race night has already started: a near-black broadcast desk cut by racing-red signals, warm-white compressed type, venue imagery, and the track-like route through Race, Play, and Refuel. It is social before it is technical. People and the promise of time together establish the first impression; hardware, live prices, and booking controls supply proof.

The system is direct, kinetic, and operational without becoming a generic esports dashboard. Rectangular panels, fine structural strokes, clipped action controls, and sparse circular markers make the surface feel assembled for a live event. The official red-and-white Xerom wordmark remains an authored brand asset and is never reconstructed from type.

Production service imagery is owner-approved Xerom photography. The Regular Rig, Pro Rig, PS5 Lounge, and cafe rasters are real owner-supplied media with deterministic 4:3 derivatives recorded in `src/assets/images/media-manifest.json`. Only the social-group hero remains an explicitly named AI placeholder and may demonstrate composition only; it is not evidence of the real venue or customers.

**Key Characteristics:**

- Crew-first photography and action-led language.
- Owner-supplied service photography with one explicit social-group hero replacement gate.
- Near-black tonal panels separated by thin technical rules.
- Bright brand red reserved for display signals and price emphasis; the deeper action red carries white text and selected states.
- Compressed uppercase typography with oversized, tightly stacked display words.
- Route connectors, numbered stages, clipped controls, and square-ended line icons.
- Booking presented as an extension of race control, not a separate generic form.

## Colors

The palette is a night venue under broadcast lighting: black layers carry the interface, warm white carries reading, bright red draws the racing route, and a deeper red gives filled controls sufficient contrast with white text.

### Primary

- **Bright Racing Red** (`{colors.primary-racing-red}`): Brand/display accent for hero words, route lines and nodes, price emphasis, booking IDs, scrollbar detail, and decorative telemetry marks. It is not a white-text control fill.
- **Action Racing Red** (`{colors.action-racing-red}`): Filled primary buttons, selected duration and time controls, current booking progress, success marks, and the full-width signal band. White on this red is 5.16:1 in the shipped contrast audit.
- **Action Red Hover** (`{colors.action-racing-red-hover}`): Darker hover fill for primary actions; it retains strong white-text contrast while keeping the interaction visibly red.
- **Deep Red** (`{colors.primary-red-dark}`): A darker red reserve for future pressed or low-light accent treatment; it must remain subordinate to the two shipped interface reds.
- **Official Logo Red** (`{colors.official-logo-red}`): Intrinsic red path in the owner-supplied official SVG trace. It belongs to the logo asset only and is not substituted for either interface red.

### Neutral

- **Canvas Black** (`{colors.canvas-black}`): Page background, inset fields, and the deepest layer.
- **Broadcast Panel** (`{colors.panel-black}`): Cards, booking shells, route panels, and CTA surfaces.
- **Raised Control Black** (`{colors.panel-raised}`): Compact interactive controls such as steppers.
- **Structural Line** (`{colors.structural-line}`): One-pixel panel divisions, field borders, and list rules.
- **Warm White** (`{colors.text-warm-white}`): Primary type and high-contrast outlines.
- **Muted Warm Gray** (`{colors.text-muted}`): Supporting copy, secondary navigation, captions, and metadata.

### Tertiary

- **Focus Amber** (`{colors.focus-amber}`): Keyboard focus and text selection only; it is an accessibility signal, not a decorative brand accent.
- **Error Coral** (`{colors.error-coral}`): Form failure copy against dark panels.
- **Warm Warning Set** (`{colors.warning-panel}`, `{colors.warning-line}`, `{colors.warning-text}`): Unresolved or operational notices that must be distinct from booking errors.

### Named Rules

**The Two-Red Rule.** Bright Racing Red announces brand and display information. Action Racing Red carries white text, selection, progress, success, and filled controls. Never swap the bright accent into a normal-sized white-text control.

**The Amber Means Keyboard Rule.** Focus Amber is reserved for visible focus and selection feedback so keyboard state is never confused with brand emphasis.

## Typography

**Display Font:** Racing Sans One, falling back to Barlow Condensed and sans-serif.  
**Control Font:** Barlow Condensed, falling back to sans-serif.  
**Body Font:** Barlow, falling back to sans-serif.

**Character:** Racing Sans One supplies the headline mass of a race poster; Barlow Condensed makes navigation, prices, labels, and booking controls scan like a broadcast rundown; Barlow keeps explanations calm and readable. Display and control language is mostly uppercase, while paragraph copy remains sentence case.

### Hierarchy

- **Hero Display** (`{typography.display-hero}`): The stacked first-viewport promise. The implementation scales it fluidly down from its 10.5rem ceiling and tightens to 0.68 line height.
- **Section Display** (`{typography.display-section}`): Short section titles with a maximum measure around 12 characters and fluid scaling below the 5.5rem ceiling.
- **Control Title** (`{typography.title-control}`): Italic, compressed titles for booking steps, cards, prices, and numbered route stages.
- **Action Label** (`{typography.label-action}`): Uppercase navigation and button text; buttons add italic posture while navigation stays upright.
- **Body** (`{typography.body}`): Explanations and operational text, generally limited to 56–65 characters where the layout provides a long measure.
- **Lede** (`{typography.body-lede}`): Section introductions and booking invitations in muted warm gray.
- **Data Label** (`{typography.label-data}`): Compact uppercase labels above prices and other proof values.

### Named Rules

**The Three-Voice Rule.** Racing Sans One announces, Barlow Condensed directs, and Barlow explains. Do not interchange those jobs merely to add variety.

**The Short-Lap Rule.** Oversized display type is for brief phrases that can be read in one glance. Longer copy returns to Barlow rather than shrinking the display face into paragraph work.

## Layout

The shared shell is centered within an 88rem maximum width and ordinarily leaves 1rem at each side; below 560px that outer gutter contracts to 0.5rem. Vertical sections use a fluid 4.5rem–9rem rhythm. Layout is panel-based, with one-pixel seams and deliberate 1px grid gaps reinforcing the broadcast assembly.

The shipped homepage first viewport is a cinematic full-width crew image with a strong lower-left copy block. Its semantic headline is exactly `Race Together`; Klang is kept in a separate location cue. A desktop experience dock overlaps the hero's lower edge and links Race, Play, and Refuel to the corresponding page sections. Tablet retains the dock as a three-column strip. At 560px and below, the dock is hidden because the compact Pick Your Pace cards already provide sufficient service navigation; the phone reading order is hero, session cards, Choose Your Setup comparison, practical hours/location, and final booking action.

The implementation has two responsive thresholds: 900px reorganizes major grids and replaces desktop navigation with the menu; 560px performs the phone-specific composition. Every change must still be inspected at 375, 390, 430, 768, 1024, and 1440+ CSS pixels because the approved phone composition is not just a compressed desktop.

Booking layouts inherit the same geometry. The shell is a bordered broadcast panel; progress is a three-cell strip; quantity rows, duration choices, slots, review blocks, and fields form an inset control grid. Two-column field and visit layouts collapse to one column on phones. Touch actions maintain a minimum implemented height of 3.25rem.

**The Story Before Specification Rule.** Preserve the sequence: people and shared-night promise, clear booking action, service/price proof, Race / Play / Refuel experience route, setup comparison, practical visit information, then a final booking action.

## Elevation & Depth

The system is flat by default. Depth comes primarily from tonal black layers, one-pixel structural borders, photographic overlays, and occasional offset red geometry. Shadows are reserved for surfaces that genuinely float: the sticky translucent header, the mobile menu, and the legibility shadow beneath the hero headline.

### Shadow Vocabulary

- **Sticky Broadcast Bar** (`0 12px 34px rgba(0,0,0,.3)`): Supports the translucent sticky header over moving page content.
- **Mobile Menu Lift** (`0 16px 32px rgba(0,0,0,.45)`): Separates the open menu from the page below.
- **Hero Type Legibility** (`0 10px 32px rgba(0,0,0,.55)`): Protects the oversized title over photography; never use as a generic text effect.

### Named Rules

**The Flat Control Room Rule.** Resting cards and fields use tone plus border, not drop shadows. Elevation is functional and rare.

## Shapes

The core form language is square and engineered: panels, cards, fields, booking rows, and status blocks use hard 0px corners. Primary actions are clipped into a skewed racing plate using `polygon(7% 0, 100% 0, 93% 100%, 0 100%)`. Circles are reserved for route nodes, round links, and large background telemetry rings; small square diamonds mark feature bullets. Fine red outlines and repeating dash marks may extend beyond an image frame to imply equipment alignment or a traced course.

Functional interface icons follow one SVG grammar: unfilled 24×24 geometry, current-color stroke, 1.8 stroke width, square line caps, and miter joins. The canonical arrow is a simple rightward shaft and angled head. Icons support a text action and never replace an accessible label by themselves.

The brand glyph is the deliberate exception to the stroked icon family. `public/favicon.svg` reuses the exact red and white X path geometry from the official wordmark, cropped to a 333×209 viewBox; it is neither redrawn nor simplified. Its transparent 32px favicon, 180px Apple touch icon, and 192px and 512px web-app derivatives belong to the same official mark family. Preserve the intrinsic Official Logo Red and white fills.

**The Hard Panel, Fast Edge Rule.** Default to square panels and fields. Use the clipped plate for decisive actions and a true circle only for a marker or compact icon control.

## Components

### Buttons

- **Shape:** Square secondary controls use `{rounded.none}`; the primary uses the signature clipped racing plate.
- **Primary:** Action Racing Red with white text at 5.16:1 contrast, compressed italic uppercase labeling, a 3.25rem minimum height, and wider horizontal padding. The hero instance rises to 4.2rem and becomes the dominant booking action.
- **Hover / Focus / Active:** Hover lifts by 2px over 300ms using the shipped ease-out curve and darkens to `{components.button-primary-hover.backgroundColor}`. Focus uses the global 3px Focus Amber outline with a 4px offset. Disabled booking actions retain their geometry but become grayscale at 50% opacity and never lift.
- **Secondary:** Transparent black-ground control with a Warm White one-pixel border; hover inverts to Warm White with Canvas Black text.

### Cards / Containers

- **Corner Style:** Hard 0px corners.
- **Background:** Broadcast Panel over Canvas Black.
- **Shadow Strategy:** Flat; hierarchy comes from the Structural Line border and media contrast.
- **Internal Padding:** Primarily 1rem, expanding to 2rem–5rem in the large CTA panel.
- **Media:** Regular Rig, Pro Rig, PS5 Lounge, and Cafe cards use owner-supplied production photographs. Each family has verified 480×360, 800×600, and 1200×900 JPEG derivatives and focal/crop guidance in `src/assets/images/media-manifest.json`; Astro imports the 1200px master and generates optimized delivery formats. The design may crop these 4:3 sources to square route tiles, 16:9 homepage proof cards, 4:3 hardware frames, or compact phone rows only while preserving the documented subject focal point. The Regular Rig is a reviewed exception with exact responsive behavior: its desktop/tablet 16:9 card uses `object-position: 43% 58%` so the Fanatec marking remains visible, while phone rows at 560px and below reset to `object-position: center`. Experience media enlarges subtly to 1.035 scale over 800ms on hover. The 16:9 social-group hero remains AI placeholder media and must keep placeholder filename and alt language until owner-approved photography replaces it.

**The Provenance Gate Rule.** A service photograph may be treated as production media only when its owner-supplied status and derivatives are recorded in the media manifest. The current social-group hero does not pass that gate.

### Inputs / Fields

- **Style:** Canvas Black field, Warm White text, Structural Line one-pixel border, square corners, and 0.8rem × 1rem padding.
- **Focus:** The shared 3px Focus Amber outline with 4px offset remains fully visible; radio controls transfer that outline to their visual label.
- **Error / Disabled:** Error copy uses Error Coral with a reserved minimum-height region to prevent layout jumps. Disabled actions use grayscale and 50% opacity. Carets use Bright Racing Red.

### Navigation

The sticky header is a translucent Canvas Black broadcast bar with a fine Warm White mixed border and 16px backdrop blur. The owner-supplied deterministic SVG trace at `src/assets/brand/xerom-logo.svg` anchors the left at a fluid 7.8rem–11rem width; the footer uses the same asset at 8.5rem. Compressed uppercase service links and a Klang location cue occupy the desktop center, and the primary booking action closes the right. Below 900px, the navigation links move into a two-line menu while a compact always-visible Book pill remains in the header. The opened menu is keyboard-contained, Escape-dismissable, and moves focus into its first link.

### Race / Play / Refuel Route

The route is a three-cell experience dock. Each cell pairs owner service imagery with an ordinal, Race / Play / Refuel label, short safe copy, and a directional affordance. It is a visual itinerary, not a leaderboard or ranking. Desktop overlaps the dock across the hero's lower edge and tablet retains a compact three-column presentation. The dock is intentionally absent at the 560px phone breakpoint because Pick Your Pace immediately provides the same service routes.

### Session Price Proof

Price proof lives in the Pick Your Pace section immediately after the hero on phones and after the overlapping dock on desktop. Four semantic cards present Regular Rig, Pro Rig, PS5 Lounge, and Cafe using centralized price/service configuration and owner-supplied imagery. Cards stay compact on phones so users see real choices quickly. Cafe remains a service route rather than an invented menu or price claim.

### Opening Hours

The homepage presents opening hours beside the verified Klang location cue in a dedicated practical-information section after Choose Your Setup. Hours derive from the same centralized `bookingRules.weeklyHours` configuration that drives availability, so published hours and bookable slots cannot drift. The Visit page renders the same configuration as a compact row list.

### Booking Controls

The three-step booking flow uses an Action Racing Red current-progress cell, bordered quantity rows with compact steppers, full-width selectable duration and time controls, and a dark-red review block. Selected choices and the success mark use Action Racing Red plus white rather than relying on border alone; the oversized booking ID remains Bright Racing Red display information. Status copy uses a polite live region and failures use alert semantics.

### Race Control / Owner Operate Shell

Race Control is the private owner front-desk surface and keeps the Broadcast language in a denser, utility-first composition. This guidance describes the verified shell only: the current implementation is a demo fixture with draft controls and no live Calendar or publishing mutation. Future connected screens must preserve the visual distinction while deriving operational truth from the approved contracts and architecture.

- **Topbar:** Keep the compact sticky topbar at roughly 4rem / 64px, with the unchanged official XEROM SVG, concise `Race Control` / `Owner front desk` lockup, sync-status indicator, refresh affordance, and clipped `New booking` action. Do not introduce a marketing hero or public-site navigation treatment.
- **Desktop frame:** Use a two-column shell with a 13.5rem navigation rail and flexible work area. At the 1440px reference width, schedule reserves a 21rem inspector column beside the agenda. Active navigation uses a restrained inset racing-red rule.
- **Schedule toolbar:** Keep date navigation, Day / Agenda mode, service filter, search, block-time, and New booking in one bordered control band above summary metrics. Disabled demo controls remain visibly disabled.
- **Agenda and inspector:** Desktop uses a horizontally inspectable resource timeline with one-pixel grid rules, compact time labels, status dots, red booking blocks, and amber maintenance / blocked blocks. Between 701px and 1279px, the inspector becomes a fixed right-side overlay with functional shadow; at 1440px and above it returns to the reserved grid column.
- **Phone agenda:** Below 560px, replace the wide timeline with a chronological list preserving time-first scanning, resource/service context, status, and an explicit action affordance.
- **Page titles and states:** Use compact approximately 2rem italic condensed titles. `Demo fixture`, `Draft surface`, `Owner review required`, `Not published`, and `Setup required` use the warm warning treatment so provisional state is unmistakable and never confused with an error or live success.
- **Forms and records:** Editors, tables, activity streams, connection status, and inspector details stay rectangular, border-led, and tightly padded. Use condensed uppercase data labels, warm-white values, muted metadata, and red only for active/brand signals.

**The Operate, Don’t Market Rule.** Race Control should read like a calm owner instrument panel: schedule, state, impact, and next action first. Never import the public homepage’s cinematic hero, promotional route, invented operational claims, or decorative density into this shell.

## Do's and Don'ts

### Do:

- **Do** lead shared marketing surfaces with people enjoying the venue before equipment detail and booking mechanics.
- **Do** preserve the Race / Play / Refuel route as an itinerary with the 01 / 02 / 03 order.
- **Do** use the owner-supplied deterministic trace at `src/assets/brand/xerom-logo.svg` unchanged in color, path geometry, and aspect ratio.
- **Do** use Action Racing Red behind normal-sized white text and reserve Bright Racing Red for unfilled display accents.
- **Do** keep prices, services, hours, and other business facts sourced from centralized configuration and confirmed project documentation.
- **Do** preserve visible Focus Amber focus, keyboard menu behavior, 3.25rem control heights, semantic live/error states, and reduced-motion handling.
- **Do** keep the social-group hero labelled as placeholder material in source and alt text until owner-approved Xerom photography replaces it.

### Don't:

- **Don't** reintroduce a leaderboard, ranking metaphor, or generic neon gaming dashboard.
- **Don't** invent venue, equipment, cafe, promotion, capacity, or customer-proof claims to fill a composition.
- **Don't** redraw, typeset, recolor, distort, or decorate the official Xerom wordmark without explicit owner approval.
- **Don't** treat the generated social-group hero as production truth or imply that its people or venue depict real Xerom customers or premises.
- **Don't** round every container, add ambient card shadows, or use either interface red as undifferentiated decoration.
- **Don't** hide active, selected, error, or focus state behind motion or color differences that disappear in reduced-motion or keyboard use.
