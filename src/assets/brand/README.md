# Xerom Logo Assets

- `xerom-logo-source.png` is the official 1548×690 raster supplied by the owner-helper on 2026-09-11.
- `xerom-logo.svg` is a deterministic two-layer Potrace conversion cropped to the visible mark. It has a transparent background, an 1119×209 viewBox, white wordmark paths, and red `X` paths using `#ff4939`.

The SVG preserves the supplied source geometry and is the website asset. Do not typeset the wordmark, alter its proportions, or recolor individual paths without owner approval. Maintain clear space around it and use it primarily on dark backgrounds.

The vector conversion is not generative. The source was split into red and white masks, traced independently, and visually compared against a raster render stored at `.impeccable/review/logo-vector-preview.png`.

## Site icon

`public/favicon.svg` reuses the exact red and white X path geometry from the official wordmark. It does not redraw or simplify the mark. `npm run assets:favicon` renders transparent 32px, 180px, 192px, and 512px PNG derivatives for browser, Apple touch, and web-app icon use.
