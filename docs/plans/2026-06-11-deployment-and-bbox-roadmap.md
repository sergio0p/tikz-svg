# Deployment & bounding-box roadmap — deferred work from 2026-06-11 audit

Context: the 2026-06-11 light audit traced the two chronic pain points
("delays in loading pages" and "iffy boundaries needing per-use dimension
tweaks") to deployment drift and a handful of library gaps. The quick wins
were implemented same-day (see §Done below). This plan covers what remains.

## Key facts discovered by the audit

- **Production consumers** (none are in this repo):
  - `~/Dropbox/Teaching/Projects/E510/LECWeb/*.html` — ~24 lecture pages;
    6 call `render()` (repeated-games and arbitrage with 6 diagrams each).
    They import `./tikz-svg/src-v2/index.js` from a **vendored copy** of the
    repo inside LECWeb. That copy was 2 months stale (missing the `d37b742`
    viewBox-clipping fix) until re-synced 2026-06-11.
  - `~/Dropbox/Books/Tropical/newton-polygon-113{,-test}.html` — import from
    **GitHub Pages**: `https://sergio0p.github.io/tikz-svg/src-v2/index.js`.
    One `import { render }` pulls ~54 module files → a waterfall of ~50
    sequential HTTPS requests per page load. This is the main "loading
    delay" the user experiences.
- The auto-viewBox machinery is fundamentally sound (stroke-aware,
  convex-hull-conservative on curves). The instability came from the stale
  copy + the unconditional fonts.ready re-render overwriting manual tweaks.

## Done (2026-06-11, in both src-v2 and src-v3)

- `config.viewBox` (array or string) — explicit viewBox override, wins over
  auto-bounds and transformCanvas. `config.width` / `config.height` set the
  SVG element attributes. Tests: `test/viewport-config.test.js`.
- fonts.ready re-render now **skipped for math-free configs**
  (`configHasMathLabels()` in index.js) — no more double render / viewBox
  clobbering on pages without KaTeX labels.
- KaTeX measurement memoized per (html, fontSize); cache invalidated on
  `document.fonts.ready`.
- `mathjs-shim.js` moved into `src-v2/core/` (and `src-v3/core/`);
  `examples-v2/mathjs-shim.js` is now a back-compat re-export.
- `npm run build` → `dist/tikz-svg.min.js` (esbuild, ESM, ~108 KB, mathjs
  external, sourcemap). Smoke-tested in `test/bundle.test.js`.
- `npm run sync:lecweb` — build + rsync src-v2 + copy bundle into the
  LECWeb vendored copy. Run this after every change to src-v2.
- LECWeb copy re-synced; bundle staged at `LECWeb/tikz-svg/dist/`.

## Remaining work, ranked

### 1. Switch production pages to the single-file bundle — DONE 2026-06-12

- Committed + pushed; GitHub Pages serves `dist/tikz-svg.min.js` (verified
  byte-identical to the local build, and renders correctly in jsdom).
- Both Tropical pages now import the Pages bundle URL.
- All 4 LECWeb pages that actually use tikz-svg (`arbitrage` ×6 diagrams,
  `repeated-games` ×2, `financial-markets`, `automaton_2period`) now import
  `./tikz-svg/dist/tikz-svg.min.js`. (`tree-cutting` and `search-osd` define
  their own local `render()` functions — they never used tikz-svg.)
- Remaining manual step: **open each of the 6 pages in a browser once** to
  visually confirm. Automated checks passed, but no human eyeballs yet.
- Caveat unchanged: pages using string-expression plots need the mathjs UMD
  `<script>` (bundle keeps mathjs external).

### 2. Bounding box: parse rotate/scale in node transforms (medium)

`expandBBoxFromElement()` (src-v2/svg/emitter.js:80) only extracts
`translate(...)` from the transform string; `rotate`/`scale` on the same
node are ignored, so rotated or `nodeScale`d nodes can clip. Fix: parse all
three components, apply a 2×2 transform to the child-extent corners before
`expandBBox`. ~30 lines + tests (rotated rectangle near viewBox edge).

### 3. Bounding box: include arrow-marker extents (low)

Markers live in `<defs>` and never contribute bounds; tips poking past the
viewBox edge are currently hidden by the default 40px padding. Proper fix
requires mapping marker refX/markerWidth to each use site. Low urgency.

### 4. `use as bounding box` path flag (TikZ §15 item 6)

`config.viewBox` now covers the explicit-viewport case. The remaining piece
is the per-path flag (`useAsBoundingBox: true` on a path = viewport follows
that path, other content may overflow). Spec:
`docs/plans/2026-04-17-path-actions-plan.md` §6. Also feeds Animation
Layer 2 camera verbs (`Animation/MUSTADDRESS.md` item 5).

### 5. Bundle hygiene (nice-to-have)

- `index-lite.js` entry registering only circle/rectangle/ellipse for
  diagram-only pages (side-effect shape imports defeat tree-shaking).
- Dynamic-import the plotting evaluator so diagram-only bundles drop it.
- Dedup `<defs>` markers across multiple render() calls on one page.

### 6. Exact Bézier extrema in bounds (very low)

Current regex-over-path-data includes control points → convex hull →
slightly oversized but never clipping. Exact extrema would tighten bounds
for sharply-bent edges. Only worth it if oversized boxes become visible.

## Deployment routine

After any src-v2 change:
1. `npm test`
2. `npm run sync:lecweb` (rebuilds the bundle + syncs the LECWeb copy)
3. Commit + push (GitHub Pages serves the bundle to the Tropical pages
   from `main`).

All consumer pages now import the bundle, so step 2's rsync of raw
`src-v2/` is belt-and-suspenders; the bundle copy is what the pages load.
