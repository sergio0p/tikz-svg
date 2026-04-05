# Flowchart Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three flowchart shapes — parallelogram, document (tape), and preparation (hexagon) — to the tikz-svg library.

**Architecture:** Each shape follows the `createShape` factory pattern (see `src-v2/shapes/shape.js`). Parallelogram reuses trapezium geometry with fixed angles. Document uses the TikZ `tape` shape (Bézier wavy bottom). Preparation is a horizontally-stretched hexagon. All three get Phase 3 geomConfig wiring, emitter compatibility (generic `backgroundPath` fallback), tests, and manual docs.

**Tech Stack:** JavaScript ES modules, node:test + jsdom, SVG path commands (M/L/C/Z)

**Key references:**
- Our shape factory: `src-v2/shapes/shape.js` (`createShape`, `polygonBorderPoint`)
- Our trapezium (parallelogram base): `src-v2/shapes/trapezium.js`
- TikZ tape source: `docs/References/pgflibraryshapes.symbols.code.tex` lines 2115–2557
- Pipeline Phase 3 switch: `src-v2/index.js` lines 316–373
- Builder skill: `.claude/skills/tikz-svg-builder/SKILL.md` (emitter re-call contract, compatibility audit)

---

### Task 1: Parallelogram shape

**Files:**
- Create: `src-v2/shapes/parallelogram.js`
- Modify: `src-v2/index.js` (add import + Phase 3 case)
- Create: `test/parallelogram.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/parallelogram.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  document = dom.window.document;
});

describe('parallelogram shape', () => {
  it('registers and returns geometry', async () => {
    await import('../src-v2/shapes/parallelogram.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 },
      halfWidth: 40, halfHeight: 20, outerSep: 0,
    });
    assert.ok(geom.center);
    assert.strictEqual(geom.halfWidth, 40);
    assert.strictEqual(geom.halfHeight, 20);
    assert.strictEqual(geom.leftAngle, 120);
    assert.strictEqual(geom.rightAngle, 60);
  });

  it('produces a closed SVG path', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 20, outerSep: 0,
    });
    const path = shape.backgroundPath(geom);
    assert.ok(path.startsWith('M'), 'path starts with M');
    assert.ok(path.endsWith('Z'), 'path ends with Z');
  });

  it('has standard anchors', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    const names = shape.anchors();
    for (const a of ['center', 'north', 'south', 'east', 'west']) {
      assert.ok(names.includes(a), `missing anchor: ${a}`);
    }
  });

  it('borderPoint returns point on boundary', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 20, outerSep: 0,
    });
    const pt = shape.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(pt.x > 0, 'east border should be positive x');
  });

  it('stores all config inputs in geom for emitter re-call', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    const geom = shape.savedGeometry({
      center: { x: 50, y: 50 }, halfWidth: 30, halfHeight: 15, outerSep: 2,
    });
    // Re-call with geom spread + new center (emitter contract)
    const geom2 = shape.savedGeometry({ ...geom, center: { x: 0, y: 0 } });
    assert.strictEqual(geom2.halfWidth, geom.halfWidth);
    assert.strictEqual(geom2.halfHeight, geom.halfHeight);
    assert.strictEqual(geom2.leftAngle, 120);
    assert.strictEqual(geom2.rightAngle, 60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/parallelogram.test.js`
Expected: FAIL — module `../src-v2/shapes/parallelogram.js` not found

- [ ] **Step 3: Write minimal implementation**

```js
// src-v2/shapes/parallelogram.js
/**
 * Parallelogram shape — trapezium with fixed angles (leftAngle=120, rightAngle=60).
 * TikZ: \node[trapezium, trapezium left angle=120, trapezium right angle=60]
 */

import { createShape, polygonBorderPoint } from './shape.js';

const DEG2RAD = Math.PI / 180;
const LEFT_ANGLE = 120;
const RIGHT_ANGLE = 60;

function vertices(cx, cy, hw, hh) {
  const leftExt = hh / Math.tan(LEFT_ANGLE * DEG2RAD);
  const rightExt = hh / Math.tan(RIGHT_ANGLE * DEG2RAD);
  return [
    { x: cx - hw,             y: cy + hh },  // bottom left
    { x: cx - hw + leftExt,   y: cy - hh },  // top left
    { x: cx + hw - rightExt,  y: cy - hh },  // top right
    { x: cx + hw,             y: cy + hh },  // bottom right
  ];
}

export default createShape('parallelogram', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 25) + outerSep,
      halfHeight: (halfHeight ?? 15) + outerSep,
      leftAngle: LEFT_ANGLE, rightAngle: RIGHT_ANGLE, outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    const verts = vertices(c.x, c.y, hw, hh);
    return {
      north:        { x: c.x, y: c.y - hh },
      south:        { x: c.x, y: c.y + hh },
      east:         { x: c.x + hw, y: c.y },
      west:         { x: c.x - hw, y: c.y },
      'north east': verts[2], 'north west': verts[1],
      'south east': verts[3], 'south west': verts[0],
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    return polygonBorderPoint(c, direction, vertices(c.x, c.y, hw, hh));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, outerSep } = geom;
    const v = vertices(cx, cy, halfWidth - outerSep, halfHeight - outerSep);
    return `M ${v[0].x} ${v[0].y} L ${v[1].x} ${v[1].y} L ${v[2].x} ${v[2].y} L ${v[3].x} ${v[3].y} Z`;
  },
});
```

- [ ] **Step 4: Register in index.js**

Add import at top of `src-v2/index.js` after the cloud-callout import (line 27):

```js
import './shapes/parallelogram.js';
```

Add to Phase 3 switch — parallelogram uses `halfWidth`/`halfHeight`, so add it to the trapezium case group (line 322):

```js
      case 'trapezium':
      case 'parallelogram':
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/parallelogram.test.js`
Expected: all 5 tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all tests PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git add src-v2/shapes/parallelogram.js src-v2/index.js test/parallelogram.test.js
git commit -m "Add parallelogram shape (trapezium with fixed 120/60 angles)"
```

---

### Task 2: Document shape (TikZ tape)

**Files:**
- Create: `src-v2/shapes/document.js`
- Modify: `src-v2/index.js` (add import + Phase 3 case)
- Create: `test/document-shape.test.js`

**TikZ reference:** `docs/References/pgflibraryshapes.symbols.code.tex` lines 2115–2557. The `tape` shape is a rectangle where top and/or bottom edges are replaced with sinusoidal Bézier curves. Key parameters:
- `tape bend height` — amplitude of the wave (default ~5pt). We use `bendHeight`.
- `tape bend top` / `tape bend bottom` — can be `in and out`, `out and in`, or `none`. For a flowchart document shape, we only need bottom bend = `in and out` (the wavy bottom).
- The wave is drawn as two quarter-ellipse arcs using `\pgfpatharc` with `bendxradius = 0.707 * halfwidth` and `bendyradius = 3.414 * halfbendheight`.
- Anchors at corners account for the bend offset.
- borderPoint at the wavy edge uses arc intersection in TikZ; we simplify to a polygon approximation that follows the wave.

- [ ] **Step 1: Write the failing test**

```js
// test/document-shape.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  document = dom.window.document;
});

describe('document shape', () => {
  it('registers and returns geometry', async () => {
    await import('../src-v2/shapes/document.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 },
      halfWidth: 40, halfHeight: 25, outerSep: 0,
    });
    assert.ok(geom.center);
    assert.strictEqual(geom.halfWidth, 40);
    assert.strictEqual(geom.halfHeight, 25);
    assert.ok(geom.bendHeight >= 0);
  });

  it('backgroundPath contains cubic Bézier (C command)', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25, outerSep: 0,
    });
    const path = shape.backgroundPath(geom);
    assert.ok(path.includes('C'), 'should have cubic Bézier for wavy bottom');
    assert.ok(path.endsWith('Z'), 'path should be closed');
  });

  it('has standard anchors', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const names = shape.anchors();
    for (const a of ['center', 'north', 'south', 'east', 'west']) {
      assert.ok(names.includes(a), `missing anchor: ${a}`);
    }
  });

  it('south anchor accounts for bend height', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25,
      outerSep: 0, bendHeight: 10,
    });
    const south = shape.anchor('south', geom);
    // South should be beyond halfHeight due to bend
    assert.ok(south.y > 25, `south.y (${south.y}) should exceed halfHeight (25)`);
  });

  it('stores all config inputs in geom for emitter re-call', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 50, y: 50 }, halfWidth: 40, halfHeight: 25,
      outerSep: 2, bendHeight: 8,
    });
    const geom2 = shape.savedGeometry({ ...geom, center: { x: 0, y: 0 } });
    assert.strictEqual(geom2.halfWidth, geom.halfWidth);
    assert.strictEqual(geom2.halfHeight, geom.halfHeight);
    assert.strictEqual(geom2.bendHeight, geom.bendHeight);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/document-shape.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

The document shape is a rectangle with a wavy bottom edge. Following TikZ's tape shape geometry:
- Top edge: straight line from NW to NE
- Right edge: straight line from NE to SE corner (before wave)
- Bottom edge: two cubic Bézier curves forming an S-wave (in-and-out pattern)
- Left edge: straight line from SW corner (after wave) back to NW

TikZ computes the wave using elliptical arcs with `bendxradius = 0.707 * halfWidth` and `bendyradius = 3.414 * halfBendHeight`. We approximate these arcs with cubic Béziers (SVG `C` command), using the standard arc-to-Bézier control point formula.

```js
// src-v2/shapes/document.js
/**
 * Document shape — rectangle with wavy bottom edge.
 * Based on TikZ "tape" shape (pgflibraryshapes.symbols.code.tex lines 2115–2557).
 * Uses bottom bend only ("in and out" style) for the standard flowchart document icon.
 */

import { createShape, polygonBorderPoint } from './shape.js';

/**
 * Generate the bottom wave as two cubic Bézier curves.
 * TikZ tape uses two quarter-ellipse arcs:
 *   arc 1: from right midpoint, curving down (concave) — angles 45→135
 *   arc 2: from center, curving up (convex) — angles 315→225
 * We approximate with cubic Béziers using the kappa constant (0.5522847).
 */
function wavyBottomPath(cx, cy, hw, hh, bendH) {
  // The wave goes across the full width in two halves
  // Right half: curves down from (cx+hw, cy+hh) through midpoint to (cx, cy+hh+bendH)
  // Left half: curves up from (cx, cy+hh+bendH) through midpoint to (cx-hw, cy+hh)
  const k = 0.5522847; // cubic Bézier approximation of quarter circle

  // Right half: S-curve down — from right edge to center
  const r1x = cx + hw,   r1y = cy + hh;        // start: bottom right
  const m1x = cx,         m1y = cy + hh + bendH; // end: center bottom (wave trough)
  // Control points: ease down
  const c1x = r1x - hw * k, c1y = r1y;
  const c2x = m1x + hw * k, c2y = m1y;

  // Left half: S-curve up — from center to left edge
  const r2x = cx - hw,   r2y = cy + hh;        // end: bottom left
  // Control points: ease up
  const c3x = m1x - hw * k, c3y = m1y;
  const c4x = r2x + hw * k, c4y = r2y;

  return { r1x, r1y, c1x, c1y, c2x, c2y, m1x, m1y, c3x, c3y, c4x, c4y, r2x, r2y };
}

export default createShape('document', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, bendHeight = 5, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 30) + outerSep,
      halfHeight: (halfHeight ?? 20) + outerSep,
      bendHeight, outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh, bendHeight: bh } = geom;
    return {
      north:        { x: c.x, y: c.y - hh },
      south:        { x: c.x, y: c.y + hh + bh },  // accounts for wave trough
      east:         { x: c.x + hw, y: c.y },
      west:         { x: c.x - hw, y: c.y },
      'north east': { x: c.x + hw, y: c.y - hh },
      'north west': { x: c.x - hw, y: c.y - hh },
      'south east': { x: c.x + hw, y: c.y + hh },   // at the straight corner
      'south west': { x: c.x - hw, y: c.y + hh },   // at the straight corner
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh, bendHeight: bh } = geom;
    // Approximate the wavy bottom with polygon vertices sampled from the wave
    const steps = 8;
    const bottomPts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = c.x + hw - 2 * hw * t;
      // Sine wave approximation: peak at center
      const wave = bh * Math.sin(Math.PI * t);
      bottomPts.push({ x, y: c.y + hh + wave });
    }
    const verts = [
      { x: c.x - hw, y: c.y - hh },  // NW
      { x: c.x + hw, y: c.y - hh },  // NE
      ...bottomPts,                     // bottom wave: NE→SE→...→SW→NW
    ];
    return polygonBorderPoint(c, direction, verts);
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, bendHeight, outerSep } = geom;
    const hw = halfWidth - outerSep;
    const hh = halfHeight - outerSep;
    const bh = bendHeight;
    const w = wavyBottomPath(cx, cy, hw, hh, bh);
    return (
      `M ${cx - hw} ${cy - hh}` +       // NW
      ` L ${cx + hw} ${cy - hh}` +       // NE
      ` L ${w.r1x} ${w.r1y}` +           // SE (start of wave)
      ` C ${w.c1x} ${w.c1y} ${w.c2x} ${w.c2y} ${w.m1x} ${w.m1y}` +  // right half wave
      ` C ${w.c3x} ${w.c3y} ${w.c4x} ${w.c4y} ${w.r2x} ${w.r2y}` +  // left half wave
      ` Z`                                // close to NW
    );
  },
});
```

- [ ] **Step 4: Register in index.js**

Add import after parallelogram import:

```js
import './shapes/document.js';
```

Add to Phase 3 switch — document uses `halfWidth`/`halfHeight`, add to trapezium case group:

```js
      case 'trapezium':
      case 'parallelogram':
      case 'document':
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/document-shape.test.js`
Expected: all 5 tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src-v2/shapes/document.js src-v2/index.js test/document-shape.test.js
git commit -m "Add document shape (rectangle with wavy bottom, based on TikZ tape)"
```

---

### Task 3: Preparation shape (hexagon)

**Files:**
- Create: `src-v2/shapes/preparation.js`
- Modify: `src-v2/index.js` (add import + Phase 3 case)
- Create: `test/preparation.test.js`

**Geometry:** The ISO 5807 preparation symbol is a horizontally-elongated hexagon — a rectangle with pointed left and right ends. Unlike TikZ's `signal` shape (which has configurable pointer directions and angles), this is simpler: two angled edges on each side meeting at the east/west points. The point depth is controlled by `pointWidth` (default: `halfHeight`, making 45° angles).

6 vertices:
```
        NW ─────── NE
       /               \
  W ─                     ─ E
       \               /
        SW ─────── SE
```

- [ ] **Step 1: Write the failing test**

```js
// test/preparation.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  document = dom.window.document;
});

describe('preparation shape', () => {
  it('registers and returns geometry', async () => {
    await import('../src-v2/shapes/preparation.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 },
      halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    assert.ok(geom.center);
    assert.strictEqual(geom.halfWidth, 50);
    assert.strictEqual(geom.halfHeight, 20);
  });

  it('produces a 6-vertex closed SVG path', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    const path = shape.backgroundPath(geom);
    assert.ok(path.startsWith('M'), 'path starts with M');
    assert.ok(path.endsWith('Z'), 'path ends with Z');
    // 1 M + 5 L = 6 vertices
    const lineCount = (path.match(/L /g) || []).length;
    assert.strictEqual(lineCount, 5, 'should have 5 L commands (6 vertices total)');
  });

  it('has standard anchors', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const names = shape.anchors();
    for (const a of ['center', 'north', 'south', 'east', 'west']) {
      assert.ok(names.includes(a), `missing anchor: ${a}`);
    }
  });

  it('east and west anchors are at the points', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    const east = shape.anchor('east', geom);
    const west = shape.anchor('west', geom);
    assert.strictEqual(east.y, 0, 'east anchor at center y');
    assert.strictEqual(west.y, 0, 'west anchor at center y');
    assert.ok(east.x > west.x, 'east.x > west.x');
  });

  it('stores all config inputs in geom for emitter re-call', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 50, y: 50 }, halfWidth: 50, halfHeight: 20,
      outerSep: 2, pointWidth: 15,
    });
    const geom2 = shape.savedGeometry({ ...geom, center: { x: 0, y: 0 } });
    assert.strictEqual(geom2.halfWidth, geom.halfWidth);
    assert.strictEqual(geom2.halfHeight, geom.halfHeight);
    assert.strictEqual(geom2.pointWidth, geom.pointWidth);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/preparation.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```js
// src-v2/shapes/preparation.js
/**
 * Preparation shape — horizontally-elongated hexagon (ISO 5807 flowchart symbol).
 * A rectangle with pointed left and right ends.
 *
 * 6 vertices:
 *        NW ─────── NE
 *       /               \
 *   W                     E
 *       \               /
 *        SW ─────── SE
 *
 * pointWidth controls how far the east/west points extend inward from the
 * rectangle edge. Default: halfHeight (45° angles).
 */

import { createShape, polygonBorderPoint } from './shape.js';

function hexVertices(cx, cy, hw, hh, pw) {
  return [
    { x: cx - hw,      y: cy },      // W (left point)
    { x: cx - hw + pw, y: cy - hh }, // NW
    { x: cx + hw - pw, y: cy - hh }, // NE
    { x: cx + hw,      y: cy },      // E (right point)
    { x: cx + hw - pw, y: cy + hh }, // SE
    { x: cx - hw + pw, y: cy + hh }, // SW
  ];
}

export default createShape('preparation', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, pointWidth, outerSep = 0 } = config;
    const hw = (halfWidth ?? 35) + outerSep;
    const hh = (halfHeight ?? 15) + outerSep;
    const pw = pointWidth ?? hh;  // default: same as halfHeight → 45° angles
    return {
      center: { x: center.x, y: center.y },
      halfWidth: hw, halfHeight: hh, pointWidth: pw, outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh, pointWidth: pw } = geom;
    const verts = hexVertices(c.x, c.y, hw, hh, pw);
    return {
      north:        { x: c.x, y: c.y - hh },
      south:        { x: c.x, y: c.y + hh },
      east:         verts[3],  // right point
      west:         verts[0],  // left point
      'north east': verts[2],
      'north west': verts[1],
      'south east': verts[4],
      'south west': verts[5],
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh, pointWidth: pw } = geom;
    return polygonBorderPoint(c, direction, hexVertices(c.x, c.y, hw, hh, pw));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, pointWidth, outerSep } = geom;
    const v = hexVertices(cx, cy, halfWidth - outerSep, halfHeight - outerSep, pointWidth);
    return `M ${v[0].x} ${v[0].y} L ${v[1].x} ${v[1].y} L ${v[2].x} ${v[2].y} L ${v[3].x} ${v[3].y} L ${v[4].x} ${v[4].y} L ${v[5].x} ${v[5].y} Z`;
  },
});
```

- [ ] **Step 4: Register in index.js**

Add import after document import:

```js
import './shapes/preparation.js';
```

Add to Phase 3 switch — preparation uses `halfWidth`/`halfHeight`, add to the case group:

```js
      case 'trapezium':
      case 'parallelogram':
      case 'document':
      case 'preparation':
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/preparation.test.js`
Expected: all 5 tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src-v2/shapes/preparation.js src-v2/index.js test/preparation.test.js
git commit -m "Add preparation shape (hexagon for flowchart initialization symbol)"
```

---

### Task 4: Update documentation

**Files:**
- Modify: `docs/Manual/02-nodes-and-positioning.md`
- Modify: `docs/Manual/appendix-reference.md`

- [ ] **Step 1: Update chapter 02 shape lists**

In `docs/Manual/02-nodes-and-positioning.md`, update the shape list at line 27:

Change:
```
**Geometric shapes:** `circle`, `rectangle`, `ellipse`, `diamond`, `star`, `regular polygon`, `trapezium`, `semicircle`, `isosceles triangle`, `kite`, `dart`, `circular sector`, `cylinder`
```
To:
```
**Geometric shapes:** `circle`, `rectangle`, `ellipse`, `diamond`, `star`, `regular polygon`, `trapezium`, `parallelogram`, `semicircle`, `isosceles triangle`, `kite`, `dart`, `circular sector`, `cylinder`

**Flowchart:** `document`, `preparation`
```

Also update line 17 "Set `shape` to any of the 20 built-in shapes:" → change `20` to `23`.

- [ ] **Step 2: Update appendix reference**

In `docs/Manual/appendix-reference.md`, add to the Geometric shapes table after `cylinder`:

```markdown
| `parallelogram` | `halfWidth`, `halfHeight` | Trapezium with fixed 120/60 angles |
```

Add a new Flowchart section after the Callouts section:

```markdown
### Flowchart

| Shape | Key properties | Notes |
|-------|---------------|-------|
| `document` | `halfWidth`, `halfHeight`, `bendHeight` (default 5) | Rectangle with wavy bottom |
| `preparation` | `halfWidth`, `halfHeight`, `pointWidth` (default halfHeight) | Elongated hexagon |
```

- [ ] **Step 3: Commit**

```bash
git add docs/Manual/02-nodes-and-positioning.md docs/Manual/appendix-reference.md
git commit -m "Document parallelogram, document, and preparation shapes in Manual"
```

---

### Task 5: Compatibility audit

Verify per the tikz-svg-builder skill:

- [ ] **Step 1: Emitter check**

Confirm the emitter's generic `backgroundPath` fallback handles all three shapes without a new switch case. Read `src-v2/svg/emitter.js` and verify the `if (shapeImpl && shapeImpl.backgroundPath)` fallback at ~line 801 covers new shapes automatically.

- [ ] **Step 2: ViewBox check**

Confirm `expandBBoxFromElement` picks up new shapes. Since they emit standard SVG `<path>` elements inside `<g>` groups, the existing walker handles them.

- [ ] **Step 3: Run full test suite one final time**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 4: Commit any fixes**

If any audit reveals issues, fix and commit.
