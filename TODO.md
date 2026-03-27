# TikZ-SVG: Remaining Tasks

## Status: Major improvements in src-v2/ (2026-03-23), QA ongoing

---

## ✅ DONE (src-v2): Label-size-aware edge label placement

Node-based labels with TikZ-faithful anchor selection. See `docs/superpowers/specs/2026-03-22-anchor-based-label-positioning-design.md`.

## ✅ DONE (src-v2): Outer sep (edge-to-node clearance)

All 14 shapes support `outerSep`. Default: `0.5 × strokeWidth`. Source: `pgfmoduleshapes.code.tex` lines 1249-1327.

## ✅ DONE (src-v2): Path shortening (shorten < / shorten >)

All edge types. Automata default: `shortenEnd: 1`. Source: `tikz.code.tex` lines 1198-1199.

## ✅ DONE (src-v2): Loop geometry

TikZ-faithful angles, looseness=8, minDistance=20. Source: `tikzlibrarytopaths.code.tex` lines 364-375.

## ✅ DONE (src-v2): 16 shapes total

circle, rectangle, ellipse (hand-rolled) + diamond, star, regular polygon, trapezium, semicircle, isosceles triangle, kite, dart, circular sector, cylinder, rectangle split, circle split, ellipse split (via `createShape` factory). Source: `pgflibraryshapes.geometric.code.tex`, `pgflibraryshapes.multipart.code.tex`.

### Multipart shapes (rectangle split, circle split, ellipse split)
- **partFills**: array of fill colors, one per part — uses SVG clipPath + per-part rects
- **partAlign**: `'left'` | `'center'` | `'right'` — text alignment following shape boundary curve
- **Array labels**: `label: ['A', 'B', ...]` renders one text per part
- **drawSplits**: toggle chord/divider line visibility
- Shared helpers in `shapes/split-utils.js`

## ✅ DONE (src-v2): Generic emitter fallback

New shapes render via `shape.backgroundPath()` as `<path>` elements. No new switch cases needed for future shapes.

---

## ✅ DONE (src-v2): Arrow tip registry (18 tips + aliases)

ArrowTipRegistry with 18 built-in tips + 9 aliases from `pgflibraryarrows.meta.code.tex`, fully wired to the render pipeline via `geometry/arrows.js`. Auto-shortening from `pgfcorearrows.code.tex`. Supports `fillMode` (filled/stroke/both) and `open` parameter.

## ✅ DONE (src-v2): Named styles, groups, and pipeline transforms

Style registry (`style/registry.js`) with `config.styles` for reusable named bundles. Node/edge groups (`config.groups`) for shared styles. Global and per-group coordinate transforms (`config.transform`). Cascade: `DEFAULTS → stateStyle/edgeStyle → group → named style + per-element`.

## ✅ DONE (src-v2): Decorations (path morphing)

`decorations/` module with `morphPath()` pipeline — random steps + rounded corners. Supports edges and node borders via `decoration` style property. Seeded PRNG (`core/random.js`) for determinism. Built-in named style `wavy`. Source: `pgfmoduledecorations.code.tex`, `pgflibrarydecorations.pathmorphing.code.tex`.

---

## TODO: KaTeX math rendering in node/label content

Replace plain `<text>` content with KaTeX SVG output for proper math typesetting. Needed for: subscripts (`q_a`), fractions (`\frac{1-p}{p}`), and any LaTeX math in labels — common in econ/game theory automata.

### Architecture

1. **KaTeX renders to SVG paths** — full math coverage
2. **Inject SVG into node `<g>`** — extract KaTeX's SVG output
3. **Styling via SVG `fill` inheritance** — color, per-element coloring
4. **Font size via KaTeX render option** — pass `fontSize` before rendering
5. **Transforms via SVG `transform`** — native SVG, works with `Transform` class
6. **`getBBox()` works** — replaces character-count text estimator

### Dependencies

- KaTeX (~300KB) optional — loaded when math content is detected
- Falls back to plain `<text>` when not available

---

## ✅ DONE: Skill — tikz-svg library builder

Skill at `.claude/skills/tikz-svg-builder/`. Invoked via `/tikz-svg-builder`.

---

## TODO: Visual QA of new shapes

Open demos with new shapes (diamond, star, polygon, etc.) in browser and verify rendering. Create demo HTML pages for the new shapes in `examples-v2/`.

---

## TODO: LECWeb migration

Migration script ready but NOT run. Pending full visual validation.

```bash
sed -i '' 's|/tikz-svg/src/automata/automata.js|/tikz-svg/src-v2/automata/automata.js|g' \
  /Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/arbitrage.html \
  /Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/financial-markets.html
```

---

## TODO: Pixel-level comparison with native TikZ

Compile `example6-turing.tex` natively and compare against our rendering.

---

## Architecture reference

```
src-v2/
  core/math.js          — vector math, Bézier, angles
  core/constants.js     — DIRECTIONS table, DEFAULTS
  core/resolve-point.js — universal coordinate resolver
  core/transform.js     — 2D affine transform matrix + scoped stack
  core/arrow-tips.js    — arrow tip registry + 18 built-in tip definitions + aliases
  core/path.js          — soft-path builder with segment model + SVG serialization
  core/random.js        — seeded PRNG for deterministic decorations
  shapes/shape.js       — shape registry + createShape factory + polygonBorderPoint
  shapes/circle.js      — circle (hand-rolled, outerSep)
  shapes/rectangle.js   — rectangle (hand-rolled, outerSep)
  shapes/ellipse.js     — ellipse (hand-rolled, outerSep)
  shapes/diamond.js     — diamond (factory)
  shapes/star.js        — N-pointed star (factory)
  shapes/regular-polygon.js — N-sided polygon (factory)
  shapes/trapezium.js   — trapezium with angled sides (factory)
  shapes/semicircle.js  — half circle (factory)
  shapes/isosceles-triangle.js — triangle with apex (factory)
  shapes/kite.js        — kite quadrilateral (factory)
  shapes/dart.js        — arrowhead shape (factory)
  shapes/circular-sector.js — pie slice (factory)
  shapes/cylinder.js    — 3D cylinder projection (factory)
  shapes/split-utils.js — shared helpers for multipart shapes
  shapes/rectangle-split.js — N-part divided rectangle (factory, multipart)
  shapes/circle-split.js    — N-part divided circle (factory, multipart)
  shapes/ellipse-split.js   — N-part divided ellipse (factory, multipart)
  positioning/positioning.js — topological sort + direction table positioning
  geometry/edges.js     — straight, bent, loop edges + shorten
  geometry/arrows.js    — bridges arrow-tips registry to pipeline + auto-shortening
  geometry/labels.js    — node-based label positioning with anchor selection
  decorations/index.js  — morphPath() pipeline + decoration style integration
  decorations/path-utils.js  — SVG path parsing, sampling, reconstruction
  decorations/random-steps.js — random steps decoration
  decorations/rounded-corners.js — rounded corners decoration
  style/registry.js     — named style registry + group style resolution
  style/style.js        — resolveNodeStyle, resolveEdgeStyle, collectShadowFilters
  svg/emitter.js        — SVG DOM construction + generic shape fallback + multipart rendering
  index.js              — 6-phase render pipeline (16 shapes registered)
  automata/automata.js  — renderAutomaton() wrapper (shortenEnd: 1)
```

### Key conventions
- ES modules, no external deps
- SVG DOM via `document.createElementNS`
- TikZ angles: 0°=east, CCW positive; SVG: y-down
- Style cascade: DEFAULTS → stateStyle/edgeStyle → group → named style + per-element
- 286 tests pass: `npm test` (uses `node --test`)
- TikZ-reference-first: always check PGF source before fixing visual issues

---

## The subagent

`.claude/agents/tikz-to-svg.md` — converts TikZ automata source to `renderAutomaton()` calls. Invoke from Claude Code with:
```
Use the tikz-to-svg agent to convert examples/tikz-sources/example4-blue-styled.tex
```
