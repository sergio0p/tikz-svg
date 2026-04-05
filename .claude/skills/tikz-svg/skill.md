---
name: tikz-svg
description: SVG graphics for lecture pages using the tikz-svg JS library (v2). Covers render() for general-purpose drawing (economics graphs, diagrams), renderAutomaton() for state machines, inline SVG for trees, and callout annotations. Complete API reference.
---

# tikz-svg Library (v2) — Complete API Reference

Library: `/Users/sergiop/Dropbox/Scripts/tikz-svg/`
Entry point: `src-v2/index.js` exports `render()` and `renderAutomaton()`.

## Setup

**Symlink** (each course dir needs one):
```bash
ln -s /Users/sergiop/Dropbox/Scripts/tikz-svg [course]/tikz-svg
```

**HTML boilerplate:**
```html
<!-- KaTeX for $...$ math labels in nodes -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
<!-- mathjs (required by evaluator import chain) -->
<script src="https://cdn.jsdelivr.net/npm/mathjs@15.1.1/lib/browser/math.js"></script>
<script type="importmap">
{ "imports": { "mathjs": "./tikz-svg/examples-v2/mathjs-shim.js" } }
</script>
```

**Import:**
```javascript
import { render, renderAutomaton } from './tikz-svg/src-v2/index.js';
```

**Requires HTTP server** — ES module imports fail with `file://`:
```bash
python3 -m http.server 8080
```

---

## 1. render() — Top-Level Config Keys

```javascript
const refs = render(svgElement, config);
```

**Returns:** `{ nodes: { [id]: <g> }, edges: [<path>...], labels: [...], plots: [...] }` — live DOM references. Calling `render()` again on the same SVG auto-clears and re-renders.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `states` | Object | `{}` | Node ID → node config map |
| `edges` | Array | `[]` | Edge specs |
| `plots` | Array | `[]` | Function plot specs |
| `paths` | Array | `[]` | Free-form path specs |
| `draw` | Array | — | Mixed-order rendering (see §1.1) |
| `stateStyle` | Object | `{}` | Default style for ALL nodes |
| `edgeStyle` | Object | `{}` | Default style for ALL edges |
| `plotStyle` | Object | `{}` | Default style for ALL plots |
| `pathStyle` | Object | `{}` | Default style for ALL paths |
| `styles` | Object | `{}` | Named style registry (see §2) |
| `groups` | Array | — | Group styling/transforms (see §2) |
| `scale` | number | 1 | Uniform scale: 1 math-unit = scale SVG pixels |
| `scaleX/Y` | number | — | Per-axis scale (overrides `scale`) |
| `originX/Y` | number | 0 | SVG pixel offset for coordinate origin |
| `nodeDistance` | number | 90 | Spacing for relative positioning |
| `onGrid` | boolean | true | Snap positions to grid |
| `transform` | Transform | — | Global coordinate transform |
| `seed` | number | — | RNG seed for decorations |
| `layers` | Object | — | Layer configuration for z-order |

### 1.1 config.draw — Mixed-Order Rendering

Controls render order (first entry = drawn first = behind). Each entry has `type`:

```javascript
draw: [
  { type: 'path', points: [...], fill: '...', cycle: true },  // filled area behind
  { type: 'path', points: [...], arrow: '->' },                // axis
  { type: 'plot', expr: x => ..., domain: [...] },             // curve
  { type: 'node', id: 'lbl', position: {...}, label: '...' },  // label
]
```

Types: `'node'` (requires `id`), `'edge'`, `'plot'`, `'path'`. Each entry's properties match the corresponding §3–6 tables.

### 1.2 Coordinate System

| Element | y convention | Reason |
|---------|-------------|--------|
| Node `position` | y-down (SVG) | Positions scaled directly to SVG pixels |
| Path `points` | y-down (SVG) | Same as nodes |
| Plot `expr` return | y-up (math) | Library auto-flips: `SVG_y = -math_y × scale + originY` |

**Economics convention** — to think in (Q, P) where P increases upward:
- Nodes/paths: negate P → `position: { x: Q, y: -P }`
- Plots: return P directly (auto-flipped)

---

## 2. Style System

### Style Cascade (merge order)
DEFAULTS → `config.stateStyle` → group style → named style expansion → per-element properties

### Named Styles (`config.styles`)
```javascript
styles: {
  'econ label': { shape: 'rectangle', fill: 'none', stroke: 'none',
                  fontFamily: "'Times New Roman', serif", innerSep: 1, labelColor: '#586e75' }
},
draw: [
  { type: 'node', id: 'axP', style: 'econ label', position: {x:-3,y:-69}, label: '$P$', anchor: 'east', fontSize: 18 },
]
```
Per-element properties override named style. Built-in style: `'wavy'` (random-step decoration).

### stateStyle (default for all nodes)
```javascript
stateStyle: { shape: 'rectangle', fill: 'none', stroke: 'none', innerSep: 1,
              fontFamily: "'Times New Roman', serif", labelColor: '#586e75' }
```
Individual nodes only need `position`, `id`, `label`, `anchor`, and overrides.

### Groups
```javascript
groups: [
  { nodes: ['axP', 'axQ'], style: { fontSize: 18 } },
  { nodes: ['v20', 'v30', 'v40'], style: 'small-label' },
]
```
Groups processed in order; later override earlier.

---

## 3. Node Properties

Resolved via: DEFAULTS → stateStyle → group → per-node

### Size & Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `shape` | string | `'circle'` | See §8 for all 16 shapes |
| `radius` | number | 20 | Circle/regular polygon radius |
| `halfWidth/halfHeight` | number | auto | Rectangle dimensions |
| `rx/ry` | number | auto | Ellipse radii |
| `minimumWidth/Height` | number | 0 | Floor dimensions |
| `innerSep` | number | 3 | Text-to-border padding |
| `outerSep` | number | auto | Border-to-edge gap |

### Fill & Stroke

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `fill` | string | `'#FFFFFF'` | Background color |
| `stroke` | string | `'#000000'` | Border color |
| `strokeWidth` | number | 1.5 | Border width |
| `opacity` | number | 1 | Overall opacity |
| `dashed` | bool/string | false | `true` → `'6 4'`, or custom dasharray |

### Text & Labels

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | string | node id | Display text. `$...$` → KaTeX math (see §7) |
| `fontSize` | number/string | 14 | Pixels or named: `'tiny'`(7) `'scriptsize'`(8) `'small'`(10) `'normalsize'`(12) `'large'`(14) `'Large'`(17) `'huge'`(24) |
| `fontFamily` | string | `'serif'` | CSS font |
| `labelColor` | string | `'#000000'` | Text fill color |
| `textWidth` | number | 0 | Max text width (0 = no wrap) |
| `align` | string | `'center'` | `'left'`/`'center'`/`'right'` |

### Position & Transform

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `position` | `{x,y}`, `[x,y]`, or `{'right':'nodeId'}` | — | Absolute or relative |
| `anchor` | string | — | Anchor at position: `'center'`, `'east'`, `'west'`, `'north'`, `'south'`, `'north east'`, etc. |
| `xshift/yshift` | number | 0 | Additional offset |
| `rotate` | number | 0 | Rotation in degrees |
| `nodeScale` | number | 1 | Local scale factor |
| `at` | `{plot,point}` | — | Position at plot sample point: `{plot: 0, point: 25, above: 20}` |

### Automata

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `initial` | bool/string | false | Initial arrow. `true`/`'left'`/`'right'`/`'above'`/`'below'` |
| `accepting` | boolean | false | Double-circle border |
| `acceptingInset` | number | 3 | Gap between borders |

### Visual Effects

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `shadow` | bool/object | false | `true` or `{ dx, dy, blur, color }` |
| `className` | string | null | CSS class on `<g>` |
| `decoration` | object | null | Path decoration config |

### Split Shapes

| Property | Type | Description |
|----------|------|-------------|
| `partFills` | string[] | Fill colors per part |
| `partAlign` | string | Part label alignment |

---

## 4. Edge Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `from/to` | string | — | Source/target node IDs |
| `label` | string | — | Edge label text |
| `bend` | string/number | null | `'left'`/`'right'` or angle in degrees |
| `loop` | string | null | `'above'`/`'below'`/`'left'`/`'right'` |
| `looseness` | number | — | Curvature multiplier |
| `arrow` | string | `'stealth'` | `'->'`/`'<-'`/`'<->'`/`'none'` |
| `arrowSize` | number | 8 | Arrow tip size |
| `stroke` | string | `'#000000'` | Line color |
| `strokeWidth` | number | 1.5 | Line width |
| `dashed` | bool/string | false | Dash pattern |
| `opacity` | number | 1 | |
| `shortenStart/End` | number | 0 | Trim path |
| `labelPos` | number | 0.5 | Label position (0=start, 1=end) |
| `labelSide` | string | `'auto'` | `'auto'`/`'left'`/`'right'` |
| `labelDistance` | number | 0 | Label offset from edge |
| `sloped` | boolean | — | Rotate label to follow edge |
| `className` | string | null | CSS class |

---

## 5. Plot Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `expr` | function/string | — | JS function `x => ...` or mathjs string `'sin(x)'` |
| `coordinates` | `[{x,y}...]` | — | Explicit points (when `expr` is null) |
| `domain` | `[min,max]` | `[-5,5]` | Sample range |
| `samples` | number | 25 | Sample count |
| `samplesAt` | number[] | — | Explicit x-values |
| `variable` | string | `'x'` | Variable name |
| `yExpr` | function/string | — | Parametric y expression |
| `yRange` | `[min,max]` | — | Clip y outside range |
| `handler` | string | `'lineto'` | See §9 for all handlers |
| `tension` | number | 0.5 | Smooth curve tension |
| `stroke` | string | `'#2563eb'` | Line color |
| `strokeWidth` | number | 2 | Line width |
| `fill` | string | `'none'` | Fill under curve |
| `dashed` | bool/string | false | Dash pattern. **No `dotted`** — use `dashed: '2 3'` |
| `opacity` | number | 1 | |
| `mark` | string | — | See §10 for mark types |
| `markSize` | number | 3 | Mark radius |
| `markRepeat` | number | — | Mark every N points |
| `markPhase` | number | — | First mark offset (1-indexed) |
| `markIndices` | number[] | — | Explicit mark positions |
| `scaleX/Y` | number | 1 | Plot-level scale (before global) |
| `offsetX/Y` | number | 0 | Plot-level offset (in math-units) |
| `barWidth` | number | 10 | Bar chart width |
| `barShift` | number | 0 | Bar offset |
| `baseline` | number | 0 | Comb/bar baseline |

---

## 6. Path Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `points` | `[{x,y}...]` | — | Path vertices (y-down after negation) |
| `cycle` | boolean | false | Close path (SVG `Z`) |
| `fill` | string | `'none'` | Fill color |
| `stroke` | string | `'#000000'` | Stroke color |
| `strokeWidth` | number | 1.5 | Stroke width |
| `thick` | boolean | false | Sets strokeWidth to 2.4 |
| `dashed` | bool/string | false | `true` → `'6 4'`, or custom |
| `dotted` | boolean | false | `true` → `'2 3'` |
| `opacity` | number | 1 | |
| `arrow` | string | — | `'->'`/`'<->'`/`'<-'`/`'none'` |
| `arrowSize` | number | 8 | Arrow tip size |
| `nodes` | array | — | Inline labels: `[{ at: 0.5, label: 'text', anchor: 'above' }]` |
| `className` | string | null | CSS class |

---

## 7. KaTeX Math in Labels

Labels containing `$...$` are rendered via KaTeX into `<foreignObject>`. Requires KaTeX JS loaded synchronously before `render()`.

```javascript
'$P$'                           // pure math
'$\\frac{1}{4}$'                // fractions
'$\\bar{P} = 30$'               // accents
'$\\text{CS}$'                  // text inside math
'Payoff: $\\frac{1-p}{p}$'     // mixed text + math
```

Falls back to plain SVG `<text>` (with `$` stripped) if KaTeX is not loaded.

---

## 8. Shapes (20 available)

**Geometric:** `'circle'`, `'rectangle'`, `'ellipse'`, `'diamond'`, `'star'`, `'regular polygon'`, `'trapezium'`, `'semicircle'`, `'isosceles triangle'`, `'kite'`, `'dart'`, `'circular sector'`, `'cylinder'`

**Multipart:** `'rectangle split'`, `'circle split'`, `'ellipse split'`

**Symbols:** `'cloud'`

**Callouts:** `'rectangle callout'`, `'ellipse callout'`, `'cloud callout'`

### Cloud Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `cloudPuffs` | number | 10 | Number of puffs |
| `cloudPuffArc` | number | 135 | Arc length of each puff (degrees) |

### Callout Properties

All callout shapes accept a `calloutPointer` — the absolute `{x,y}` position (or node ID string) that the pointer targets.

| Property | Type | Default | Shapes | Description |
|----------|------|---------|--------|-------------|
| `calloutPointer` | `{x,y}` or string | — | all callouts | Pointer target (absolute position or node ID) |
| `calloutPointerWidth` | number | 7 | rectangle callout | Base width of pointer triangle |
| `calloutPointerArc` | number | 15 | ellipse callout | Pointer opening in degrees |
| `calloutPointerShorten` | number | 0 | all callouts | Shorten pointer toward center |
| `calloutPointerSegments` | number | 2 | cloud callout | Number of thought-bubble ellipses |
| `calloutPointerStartSize` | number | 0.2 | cloud callout | Start bubble size (fraction of cloud) |
| `calloutPointerEndSize` | number | 0.1 | cloud callout | End bubble size (fraction of cloud) |

All callout shapes provide a `'pointer'` anchor at the tip.

---

## 9. Plot Handlers

| Handler | Aliases | Description |
|---------|---------|-------------|
| `'lineto'` | `'sharp plot'` | Straight segments |
| `'curveto'` | `'smooth'` | Tension-based Bézier |
| `'closedcurve'` | `'smooth cycle'` | Closed smooth curve |
| `'polygon'` | `'sharp cycle'` | Closed polygon |
| `'constlineto'` | `'const plot'` | Step function (mark left) |
| `'constlinetoright'` | `'const plot mark right'` | Step (mark right) |
| `'constlinetomid'` | `'const plot mark mid'` | Step (mark mid) |
| `'jumpmarkleft'` | — | Disconnected steps (left) |
| `'jumpmarkright'` | — | Disconnected steps (right) |
| `'jumpmarkmid'` | — | Disconnected steps (mid) |
| `'xcomb'` | — | Horizontal lines from baseline |
| `'ycomb'` | — | Vertical lines from baseline |
| `'ybar'` | — | Vertical bars |
| `'xbar'` | — | Horizontal bars |

---

## 10. Mark Types

`'*'`, `'o'`, `'+'`, `'x'`, `'|'`, `'-'`, `'square'`, `'square*'`, `'triangle'`, `'triangle*'`, `'diamond'`, `'diamond*'`, `'pentagon'`, `'pentagon*'`, `'asterisk'`, `'star'`

---

## 11. Arrow Tips

`'stealth'`, `'latex'`, `'to'`, `'bar'`, `'bracket'`, `'parenthesis'`, `'kite'`, `'square'`, `'circle'`, `'triangle'`, `'rectangle'`, `'ellipse'`, `'diamond'`, `'straight barb'`, `'hooks'`, `'arc barb'`, `'tee barb'`, `'implies'`, `'classical tikz rightarrow'`, `'computer modern rightarrow'`, `'round cap'`, `'butt cap'`, `'triangle cap'`, `'fast triangle'`, `'fast round'`, `'rays'`

---

## 12. Complete Economics Graph Example

Uses `stateStyle` for label defaults — no custom helpers needed:

```javascript
import { render } from './tikz-svg/src-v2/index.js';

render(document.getElementById('graph'), {
  scale: 4, originX: 55, originY: 325,

  // Default style for all nodes: invisible label boxes
  stateStyle: {
    shape: 'rectangle', fill: 'none', stroke: 'none',
    fontFamily: "'Times New Roman', serif", innerSep: 1, labelColor: '#586e75',
  },

  draw: [
    // Filled area (cycle + fill)
    { type: 'path', points: [{x:0,y:-60},{x:60,y:-30},{x:0,y:-30}],
      cycle: true, fill: 'rgba(38,139,210,0.55)', stroke: 'none' },

    // Axes with arrows
    { type: 'path', points: [{x:0,y:23},{x:0,y:-67}], arrow: '->', stroke: '#586e75', strokeWidth: 2.5 },
    { type: 'path', points: [{x:0,y:0},{x:130,y:0}], arrow: '->', stroke: '#586e75', strokeWidth: 2.5 },

    // Tick mark
    { type: 'path', points: [{x:-1.5,y:-20},{x:1.5,y:-20}], stroke: '#586e75' },

    // Linear function (2 samples suffice)
    { type: 'plot', expr: Q => 60 - Q/2, domain: [0,120], samples: 2,
      handler: 'lineto', stroke: '#dc322f', strokeWidth: 3 },

    // Dotted guide
    { type: 'path', points: [{x:0,y:-40},{x:40,y:-40}], dotted: true, stroke: '#586e75' },

    // Labels — only position, id, label, anchor needed (stateStyle handles the rest)
    { type: 'node', id: 'axP', position: {x:-3,y:-69}, label: '$P$', anchor: 'east', fontSize: 18 },
    { type: 'node', id: 'axQ', position: {x:132,y:0}, label: '$Q$', anchor: 'west', fontSize: 18 },
    { type: 'node', id: 'v20', position: {x:-5,y:-20}, label: '$20$', anchor: 'east', fontSize: 12 },
    { type: 'node', id: 'lblD', position: {x:105,y:-10}, label: '$D$', anchor: 'west', fontSize: 16, labelColor: '#dc322f' },
    { type: 'node', id: 'lblCS', position: {x:15,y:-43}, label: 'CS', anchor: 'center', fontSize: 16, labelColor: '#ffffff' },
  ],
});
```

---

## 13. renderAutomaton()

Wrapper around `render()` for state machines. Same import.

```javascript
renderAutomaton(svg, {
  nodeDistance: 80, onGrid: true,
  stateStyle: { radius: 22, fill: '#f97316', stroke: 'none', labelColor: '#fff', fontSize: 16 },
  edgeStyle: { stroke: '#333', strokeWidth: 2, arrow: 'stealth' },
  states: {
    q0: { initial: true, label: 'q₀' },
    q1: { position: { 'above right': 'q0' }, label: 'q₁' },
    q2: { position: { 'below right': 'q0' }, label: 'q₂' },
    q3: { position: { 'below right': 'q1' }, label: 'q₃', accepting: true },
  },
  edges: [
    { from: 'q0', to: 'q1', label: '0' },
    { from: 'q0', to: 'q2', label: '1' },
    { from: 'q1', to: 'q3', label: '1' },
    { from: 'q1', to: 'q1', label: '0', loop: 'above' },
  ],
});
```

Relative positions: `'above'`, `'below'`, `'left'`, `'right'`, `'above right'`, `'above left'`, `'below right'`, `'below left'`.

---

## 14. Inline SVG (Decision/Game Trees)

For simple node-edge diagrams, write inline SVG directly. Zero dependencies.

**Construction order:** defs → edges → edge labels → nodes (shape + text pair, never separate).

```html
<svg viewBox="0 0 420 200" style="max-width:420px;width:100%;display:block;margin:0.75rem auto;">
  <defs>
    <marker id="arr" markerWidth="10" markerHeight="6" refX="9" refY="3" orient="auto">
      <polygon points="0 0,10 3,0 6" fill="#586e75"/>
    </marker>
  </defs>
  <line x1="135" y1="100" x2="245" y2="47" stroke="#586e75" stroke-width="2" marker-end="url(#arr)"/>
  <ellipse cx="80" cy="100" rx="55" ry="22" fill="#dc322f"/>
  <text x="80" y="106" text-anchor="middle" font-family="'Times New Roman',serif" font-size="15" fill="#fff">Root</text>
</svg>
```

SVG `<text>` subscripts: use `<tspan dy="-6" font-size="10">` (super), `<tspan dy="9" dx="-7">` (sub), `<tspan dy="-3">` (return to baseline). Unicode fractions: ½ ⅓ ⅔ ¼ ¾.

---

## 15. Callouts

**Preferred: integrated callout shapes** (via `render()`). Use `shape: 'rectangle callout'`, `'ellipse callout'`, or `'cloud callout'` with `calloutPointer` — see §8 for properties.

```javascript
render(svgEl, {
  states: {
    note: {
      position: { x: 100, y: 80 },
      shape: 'rectangle callout',
      label: 'Hello!',
      calloutPointer: { x: 250, y: 140 },
      calloutPointerWidth: 15,
      fill: '#d4e4f7',
    },
  },
  edges: [],
});
```

**Legacy standalone callouts** (`legacy-callouts.js`) are still available for existing pages but are not part of the render pipeline.

---

## 16. Defaults Reference

| Constant | Value | Used by |
|----------|-------|---------|
| nodeRadius | 20 | Nodes |
| fontSize | 14 | All text |
| fontFamily | `'serif'` | All text |
| innerSep | 3 | Node padding |
| nodeFill | `'#FFFFFF'` | Node background |
| nodeStroke | `'#000000'` | Node border |
| nodeStrokeWidth | 1.5 | Node border |
| edgeColor | `'#000000'` | Edge lines |
| edgeStrokeWidth | 1.5 | Edge lines |
| arrowSize | 8 | Arrow tips |
| bendAngle | 30 | Edge bend |
| plotColor | `'#2563eb'` | Plot lines |
| plotStrokeWidth | 2 | Plot lines |
| pathColor | `'#000000'` | Free paths |
| pathStrokeWidth | 1.5 | Free paths |
| nodeDistance | 90 | Relative positioning |
| shadowDefaults | `{dx:2,dy:2,blur:3,color:'rgba(0,0,0,0.25)'}` | Node shadows |
