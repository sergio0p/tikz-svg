# tikz-svg

A pure JavaScript library that renders TikZ/PGF graphics as SVG in the browser. No LaTeX required — pure ES modules, runs entirely client-side.

The library targets general-purpose TikZ rendering: shapes, paths, plots, callouts, labels, decorations, layers, KaTeX math, and animation metadata. The original automata wrapper has been retired to `deprecated/`; new work uses the general `render()` API.

**Status (2026-06-12):** 780 tests passing, 212 suites. Production code in `src-v2/`. Animation sandbox in `src-v3/`. Single-file bundle via `npm run build` → `dist/tikz-svg.min.js`.

## Quick Start

```html
<svg id="diagram" width="400" height="300"></svg>

<script type="module">
  import { render } from './src-v2/index.js';

  render(document.getElementById('diagram'), {
    states: {
      q0: { label: 'q₀', initial: true },
      q1: { label: 'q₁', position: { 'right': 'q0' }, accepting: true },
    },
    edges: [
      { from: 'q0', to: 'q1', label: 'a' },
      { from: 'q1', to: 'q1', label: 'b', loop: 'above' },
    ],
    stateStyle: { radius: 22, fill: '#dbeafe' },
    edgeStyle: { stroke: '#333', arrow: 'stealth' },
  });
</script>
```

### Single-file bundle (recommended for production pages)

```bash
npm run build        # → dist/tikz-svg.min.js (~108 KB, esbuild)
```

Importing `src-v2/index.js` directly pulls in ~54 separate module files — fine
locally, but over HTTP (e.g. GitHub Pages) that's a waterfall of ~50 requests
per page. Production pages should import the bundle instead:

```js
import { render } from './tikz-svg.min.js';
```

Same API, one request. `mathjs` stays external (load the UMD bundle via
`<script>` only on pages that use plots).

## API

### `render(svgEl, config)` — `src-v2/index.js`

The top-level entry point. Takes an SVG element and a configuration object describing nodes, edges, plots, paths, and styles. Returns `{ nodes, edges, labels, plots, refs }` for downstream consumers.

#### Top-level config keys

| Key | Type | Description |
|-----|------|-------------|
| `states` | `Object` | Map of node ID → node config |
| `edges` | `Array` | Edges between nodes (directed by default) |
| `plots` | `Array` | Function plots (math.js / JS expressions) |
| `paths` | `Array` | Free-form `\draw`-style polylines + arrows |
| `styles` | `Object` | Named style bundles |
| `groups` | `Array` | Node/edge groups with shared styles |
| `layers` | `Array` | Z-order layer declarations |
| `draw` | `Array` | Explicit draw-order overrides |
| `stateStyle` `edgeStyle` `plotStyle` `pathStyle` | `Object` | Per-layer defaults |
| `transform` | `Transform` | Global coordinate transform (positions remapped) |
| `transformCanvas` | `Transform` | Low-level graphics transform (also scales strokes) |
| `scale` `scaleX` `scaleY` `originX` `originY` | `number` | Coordinate scaling |
| `nodeDistance` `onGrid` | — | Layout knobs |
| `padding` `background` | — | ViewBox controls |
| `viewBox` | `Array \| string` | Explicit viewBox `[x, y, w, h]` — overrides auto-computed bounds |
| `width` `height` | `number \| string` | Set the SVG element's width/height attributes (e.g. `400` or `'100%'`) |
| `paths[i].useAsBoundingBox` | `boolean` | TikZ `use as bounding box`: the viewport follows this path's extent exactly (no padding unless `padding` is set); other content may overflow. Combine with `stroke: 'none'` for an invisible frame. `config.viewBox` still wins. |
| `katexMacros` | `Object` | KaTeX macros (e.g. `{"\\R": "\\mathbb{R}"}`) |
| `seed` | `number` | PRNG seed for deterministic decorations |

#### Node config

| Key | Type | Description |
|-----|------|-------------|
| `label` | `string \| Array` | Display label; arrays render multipart shapes |
| `position` | `Object` | Relative (`{ 'above right': 'q0' }`) or absolute (`{ x, y }`) |
| `shape` | `string` | One of 23 registered shapes (default `circle`) |
| `initial` `accepting` | `boolean` | Initial-arrow / double-circle (automata sugar) |
| `radius` `rx` `ry` `halfWidth` `halfHeight` | `number` | Geometry |
| `minimumWidth` `minimumHeight` | `number` | Floors for auto-sizing |
| `textWidth` `align` | — | Wrapped text |
| `fill` `stroke` `strokeWidth` `dash` `opacity` | — | Style |
| `xshift` `yshift` `rotate` | `number` | Per-node transforms |
| `partFills` `partAlign` `drawSplits` | — | Multipart shape options |
| `style` | `string` | Reference to a named style |
| `className` | `string` | CSS class on the node `<g>` |
| `frame` | `string` | Animation frame spec (v3 only) |

#### Edge config

| Key | Type | Description |
|-----|------|-------------|
| `from` `to` | `string` | Source / target node IDs |
| `label` | `string` | Edge label (KaTeX-aware) |
| `bend` | `string \| number` | `'left'`, `'right'`, or angle |
| `out` `in` | `number` | Departure / arrival angles in degrees |
| `looseness` | `number` | Bend / loop control-point multiplier |
| `loop` | `string` | Self-loop direction (`'above'`, etc.) |
| `arrow` `arrowSize` | — | Arrow tip + size |
| `shortenStart` `shortenEnd` | `number` | Path shortening |
| `labelPos` `labelSide` `labelDistance` `sloped` | — | Label placement |
| `dashed` `dotted` `dash` `lineCap` `lineJoin` `miterLimit` `fillRule` | — | Stroke style |
| `style` `className` `frame` | — | Style ref / CSS / animation |

### Shapes (23)

`circle`, `rectangle`, `ellipse`, `diamond`, `star`, `regular polygon`, `trapezium`, `semicircle`, `isosceles triangle`, `kite`, `dart`, `circular sector`, `cylinder`, `parallelogram`, `cloud`, `document`, `preparation`, `rectangle split`, `circle split`, `ellipse split`, `rectangle callout`, `ellipse callout`, `cloud callout`.

Multipart shapes accept `partFills: [...]`, `partAlign: 'left'|'center'|'right'`, `drawSplits`, and array labels (`label: ['A', 'B']`).

Callouts accept `pointer: { x, y }` (absolute pointer target), `pointerWidth`, and a `pointerShorten`.

### Arrow tips

18 base tips + 9 aliases:

**Base (18):** Stealth, Latex, Kite, Square, Circle, Straight Barb, Hooks, Arc Barb, Tee Barb, Classical TikZ Rightarrow, Computer Modern Rightarrow, Implies, Round Cap, Butt Cap, Triangle Cap, Fast Triangle, Fast Round, Rays.

**Aliases (9):** To, Bar, Bracket, LaTeX, Triangle, Rectangle, Ellipse, Diamond, Parenthesis.

Each supports `length`, `width`, `inset`, `lineWidth`, and `open`. Path data is auto-shortened to match the tip via `pgfcorearrows.code.tex` semantics. `arrow: 'none'` suppresses the head.

### Plotting — `src-v2/plotting/`

```js
plots: [
  {
    expr: 'sin(x)',          // string for math.js, or JS function
    domain: [-Math.PI, Math.PI],
    samples: 80,
    handler: 'curveto',       // lineto | curveto | barchart | ybar | closedcurve | ecdf | const | jump
    mark: 'circle',           // 16 marks available
    scaleX: 50, scaleY: 30,
  },
],
```

Plot expressions can be math.js strings or JS functions (piecewise logic). Marks render at sampled points, with `repeat`, `phase`, and `indices` controls. Plots integrate with `paths` / `nodes` via `at: { plot, point }` for placing nodes on a plotted curve.

### Free-form paths

```js
paths: [
  {
    points: [{x: 0, y: 0}, {x: 100, y: 50}, {x: 200, y: 0}],
    arrow: '<->',                  // '->' | '<-' | '<->'
    cycle: false,
    dashed: true,
    nodes: [{ at: 0.5, label: 'mid', anchor: 'south' }],
  },
],
```

### Decorations — `src-v2/decorations/`

`morphPath()` post-processes any path data string. Currently implemented:

- **`random steps`** — PGF-style amplitude-driven offsets with seeded PRNG
- **`rounded corners`** — corner smoothing (also usable on its own)

Apply via the `decoration` style key on edges, paths, or node borders, or call `morphPath()` directly. Pending: `zigzag`, `snake`, `coil` (PGF §34).

### KaTeX math

Labels wrapped in `$…$` render as KaTeX inside `<foreignObject>`. Define macros via `config.katexMacros: { "\\R": "\\mathbb{R}" }`. Falls back to plain text with `$` stripped if KaTeX isn't loaded. Auto-sizing accounts for KaTeX-measured dimensions.

Configs containing math labels are automatically re-rendered once web fonts finish loading (measurements change when the real KaTeX fonts arrive); math-free configs render exactly once. KaTeX measurements are memoized per (html, fontSize) and the cache is invalidated on font load.

### Layers and draw order

```js
layers: ['back', 'main', 'front'],
draw: [
  { type: 'node', id: 'q0', layer: 'back' },
  { type: 'edge', index: 0, layer: 'front' },
],
```

Default layer is `'main'`. Within a layer, declaration order is preserved.

### Named styles, groups, and transforms

```js
styles: {
  blue: { fill: '#dbeafe', stroke: '#3b82f6' },
  danger: { stroke: 'red', dash: 'dashed' },
},
groups: [
  { nodes: ['q0', 'q1'], style: 'blue', transform: new Transform().rotate(15) },
  { edges: [0, 2], style: 'danger' },
],
transform: new Transform().translate(0, 50),
```

Cascade: `DEFAULTS → stateStyle/edgeStyle → group → named style → per-element`.

### Color

Hex passthrough, 17+ named colors, and TikZ mix syntax `red!50!blue` / `blue!20`. The `color` shorthand applies to stroke (all elements) and to fill+labelColor (nodes), with explicit per-field keys overriding.

### Path actions (TikZ §15)

Items 1–5 implemented (commit `66bf309`):

- Named line widths (`ultra thin` … `ultra thick`)
- Named dash patterns (12 TikZ patterns, plus `dashed: true` / `dotted: true`)
- `lineCap` / `lineJoin` / `miterLimit`
- `color` shorthand
- `fillRule: 'nonzero' | 'evenodd'`

Item 6 (`use as bounding box`) is pending — see `Animation/MUSTADDRESS.md` for cross-reference.

## Repository layout

```
src-v2/                         — production library (default import)
  index.js                    — render() entry point
  core/                       — math, constants, transforms, arrow tips, color, KaTeX, PRNG, text-measure, path
  shapes/                     — 23 shapes + registry
  geometry/                   — edges, arrows, labels, paths
  positioning/                — topological layout
  style/                      — registry + cascade resolvers
  decorations/                — random steps, rounded corners, path utils
  plotting/                   — evaluator, handlers, marks, plot orchestrator
  svg/                        — SVG emitter
  legacy-callouts.js          — legacy callout factory (not wired into render)

src-v3/                         — animation sandbox
  ...                         — copy of src-v2 plus animation metadata
                                (`frame`, `className`, `idPrefix` namespacing)
                                See docs/plans/2026-04-10-animation-layer-design.md
                                Layer 1 (emitter metadata) implemented;
                                Layers 2 (controller) and 3 (authoring agent) pending.

deprecated/                     — historical APIs
  automata-wrapper/           — old renderAutomaton() (still used by some legacy pages)
  src-v1/                     — original prototype

Animation/                      — animation R&D (vocabulary, cheatsheet, plans)
docs/                           — plans, specs, audit, guides, References
examples-v2/                    — 21 demos (incl. blind-audition comparisons against TikZ PNGs)
test/                           — 57 test files, 756 tests, 205 suites
deprecated/, tex/, References/  — legacy sources, native-TikZ comparison sources
```

## Examples

Serve the repo over HTTP (file:// breaks ES module imports):

```bash
npx http-server /Users/sergiop/Dropbox/Scripts/tikz-svg -p 8080 -c-1
open http://localhost:8080/examples-v2/index.html
```

Highlights:

- `shapes-demo.html`, `split-shapes-demo.html` — shape catalog
- `plotting-demo.html`, `plot-with-nodes-demo.html` — function plots and nodes-on-plots
- `draw-paths-demo.html` — free-form path drawing
- `katex-demo.html` — KaTeX math in labels
- `layers-demo.html` — explicit z-order
- `decoration-demo.html` — random steps decoration
- `economics-demo.html`, `newton-polygon-test.html` — domain-specific composites
- `callout-blind-audition.html`, `flowchart-blind-audition.html`, `positioning-blind-audition.html`, `rounded-corners-blind-audition.html` — side-by-side TikZ-vs-tikz-svg comparisons (see `DEMO.md` for the protocol)

## Tests

```bash
npm test
```

Runs 780 tests across 212 suites with `node --test` + jsdom. Coverage spans shapes, callouts, multipart, decorations, plotting (evaluator/handlers/marks), KaTeX, layers, auto-IDs (v2 + v3), auto-sizing, geometry (edges, arrows, labels, anchors), styling (color-mix, dash, line-width, caps/joins, fill-rule, named styles, groups), pipeline transforms, viewBox/scale/zoom, paths, and integration.

## Roadmap

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | Core renderer (`render()`) | ✅ done | 23 shapes, full API |
| 2 | Plotting | ✅ done | 8 handlers, 16 marks, math.js + JS expressions |
| 3 | Free-form paths (`config.paths`) | ✅ done | Inline labels, cycle, arrows |
| 4 | Layers / z-order | ✅ done | `config.layers` + `config.draw` |
| 5 | KaTeX math labels | ✅ done | `katexMacros` config, async fallback |
| 6 | Named styles + groups + transforms | ✅ done | Full cascade |
| 7 | Path actions (TikZ §15) | ✅ done | All 6 items, incl. `useAsBoundingBox` (2026-06-12) |
| 8 | Decorations | 🟡 partial | Random steps + rounded corners done; zigzag/snake/coil pending |
| 9 | Animation Layer 1 (metadata) | ✅ done | In `src-v3/` (sandbox) |
| 10 | Animation Layer 2 (controller) | ⬜ planned | Frame navigation, transitions, camera verbs |
| 11 | Animation Layer 3 (authoring agent) | ⬜ planned | Markdown-to-frames vocabulary |
| 12 | Polar coordinates `(angle:radius)` | ⬜ planned | Math exists, no user syntax |
| 13 | `calc` expressions `($(A)!0.5!(B)$)` | ⬜ planned | — |
| 14 | Smooth curves / Catmull-Rom / tension | ⬜ planned | All curves are explicit Bézier today |
| 15 | Tree layout (Reingold–Tilford) | ⬜ planned | No `child` keyword |
| 16 | Patterns / shadings / clip / gradient fill | ⬜ planned | SVG primitives available, no user-facing hook |

## Design principles

- **No LaTeX dependency.** All TikZ/PGF geometry is reimplemented in JavaScript by reading the PGF source files in `docs/References/`.
- **PGF-informed, not PGF-ported.** APIs are idiomatic JavaScript (classes, method chaining, `{x, y}` points), not literal TeX macro translations.
- **Additive modules.** Core utilities (`Transform`, `ArrowTipRegistry`, `Path`, `morphPath`) export standalone APIs the pipeline can adopt incrementally.
- **Segment-based paths.** `Path` stores typed segments (`M`/`L`/`C`/`Z`) as an inspectable array, enabling post-processing (`roundCorners()`, `transform()`, `morphPath()`) before SVG serialization.
- **Reference-first fixes.** When in doubt, check the PGF source before guessing visual semantics.
