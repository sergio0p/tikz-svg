**Status: COMPLETED** — `config.paths` implemented in `src-v2/geometry/paths.js`.

# Free-Form Path Drawing (config.paths) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `config.paths` to the render pipeline — TikZ's `\draw` equivalent: arbitrary point-to-point lines with arrows on either/both ends, dashed/dotted/thick styles, inline node labels at any position, and cycle (closed path) support.

**Architecture:** Each path entry in `config.paths` is a polyline defined by `points: [{x,y}, ...]`. The pipeline builds an SVG `d` attribute from the points (M/L segments), resolves arrow markers for start/end, and emits `<path>` elements in the edge layer. Inline node labels (`nodes: [{ at, label, anchor }]`) are positioned along the path at fractional positions (0=start, 1=end) and emitted in the label layer. All coordinates are in SVG space (y-down) — no math-to-SVG transform needed (unlike plots). The existing arrow tip registry (`core/arrow-tips.js`) and style cascade (`style/style.js`) are reused directly.

**Tech Stack:** ES modules, existing arrow tip registry, existing `Path` class, existing style cascade. Tests: `node --test` + jsdom.

**Stop-at-any-step guarantee:** Each task ships a complete, tested feature. The library is fully usable after any task.

**TikZ equivalents this unlocks:**

```
\draw[<->] (0,0.3)--(0,-0.7);          →  { points: [{x:0,y:-0.3},{x:0,y:0.7}], arrow: '<->' }
\draw[dotted] (.25,-.1)--(.25,.3);      →  { points: [{x:0.25,y:0.1},{x:0.25,y:-0.3}], dotted: true }
\draw[color=red,thick] (0,0)--(.25,0);  →  { points: [{x:0,y:0},{x:0.25,y:0}], stroke: 'red', thick: true }
\draw (0,0)--(1,0) node[right] {$e_1$}; →  { points: [...], nodes: [{ at: 1, label: 'e₁', anchor: 'right' }] }
```

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-v2/geometry/paths.js` | **Create** | `buildPathGeometry()`: builds SVG path string from points, computes label positions along path |
| `src-v2/style/style.js` | **Modify** | Add `resolvePathStyle()` for path style cascade |
| `src-v2/core/constants.js` | **Modify** | Add `DEFAULTS.pathColor`, `DEFAULTS.pathStrokeWidth` |
| `src-v2/svg/emitter.js` | **Modify** | Add `emitDrawPath()` for `<path>` + inline label rendering |
| `src-v2/index.js` | **Modify** | Add Phase 4.6: process `config.paths`, resolve styles, build path models |
| `test/draw-paths.test.js` | **Create** | Tests for path geometry, style resolution, emission, and pipeline integration |
| `examples-v2/draw-paths-demo.html` | **Create** | Demo: axes, dotted lines, labeled paths — the economics diagram use case |

---

### Task 1: Path Geometry — Building SVG Paths from Points

**What it does:** Creates a module that takes an array of `{x, y}` points and produces an SVG path string plus label position computation. Supports open polylines and closed cycles. Label positions are computed by linear interpolation along the path at fractional `t` values (0=start, 1=end, 0.5=midpoint).

**Source:** `pgfcorepathconstruct.code.tex` (moveto, lineto, closepath).

**Files:**
- Create: `src-v2/geometry/paths.js`
- Create: `test/draw-paths.test.js`

- [ ] **Step 1: Write failing tests for path geometry**

Create `test/draw-paths.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPathGeometry, computePathLabelPosition } from '../src-v2/geometry/paths.js';

describe('buildPathGeometry', () => {
  it('builds SVG path string from two points', () => {
    const result = buildPathGeometry([{ x: 0, y: 0 }, { x: 100, y: 50 }]);
    assert.strictEqual(result.d, 'M 0 0 L 100 50');
  });

  it('builds SVG path string from multiple points', () => {
    const result = buildPathGeometry([
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 },
    ]);
    assert.strictEqual(result.d, 'M 0 0 L 50 0 L 50 50');
  });

  it('closes path when cycle is true', () => {
    const result = buildPathGeometry(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }],
      { cycle: true }
    );
    assert.ok(result.d.endsWith('Z'));
  });

  it('returns total path length', () => {
    const result = buildPathGeometry([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    assert.ok(Math.abs(result.totalLength - 100) < 0.01);
  });

  it('handles single point gracefully', () => {
    const result = buildPathGeometry([{ x: 10, y: 20 }]);
    assert.strictEqual(result.d, 'M 10 20');
    assert.strictEqual(result.totalLength, 0);
  });

  it('handles empty array', () => {
    const result = buildPathGeometry([]);
    assert.strictEqual(result.d, '');
    assert.strictEqual(result.totalLength, 0);
  });
});

describe('computePathLabelPosition', () => {
  const segments = [
    { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, length: 100, cumLength: 100 },
  ];
  const totalLength = 100;

  it('returns start point at t=0', () => {
    const pos = computePathLabelPosition(segments, totalLength, 0);
    assert.strictEqual(pos.x, 0);
    assert.strictEqual(pos.y, 0);
  });

  it('returns end point at t=1', () => {
    const pos = computePathLabelPosition(segments, totalLength, 1);
    assert.strictEqual(pos.x, 100);
    assert.strictEqual(pos.y, 0);
  });

  it('returns midpoint at t=0.5', () => {
    const pos = computePathLabelPosition(segments, totalLength, 0.5);
    assert.strictEqual(pos.x, 50);
    assert.strictEqual(pos.y, 0);
  });

  it('works on multi-segment path', () => {
    const segs = [
      { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, length: 100, cumLength: 100 },
      { from: { x: 100, y: 0 }, to: { x: 100, y: 100 }, length: 100, cumLength: 200 },
    ];
    // t=0.5 should be at (100, 0) — the corner
    const pos = computePathLabelPosition(segs, 200, 0.5);
    assert.strictEqual(pos.x, 100);
    assert.strictEqual(pos.y, 0);

    // t=0.75 should be at (100, 50) — midway on second segment
    const pos2 = computePathLabelPosition(segs, 200, 0.75);
    assert.strictEqual(pos2.x, 100);
    assert.strictEqual(pos2.y, 50);
  });

  it('returns angle of segment at position', () => {
    const segs = [
      { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, length: 100, cumLength: 100 },
    ];
    const pos = computePathLabelPosition(segs, 100, 0.5);
    assert.strictEqual(pos.angle, 0); // horizontal
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/draw-paths.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement path geometry**

Create `src-v2/geometry/paths.js`:

```js
/**
 * Free-form path geometry.
 *
 * Builds SVG path strings from point arrays and computes
 * label positions along paths by linear interpolation.
 *
 * TikZ equivalent: \draw (a)--(b)--(c);
 * Source: pgfcorepathconstruct.code.tex (moveto, lineto, closepath)
 */

/**
 * Build an SVG path string and segment data from an array of points.
 *
 * @param {{ x: number, y: number }[]} points
 * @param {{ cycle?: boolean }} [opts]
 * @returns {{ d: string, segments: Array, totalLength: number }}
 */
export function buildPathGeometry(points, opts = {}) {
  if (!points || points.length === 0) {
    return { d: '', segments: [], totalLength: 0 };
  }

  if (points.length === 1) {
    return {
      d: `M ${points[0].x} ${points[0].y}`,
      segments: [],
      totalLength: 0,
    };
  }

  const parts = [`M ${points[0].x} ${points[0].y}`];
  const segments = [];
  let totalLength = 0;

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    parts.push(`L ${to.x} ${to.y}`);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    totalLength += length;

    segments.push({ from, to, length, cumLength: totalLength });
  }

  if (opts.cycle) {
    // Close back to first point
    const from = points[points.length - 1];
    const to = points[0];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    totalLength += length;
    segments.push({ from, to, length, cumLength: totalLength });
    parts.push('Z');
  }

  return {
    d: parts.join(' '),
    segments,
    totalLength,
  };
}

/**
 * Compute a position along a path at fractional parameter t.
 *
 * @param {Array<{ from, to, length, cumLength }>} segments
 * @param {number} totalLength
 * @param {number} t - 0 = start, 1 = end
 * @returns {{ x: number, y: number, angle: number }}
 */
export function computePathLabelPosition(segments, totalLength, t) {
  if (segments.length === 0) {
    return { x: 0, y: 0, angle: 0 };
  }

  const targetDist = t * totalLength;

  // Find which segment contains this distance
  for (const seg of segments) {
    const segStart = seg.cumLength - seg.length;
    if (targetDist <= seg.cumLength || seg === segments[segments.length - 1]) {
      // Interpolate within this segment
      const localT = seg.length > 0 ? (targetDist - segStart) / seg.length : 0;
      const clampedT = Math.max(0, Math.min(1, localT));

      const x = seg.from.x + (seg.to.x - seg.from.x) * clampedT;
      const y = seg.from.y + (seg.to.y - seg.from.y) * clampedT;

      // Angle in radians (SVG coordinate system)
      const angle = Math.atan2(seg.to.y - seg.from.y, seg.to.x - seg.from.x);

      return { x, y, angle };
    }
  }

  // Fallback: end of path
  const last = segments[segments.length - 1];
  return { x: last.to.x, y: last.to.y, angle: 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/draw-paths.test.js`
Expected: All 12 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add src-v2/geometry/paths.js test/draw-paths.test.js
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: add path geometry module for free-form drawing"
```

---

### Task 2: Path Style Resolution and Defaults

**What it does:** Adds `resolvePathStyle()` and path-specific defaults. Path styles differ from edge styles: no default arrow (edges default to `stealth`; paths default to `none`), and support for `arrow` as a string like `'->'`, `'<->'`, `'<-'`, or `'none'`.

**Files:**
- Modify: `src-v2/core/constants.js`
- Modify: `src-v2/style/style.js`
- Modify: `test/draw-paths.test.js`

- [ ] **Step 1: Write failing tests for path style resolution**

Append to `test/draw-paths.test.js`:

```js
import { resolvePathStyle } from '../src-v2/style/style.js';

describe('resolvePathStyle', () => {
  it('returns defaults when no overrides', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    });
    assert.strictEqual(style.stroke, '#000000');
    assert.strictEqual(style.strokeWidth, 1.5);
    assert.strictEqual(style.fill, 'none');
    assert.strictEqual(style.arrowStart, null);
    assert.strictEqual(style.arrowEnd, null);
    assert.strictEqual(style.dashed, false);
    assert.strictEqual(style.dotted, false);
  });

  it('parses arrow: "->" to arrowEnd only', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [], arrow: '->' }],
    });
    assert.strictEqual(style.arrowStart, null);
    assert.strictEqual(style.arrowEnd, 'stealth');
  });

  it('parses arrow: "<->" to both ends', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [], arrow: '<->' }],
    });
    assert.strictEqual(style.arrowStart, 'stealth');
    assert.strictEqual(style.arrowEnd, 'stealth');
  });

  it('parses arrow: "<-" to arrowStart only', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [], arrow: '<-' }],
    });
    assert.strictEqual(style.arrowStart, 'stealth');
    assert.strictEqual(style.arrowEnd, null);
  });

  it('merges config.pathStyle as base', () => {
    const config = {
      paths: [{ points: [] }],
      pathStyle: { stroke: 'red', strokeWidth: 3 },
    };
    const style = resolvePathStyle(0, config);
    assert.strictEqual(style.stroke, 'red');
    assert.strictEqual(style.strokeWidth, 3);
  });

  it('per-path overrides beat pathStyle', () => {
    const config = {
      paths: [{ points: [], stroke: 'green' }],
      pathStyle: { stroke: 'red' },
    };
    const style = resolvePathStyle(0, config);
    assert.strictEqual(style.stroke, 'green');
  });

  it('thick sets strokeWidth to 2.4', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [], thick: true }],
    });
    assert.strictEqual(style.strokeWidth, 2.4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/draw-paths.test.js`
Expected: FAIL — `resolvePathStyle` is not exported.

- [ ] **Step 3: Add path defaults to constants.js**

Add to the `DEFAULTS` object in `src-v2/core/constants.js`:

```js
  // Path defaults (free-form \draw)
  pathColor: '#000000',
  pathStrokeWidth: 1.5,
```

- [ ] **Step 4: Implement resolvePathStyle in style.js**

Add to `src-v2/style/style.js` after `resolvePlotStyle`:

```js
/**
 * Parse a TikZ arrow spec string into start/end tip names.
 * '->'  → { start: null, end: 'stealth' }
 * '<->' → { start: 'stealth', end: 'stealth' }
 * '<-'  → { start: 'stealth', end: null }
 * 'none' or undefined → { start: null, end: null }
 * @param {string} [spec]
 * @returns {{ start: string|null, end: string|null }}
 */
function parseArrowSpec(spec) {
  if (!spec || spec === 'none' || spec === '-') {
    return { start: null, end: null };
  }
  const hasStart = spec.startsWith('<');
  const hasEnd = spec.endsWith('>');
  return {
    start: hasStart ? 'stealth' : null,
    end: hasEnd ? 'stealth' : null,
  };
}

/**
 * Resolve effective style for a free-form path (\draw).
 * Merge order: DEFAULTS → config.pathStyle → per-path properties
 *
 * Differences from edge style:
 * - No default arrow (edges default to stealth; paths default to none)
 * - Supports `arrow` string: '->', '<->', '<-', 'none'
 * - Supports `dotted` (separate from `dashed`)
 * - Supports `thick` shorthand (sets strokeWidth to 2.4, matching TikZ thick=1.2pt at 2x)
 *
 * @param {number} pathIndex
 * @param {Object} config - full config object
 * @returns {Object} resolved style
 */
export function resolvePathStyle(pathIndex, config) {
  const base = {
    stroke: DEFAULTS.pathColor,
    strokeWidth: DEFAULTS.pathStrokeWidth,
    fill: 'none',
    dashed: false,
    dotted: false,
    opacity: 1,
    className: null,
    decoration: null,
  };
  const registry = new StyleRegistry(config.styles);
  const pathStyle = registry.expand(config.pathStyle || {});
  const pathProps = config.paths?.[pathIndex] || {};
  const expandedProps = registry.expand(pathProps);
  const merged = { ...base, ...pathStyle, ...expandedProps };

  // thick shorthand (TikZ thick = 0.8pt, very thick = 1.2pt; at our default 1.5 base,
  // thick = 2.4 matches the visual weight)
  if (merged.thick) {
    merged.strokeWidth = 2.4;
  }

  // Parse arrow spec from merged properties
  const arrowSpec = parseArrowSpec(merged.arrow);
  merged.arrowStart = arrowSpec.start;
  merged.arrowEnd = arrowSpec.end;

  return merged;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/draw-paths.test.js`
Expected: All 19 tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add src-v2/core/constants.js src-v2/style/style.js test/draw-paths.test.js
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: add path style resolution with arrow spec parsing"
```

---

### Task 3: Path Emission in the SVG Emitter

**What it does:** Adds `emitDrawPath()` to the emitter — renders a free-form path as a `<path>` element with optional `marker-start` / `marker-end`, and renders inline node labels as `<text>` elements positioned along the path. Handles `dotted`, `dashed`, `thick` styles.

**Files:**
- Modify: `src-v2/svg/emitter.js`
- Modify: `test/draw-paths.test.js`

- [ ] **Step 1: Write failing tests for path emission**

Append to `test/draw-paths.test.js`:

```js
import { before } from 'node:test';
import { JSDOM } from 'jsdom';
import { emitSVG } from '../src-v2/svg/emitter.js';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  document = dom.window.document;
});

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

describe('emitDrawPath', () => {
  it('renders a path in the edge layer', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 50',
        style: { stroke: '#000', strokeWidth: 1.5, fill: 'none' },
        arrowStartId: null,
        arrowEndId: null,
        labelNodes: [],
      }],
    });
    const edgeLayer = svg.querySelector('.edge-layer');
    const paths = edgeLayer.querySelectorAll('path.draw-path');
    assert.strictEqual(paths.length, 1);
    assert.strictEqual(paths[0].getAttribute('d'), 'M 0 0 L 100 50');
    assert.strictEqual(paths[0].getAttribute('stroke'), '#000');
  });

  it('renders arrow markers on both ends', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [{ id: 'arr-s', viewBox: '0 0 10 10', refX: 5, refY: 0,
        markerWidth: 10, markerHeight: 10, path: 'M 0 0 L 5 0', color: '#000',
        pathFill: '#000', pathStroke: 'none', lineEnd: 3, tipEnd: 5 }],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 0',
        style: { stroke: '#000', strokeWidth: 1.5, fill: 'none' },
        arrowStartId: 'arr-s',
        arrowEndId: 'arr-s',
        labelNodes: [],
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('marker-start'));
    assert.ok(path.getAttribute('marker-end'));
  });

  it('applies dotted style', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 0',
        style: { stroke: '#000', strokeWidth: 1, fill: 'none', dotted: true },
        arrowStartId: null,
        arrowEndId: null,
        labelNodes: [],
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('stroke-dasharray'));
  });

  it('renders inline label nodes', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 200 0',
        style: { stroke: '#000', strokeWidth: 1, fill: 'none' },
        arrowStartId: null,
        arrowEndId: null,
        labelNodes: [{
          x: 200, y: 0,
          label: 'e₁',
          anchor: 'right',
          fontSize: 12,
          fontFamily: 'serif',
        }],
      }],
    });
    const labels = svg.querySelectorAll('.label-layer .draw-label');
    assert.strictEqual(labels.length, 1);
    assert.strictEqual(labels[0].textContent, 'e₁');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/draw-paths.test.js`
Expected: FAIL — `emitSVG` ignores `drawPaths`.

- [ ] **Step 3: Implement emitDrawPath in emitter.js**

Add this function before the `emitSVG` function in `src-v2/svg/emitter.js`, after the `emitPlot` function:

```js
// ────────────────────────────────────────────
// Free-form path (\draw) emission
// ────────────────────────────────────────────

/** Anchor offsets in px for inline path labels. */
const ANCHOR_OFFSETS = {
  right:  { dx: 5,  dy: 0,  textAnchor: 'start',  baseline: 'central' },
  left:   { dx: -5, dy: 0,  textAnchor: 'end',    baseline: 'central' },
  above:  { dx: 0,  dy: -5, textAnchor: 'middle', baseline: 'auto' },
  below:  { dx: 0,  dy: 5,  textAnchor: 'middle', baseline: 'hanging' },
};

/**
 * Emit SVG elements for a single free-form path (\draw).
 * @param {Object} pathModel - { d, style, arrowStartId, arrowEndId, labelNodes }
 * @param {SVGGElement} edgeLayer
 * @param {SVGGElement} labelLayer
 */
function emitDrawPath(pathModel, edgeLayer, labelLayer) {
  const { d, style, arrowStartId, arrowEndId, labelNodes } = pathModel;

  if (!d) return;

  // Path element
  const attrs = {
    d,
    fill: style.fill ?? 'none',
    stroke: style.stroke ?? '#000',
    'stroke-width': style.strokeWidth ?? 1.5,
    class: 'draw-path',
  };

  if (style.dotted) {
    attrs['stroke-dasharray'] = '2 3';
  } else if (style.dashed) {
    attrs['stroke-dasharray'] = typeof style.dashed === 'string' ? style.dashed : '6 4';
  }

  if (style.opacity != null && style.opacity < 1) {
    attrs.opacity = style.opacity;
  }

  if (arrowStartId) {
    attrs['marker-start'] = `url(#${arrowStartId})`;
  }
  if (arrowEndId) {
    attrs['marker-end'] = `url(#${arrowEndId})`;
  }

  edgeLayer.appendChild(createSVGElement('path', attrs));

  // Inline label nodes
  if (labelNodes) {
    for (const ln of labelNodes) {
      const anchorInfo = ANCHOR_OFFSETS[ln.anchor] ?? ANCHOR_OFFSETS.right;
      const text = createSVGElement('text', {
        x: ln.x + anchorInfo.dx,
        y: ln.y + anchorInfo.dy,
        'text-anchor': anchorInfo.textAnchor,
        'dominant-baseline': anchorInfo.baseline,
        'font-size': ln.fontSize ?? DEFAULTS.fontSize,
        'font-family': ln.fontFamily ?? DEFAULTS.fontFamily,
        fill: ln.color ?? '#000',
        class: 'draw-label',
      });
      text.textContent = String(ln.label);
      labelLayer.appendChild(text);
    }
  }
}
```

- [ ] **Step 4: Wire emitDrawPath into emitSVG**

In the `emitSVG` function, add `drawPaths = []` to the destructuring:

```js
  const {
    nodes = {},
    edges = [],
    shadowFilters = [],
    arrowDefs = [],
    plots = [],
    drawPaths = [],
    seed,
  } = resolved;
```

After the plots emission block (`// 5.5. Emit plots`), add:

```js
    // 5.6. Emit free-form paths (\draw)
    for (const pathModel of drawPaths) {
      emitDrawPath(pathModel, edgeLayer, labelLayer);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/draw-paths.test.js`
Expected: All 23 tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add src-v2/svg/emitter.js test/draw-paths.test.js
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: add emitDrawPath to SVG emitter for free-form path rendering"
```

---

### Task 4: Pipeline Integration — config.paths in render()

**What it does:** Adds Phase 4.6 to the render pipeline. For each entry in `config.paths`, it resolves the style, builds the path geometry, resolves arrow markers (reusing the existing `arrowDefsMap`), computes inline label positions, and builds a path model for the emitter. Also includes `config.paths` in the empty-config guard.

**Files:**
- Modify: `src-v2/index.js`
- Modify: `test/draw-paths.test.js`

- [ ] **Step 1: Write failing integration tests**

Append to `test/draw-paths.test.js`:

```js
import { render } from '../src-v2/index.js';

describe('render() with config.paths', () => {
  it('renders a simple line', () => {
    const svg = makeSVG();
    render(svg, {
      states: {},
      edges: [],
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path, 'should render a draw-path');
    assert.strictEqual(path.getAttribute('d'), 'M 0 0 L 100 0');
  });

  it('renders a path with <-> arrows', () => {
    const svg = makeSVG();
    render(svg, {
      states: {},
      edges: [],
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
        arrow: '<->',
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('marker-start'), 'should have marker-start');
    assert.ok(path.getAttribute('marker-end'), 'should have marker-end');
  });

  it('renders a dotted line', () => {
    const svg = makeSVG();
    render(svg, {
      states: {},
      edges: [],
      paths: [{
        points: [{ x: 10, y: 0 }, { x: 10, y: 100 }],
        dotted: true,
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('stroke-dasharray'));
  });

  it('renders inline node labels', () => {
    const svg = makeSVG();
    render(svg, {
      states: {},
      edges: [],
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
        arrow: '->',
        nodes: [
          { at: 1, label: 'x-axis', anchor: 'right' },
        ],
      }],
    });
    const label = svg.querySelector('.draw-label');
    assert.ok(label, 'should render inline label');
    assert.strictEqual(label.textContent, 'x-axis');
  });

  it('renders a thick red line segment', () => {
    const svg = makeSVG();
    render(svg, {
      states: {},
      edges: [],
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
        stroke: 'red',
        thick: true,
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.strictEqual(path.getAttribute('stroke'), 'red');
    assert.strictEqual(path.getAttribute('stroke-width'), '2.4');
  });

  it('coexists with nodes, edges, and plots', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        q0: { position: { x: 50, y: 50 }, label: 'A' },
      },
      edges: [],
      plots: [{
        expr: 'x',
        domain: [0, 1],
        samples: 3,
        scaleX: 100,
        scaleY: 100,
        offsetX: 0,
        offsetY: 0,
      }],
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
        arrow: '<->',
      }],
    });
    assert.ok(svg.querySelector('#node-q0'), 'node should exist');
    assert.ok(svg.querySelector('.plot-path'), 'plot should exist');
    assert.ok(svg.querySelector('.draw-path'), 'draw-path should exist');
  });

  it('renders a closed path (cycle)', () => {
    const svg = makeSVG();
    render(svg, {
      states: {},
      edges: [],
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }],
        cycle: true,
        fill: 'rgba(0,0,255,0.1)',
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('d').includes('Z'), 'should be closed');
    assert.ok(path.getAttribute('fill').includes('rgba'), 'should have fill');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/draw-paths.test.js`
Expected: FAIL — `render()` does not process `config.paths`.

- [ ] **Step 3: Implement Phase 4.6 in index.js**

Add imports at the top of `src-v2/index.js`:

```js
import { buildPathGeometry, computePathLabelPosition } from './geometry/paths.js';
import { resolvePathStyle } from './style/style.js';
```

Update the early guard to include paths:

Replace:
```js
  if (stateIds.length === 0 && plots.length === 0) {
    return { nodes: {}, edges: [], labels: [], plots: [] };
  }
```

With:
```js
  const paths = config.paths || [];
  if (stateIds.length === 0 && plots.length === 0 && paths.length === 0) {
    return { nodes: {}, edges: [], labels: [], plots: [] };
  }
```

And move the existing `const plots = config.plots || [];` to before this guard (it's already there).

After Phase 4.5 (process plots) and before Phase 5 (resolve styles), add Phase 4.6:

```js
  // ── PHASE 4.6: PROCESS FREE-FORM PATHS (\draw) ───────────────────
  // Build path geometry, resolve arrows, compute inline label positions.

  const drawPathModels = [];

  for (let i = 0; i < paths.length; i++) {
    const pathDef = paths[i];
    const style = resolvePathStyle(i, config);

    // Build geometry
    const geom = buildPathGeometry(pathDef.points || [], {
      cycle: pathDef.cycle ?? style.cycle,
    });

    // Resolve arrow markers — reuse the shared arrowDefsMap
    let arrowStartId = null;
    let arrowEndId = null;

    if (style.arrowEnd) {
      const def = getArrowDef({
        type: style.arrowEnd,
        size: style.arrowSize ?? DEFAULTS.arrowSize,
        color: style.stroke ?? DEFAULTS.pathColor,
      });
      if (def) {
        if (!arrowDefsMap.has(def.id)) arrowDefsMap.set(def.id, def);
        arrowEndId = def.id;
      }
    }

    if (style.arrowStart) {
      // For marker-start, we need a reversed arrow. Create with a distinct id.
      const def = getArrowDef({
        type: style.arrowStart,
        size: style.arrowSize ?? DEFAULTS.arrowSize,
        color: style.stroke ?? DEFAULTS.pathColor,
        id: `arrow-start-${style.arrowStart}-${style.arrowSize ?? DEFAULTS.arrowSize}-${(style.stroke ?? DEFAULTS.pathColor).replace('#', '')}`,
      });
      if (def) {
        if (!arrowDefsMap.has(def.id)) arrowDefsMap.set(def.id, def);
        arrowStartId = def.id;
      }
    }

    // Compute inline label positions
    const labelNodes = [];
    if (pathDef.nodes && geom.segments.length > 0) {
      for (const nodeDef of pathDef.nodes) {
        const t = nodeDef.at ?? 0.5;
        const pos = computePathLabelPosition(geom.segments, geom.totalLength, t);
        labelNodes.push({
          x: pos.x,
          y: pos.y,
          label: nodeDef.label,
          anchor: nodeDef.anchor ?? 'right',
          fontSize: nodeDef.fontSize ?? style.fontSize ?? DEFAULTS.fontSize,
          fontFamily: nodeDef.fontFamily ?? style.fontFamily ?? DEFAULTS.fontFamily,
          color: nodeDef.color ?? style.labelColor,
        });
      }
    }

    drawPathModels.push({
      d: geom.d,
      style,
      arrowStartId,
      arrowEndId,
      labelNodes,
    });
  }
```

- [ ] **Step 4: Update the arrowDefs rebuild after Phase 4.6**

The existing `const arrowDefs = Array.from(arrowDefsMap.values());` line is BEFORE Phase 4.6. Move it to AFTER Phase 4.6, or rebuild it. The simplest approach: the arrowDefs is already built from arrowDefsMap. Since Phase 4.6 may add new arrow defs to arrowDefsMap, we need to rebuild arrowDefs after Phase 4.6.

Replace the existing line:
```js
  const arrowDefs = Array.from(arrowDefsMap.values());
```

With a comment marking it as a placeholder, and add the final build after Phase 4.6:

Actually, the simplest fix: just move this line to after Phase 4.6. Find the current location (after the edge arrow loop) and move it to after the drawPathModels block. Replace it in its current position with nothing, and place `const arrowDefs = Array.from(arrowDefsMap.values());` after Phase 4.6.

- [ ] **Step 5: Pass drawPathModels to the emitter**

In Phase 6 (emit SVG), add `drawPaths: drawPathModels` to the model object:

```js
  const model = {
    nodes: {},
    edges: [],
    arrowDefs,
    shadowFilters,
    plots: plotModels,
    drawPaths: drawPathModels,
    seed: config.seed,
  };
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/draw-paths.test.js`
Expected: All tests PASS.

- [ ] **Step 7: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add src-v2/index.js test/draw-paths.test.js
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: integrate free-form paths into render() pipeline with arrows and inline labels"
```

---

### Task 5: Visual Demo — Economics Diagram with Axes and Annotations

**What it does:** Creates a demo HTML page showing the user's exact use case: axes with arrows, a function plot, dotted guidelines, colored line segments, and text labels at arbitrary positions. Mirrors the TikZ example with `\draw[<->]` axes, `plot[samples=200]`, `\draw[dotted]`, and `node[right]`/`node[below]` labels.

**Files:**
- Create: `examples-v2/draw-paths-demo.html`

- [ ] **Step 1: Create the demo page**

Create `examples-v2/draw-paths-demo.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>tikz-svg: Free-Form Paths Demo</title>
  <script src="https://cdn.jsdelivr.net/npm/mathjs@15.1.1/lib/browser/math.js"></script>
  <script type="importmap">
  {
    "imports": {
      "mathjs": "./mathjs-shim.js"
    }
  }
  </script>
  <style>
    body { font-family: system-ui; padding: 2rem; background: #f8f8f8; max-width: 900px; margin: 0 auto; }
    .demo { margin: 2rem 0; background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    svg { border: 1px solid #eee; display: block; margin: 0.5rem 0; }
    h2 { color: #333; margin-top: 0; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Free-Form Paths Demo</h1>
  <p><code>config.paths</code> — TikZ <code>\draw</code> equivalent: axes, dotted lines, annotations.</p>

  <div class="demo">
    <h2>Axes with arrows + dotted guidelines</h2>
    <p>Economics diagram: axes, function plot, dotted guides, labels.</p>
    <svg id="demo1" width="500" height="400"></svg>
  </div>

  <div class="demo">
    <h2>Simple coordinate system</h2>
    <svg id="demo2" width="400" height="300"></svg>
  </div>

  <div class="demo">
    <h2>Paths + plots + nodes together</h2>
    <svg id="demo3" width="600" height="350"></svg>
  </div>

  <script type="module">
    import { render } from '../src-v2/index.js';

    // Scale factor: multiply TikZ coords by this for SVG pixels
    const S = 250; // 3.5 * ~70px per TikZ unit

    // Demo 1: Economics diagram inspired by user's TikZ example
    // \draw[<->] (0,0.3)--(0,-0.7);  Y-axis
    // \draw[<->] (-0.1,0)--(1.30,0); X-axis
    // + dotted guidelines, colored segment, labels
    render(document.getElementById('demo1'), {
      states: {
        ylabel: { position: { x: -80, y: 30 }, label: 'u₁(e₁,e₂|Δ)', shape: 'rectangle', radius: 1, fill: 'none', stroke: 'none', fontSize: 11 },
        xlabel: { position: { x: 340, y: 170 }, label: 'e₁', shape: 'rectangle', radius: 1, fill: 'none', stroke: 'none', fontSize: 11 },
        q1: { position: { x: 62, y: 195 }, label: '¼', shape: 'rectangle', radius: 1, fill: 'none', stroke: 'none', fontSize: 10 },
        q5: { position: { x: 156, y: 195 }, label: '⅝', shape: 'rectangle', radius: 1, fill: 'none', stroke: 'none', fontSize: 10 },
        q54: { position: { x: 312, y: 195 }, label: '⁵⁄₄', shape: 'rectangle', radius: 1, fill: 'none', stroke: 'none', fontSize: 10 },
        caption: { position: { x: 150, y: 340 }, label: 'Δ=0, c(e)=e², v₁=v₂=1, e₂=¼', shape: 'rectangle', radius: 1, fill: 'none', stroke: 'none', fontSize: 9 },
      },
      edges: [],
      paths: [
        // Y-axis
        { points: [{ x: 0, y: 20 }, { x: 0, y: 310 }], arrow: '<->' },
        // X-axis
        { points: [{ x: -10, y: 170 }, { x: 330, y: 170 }], arrow: '<->' },
        // Dotted vertical at x=1/4
        { points: [{ x: 62, y: 185 }, { x: 62, y: 75 }], dotted: true },
        // Dotted vertical at x=5/4
        { points: [{ x: 312, y: 310 }, { x: 312, y: 185 }], dotted: true },
        // Dotted vertical at x=5/8
        { points: [{ x: 156, y: 170 }, { x: 156, y: 115 }], dotted: true },
        // Red thick segment [0, 1/4]
        { points: [{ x: 0, y: 170 }, { x: 62, y: 170 }], stroke: 'red', thick: true },
      ],
      plots: [{
        expr: 'x^2',
        domain: [0, 1.3],
        samples: 100,
        handler: 'smooth',
        stroke: 'blue',
        scaleX: S,
        scaleY: -S,
        offsetX: 0,
        offsetY: 170,
      }],
    });

    // Demo 2: Simple coordinate system with labeled axes
    render(document.getElementById('demo2'), {
      states: {},
      edges: [],
      paths: [
        // X-axis
        {
          points: [{ x: 30, y: 250 }, { x: 370, y: 250 }],
          arrow: '->',
          nodes: [{ at: 1, label: 'x', anchor: 'right' }],
        },
        // Y-axis
        {
          points: [{ x: 50, y: 270 }, { x: 50, y: 20 }],
          arrow: '->',
          nodes: [{ at: 1, label: 'y', anchor: 'above' }],
        },
        // Diagonal line
        {
          points: [{ x: 50, y: 250 }, { x: 350, y: 50 }],
          stroke: '#2563eb',
          nodes: [{ at: 0.5, label: 'f(x) = x', anchor: 'above' }],
        },
      ],
    });

    // Demo 3: Everything together — paths + plot + nodes
    render(document.getElementById('demo3'), {
      states: {
        peak: {
          at: { plot: 0, point: 25, above: 20 },
          label: 'maximum',
          shape: 'rectangle',
          radius: 16,
          fill: '#fef3c7',
          stroke: '#f59e0b',
          fontSize: 11,
        },
      },
      edges: [],
      paths: [
        // X-axis
        {
          points: [{ x: 40, y: 280 }, { x: 550, y: 280 }],
          arrow: '->',
          nodes: [{ at: 1, label: 'x', anchor: 'right' }],
        },
        // Y-axis
        {
          points: [{ x: 50, y: 300 }, { x: 50, y: 20 }],
          arrow: '->',
          nodes: [{ at: 1, label: 'y', anchor: 'above' }],
        },
        // Dotted horizontal at y = peak
        {
          points: [{ x: 50, y: 80 }, { x: 300, y: 80 }],
          dotted: true,
        },
      ],
      plots: [{
        expr: 'sin(x)',
        domain: [0, Math.PI],
        samples: 50,
        handler: 'smooth',
        stroke: '#2563eb',
        scaleX: 150,
        scaleY: 200,
        offsetX: 50,
        offsetY: 280,
      }],
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Run:
```bash
npx http-server ~/Dropbox/Scripts/tikz-svg -p 8080 -c-1
open http://localhost:8080/examples-v2/draw-paths-demo.html
```

Expected: Three demos visible — economics-style diagram, simple axes, combined paths+plot+nodes.

- [ ] **Step 3: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add examples-v2/draw-paths-demo.html
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: add free-form paths demo with axes, dotted lines, and labels"
```

---

## Verification Checklist

After all 5 tasks:

- [ ] `node --test` — all tests pass
- [ ] `render()` and `renderAutomaton()` still work unchanged for configs with no `paths`
- [ ] Paths render in edge layer (behind nodes)
- [ ] `<->`, `->`, `<-` arrows work on free-form paths
- [ ] `dotted`, `dashed`, `thick`, colored paths work
- [ ] Inline `nodes` labels positioned correctly along paths
- [ ] `cycle: true` closes the path
- [ ] Paths, plots, and nodes coexist in one render() call
- [ ] Demo page shows economics-style diagram in browser (via `http-server`)

## What This Does NOT Cover (future work)

- **Curved paths** — `.. controls (a) and (b) ..` Bézier syntax. Only straight-line segments for now.
- **Named node references in paths** — `\draw (nodeA) -- (nodeB)`. Paths use explicit `{x,y}` coordinates.
- **Decoration on paths** — wavy/zigzag on free-form paths (existing decoration module works on edges only).
- **Grid/axis helper** — auto-generating tick marks and grid lines.

---

## Context for Future Implementer

### Key design decisions

1. **Coordinates are in SVG space** — unlike plots (which use math coords + transform), paths use raw SVG `{x, y}` directly. This matches how the user thinks about layout: "put an axis from pixel 0 to pixel 300." No coordinate transform needed.

2. **Arrow markers are shared** — free-form paths reuse the same `arrowDefsMap` as edges. A `<->` axis and a `->` edge can share the same marker defs if they have the same color/size. The `marker-start` SVG attribute handles start arrows automatically — SVG reverses the marker orientation for start markers.

3. **`parseArrowSpec()` lives in style.js** — it converts TikZ-style strings (`'<->'`, `'->'`, `'<-'`) into `{ arrowStart, arrowEnd }` tip names. This is cleaner than spreading arrow parsing into the pipeline.

4. **Inline labels use absolute positioning** — `computePathLabelPosition()` returns absolute `{x, y}` coordinates, and anchor offsets (right=+5px, below=+5px, etc.) are applied in the emitter. This avoids needing shape geometry for what are essentially free-floating text labels.

5. **`dotted` is separate from `dashed`** — TikZ treats these as distinct styles with different dash patterns. `dotted` = `'2 3'`, `dashed` = `'6 4'`.

### Browser demo requirement

Demos must be served via `http-server` (not `file://`). See `examples-v2/plotting-demo.html` for the mathjs UMD + importmap shim pattern.
