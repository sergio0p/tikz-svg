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

## ✅ DONE (src-v2): 14 shapes total

circle, rectangle, ellipse (hand-rolled) + diamond, star, regular polygon, trapezium, semicircle, isosceles triangle, kite, dart, circular sector, cylinder, rectangle split (via `createShape` factory). Source: `pgflibraryshapes.geometric.code.tex`, `pgflibraryshapes.multipart.code.tex`.

## ✅ DONE (src-v2): Generic emitter fallback

New shapes render via `shape.backgroundPath()` as `<path>` elements. No new switch cases needed for future shapes.

---

## TODO: Arrow tip placement and capabilities

Arrow tips need improvement to match TikZ capabilities. Current implementation uses a single hardcoded stealth arrow. TikZ supports multiple arrow tip styles (Stealth, Latex, To, Bar, Circle, Bracket), configurable sizing, double tips, reversed tips, and precise placement at path endpoints. The `arrow-tips.js` registry has 6 tip definitions but they are not wired into the render pipeline. Import full TikZ arrow capabilities in a next edition.

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

## TODO: Skill — tikz-svg library builder

Create a Claude skill for **building and improving** the tikz-svg JS library. The current skill at `.claude/agents/tikz-to-svg.md` is for **using** the existing library. The builder skill should:

- Guide through TikZ-reference-first development process
- Know where PGF/TikZ source files are (`References/` + `/usr/local/texlive/2025/`)
- Know the architecture (pipeline, shape registry, anchor system, Transform class, createShape factory)
- Know about `src/` (live, don't edit) vs `src-v2/` (sandbox)
- Know the test setup (`node --test`, jsdom)
- Know about the LECWeb symlink dependency
- Enforce: match TikZ behavior, don't invent ad-hoc fixes

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
  core/arrow-tips.js    — arrow tip registry + 6 built-in tip definitions
  core/path.js          — soft-path builder with segment model + SVG serialization
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
  shapes/rectangle-split.js — N-part divided rectangle (factory)
  positioning/positioning.js — topological sort + direction table positioning
  geometry/edges.js     — straight, bent, loop edges + shorten
  geometry/arrows.js    — stealth arrow marker defs
  geometry/labels.js    — node-based label positioning with anchor selection
  style/style.js        — resolveNodeStyle, resolveEdgeStyle, collectShadowFilters
  svg/emitter.js        — SVG DOM construction + generic shape fallback
  index.js              — 6-phase render pipeline (14 shapes registered)
  automata/automata.js  — renderAutomaton() wrapper (shortenEnd: 1)
```

### Key conventions
- ES modules, no external deps
- SVG DOM via `document.createElementNS`
- TikZ angles: 0°=east, CCW positive; SVG: y-down
- Style cascade: DEFAULTS → stateStyle → per-node overrides
- 168 tests pass: `npm test` (uses `node --test`)
- TikZ-reference-first: always check PGF source before fixing visual issues

---

## The subagent

`.claude/agents/tikz-to-svg.md` — converts TikZ automata source to `renderAutomaton()` calls. Invoke from Claude Code with:
```
Use the tikz-to-svg agent to convert examples/tikz-sources/example4-blue-styled.tex
```
