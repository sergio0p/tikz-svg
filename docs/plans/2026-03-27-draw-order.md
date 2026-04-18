**Status: COMPLETED** — `config.draw` ordered rendering implemented.

# Draw-Order-Aware Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `config.draw` ordered array that renders elements in declaration order — matching TikZ's sequential paint model where later elements cover earlier ones.

**Architecture:** When `config.draw` is present, the pipeline processes each entry in order, building a flat `drawOrder` array of tagged items (`{ type: 'node'|'edge'|'path'|'plot', ... }`). The emitter renders them into a single `<g class="draw-layer">` in order, replacing the fixed layer groups. When `config.draw` is absent, the existing layer-based approach runs unchanged (full backward compatibility). The existing `config.states`/`config.edges`/`config.paths`/`config.plots` arrays still work as before.

**Tech Stack:** ES modules, existing emit functions, existing pipeline. Tests: `node --test` + jsdom.

**Stop-at-any-step guarantee:** Each task ships a complete, tested feature.

**Usage example:**
```js
render(svg, {
  scale: 250,
  draw: [
    // Y-axis (drawn first = behind everything)
    { type: 'path', points: [{x:0,y:-0.3},{x:0,y:0.7}], arrow: '<->' },
    // X-axis
    { type: 'path', points: [{x:-0.1,y:0},{x:1.3,y:0}], arrow: '<->' },
    // Dotted line
    { type: 'path', points: [{x:0.25,y:0.1},{x:0.25,y:-0.3}], dotted: true },
    // Label (drawn after dotted = covers it if fill:white)
    { type: 'node', id: 'lbl', position: {x:0.25,y:0.1}, label: '¼', anchor: 'north' },
    // Blue plot
    { type: 'plot', expr: u1, domain: [0,1.3], samples: 200, handler: 'smooth', stroke: 'blue' },
    // Red segment (drawn after plot = on top)
    { type: 'path', points: [{x:0,y:0},{x:0.25,y:0}], stroke: 'red', thick: true },
  ],
});
```

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-v2/index.js` | **Modify** | Process `config.draw` entries: resolve styles, build geometry, create ordered model |
| `src-v2/svg/emitter.js` | **Modify** | Add `emitOrdered()` path: render `drawOrder` items into single group in sequence |
| `test/draw-order.test.js` | **Create** | Tests for ordered rendering, backward compat, mixed element types |

---

### Task 1: Ordered Emission in the Emitter

**What it does:** Adds a `drawOrder` array to the model. When present, the emitter renders all elements into a single `<g class="draw-layer">` in order instead of using the three fixed layers. Each item in `drawOrder` is tagged with its type so the emitter knows which emit function to call.

**Files:**
- Modify: `src-v2/svg/emitter.js`
- Create: `test/draw-order.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/draw-order.test.js`:

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

const circleShape = {
  savedGeometry(c) { return c; },
  backgroundPath() { return ''; },
  borderPoint(g, d) { return g.center; },
  namedAnchors() { return {}; },
};

describe('ordered emission (drawOrder)', () => {
  it('renders elements in declaration order into a single layer', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 15, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 15, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'A' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 0',
        style: { stroke: '#000', strokeWidth: 1.5, fill: 'none' },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
      drawOrder: [
        { type: 'node', id: 'a' },
        { type: 'drawPath', index: 0 },
      ],
    });
    const drawLayer = svg.querySelector('.draw-layer');
    assert.ok(drawLayer, 'should have draw-layer');
    const children = [...drawLayer.children];
    // Node first, then path — path paints on top of node
    assert.ok(children[0].classList.contains('node'), 'first child should be node');
    assert.ok(children[1].classList.contains('draw-path'), 'second child should be path');
  });

  it('falls back to layer-based rendering when drawOrder is absent', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 15, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 15, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'A' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
    });
    // Should use traditional layers
    assert.ok(svg.querySelector('.edge-layer'), 'should have edge-layer');
    assert.ok(svg.querySelector('.node-layer'), 'should have node-layer');
    assert.ok(!svg.querySelector('.draw-layer'), 'should NOT have draw-layer');
  });

  it('renders plots in draw order', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 100 50',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none' },
        marks: null, markPath: null, markFillMode: 'stroke',
      }],
      drawPaths: [{
        d: 'M 0 0 L 200 0',
        style: { stroke: '#000', strokeWidth: 1.5, fill: 'none' },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
      drawOrder: [
        { type: 'drawPath', index: 0 },
        { type: 'plot', index: 0 },
      ],
    });
    const drawLayer = svg.querySelector('.draw-layer');
    const children = [...drawLayer.children];
    assert.ok(children[0].classList.contains('draw-path'), 'path first');
    assert.ok(children[1].classList.contains('plot-path'), 'plot second');
  });

  it('renders edge with its label in order', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        index: 0, from: 'a', to: 'b', label: 'edge', path: 'M 0 0 L 100 0',
        edgeGeometry: { path: 'M 0 0 L 100 0' },
        labelNode: { center: { x: 50, y: -10 }, geom: { halfWidth: 20, halfHeight: 8 }, angle: null },
        style: { stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
      }],
      arrowDefs: [],
      shadowFilters: [],
      drawOrder: [
        { type: 'edge', index: 0 },
      ],
    });
    const drawLayer = svg.querySelector('.draw-layer');
    assert.ok(drawLayer, 'should have draw-layer');
    // Edge path + label should both be in the draw layer
    const paths = drawLayer.querySelectorAll('path');
    assert.ok(paths.length >= 1, 'should have edge path');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/draw-order.test.js`
Expected: FAIL — `drawOrder` not handled.

- [ ] **Step 3: Implement ordered emission in emitSVG**

In `src-v2/svg/emitter.js`, modify `emitSVG` to check for `drawOrder` and use a different rendering path:

Add `drawOrder` to the destructuring:

```js
  const {
    nodes = {},
    edges = [],
    shadowFilters = [],
    arrowDefs = [],
    plots = [],
    drawPaths = [],
    drawOrder,
    seed,
  } = resolved;
```

After the PRNG initialization and before the layer creation, add a branch:

```js
  if (drawOrder) {
    // ── ORDERED RENDERING (TikZ-faithful paint order) ──────────
    // All elements go into a single group in declaration order.

    const drawLayer = createSVGElement('g', { class: 'draw-layer' });
    svgEl.appendChild(drawLayer);

    const refs = { nodes: {}, edges: [], labels: [], plots: [] };

    const defaultArrowDef = arrowDefs.length > 0 ? arrowDefs[0] : null;
    const defaultArrowId = defaultArrowDef ? defaultArrowDef.id : null;

    for (const item of drawOrder) {
      switch (item.type) {
        case 'node': {
          const node = nodes[item.id];
          if (!node) break;
          const g = emitNode(item.id, node, prng);
          drawLayer.appendChild(g);
          refs.nodes[item.id] = g;
          if (node.style.initial) {
            const arrowPath = emitInitialArrow(node, defaultArrowId, defaultArrowDef);
            drawLayer.appendChild(arrowPath);
          }
          break;
        }
        case 'edge': {
          const edge = edges[item.index];
          if (!edge) break;
          const pathEl = emitEdgePath(edge, prng);
          drawLayer.appendChild(pathEl);
          refs.edges.push(pathEl);
          const labelEl = emitLabelNode(edge);
          if (labelEl) {
            drawLayer.appendChild(labelEl);
            refs.labels.push(labelEl);
          }
          break;
        }
        case 'plot': {
          const plotModel = plots[item.index];
          if (!plotModel) break;
          emitPlot(plotModel, drawLayer);
          break;
        }
        case 'drawPath': {
          const pathModel = drawPaths[item.index];
          if (!pathModel) break;
          emitDrawPath(pathModel, drawLayer, drawLayer);
          break;
        }
      }
    }

    const viewBox = computeViewBox(svgEl);
    svgEl.setAttribute('viewBox', viewBox);
    return refs;
  }
```

Then update `computeViewBox` to also scan `.draw-layer`:

Replace:
```js
  for (const layer of svgEl.querySelectorAll('.edge-layer, .label-layer, .node-layer')) {
```

With:
```js
  for (const layer of svgEl.querySelectorAll('.edge-layer, .label-layer, .node-layer, .draw-layer')) {
```

The existing layer-based code remains below, unchanged — it only runs when `drawOrder` is absent.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/draw-order.test.js`
Expected: All 4 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS (layer-based rendering unchanged).

- [ ] **Step 6: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add src-v2/svg/emitter.js test/draw-order.test.js
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: add drawOrder array for declaration-order rendering"
```

---

### Task 2: Pipeline — Build drawOrder from config.draw

**What it does:** When `config.draw` is present, the pipeline processes each entry to resolve styles, build geometry, and create the `drawOrder` array for the emitter. Each `config.draw` entry has a `type` field and the same properties as the corresponding `config.states[id]`, `config.paths[i]`, or `config.plots[i]` entry. The pipeline handles everything — nodes get positioned (Phase 2 equivalent), geometry computed (Phase 3 equivalent), paths/plots processed — then tags each for ordered emission.

**Files:**
- Modify: `src-v2/index.js`
- Modify: `test/draw-order.test.js`

- [ ] **Step 1: Write failing integration tests**

Append to `test/draw-order.test.js`:

```js
import { render } from '../src-v2/index.js';

describe('render() with config.draw', () => {
  it('renders draw items in order', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], arrow: '<->' },
        { type: 'node', id: 'lbl', position: { x: 100, y: 0 }, label: 'mid' },
        { type: 'path', points: [{ x: 100, y: -50 }, { x: 100, y: 50 }], dotted: true },
      ],
    });
    const drawLayer = svg.querySelector('.draw-layer');
    assert.ok(drawLayer, 'should use draw-layer');
    const children = [...drawLayer.children];
    // 3 items: path, node (g.node), path
    assert.ok(children.length >= 3, `expected >= 3 children, got ${children.length}`);
  });

  it('renders path before node — path behind node', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] },
        { type: 'node', id: 'a', position: { x: 100, y: 0 }, label: 'A', fill: 'white' },
      ],
    });
    const children = [...svg.querySelector('.draw-layer').children];
    assert.ok(children[0].classList.contains('draw-path'), 'path first');
    assert.ok(children[1].classList.contains('node'), 'node second (on top)');
  });

  it('renders node before path — node behind path', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'node', id: 'a', position: { x: 100, y: 0 }, label: 'A', fill: 'white' },
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] },
      ],
    });
    const children = [...svg.querySelector('.draw-layer').children];
    assert.ok(children[0].classList.contains('node'), 'node first (behind)');
    assert.ok(children[1].classList.contains('draw-path'), 'path second (on top)');
  });

  it('applies global scale to draw items', () => {
    const svg = makeSVG();
    render(svg, {
      scale: 100,
      draw: [
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }] },
        { type: 'node', id: 'a', position: { x: 1, y: 0 }, label: 'A' },
      ],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('d').includes('200'), 'path x=2 should scale to 200');
    const node = svg.querySelector('#node-a');
    assert.ok(node.getAttribute('transform').includes('100'), 'node x=1 should scale to 100');
  });

  it('mixes plots and paths in draw order', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], arrow: '<->' },
        { type: 'plot', expr: (x) => x * x, domain: [0, 2], samples: 5, scaleX: 50, scaleY: 50, offsetX: 0, offsetY: 0, stroke: 'blue' },
        { type: 'node', id: 'lbl', position: { x: 200, y: 0 }, label: 'x', anchor: 'west' },
      ],
    });
    const layer = svg.querySelector('.draw-layer');
    assert.ok(layer.querySelector('.draw-path'), 'has path');
    assert.ok(layer.querySelector('.plot-path'), 'has plot');
    assert.ok(layer.querySelector('#node-lbl'), 'has node');
  });

  it('still works with config.states/edges/paths when config.draw is absent', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { position: { x: 50, y: 50 }, label: 'Q' } },
      edges: [],
      paths: [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }],
    });
    assert.ok(svg.querySelector('.edge-layer'), 'should use traditional layers');
    assert.ok(svg.querySelector('.node-layer'), 'should use traditional layers');
    assert.ok(!svg.querySelector('.draw-layer'), 'no draw-layer');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/draw-order.test.js`
Expected: FAIL — `config.draw` not processed.

- [ ] **Step 3: Implement config.draw processing in the pipeline**

In `src-v2/index.js`, at the top of `render()` (in Phase 1), add a branch for `config.draw`:

After the existing Phase 1 parse block and the early return guard, add:

```js
  // ── DRAW-ORDER MODE ──────────────────────────────────────────────────
  // When config.draw is present, process entries in order and build drawOrder.
  // This replaces the separate states/edges/paths/plots arrays.
  if (config.draw) {
    const drawStates = {};
    const drawEdges = [];
    const drawPlots = [];
    const drawPaths = [];
    const drawOrderSpec = [];

    // Separate entries by type and assign indices
    for (const entry of config.draw) {
      switch (entry.type) {
        case 'node': {
          const id = entry.id;
          drawStates[id] = { ...entry };
          delete drawStates[id].type;
          delete drawStates[id].id;
          drawOrderSpec.push({ type: 'node', id });
          break;
        }
        case 'edge': {
          const idx = drawEdges.length;
          drawEdges.push({ ...entry });
          delete drawEdges[idx].type;
          drawOrderSpec.push({ type: 'edge', index: idx });
          break;
        }
        case 'plot': {
          const idx = drawPlots.length;
          drawPlots.push({ ...entry });
          delete drawPlots[idx].type;
          drawOrderSpec.push({ type: 'plot', index: idx });
          break;
        }
        case 'path': {
          const idx = drawPaths.length;
          drawPaths.push({ ...entry });
          delete drawPaths[idx].type;
          drawOrderSpec.push({ type: 'drawPath', index: idx });
          break;
        }
      }
    }

    // Recurse with separated arrays + drawOrder tag
    // Build a config that uses the standard pipeline but adds drawOrder
    const subConfig = {
      ...config,
      states: drawStates,
      edges: drawEdges,
      plots: drawPlots,
      paths: drawPaths,
      _drawOrder: drawOrderSpec,
    };
    delete subConfig.draw;
    return render(svgEl, subConfig);
  }
```

Then, in Phase 6 (emit SVG), pass `_drawOrder` to the model:

In the model construction, add:

```js
    drawOrder: config._drawOrder,
```

So the model becomes:

```js
  const model = {
    nodes: {},
    edges: [],
    arrowDefs,
    shadowFilters,
    plots: plotModels,
    drawPaths: drawPathModels,
    drawOrder: config._drawOrder,
    seed: config.seed,
  };
```

Also update the early return guard to handle `config.draw`:

Replace:
```js
  if (stateIds.length === 0 && plots.length === 0 && paths.length === 0) {
    return { nodes: {}, edges: [], labels: [], plots: [] };
  }
```

With:
```js
  if (stateIds.length === 0 && plots.length === 0 && paths.length === 0 && !config._drawOrder) {
    return { nodes: {}, edges: [], labels: [], plots: [] };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/draw-order.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS (backward compat).

- [ ] **Step 6: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add src-v2/index.js test/draw-order.test.js
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: add config.draw for declaration-order rendering"
```

---

### Task 3: Update Economics Demo to Use config.draw

**What it does:** Rewrites the economics demo to use `config.draw` with elements in the exact same order as the original TikZ source. This proves the feature works end-to-end and produces correct z-ordering.

**Files:**
- Modify: `examples-v2/economics-demo.html`

- [ ] **Step 1: Rewrite panel 1 using config.draw**

Replace panel 1's `render()` call with a `config.draw` version that mirrors the original TikZ source order:

```js
    render(document.getElementById('panel1'), {
      scale: 280,
      originX: 130,
      originY: 120,
      draw: [
        // \draw[<->] (0,0.3)--(0,-0.7)  — Y-axis
        { type: 'path', points: [{x:0,y:-0.3},{x:0,y:0.7}], arrow: '<->' },
        // \draw[<->] (-0.1,0)--(1.30,0) — X-axis
        { type: 'path', points: [{x:-0.1,y:0},{x:1.30,y:0}], arrow: '<->' },
        // \draw (-0.4,0.38) node[right]{u1(e1,e2|Δ)}
        { type: 'node', id: 'ylabel', ...txt(-0.4, 0.38, 'u₁(e₁,e₂|Δ)', 'west') },
        // \draw (1.32,0) node[right]{e1}
        { type: 'node', id: 'xlabel', ...txt(1.32, 0, 'e₁', 'west') },
        // \draw[color=blue] plot[samples=200](...) node[right]{u1}
        { type: 'plot', expr: u1_panel1, domain: [0,1.3], samples: 200, handler: 'smooth', stroke: 'blue', scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 },
        { type: 'node', id: 'u1end', ...txt(1.32, -0.69, 'u₁', 'west') },
        // \draw[dotted](.25,-0.1)--(.25,0.3)
        { type: 'path', points: [{x:0.25,y:0.1},{x:0.25,y:-0.3}], dotted: true },
        // \draw[dotted](1.25,-0.55)--(1.25,-0.1)
        { type: 'path', points: [{x:1.25,y:0.55},{x:1.25,y:0.1}], dotted: true },
        // \draw[dotted](.625,0)--(.625,0.219)
        { type: 'path', points: [{x:0.625,y:0},{x:0.625,y:-0.21875}], dotted: true },
        // \draw (0.25,-0.1) node[below]{1/4}
        { type: 'node', id: 'lbl1', ...txt(0.25, -0.1, '¼', 'north') },
        // \draw (0.625,0) node[below]{5/8}
        { type: 'node', id: 'lbl2', ...txt(0.625, 0, '⅝', 'north') },
        // \draw (1.25,0) node[below]{5/4}
        { type: 'node', id: 'lbl3', ...txt(1.25, 0, '⁵⁄₄', 'north') },
        // \draw[color=red,thick] (0,0)--(.25,0)
        { type: 'path', points: [{x:0,y:0},{x:0.25,y:0}], stroke: 'red', thick: true },
        // \draw (.6,-.7) node[below]{caption}
        { type: 'node', id: 'caption', ...txt(0.6, -0.7, 'Δ=0, c(e)=e², v₁=v₂=1, e₂=¼', 'north', 'tiny') },
      ],
    });
```

- [ ] **Step 2: Rewrite panel 2 similarly**

Same pattern for panel 2 — convert to `config.draw` with entries in TikZ source order.

- [ ] **Step 3: Verify in browser**

```bash
open http://localhost:8080/examples-v2/economics-demo.html
```

Expected: Both panels render correctly with proper z-ordering.

- [ ] **Step 4: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add examples-v2/economics-demo.html
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: rewrite economics demo using config.draw for TikZ-faithful paint order"
```

---

## Verification Checklist

After all 3 tasks:

- [ ] `node --test` — all tests pass
- [ ] `config.draw` renders elements in declaration order
- [ ] Nodes, paths, plots, edges all intermix correctly
- [ ] Global scale works with `config.draw`
- [ ] `config.states`/`edges`/`paths`/`plots` (no `draw`) still uses fixed layers — full backward compat
- [ ] Economics demo uses `config.draw` and renders correctly
- [ ] viewBox computation includes `draw-layer` elements

## What This Does NOT Cover

- **Edge geometry in draw mode** — Edges between named nodes still require both nodes to be defined before the edge. In `config.draw`, nodes must appear before edges that reference them.
- **Inline path node backgrounds** — Path inline labels (`nodes: [{ at, label }]`) are still bare `<text>` elements. Making them full nodes with backgrounds is a separate feature.
- **PGF layer system** — User-defined named layers (`\pgfdeclarelayer`, `\pgfsetlayers`). `config.draw` achieves the same z-ordering control without the named-layer abstraction.
