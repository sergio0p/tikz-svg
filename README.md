# tikz-svg

A pure JavaScript library that renders TikZ/PGF graphics as SVG. No LaTeX required — runs entirely in the browser.

Currently supports the automata library. Moving toward general-purpose TikZ coverage including shapes.callouts and more.

## Usage

```html
<svg id="automaton"></svg>

<script type="module">
  import { renderAutomaton } from './src/automata/automata.js';

  const svg = document.getElementById('automaton');

  renderAutomaton(svg, {
    nodeDistance: 80,
    onGrid: true,
    stateStyle: {
      radius: 22,
      fill: '#f97316',
      stroke: 'none',
      labelColor: '#ffffff',
      fontSize: 16,
      fontFamily: 'serif',
    },
    edgeStyle: {
      stroke: '#333',
      strokeWidth: 2,
      arrow: 'stealth',
    },
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
      { from: 'q2', to: 'q3', label: '0' },
      { from: 'q2', to: 'q2', label: '1', loop: 'below' },
    ],
  });
</script>
```

## API

### `renderAutomaton(svgEl, config)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `svgEl` | `SVGElement` | Target SVG element |
| `config` | `Object` | Configuration object (see below) |

#### Config

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `states` | `Object` | *required* | Map of state IDs to state configs |
| `edges` | `Array` | `[]` | Array of edge objects |
| `stateStyle` | `Object` | `{}` | Default style for all states |
| `edgeStyle` | `Object` | `{}` | Default style for all edges |
| `nodeDistance` | `number` | `60` | Distance between nodes for relative positioning |
| `onGrid` | `boolean` | `false` | Snap positions to grid |

#### State config

| Key | Type | Description |
|-----|------|-------------|
| `label` | `string` | Display label (defaults to state ID) |
| `position` | `Object` | Relative position, e.g. `{ 'above right': 'q0' }` |
| `initial` | `boolean` | Show initial arrow |
| `accepting` | `boolean` | Show accepting (double) circle |
| `fill` | `string` | Per-state fill override |
| `stroke` | `string` | Per-state stroke override |
| `radius` | `number` | Per-state radius override |
| `shadow` | `Object` | Drop shadow: `{ dx, dy, blur, color }` |

Supported positions: `above`, `below`, `left`, `right`, `above left`, `above right`, `below left`, `below right`.

#### Edge config

| Key | Type | Description |
|-----|------|-------------|
| `from` | `string` | Source state ID |
| `to` | `string` | Target state ID |
| `label` | `string` | Edge label text |
| `bend` | `string\|number` | `'left'`, `'right'`, or angle in degrees |
| `loop` | `string` | Self-loop direction: `'above'`, `'below'`, `'left'`, `'right'` |
| `looseness` | `number` | Loop/bend looseness multiplier |

#### Style options

**`stateStyle`**: `radius`, `fill`, `stroke`, `strokeWidth`, `labelColor`, `fontSize`, `fontFamily`, `shadow`, `shape` (`'circle'`, `'rectangle'`, `'ellipse'`).

**`edgeStyle`**: `stroke`, `strokeWidth`, `arrow` (`'stealth'`), `arrowSize`.

### Core Modules

The following modules are available for standalone use. They are not required by the automata API but provide building blocks for general-purpose TikZ rendering.

#### `Transform` / `TransformStack` — `src/core/transform.js`

2D affine transformation matrix with a scoped stack, mirroring PGF's coordinate transformation system.

```js
import { Transform, TransformStack } from './src/core/transform.js';

const t = new Transform();
t.translate(10, 20).rotate(45).scale(2);
const pt = t.apply({ x: 1, y: 0 }); // → transformed point

const inv = t.invert();
inv.apply(pt); // → back to {x: 1, y: 0}

t.toSVG(); // → "matrix(1.414..,1.414..,-1.414..,1.414..,10,20)"

const stack = new TransformStack();
stack.push();
stack.current.translate(50, 0);
stack.pop(); // restored to previous state
```

**Transform methods:** `translate(dx, dy)`, `scale(sx, sy?)`, `rotate(angleDeg)`, `slantX(s)`, `slantY(s)`, `concat(a,b,c,d,tx,ty)`, `apply({x,y})`, `invert()`, `clone()`, `get()`, `set(matrix)`, `reset()`, `isIdentity()`, `toSVG()`.

**TransformStack methods:** `push()`, `pop()`, `.current` (getter).

#### `ArrowTipRegistry` / `defaultRegistry` — `src/core/arrow-tips.js`

Registry of named arrow tip definitions, each producing SVG path data. Replaces the single hard-coded stealth arrow with a pluggable system.

```js
import { defaultRegistry, createMarker, ArrowTipRegistry } from './src/core/arrow-tips.js';

// Query built-in tips
defaultRegistry.names(); // → ['Stealth', 'Latex', 'To', 'Bar', 'Circle', 'Bracket']

// Generate path data for an arrow tip
const stealth = defaultRegistry.get('Stealth');
const { d, lineEnd, tipEnd, fillMode } = stealth.path({ length: 8, width: 6 });

// Create an SVG <marker> element
const { element, id } = createMarker(document, 'Latex', { length: 6 }, { color: '#333' });
svgDefs.appendChild(element);
path.setAttribute('marker-end', `url(#${id})`);
```

**Built-in tips:** Stealth, Latex, To (Computer Modern Rightarrow), Bar, Circle, Bracket. Each supports `length`, `width`, `inset`, `lineWidth`, and `open` parameters.

**`path()` returns:** `{ d, lineEnd, tipEnd, visualBackEnd, fillMode }` where `fillMode` is `'filled'`, `'stroke'`, or `'both'`.

#### `Path` — `src/core/path.js`

Path builder that accumulates segments as a structured list (the PGF "soft path" concept). Supports inspection, manipulation, and SVG serialization.

```js
import { Path } from './src/core/path.js';

const p = new Path();
p.moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close();
p.toSVGPath(); // → "M 0 0 L 100 0 L 100 100 L 0 100 Z"

// Rounded corners
const rounded = p.roundCorners(10);
rounded.toSVGPath(); // → corners replaced with cubic Bézier arcs

// Shapes
new Path().circle(50, 50, 30).toSVGPath();
new Path().ellipse(50, 50, 40, 20).toSVGPath();
new Path().rect(10, 10, 80, 60).toSVGPath();
new Path().arc(50, 50, 30, 0, 180).toSVGPath();

// Inspection
p.bbox();      // → { minX, minY, maxX, maxY }
p.lastPoint(); // → { x, y }
p.isEmpty();   // → false

// Composition
const p2 = p.clone();
p.append(new Path().circle(50, 50, 10));

// Transform integration (with Transform from transform.js)
import { Transform } from './src/core/transform.js';
const t = new Transform().translate(10, 20).scale(2);
const transformed = p.transform(t); // → new Path with all points transformed
```

**Builder methods** (chainable): `moveTo`, `lineTo`, `curveTo`, `close`, `rect`, `circle`, `ellipse`, `arc`.

**Processing:** `roundCorners(radius)` — returns a new Path with line-segment corners replaced by cubic Bézier arcs.

**Query:** `toSVGPath()`, `bbox()`, `clone()`, `append(path)`, `isEmpty()`, `lastPoint()`, `transform(t)`.

## Examples

Open `examples/index.html` in a browser to browse all demos, or open individual files:

- `examples/tikz-diamond.html` — Orange diamond DFA with shadows
- `examples/example4-blue-styled.html` — Blue-styled DFA with loops
- `examples/example5-orange-shadow.html` — Orange states with accepting state
- `examples/example6-turing.html` — 5-state Turing machine with bends

## Architecture

```
src/
  index.js                     — 6-phase render pipeline (parse → position → node geometry → edge geometry → styles → emit)
  automata/automata.js         — renderAutomaton() convenience wrapper

  core/
    math.js                    — vector math, Bézier curves, angles
    constants.js               — direction table, defaults
    resolve-point.js           — coordinate resolver
    transform.js               — 2D affine transform matrix + scoped stack
    arrow-tips.js              — arrow tip registry + 6 built-in tip definitions
    path.js                    — soft-path builder with segment model + SVG serialization

  shapes/
    shape.js                   — shape registry (registerShape / getShape)
    circle.js                  — circle: anchors, border points, background path
    rectangle.js               — rectangle: corner + edge anchors
    ellipse.js                 — ellipse: parametric border points

  positioning/
    positioning.js             — topological sort + direction-based layout

  geometry/
    edges.js                   — straight, bent, self-loop edge paths
    arrows.js                  — stealth arrow marker defs (legacy, single arrow)
    labels.js                  — edge label positioning along curves

  style/
    style.js                   — style resolution cascade

  svg/
    emitter.js                 — SVG DOM construction

References/                    — PGF/TikZ .tex source files used as implementation reference
```

### Design principles

- **No LaTeX dependency.** All TikZ/PGF geometry is reimplemented in JavaScript by studying the PGF source files in `References/`.
- **Additive modules.** New core modules (`transform.js`, `arrow-tips.js`, `path.js`) export standalone utilities. They don't modify existing code — the render pipeline can adopt them incrementally.
- **PGF-informed, not PGF-ported.** The APIs are idiomatic JavaScript (classes, method chaining, `{x, y}` point objects), not literal TeX macro translations.
- **Segment-based paths.** The `Path` class stores typed segments (`M`/`L`/`C`/`Z`) as an inspectable array, enabling post-processing like `roundCorners()` and `transform()` before SVG serialization.

## Tests

```bash
npm test
```

Runs 140 tests across 34 suites using `node --test` with jsdom for DOM support.

| Suite | Tests | Covers |
|-------|-------|--------|
| Transform + TransformStack | 19 | affine ops, composition order, inversion, push/pop |
| ArrowTipRegistry + built-in tips | 35 | registry CRUD, 6 tip geometries, fillMode, scaling, marker DOM |
| Path | 30 | segments, shapes, bbox, clone, append, roundCorners, transform |
| Geometry (edges, labels, arrows) | 12 | straight/bent/loop edges, label placement, arrow defs |
| Shapes (circle, rect, ellipse) | 20 | anchors, border points, background paths |
| Positioning | 15 | spec parsing, topological sort, on-grid, cycles |
| Integration | 4 | full pipeline with jsdom, style overrides |

### Roadmap

Planned modules that will build on the current core:

| # | Module | Builds on |
|---|--------|-----------|
| 4 | Decorations (zigzag, snake, coil) | Path soft-path segments |
| 5 | Full soft-path subsystem | Path segment model |
| 6 | Plotting (`\pgfpathplot`) | Path builder |
| 7 | Layers / z-order | TransformStack scopes |
| 8 | Patterns & shadings | Path + SVG `<pattern>` / `<linearGradient>` |
