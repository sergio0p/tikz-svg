**Status: COMPLETED** — PGF-style `config.layers` implemented.

# Named Layers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PGF-style named layers so draw items can be assigned to `background`, `main`, or `foreground` layers (or custom names) controlling z-order regardless of declaration order.

**Architecture:** `config.layers` declares the layer order (default: `['background', 'main', 'foreground']`). Each `config.draw` item gets an optional `layer` property (default: `'main'`). The emitter creates one `<g>` per layer in declared order, then routes each draw item to its assigned layer's `<g>`. Within a layer, items render in declaration order. This extends the existing `drawOrder` mechanism — when `config.layers` is present alongside `config.draw`, the emitter uses layer-based routing instead of single-group sequential rendering.

**Tech Stack:** ES modules, existing `config.draw` pipeline, existing emit functions. Tests: `node --test` + jsdom.

**Stop-at-any-step guarantee:** Each task ships a complete, tested feature.

**PGF equivalent:**
```latex
\pgfdeclarelayer{background}
\pgfdeclarelayer{foreground}
\pgfsetlayers{background,main,foreground}

\begin{pgfonlayer}{background}
  \fill[yellow] (0,0) rectangle (3,2);
\end{pgfonlayer}
\draw (1,1) circle (0.5);  % on main layer
\begin{pgfonlayer}{foreground}
  \node at (1,1) {Top};
\end{pgfonlayer}
```

**Our equivalent:**
```js
render(svg, {
  layers: ['background', 'main', 'foreground'],
  draw: [
    { type: 'path', layer: 'background', points: [...], fill: 'yellow', cycle: true },
    { type: 'node', id: 'c', position: {x:1,y:1}, label: 'circle' },  // default: main
    { type: 'node', id: 't', layer: 'foreground', position: {x:1,y:1}, label: 'Top' },
  ],
});
```

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-v2/svg/emitter.js` | **Modify** | Create per-layer `<g>` groups, route draw items by `layer` property |
| `src-v2/index.js` | **Modify** | Pass `config.layers` and item `layer` properties through to emitter model |
| `test/named-layers.test.js` | **Create** | Tests for layer ordering, default layer, custom layers |
| `examples-v2/layers-demo.html` | **Create** | Demo with overlapping colored shapes on different layers |

---

### Task 1: Layer-Aware Emission

**What it does:** When the model includes both `drawOrder` and `layers`, the emitter creates one `<g class="layer-{name}">` per layer in the declared order, then routes each draw item to its layer's group. Items without a `layer` property go to `'main'`.

**Files:**
- Modify: `src-v2/svg/emitter.js`
- Create: `test/named-layers.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/named-layers.test.js`:

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { emitSVG } from '../src-v2/svg/emitter.js';
import { render } from '../src-v2/index.js';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
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

describe('emitter named layers', () => {
  it('creates layer groups in declared order', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      layers: ['background', 'main', 'foreground'],
      drawOrder: [],
    });
    const groups = svg.querySelectorAll('g[class^="layer-"]');
    assert.strictEqual(groups.length, 3);
    assert.strictEqual(groups[0].getAttribute('class'), 'layer-background');
    assert.strictEqual(groups[1].getAttribute('class'), 'layer-main');
    assert.strictEqual(groups[2].getAttribute('class'), 'layer-foreground');
  });

  it('routes items to their assigned layer', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 20, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 20, fill: 'red', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'A' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 100',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none' },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
      layers: ['background', 'main', 'foreground'],
      drawOrder: [
        { type: 'drawPath', index: 0, layer: 'background' },
        { type: 'node', id: 'a', layer: 'foreground' },
      ],
    });
    const bg = svg.querySelector('.layer-background');
    const fg = svg.querySelector('.layer-foreground');
    assert.ok(bg.querySelector('.draw-path'), 'path should be in background');
    assert.ok(fg.querySelector('.node'), 'node should be in foreground');
    assert.ok(!bg.querySelector('.node'), 'node should NOT be in background');
  });

  it('defaults to main layer when layer not specified', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 20, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 20, fill: 'red', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'A' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      layers: ['background', 'main', 'foreground'],
      drawOrder: [
        { type: 'node', id: 'a' },  // no layer → main
      ],
    });
    const main = svg.querySelector('.layer-main');
    assert.ok(main.querySelector('.node'), 'node should be in main by default');
  });

  it('background renders behind foreground (SVG paint order)', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        bg: { id: 'bg', center: { x: 50, y: 50 }, geom: { radius: 30, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 30, fill: 'yellow', stroke: 'none', strokeWidth: 0, fontSize: 14, fontFamily: 'serif' },
          label: '' },
        fg: { id: 'fg', center: { x: 50, y: 50 }, geom: { radius: 15, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 15, fill: 'red', stroke: 'none', strokeWidth: 0, fontSize: 14, fontFamily: 'serif' },
          label: '' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      layers: ['background', 'main', 'foreground'],
      drawOrder: [
        // Declared in reverse order — but layers fix the z-order
        { type: 'node', id: 'fg', layer: 'foreground' },
        { type: 'node', id: 'bg', layer: 'background' },
      ],
    });
    // In SVG, later siblings paint on top. background group comes before foreground.
    const layers = svg.querySelectorAll('g[class^="layer-"]');
    const bgIndex = [...layers].findIndex(g => g.classList.contains('layer-background'));
    const fgIndex = [...layers].findIndex(g => g.classList.contains('layer-foreground'));
    assert.ok(bgIndex < fgIndex, 'background layer should be before foreground in DOM');
    // bg node in background, fg node in foreground
    assert.ok(layers[bgIndex].querySelector('#node-bg'), 'bg node in background layer');
    assert.ok(layers[fgIndex].querySelector('#node-fg'), 'fg node in foreground layer');
  });

  it('falls back to single draw-layer when layers not specified', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 0',
        style: { stroke: '#000', strokeWidth: 1, fill: 'none' },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
      drawOrder: [
        { type: 'drawPath', index: 0 },
      ],
    });
    assert.ok(svg.querySelector('.draw-layer'), 'should use single draw-layer');
    assert.ok(!svg.querySelector('.layer-main'), 'should NOT have named layers');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/named-layers.test.js`
Expected: FAIL — emitter ignores `layers`.

- [ ] **Step 3: Implement layer-aware emission**

In `src-v2/svg/emitter.js`, modify the ordered rendering block. Replace the `if (drawOrder)` block with a check for layers:

```js
  // ── ORDERED RENDERING (TikZ-faithful paint order) ──────────
  if (drawOrder) {
    const refs = { nodes: {}, edges: [], labels: [], plots: [] };
    const defaultArrowDef = arrowDefs.length > 0 ? arrowDefs[0] : null;
    const defaultArrowId = defaultArrowDef ? defaultArrowDef.id : null;
    const layerNames = resolved.layers;

    if (layerNames && layerNames.length > 0) {
      // ── NAMED LAYERS: create per-layer <g> groups in declared order ──
      const layerGroups = {};
      for (const name of layerNames) {
        const g = createSVGElement('g', { class: `layer-${name}` });
        svgEl.appendChild(g);
        layerGroups[name] = g;
      }

      for (const item of drawOrder) {
        const targetLayer = layerGroups[item.layer ?? 'main'] ?? layerGroups[layerNames[0]];
        switch (item.type) {
          case 'node': {
            const node = nodes[item.id];
            if (!node) break;
            const g = emitNode(item.id, node, prng);
            targetLayer.appendChild(g);
            refs.nodes[item.id] = g;
            if (node.style.initial) {
              targetLayer.appendChild(emitInitialArrow(node, defaultArrowId, defaultArrowDef));
            }
            break;
          }
          case 'edge': {
            const edge = edges[item.index];
            if (!edge) break;
            const pathEl = emitEdgePath(edge, prng);
            targetLayer.appendChild(pathEl);
            refs.edges.push(pathEl);
            const labelEl = emitLabelNode(edge);
            if (labelEl) {
              targetLayer.appendChild(labelEl);
              refs.labels.push(labelEl);
            }
            break;
          }
          case 'plot': {
            const plotModel = plots[item.index];
            if (!plotModel) break;
            emitPlot(plotModel, targetLayer);
            break;
          }
          case 'drawPath': {
            const pathModel = drawPaths[item.index];
            if (!pathModel) break;
            emitDrawPath(pathModel, targetLayer, targetLayer);
            break;
          }
        }
      }
    } else {
      // ── SINGLE DRAW-LAYER: declaration order, no named layers ──
      const drawLayer = createSVGElement('g', { class: 'draw-layer' });
      svgEl.appendChild(drawLayer);

      for (const item of drawOrder) {
        switch (item.type) {
          case 'node': {
            const node = nodes[item.id];
            if (!node) break;
            const g = emitNode(item.id, node, prng);
            drawLayer.appendChild(g);
            refs.nodes[item.id] = g;
            if (node.style.initial) {
              drawLayer.appendChild(emitInitialArrow(node, defaultArrowId, defaultArrowDef));
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
    }

    const viewBox = computeViewBox(svgEl);
    svgEl.setAttribute('viewBox', viewBox);
    return refs;
  }
```

Also add `layers` to the destructuring and update `computeViewBox` to scan `layer-*` groups:

In the destructuring add:
```js
    layers,
```

In `computeViewBox`, update the selector:
```js
  for (const layer of svgEl.querySelectorAll('.edge-layer, .label-layer, .node-layer, .draw-layer, g[class^="layer-"]')) {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/named-layers.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/svg/emitter.js test/named-layers.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add named layers for z-order control in draw mode"
```

---

### Task 2: Pipeline — Pass layers and item layer through

**What it does:** Updates the `config.draw` processing in `index.js` to preserve the `layer` property on each draw item and pass `config.layers` through to the model.

**Files:**
- Modify: `src-v2/index.js`
- Modify: `test/named-layers.test.js`

- [ ] **Step 1: Write failing integration tests**

Append to `test/named-layers.test.js`:

```js
describe('render() with config.layers', () => {
  it('renders overlapping shapes on different layers', () => {
    const svg = makeSVG();
    render(svg, {
      layers: ['background', 'main', 'foreground'],
      draw: [
        // Big yellow circle declared SECOND but on background layer
        { type: 'node', id: 'big', layer: 'background', position: { x: 100, y: 100 }, label: '', fill: 'yellow', stroke: 'none', radius: 40 },
        // Small red circle declared FIRST but on foreground layer
        { type: 'node', id: 'small', layer: 'foreground', position: { x: 100, y: 100 }, label: '', fill: 'red', stroke: 'none', radius: 15 },
      ],
    });
    const bg = svg.querySelector('.layer-background');
    const fg = svg.querySelector('.layer-foreground');
    assert.ok(bg.querySelector('#node-big'), 'big circle in background');
    assert.ok(fg.querySelector('#node-small'), 'small circle in foreground');
  });

  it('mixes layers with paths and nodes', () => {
    const svg = makeSVG();
    render(svg, {
      layers: ['bg', 'main', 'fg'],
      draw: [
        { type: 'path', layer: 'bg', points: [{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}], cycle: true, fill: '#eee', stroke: 'none' },
        { type: 'path', points: [{x:50,y:100},{x:150,y:100}], arrow: '->' },  // main
        { type: 'node', id: 'top', layer: 'fg', position: {x:100,y:100}, label: 'Top' },
      ],
    });
    assert.ok(svg.querySelector('.layer-bg .draw-path'), 'bg rect in bg layer');
    assert.ok(svg.querySelector('.layer-main .draw-path'), 'arrow in main layer');
    assert.ok(svg.querySelector('.layer-fg #node-top'), 'node in fg layer');
  });

  it('defaults to main when no layer specified', () => {
    const svg = makeSVG();
    render(svg, {
      layers: ['background', 'main', 'foreground'],
      draw: [
        { type: 'node', id: 'a', position: { x: 50, y: 50 }, label: 'A' },
      ],
    });
    assert.ok(svg.querySelector('.layer-main #node-a'), 'should default to main');
  });

  it('works without config.layers (single draw-layer)', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'path', points: [{x:0,y:0},{x:100,y:0}] },
        { type: 'node', id: 'a', position: { x: 50, y: 0 }, label: 'A' },
      ],
    });
    assert.ok(svg.querySelector('.draw-layer'), 'single draw-layer');
    assert.ok(!svg.querySelector('.layer-main'), 'no named layers');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/named-layers.test.js`
Expected: FAIL — `config.layers` not passed through.

- [ ] **Step 3: Update pipeline to pass layers and item layer**

In `src-v2/index.js`, in the `config.draw` processing block, preserve the `layer` property on draw order items:

In the switch cases that build `drawOrderSpec`, include the `layer`:

For `case 'node'`:
```js
          drawOrderSpec.push({ type: 'node', id, layer: entry.layer });
```

For `case 'edge'`:
```js
          drawOrderSpec.push({ type: 'edge', index: idx, layer: entry.layer });
```

For `case 'plot'`:
```js
          drawOrderSpec.push({ type: 'plot', index: idx, layer: entry.layer });
```

For `case 'path'`:
```js
          drawOrderSpec.push({ type: 'drawPath', index: idx, layer: entry.layer });
```

Also pass `layers` through in the subConfig:

```js
    const subConfig = {
      ...config,
      states: drawStates,
      edges: drawEdges,
      plots: drawPlots,
      paths: drawPaths,
      _drawOrder: drawOrderSpec,
      _layers: config.layers,
    };
```

In Phase 6 (model construction), pass layers:

```js
    layers: config._layers,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/named-layers.test.js`
Expected: All 9 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/index.js test/named-layers.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: pass config.layers and item layer through pipeline"
```

---

### Task 3: Visual Demo — Overlapping Shapes on Layers

**What it does:** Creates a demo with three overlapping colored circles, each assigned to a different layer. Cycling which circle is on the foreground layer demonstrates the z-order control.

**Files:**
- Create: `examples-v2/layers-demo.html`

- [ ] **Step 1: Create the demo**

Create `examples-v2/layers-demo.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>tikz-svg: Named Layers Demo</title>
  <style>
    body { font-family: system-ui; padding: 2rem; background: #f8f8f8; max-width: 900px; margin: 0 auto; }
    .demo { margin: 2rem 0; background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .row { display: flex; gap: 2rem; }
    svg { border: 1px solid #eee; display: block; margin: 0.5rem 0; }
    h2 { color: #333; margin-top: 0; }
    h3 { color: #555; margin-top: 0; font-size: 0.95em; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Named Layers Demo</h1>
  <p>Same three overlapping circles — different layer assignments change which is on top.</p>

  <div class="demo">
    <h2>Three overlapping circles, different layer orders</h2>
    <div class="row">
      <div>
        <h3>Red on top</h3>
        <svg id="demo1" width="220" height="200"></svg>
      </div>
      <div>
        <h3>Green on top</h3>
        <svg id="demo2" width="220" height="200"></svg>
      </div>
      <div>
        <h3>Blue on top</h3>
        <svg id="demo3" width="220" height="200"></svg>
      </div>
    </div>
  </div>

  <div class="demo">
    <h2>Background shading behind a diagram</h2>
    <svg id="demo4" width="400" height="250"></svg>
  </div>

  <script type="module">
    import { render } from '../src-v2/index.js';

    function makeCircles(topColor) {
      const colors = { red: '#ef4444', green: '#22c55e', blue: '#3b82f6' };
      const positions = {
        red: { x: 80, y: 80 },
        green: { x: 130, y: 80 },
        blue: { x: 105, y: 120 },
      };

      return {
        layers: ['back', 'mid', 'front'],
        draw: Object.entries(colors).map(([name, color]) => ({
          type: 'node',
          id: name,
          layer: name === topColor ? 'front' : (name === topColor ? 'mid' : 'back'),
          position: positions[name],
          label: name,
          fill: color,
          stroke: 'white',
          strokeWidth: 2,
          radius: 40,
          labelColor: 'white',
          fontSize: 12,
        })),
      };
    }

    // Assign layers more carefully
    function makeDemo(topName) {
      const colors = { red: '#ef4444', green: '#22c55e', blue: '#3b82f6' };
      const positions = { red: { x: 80, y: 80 }, green: { x: 130, y: 80 }, blue: { x: 105, y: 120 } };
      const names = ['red', 'green', 'blue'];
      const layerAssign = {};
      // top gets 'front', others get 'back' and 'mid'
      const others = names.filter(n => n !== topName);
      layerAssign[topName] = 'front';
      layerAssign[others[0]] = 'back';
      layerAssign[others[1]] = 'mid';

      return {
        layers: ['back', 'mid', 'front'],
        draw: names.map(name => ({
          type: 'node',
          id: name,
          layer: layerAssign[name],
          position: positions[name],
          label: name,
          fill: colors[name],
          stroke: 'white',
          strokeWidth: 2,
          radius: 40,
          labelColor: 'white',
          fontSize: 12,
        })),
      };
    }

    render(document.getElementById('demo1'), makeDemo('red'));
    render(document.getElementById('demo2'), makeDemo('green'));
    render(document.getElementById('demo3'), makeDemo('blue'));

    // Demo 4: Background shading behind diagram
    render(document.getElementById('demo4'), {
      layers: ['background', 'main', 'labels'],
      draw: [
        // Yellow background rect — on background layer, declared last but renders first
        { type: 'path', layer: 'background',
          points: [{x:20,y:20},{x:380,y:20},{x:380,y:230},{x:20,y:230}],
          cycle: true, fill: '#fef9c3', stroke: '#eab308' },
        // Axes on main
        { type: 'path', points: [{x:50,y:200},{x:350,y:200}], arrow: '->' },
        { type: 'path', points: [{x:50,y:220},{x:50,y:40}], arrow: '->' },
        // Nodes on labels layer (always on top)
        { type: 'node', id: 'xl', layer: 'labels', position: {x:355,y:200}, label: 'x', anchor: 'west' },
        { type: 'node', id: 'yl', layer: 'labels', position: {x:50,y:35}, label: 'y', anchor: 'south' },
        { type: 'node', id: 'title', layer: 'labels', position: {x:200,y:30}, label: 'Shaded background', fontSize: 16 },
      ],
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

```bash
open http://localhost:8080/examples-v2/layers-demo.html
```

Expected: Three panels showing the same circles with different ones on top. Fourth panel with yellow background behind axes.

- [ ] **Step 3: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add examples-v2/layers-demo.html
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add named layers demo with overlapping shapes"
```

---

## Verification Checklist

After all 3 tasks:

- [ ] `node --test` — all tests pass
- [ ] `config.layers` creates `<g class="layer-{name}">` groups in declared order
- [ ] Items with `layer: 'foreground'` render in the foreground group (on top)
- [ ] Items with `layer: 'background'` render in the background group (behind)
- [ ] Items without `layer` default to `'main'`
- [ ] Layer order controls z-order regardless of declaration order in `config.draw`
- [ ] `config.draw` without `config.layers` still uses single `draw-layer` (backward compat)
- [ ] `config.states`/`config.edges` without `config.draw` still uses fixed layers (backward compat)
- [ ] Demo shows overlapping circles with correct z-order per layer assignment
