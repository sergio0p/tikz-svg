# Plot-Render Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the standalone `plot()` module into the `render()` pipeline so plots, nodes, and edges coexist in a single config — including placing labeled nodes at arbitrary points on a plot.

**Architecture:** Add a `config.plots` array to `render()`. Each plot entry describes what to plot (expression or coordinates), how to connect points (handler), styling (stroke, fill, marks), and a coordinate transform (scale + offset) from math coords to SVG coords. The pipeline processes plots between Phase 4 (edge geometry) and Phase 5 (styles), emitting them as `<path>` + mark `<g>` elements in the edge layer. Nodes can reference plot data points via a new `at: { plotIndex, pointIndex }` position specifier, enabling labeled annotations on plots.

**Tech Stack:** ES modules, existing `plot()` API from `src-v2/plotting/`, existing `render()` pipeline in `src-v2/index.js`, existing `emitSVG` in `src-v2/svg/emitter.js`. Tests: `node --test` + jsdom.

**Stop-at-any-step guarantee:** Each task ships a complete, tested feature. The library is fully usable after any task.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-v2/index.js` | **Modify** | Add Phase 4.5: process `config.plots`, resolve plot styles, pass plot models to emitter |
| `src-v2/svg/emitter.js` | **Modify** | Add `emitPlot()` helper, render plot paths + marks in edge layer |
| `src-v2/style/style.js` | **Modify** | Add `resolvePlotStyle()` for plot style cascade |
| `src-v2/core/constants.js` | **Modify** | Add `DEFAULTS.plotStrokeWidth`, `DEFAULTS.plotColor`, `DEFAULTS.markSize` |
| `test/plot-render-integration.test.js` | **Create** | End-to-end tests: plots in render(), nodes at plot points |
| `test/plot-emitter.test.js` | **Create** | Unit tests for emitPlot() SVG output |
| `examples-v2/plot-with-nodes-demo.html` | **Create** | Visual demo: function plot with annotated nodes |

No existing tests are modified. The plotting module (`src-v2/plotting/`) is not modified — we only consume its public API.

---

### Task 1: Plot Style Defaults and Resolution

**What it does:** Adds plot-specific defaults to `constants.js` and a `resolvePlotStyle()` function that merges `DEFAULTS → config.plotStyle → per-plot overrides`. This mirrors the existing `resolveNodeStyle`/`resolveEdgeStyle` pattern.

**Files:**
- Modify: `src-v2/core/constants.js`
- Modify: `src-v2/style/style.js`
- Create: `test/plot-render-integration.test.js`

- [ ] **Step 1: Write failing tests for plot style resolution**

Create `test/plot-render-integration.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlotStyle } from '../src-v2/style/style.js';

describe('resolvePlotStyle', () => {
  it('returns defaults when no overrides', () => {
    const style = resolvePlotStyle(0, { plots: [{ expr: 'x' }] });
    assert.strictEqual(style.stroke, '#2563eb');
    assert.strictEqual(style.strokeWidth, 2);
    assert.strictEqual(style.fill, 'none');
    assert.strictEqual(style.handler, 'lineto');
    assert.strictEqual(style.markSize, 3);
  });

  it('merges config.plotStyle as base', () => {
    const config = {
      plots: [{ expr: 'x' }],
      plotStyle: { stroke: 'red', strokeWidth: 3 },
    };
    const style = resolvePlotStyle(0, config);
    assert.strictEqual(style.stroke, 'red');
    assert.strictEqual(style.strokeWidth, 3);
    assert.strictEqual(style.fill, 'none'); // default preserved
  });

  it('per-plot overrides beat plotStyle', () => {
    const config = {
      plots: [{ expr: 'x', stroke: 'green' }],
      plotStyle: { stroke: 'red' },
    };
    const style = resolvePlotStyle(0, config);
    assert.strictEqual(style.stroke, 'green');
  });

  it('includes handler and mark options', () => {
    const config = {
      plots: [{
        expr: 'sin(x)',
        handler: 'smooth',
        tension: 0.8,
        mark: '*',
        markSize: 4,
        markRepeat: 3,
      }],
    };
    const style = resolvePlotStyle(0, config);
    assert.strictEqual(style.handler, 'smooth');
    assert.strictEqual(style.tension, 0.8);
    assert.strictEqual(style.mark, '*');
    assert.strictEqual(style.markSize, 4);
    assert.strictEqual(style.markRepeat, 3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/plot-render-integration.test.js`
Expected: FAIL — `resolvePlotStyle` is not exported.

- [ ] **Step 3: Add plot defaults to constants.js**

Add to the `DEFAULTS` object in `src-v2/core/constants.js`:

```js
  // Plot defaults
  plotColor: '#2563eb',
  plotStrokeWidth: 2,
  plotFill: 'none',
  plotHandler: 'lineto',
  markSize: 3,
```

- [ ] **Step 4: Implement resolvePlotStyle in style.js**

Add to `src-v2/style/style.js` after the existing `resolveEdgeStyle`:

```js
/**
 * Resolve effective style for a plot.
 * Merge order: DEFAULTS → config.plotStyle → per-plot properties
 * @param {number} plotIndex
 * @param {Object} config - full config object
 * @returns {Object} resolved style
 */
export function resolvePlotStyle(plotIndex, config) {
  const base = {
    stroke: DEFAULTS.plotColor,
    strokeWidth: DEFAULTS.plotStrokeWidth,
    fill: DEFAULTS.plotFill,
    handler: DEFAULTS.plotHandler,
    tension: undefined,
    barWidth: undefined,
    barShift: undefined,
    baseline: undefined,
    mark: undefined,
    markSize: DEFAULTS.markSize,
    markRepeat: undefined,
    markPhase: undefined,
    markIndices: undefined,
    dashed: false,
    opacity: 1,
    className: null,
  };
  const registry = new StyleRegistry(config.styles);
  const plotStyle = registry.expand(config.plotStyle || {});
  const plotProps = config.plots?.[plotIndex] || {};
  const expandedProps = registry.expand(plotProps);
  return { ...base, ...plotStyle, ...expandedProps };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/plot-render-integration.test.js`
Expected: All 4 tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/core/constants.js src-v2/style/style.js test/plot-render-integration.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add plot style defaults and resolvePlotStyle"
```

---

### Task 2: Plot Emission in the SVG Emitter

**What it does:** Adds `emitPlot()` to the emitter — renders a plot's `Path` as a `<path>` element and its marks as `<g>` groups with `<path>` mark symbols. Plots go in the edge layer (behind nodes, like TikZ's `\draw plot`). Also updates `expandBBoxFromElement` to handle the new plot group structure for correct viewBox computation.

**Files:**
- Modify: `src-v2/svg/emitter.js`
- Create: `test/plot-emitter.test.js`

- [ ] **Step 1: Write failing tests for plot emission**

Create `test/plot-emitter.test.js`:

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
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

describe('emitPlot', () => {
  it('renders a plot path in the edge layer', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 100 -50 L 200 0',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none' },
        marks: null,
        markPath: null,
        markFillMode: 'stroke',
      }],
    });
    const edgeLayer = svg.querySelector('.edge-layer');
    const paths = edgeLayer.querySelectorAll('path.plot-path');
    assert.strictEqual(paths.length, 1);
    assert.strictEqual(paths[0].getAttribute('stroke'), 'blue');
    assert.strictEqual(paths[0].getAttribute('d'), 'M 0 0 L 100 -50 L 200 0');
  });

  it('renders marks at each position', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 100 0',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none', markStroke: 'blue', markFill: 'blue' },
        marks: [{ x: 0, y: 0 }, { x: 50, y: -25 }, { x: 100, y: 0 }],
        markPath: 'M -3 0 A 3 3 0 1 0 3 0 A 3 3 0 1 0 -3 0 Z',
        markFillMode: 'filled',
      }],
    });
    const edgeLayer = svg.querySelector('.edge-layer');
    const markGroups = edgeLayer.querySelectorAll('g.plot-mark');
    assert.strictEqual(markGroups.length, 3);
  });

  it('applies dashed style to plot path', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 100 0',
        style: { stroke: 'red', strokeWidth: 1, fill: 'none', dashed: true },
        marks: null,
        markPath: null,
        markFillMode: 'stroke',
      }],
    });
    const path = svg.querySelector('.plot-path');
    assert.ok(path.getAttribute('stroke-dasharray'));
  });

  it('coexists with nodes and edges', () => {
    const svg = makeSVG();
    // Minimal model with a node, no edges, and a plot
    const circleShape = {
      savedGeometry(c) { return c; },
      backgroundPath() { return ''; },
      borderPoint(g, d) { return g.center; },
      namedAnchors() { return {}; },
    };
    emitSVG(svg, {
      nodes: {
        q0: {
          id: 'q0',
          center: { x: 50, y: -25 },
          geom: { radius: 15, outerSep: 0.75 },
          shape: circleShape,
          style: { shape: 'circle', radius: 15, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'peak',
        },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 50 -25 L 100 0',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none' },
        marks: null,
        markPath: null,
        markFillMode: 'stroke',
      }],
    });
    // Both should exist
    assert.ok(svg.querySelector('.node-layer #node-q0'), 'node should exist');
    assert.ok(svg.querySelector('.edge-layer .plot-path'), 'plot should exist');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/plot-emitter.test.js`
Expected: FAIL — plots not rendered (emitter ignores `resolved.plots`).

- [ ] **Step 3: Implement emitPlot in emitter.js**

Add this function before the `emitSVG` function in `src-v2/svg/emitter.js`:

```js
// ────────────────────────────────────────────
// Plot emission
// ────────────────────────────────────────────

/**
 * Emit SVG elements for a single plot (path + marks).
 * @param {Object} plotModel - { path, style, marks, markPath, markFillMode }
 * @param {SVGGElement} layer - target layer to append to
 */
function emitPlot(plotModel, layer) {
  const { path, style, marks, markPath, markFillMode } = plotModel;

  // Plot path
  if (path) {
    const attrs = {
      d: path,
      fill: style.fill ?? 'none',
      stroke: style.stroke ?? '#2563eb',
      'stroke-width': style.strokeWidth ?? 2,
      class: 'plot-path',
    };
    if (style.dashed) {
      attrs['stroke-dasharray'] = typeof style.dashed === 'string' ? style.dashed : '6 4';
    }
    if (style.opacity != null && style.opacity < 1) {
      attrs.opacity = style.opacity;
    }
    if (style.className) {
      attrs.class += ` ${style.className}`;
    }
    attrs['stroke-linejoin'] = 'round';
    layer.appendChild(createSVGElement('path', attrs));
  }

  // Plot marks
  if (marks && markPath) {
    const markStroke = style.markStroke ?? style.stroke ?? '#2563eb';
    const markFill = markFillMode === 'filled'
      ? (style.markFill ?? style.stroke ?? '#2563eb')
      : 'none';

    for (const pt of marks) {
      const g = createSVGElement('g', {
        class: 'plot-mark',
        transform: `translate(${pt.x},${pt.y})`,
      });
      g.appendChild(createSVGElement('path', {
        d: markPath,
        stroke: markStroke,
        'stroke-width': 1.5,
        fill: markFill,
      }));
      layer.appendChild(g);
    }
  }
}
```

- [ ] **Step 4: Wire emitPlot into emitSVG**

In the `emitSVG` function in `src-v2/svg/emitter.js`, add plot rendering after edge emission (after the `// 5. Emit edge label nodes` comment block) and before node emission. Add `plots` to destructuring and add refs tracking:

In the destructuring at the top of `emitSVG`, add `plots = []`:

```js
  const {
    nodes = {},
    edges = [],
    shadowFilters = [],
    arrowDefs = [],
    plots = [],
    seed,
  } = resolved;
```

After the edge label loop (after line `refs.labels.push(labelEl);`), add:

```js
    // 5.5. Emit plots (in edge layer, behind nodes)
    for (const plotModel of plots) {
      emitPlot(plotModel, edgeLayer);
    }
```

Add `plots: []` to the refs object:

```js
  const refs = {
    nodes: {},
    edges: [],
    labels: [],
    plots: [],
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/plot-emitter.test.js`
Expected: All 4 tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/svg/emitter.js test/plot-emitter.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add emitPlot to SVG emitter for plot path + marks rendering"
```

---

### Task 3: Pipeline Integration — config.plots in render()

**What it does:** Adds Phase 4.5 to the render pipeline in `index.js`. For each entry in `config.plots`, it calls `plot()` to get the Path and marks, applies the coordinate transform (scaleX, scaleY, offsetX, offsetY) to convert from math coords to SVG coords, and builds a plot model for the emitter. Also exposes sampled points so nodes can reference them via `at: { plot, point }`.

**Files:**
- Modify: `src-v2/index.js`
- Modify: `test/plot-render-integration.test.js`

- [ ] **Step 1: Write failing integration tests**

Append to `test/plot-render-integration.test.js`:

```js
import { JSDOM } from 'jsdom';
import { render } from '../src-v2/index.js';

let document;
import { before } from 'node:test';

before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  document = dom.window.document;
});

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

describe('render() with config.plots', () => {
  it('renders a simple function plot', () => {
    const svg = makeSVG();
    render(svg, {
      states: { origin: { position: { x: 0, y: 0 }, label: '' } },
      edges: [],
      plots: [{
        expr: 'x',
        domain: [0, 5],
        samples: 6,
        scaleX: 20,
        scaleY: 20,
        offsetX: 0,
        offsetY: 0,
      }],
    });
    const plotPath = svg.querySelector('.plot-path');
    assert.ok(plotPath, 'should render a plot path');
    assert.ok(plotPath.getAttribute('d').includes('L'), 'should have line segments');
  });

  it('renders a plot with smooth handler', () => {
    const svg = makeSVG();
    render(svg, {
      states: { origin: { position: { x: 0, y: 0 }, label: '' } },
      edges: [],
      plots: [{
        expr: 'sin(x)',
        domain: [0, 6.28],
        samples: 20,
        handler: 'smooth',
        scaleX: 50,
        scaleY: 50,
        offsetX: 0,
        offsetY: 0,
      }],
    });
    const plotPath = svg.querySelector('.plot-path');
    assert.ok(plotPath.getAttribute('d').includes('C'), 'smooth should produce curves');
  });

  it('renders a plot with marks', () => {
    const svg = makeSVG();
    render(svg, {
      states: { origin: { position: { x: 0, y: 0 }, label: '' } },
      edges: [],
      plots: [{
        expr: 'x',
        domain: [0, 3],
        samples: 4,
        mark: '*',
        markSize: 3,
        scaleX: 30,
        scaleY: 30,
        offsetX: 0,
        offsetY: 0,
      }],
    });
    const marks = svg.querySelectorAll('.plot-mark');
    assert.strictEqual(marks.length, 4);
  });

  it('places a node at a plot data point', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        peak: {
          at: { plot: 0, point: 2 },
          label: 'max',
          shape: 'rectangle',
          radius: 10,
        },
      },
      edges: [],
      plots: [{
        expr: 'sin(x)',
        domain: [0, Math.PI],
        samples: 5,
        handler: 'smooth',
        scaleX: 50,
        scaleY: 50,
        offsetX: 100,
        offsetY: 100,
      }],
    });
    const node = svg.querySelector('#node-peak');
    assert.ok(node, 'node should exist');
    // Midpoint is x=pi/2, y=1 → SVG: (pi/2 * 50 + 100, -1 * 50 + 100) = (~178.5, 50)
    const transform = node.getAttribute('transform');
    assert.ok(transform.includes('translate'), 'node should be positioned');
  });

  it('renders plot from inline coordinates', () => {
    const svg = makeSVG();
    render(svg, {
      states: { origin: { position: { x: 0, y: 0 }, label: '' } },
      edges: [],
      plots: [{
        coordinates: [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 1 }],
        handler: 'ybar',
        barWidth: 0.8,
        scaleX: 50,
        scaleY: 30,
        offsetX: 50,
        offsetY: 100,
      }],
    });
    const plotPath = svg.querySelector('.plot-path');
    assert.ok(plotPath.getAttribute('d').includes('Z'), 'ybar should produce closed paths');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/plot-render-integration.test.js`
Expected: FAIL — `render()` does not process `config.plots`.

- [ ] **Step 3: Implement Phase 4.5 in index.js**

Add import at the top of `src-v2/index.js`:

```js
import { plot as computePlot } from './plotting/index.js';
import { getMarkFillMode } from './plotting/marks.js';
import { resolvePlotStyle } from './style/style.js';
```

Add Phase 4.5 after Phase 4 (edge geometry) and before Phase 5 (resolve styles). Insert after the `edgeLabelPositions.push(null)` block:

```js
  // ── PHASE 4.5: PROCESS PLOTS ──────────────────────────────────────
  // Evaluate plot expressions, apply handlers, transform to SVG coords.
  // Also collect resolved points for node positioning (at: { plot, point }).

  const plots = config.plots || [];
  const plotModels = [];
  const plotResolvedPoints = []; // per-plot array of SVG-coord points

  for (let i = 0; i < plots.length; i++) {
    const plotDef = plots[i];
    const style = resolvePlotStyle(i, config);

    // Evaluate the plot
    const result = computePlot(plotDef.expr ?? null, {
      domain: plotDef.domain,
      samples: plotDef.samples,
      samplesAt: plotDef.samplesAt,
      variable: plotDef.variable,
      yExpr: plotDef.yExpr,
      yRange: plotDef.yRange,
      coordinates: plotDef.coordinates,
      handler: style.handler,
      tension: style.tension,
      barWidth: style.barWidth ?? plotDef.barWidth,
      barShift: style.barShift ?? plotDef.barShift,
      baseline: style.baseline ?? plotDef.baseline,
      mark: style.mark,
      markSize: style.markSize,
      markRepeat: style.markRepeat,
      markPhase: style.markPhase,
      markIndices: style.markIndices,
    });

    // Coordinate transform: math (y-up) → SVG (y-down)
    const sx = plotDef.scaleX ?? 1;
    const sy = plotDef.scaleY ?? 1;
    const ox = plotDef.offsetX ?? 0;
    const oy = plotDef.offsetY ?? 0;

    // Transform the path string
    const transformedPath = transformPlotPath(result.path, sx, sy, ox, oy);

    // Transform mark positions to SVG coords
    let svgMarks = null;
    if (result.marks) {
      svgMarks = result.marks.map(pt => ({
        x: pt.x * sx + ox,
        y: -pt.y * sy + oy,
      }));
    }

    // Transform all sampled points to SVG coords for node referencing
    const svgPoints = result.points
      .filter(p => !p.undefined && p.y !== undefined)
      .map(p => ({ x: p.x * sx + ox, y: -p.y * sy + oy }));
    plotResolvedPoints.push(svgPoints);

    plotModels.push({
      path: transformedPath,
      style,
      marks: svgMarks,
      markPath: result.markPath ? result.markPath.toSVGPath() : null,
      markFillMode: style.mark ? getMarkFillMode(style.mark) : 'stroke',
    });
  }
```

Also add this helper function at module level (before `render()`):

```js
/**
 * Transform a Path's coordinates from math (y-up) to SVG (y-down) with scale+offset.
 * @param {Path} path - Path instance from plot()
 * @param {number} sx - x scale
 * @param {number} sy - y scale
 * @param {number} ox - x offset
 * @param {number} oy - y offset
 * @returns {string} SVG path string
 */
function transformPlotPath(path, sx, sy, ox, oy) {
  if (!path || path.isEmpty()) return '';
  const parts = [];
  for (const seg of path.segments) {
    if (seg.type === 'Z') {
      parts.push('Z');
    } else if (seg.type === 'M' || seg.type === 'L') {
      const x = seg.args[0] * sx + ox;
      const y = -seg.args[1] * sy + oy;
      parts.push(`${seg.type} ${round4(x)} ${round4(y)}`);
    } else if (seg.type === 'C') {
      const x1 = seg.args[0] * sx + ox, y1 = -seg.args[1] * sy + oy;
      const x2 = seg.args[2] * sx + ox, y2 = -seg.args[3] * sy + oy;
      const x3 = seg.args[4] * sx + ox, y3 = -seg.args[5] * sy + oy;
      parts.push(`C ${round4(x1)} ${round4(y1)} ${round4(x2)} ${round4(y2)} ${round4(x3)} ${round4(y3)}`);
    }
  }
  return parts.join(' ');
}

function round4(v) {
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? 0 : r;
}
```

- [ ] **Step 4: Wire plot-based node positioning**

In Phase 2 (resolve positions), add early handling for `at: { plot, point }` nodes. Insert this at the start of `render()`, before `resolvePositions` is called — resolve `at` references into absolute positions:

```js
  // Pre-resolve plot-based positions: nodes with at: { plot, point }
  // These need plots to be evaluated first, but positions need to be known
  // before Phase 2. Solution: evaluate plots eagerly for position-only nodes.
  const plotPointPositions = {}; // nodeId → { x, y } in SVG coords
  if (config.plots && config.plots.length > 0) {
    // Quick-evaluate all plots to get point arrays
    const quickPlotPoints = [];
    for (const plotDef of config.plots) {
      const result = computePlot(plotDef.expr ?? null, {
        domain: plotDef.domain,
        samples: plotDef.samples,
        samplesAt: plotDef.samplesAt,
        variable: plotDef.variable,
        yExpr: plotDef.yExpr,
        yRange: plotDef.yRange,
        coordinates: plotDef.coordinates,
        handler: plotDef.handler ?? 'lineto',
      });
      const sx = plotDef.scaleX ?? 1;
      const sy = plotDef.scaleY ?? 1;
      const ox = plotDef.offsetX ?? 0;
      const oy = plotDef.offsetY ?? 0;
      quickPlotPoints.push(
        result.points
          .filter(p => !p.undefined && p.y !== undefined)
          .map(p => ({ x: p.x * sx + ox, y: -p.y * sy + oy }))
      );
    }

    for (const id of stateIds) {
      const at = states[id].at;
      if (at && typeof at === 'object' && 'plot' in at && 'point' in at) {
        const pts = quickPlotPoints[at.plot];
        if (pts && pts[at.point] != null) {
          plotPointPositions[id] = pts[at.point];
          // Inject absolute position so resolvePositions handles it
          states[id] = { ...states[id], position: pts[at.point] };
        }
      }
    }
  }
```

This must go BEFORE the `resolvePositions` call.

- [ ] **Step 5: Pass plot models to emitter**

In Phase 6 (emit SVG), add `plots: plotModels` to the model object:

```js
  const model = {
    nodes: {},
    edges: [],
    arrowDefs,
    shadowFilters,
    plots: plotModels,
    seed: config.seed,
  };
```

- [ ] **Step 6: Handle empty states gracefully**

Update the early return at the top of `render()` to still process plots when there are no states:

Replace:
```js
  if (stateIds.length === 0) {
    return { nodes: {}, edges: [], labels: [] };
  }
```

With:
```js
  if (stateIds.length === 0 && plots.length === 0) {
    return { nodes: {}, edges: [], labels: [], plots: [] };
  }
```

Move `const plots = config.plots || [];` before this guard.

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test test/plot-render-integration.test.js`
Expected: All tests PASS.

- [ ] **Step 8: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/index.js test/plot-render-integration.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: integrate plots into render() pipeline with node-at-plot-point positioning"
```

---

### Task 4: Visual Demo — Plot with Annotated Nodes

**What it does:** Creates a demo HTML page showing a function plot with labeled nodes placed at specific data points — the primary use case motivating this integration.

**Files:**
- Create: `examples-v2/plot-with-nodes-demo.html`

- [ ] **Step 1: Create the demo page**

Create `examples-v2/plot-with-nodes-demo.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>tikz-svg: Plot with Nodes Demo</title>
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
  <h1>Plot + Nodes Integration Demo</h1>
  <p>Function plots with labeled nodes placed at specific data points via <code>at: { plot, point }</code>.</p>

  <div class="demo">
    <h2>sin(x) with annotated peak and zero-crossing</h2>
    <svg id="demo1" width="700" height="300"></svg>
  </div>

  <div class="demo">
    <h2>Parabola with vertex and roots</h2>
    <svg id="demo2" width="700" height="350"></svg>
  </div>

  <div class="demo">
    <h2>Data coordinates with labeled points</h2>
    <svg id="demo3" width="700" height="300"></svg>
  </div>

  <script type="module">
    import { render } from '../src-v2/index.js';

    // Demo 1: sin(x) with annotations
    render(document.getElementById('demo1'), {
      states: {
        peak: {
          at: { plot: 0, point: 12 },
          label: 'peak',
          shape: 'rectangle',
          radius: 12,
          fill: '#fef3c7',
          stroke: '#f59e0b',
        },
        zero: {
          at: { plot: 0, point: 24 },
          label: 'π',
          shape: 'circle',
          radius: 10,
          fill: '#dbeafe',
          stroke: '#2563eb',
        },
      },
      edges: [],
      plots: [{
        expr: 'sin(x)',
        domain: [0, 2 * Math.PI],
        samples: 49,
        handler: 'smooth',
        stroke: '#2563eb',
        mark: 'o',
        markSize: 2,
        markRepeat: 8,
        scaleX: 80,
        scaleY: 80,
        offsetX: 80,
        offsetY: 150,
      }],
    });

    // Demo 2: Parabola x^2 - 4 with vertex and roots
    render(document.getElementById('demo2'), {
      states: {
        vertex: {
          at: { plot: 0, point: 10 },
          label: 'vertex',
          shape: 'rectangle',
          radius: 14,
          fill: '#fce7f3',
          stroke: '#ec4899',
        },
        root1: {
          at: { plot: 0, point: 0 },
          label: 'x=-2',
          shape: 'rectangle',
          radius: 12,
          fill: '#d1fae5',
          stroke: '#059669',
        },
        root2: {
          at: { plot: 0, point: 20 },
          label: 'x=2',
          shape: 'rectangle',
          radius: 12,
          fill: '#d1fae5',
          stroke: '#059669',
        },
      },
      edges: [],
      plots: [{
        expr: 'x^2 - 4',
        domain: [-2, 2],
        samples: 21,
        handler: 'smooth',
        stroke: '#dc2626',
        scaleX: 120,
        scaleY: 40,
        offsetX: 350,
        offsetY: 200,
      }],
    });

    // Demo 3: Inline coordinates with labels
    render(document.getElementById('demo3'), {
      states: {
        a: { at: { plot: 0, point: 0 }, label: 'Jan', shape: 'rectangle', radius: 12, fill: '#ede9fe', stroke: '#7c3aed' },
        b: { at: { plot: 0, point: 2 }, label: 'Mar', shape: 'rectangle', radius: 12, fill: '#ede9fe', stroke: '#7c3aed' },
        c: { at: { plot: 0, point: 5 }, label: 'Jun', shape: 'rectangle', radius: 12, fill: '#fef3c7', stroke: '#f59e0b' },
      },
      edges: [],
      plots: [{
        coordinates: [
          { x: 0, y: 2 }, { x: 1, y: 3 }, { x: 2, y: 1 },
          { x: 3, y: 4 }, { x: 4, y: 3 }, { x: 5, y: 5 },
        ],
        handler: 'smooth',
        stroke: '#7c3aed',
        mark: '*',
        markSize: 3,
        scaleX: 100,
        scaleY: 40,
        offsetX: 80,
        offsetY: 250,
      }],
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Run:
```bash
npx http-server /Users/sergiop/Dropbox/Scripts/tikz-svg -p 8080 -c-1
open http://localhost:8080/examples-v2/plot-with-nodes-demo.html
```

Expected: Three plots visible, each with labeled annotation nodes at specific data points.

- [ ] **Step 3: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add examples-v2/plot-with-nodes-demo.html
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add plot-with-nodes demo showing integrated plot + node rendering"
```

---

## Verification Checklist

After all 4 tasks:

- [ ] `node --test` — all tests pass
- [ ] `render()` and `renderAutomaton()` still work unchanged for configs with no `plots`
- [ ] Plots render in edge layer (behind nodes)
- [ ] Nodes with `at: { plot, point }` are positioned at correct SVG coordinates
- [ ] Marks render at correct SVG coordinates
- [ ] Style cascade works: `DEFAULTS → plotStyle → per-plot`
- [ ] Demo page shows plots with annotated nodes in browser (via `http-server`)
- [ ] No modifications to `src-v2/plotting/` — pure consumer of its public API

## What This Does NOT Cover (future work)

- **Axes and ticks** — grid lines, axis labels, tick marks. Would be a separate module.
- **Plot-to-plot edges** — connecting annotation nodes with edges (already possible manually since nodes exist in the normal pipeline).
- **Legend** — automatic legend generation from plot styles.
- **Multiple y-axes** — dual-axis plots.

---

## Context for Future Implementer

### Key design decisions

1. **Plots evaluated twice when nodes use `at: { plot, point }`** — once early (before position resolution) to get point coordinates for node placement, once in Phase 4.5 for full rendering. This is intentional: position resolution needs coordinates before edge geometry, but plot styling needs the full style cascade. The double evaluation is cheap (math.js compile is cached).

2. **Coordinate transform lives in config, not in the plot module** — `scaleX`, `scaleY`, `offsetX`, `offsetY` are per-plot config properties, not part of the plot() API. This keeps the plot module pure (math coords) and lets the render pipeline handle SVG conversion.

3. **Plots go in edge layer** — matches TikZ where `\draw plot` is a path operation. Nodes paint on top, which is the expected z-order for annotations.

4. **The plot model passed to emitter uses pre-transformed SVG strings** — the emitter doesn't know about math coordinates. Path strings and mark positions are already in SVG space.

### Browser demo requirement

Demos must be served via `http-server` (not `file://`) because ES module imports require same-origin. The mathjs UMD bundle is loaded via CDN `<script>` tag, and a shim (`examples-v2/mathjs-shim.js`) re-exports `window.math` as ES module.
