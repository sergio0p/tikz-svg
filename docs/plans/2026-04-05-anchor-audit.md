# Anchor Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all missing TikZ anchors to every shape — `mid`/`base` family everywhere, `corner N`/`side N` on polygons, and shape-specific anchors (trapezium corners/sides, kite vertices/sides, cylinder top/bottom, semicircle chord center).

**Architecture:** The `mid`/`base` anchors are text-baseline anchors in TikZ. Since we don't track text baselines, we approximate: `base` = center, `mid` = center (matching TikZ behavior for vertically-centered text). The `east`/`west` variants use the shape's east/west x-coordinate at the base/mid y. For the 17 `createShape` shapes, we add `mid`/`base` support in the factory itself. For the 6 `registerShape` shapes, we add them individually. `corner N`/`side N` use `dynamicAnchor`. Shape-specific anchors go in each shape's `namedAnchors`.

**Tech Stack:** JavaScript ES modules, node:test + jsdom

**Key files:**
- Factory: `src-v2/shapes/shape.js` — `createShape` function
- 6 legacy shapes: `src-v2/shapes/circle.js`, `rectangle.js`, `ellipse.js`, `rectangle-callout.js`, `ellipse-callout.js`, `cloud-callout.js`
- Polygon shapes: `src-v2/shapes/regular-polygon.js`, `src-v2/shapes/preparation.js`
- Shape-specific: `src-v2/shapes/trapezium.js`, `src-v2/shapes/kite.js`, `src-v2/shapes/cylinder.js`, `src-v2/shapes/semicircle.js`
- Tests: `test/anchor-audit.test.js`

---

### Task 1: Add `mid`/`base` anchors to `createShape` factory

This single change adds 6 anchors (`mid`, `base`, `mid east`, `mid west`, `base east`, `base west`) to all 17 factory-based shapes at once.

**Files:**
- Modify: `src-v2/shapes/shape.js`
- Create: `test/anchor-audit.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/anchor-audit.test.js
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

describe('mid/base anchors on createShape shapes', () => {
  it('diamond has mid and base anchors', async () => {
    await import('../src-v2/shapes/diamond.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('diamond');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 }, radius: 30, outerSep: 0,
    });
    const mid = shape.anchor('mid', geom);
    const base = shape.anchor('base', geom);
    assert.strictEqual(mid.x, 100);
    assert.strictEqual(mid.y, 50);
    assert.strictEqual(base.x, 100);
    assert.strictEqual(base.y, 50);
  });

  it('diamond has mid east/west and base east/west', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('diamond');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 }, radius: 30, outerSep: 0,
    });
    const midEast = shape.anchor('mid east', geom);
    const midWest = shape.anchor('mid west', geom);
    const baseEast = shape.anchor('base east', geom);
    const baseWest = shape.anchor('base west', geom);
    // mid/base east/west should be at the shape's east/west x, at center y
    assert.strictEqual(midEast.y, 50);
    assert.strictEqual(midWest.y, 50);
    assert.strictEqual(baseEast.y, 50);
    assert.strictEqual(baseWest.y, 50);
    assert.ok(midEast.x > 100);
    assert.ok(midWest.x < 100);
  });

  it('trapezium has mid and base anchors', async () => {
    await import('../src-v2/shapes/trapezium.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('trapezium');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 30, halfHeight: 15, outerSep: 0,
    });
    const mid = shape.anchor('mid', geom);
    const base = shape.anchor('base', geom);
    assert.strictEqual(mid.x, 0);
    assert.strictEqual(base.x, 0);
  });

  it('cloud has mid and base anchors', async () => {
    await import('../src-v2/shapes/cloud.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('cloud');
    const geom = shape.savedGeometry({
      center: { x: 50, y: 50 }, rx: 30, ry: 20, outerSep: 0,
    });
    const mid = shape.anchor('mid', geom);
    assert.strictEqual(mid.x, 50);
    assert.strictEqual(mid.y, 50);
  });

  it('preparation has mid and base anchors', async () => {
    await import('../src-v2/shapes/preparation.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    const midEast = shape.anchor('mid east', geom);
    assert.ok(midEast.x > 0);
    assert.strictEqual(midEast.y, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/anchor-audit.test.js`
Expected: FAIL — `diamond.anchor: unknown anchor "mid"`

- [ ] **Step 3: Implement mid/base in createShape factory**

In `src-v2/shapes/shape.js`, modify the `anchor()` method inside `createShape` to handle `mid`, `base`, `mid east`, `mid west`, `base east`, `base west` before falling through to `namedAnchors`. These anchors use center y (since we don't track text baselines) and the shape's border x for east/west variants.

```js
// In createShape, inside the anchor() method, after the 'center' check
// and before the namedAnchors lookup:

// mid/base anchors — TikZ text-baseline anchors.
// Without text baseline tracking, mid = base = center y.
// East/west variants use the shape's east/west border x at center y.
if (anchorName === 'mid' || anchorName === 'base') {
  return { x: geom.center.x, y: geom.center.y };
}
if (anchorName === 'mid east' || anchorName === 'base east') {
  const east = spec.namedAnchors(geom).east;
  if (east) return { x: east.x, y: geom.center.y };
  // Fallback: use borderPoint east
  return shape.borderPoint(geom, { x: 1, y: 0 });
}
if (anchorName === 'mid west' || anchorName === 'base west') {
  const west = spec.namedAnchors(geom).west;
  if (west) return { x: west.x, y: geom.center.y };
  return shape.borderPoint(geom, { x: -1, y: 0 });
}
```

Also update `anchorNameCache` to include the 6 new names:

```js
const anchorNameCache = ['center', 'mid', 'base', 'mid east', 'mid west', 'base east', 'base west',
  ...Object.keys(spec.namedAnchors({ center: { x: 0, y: 0 }, outerSep: 0, _probe: true }))];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/anchor-audit.test.js`
Expected: all 5 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-v2/shapes/shape.js test/anchor-audit.test.js
git commit -m "Add mid/base anchor family to createShape factory (17 shapes)"
```

---

### Task 2: Add `mid`/`base` anchors to 6 legacy `registerShape` shapes

These shapes have their own `anchor()` function and don't use the factory. Add the 6 anchors to each.

**Files:**
- Modify: `src-v2/shapes/circle.js`
- Modify: `src-v2/shapes/rectangle.js`
- Modify: `src-v2/shapes/ellipse.js`
- Modify: `src-v2/shapes/rectangle-callout.js`
- Modify: `src-v2/shapes/ellipse-callout.js`
- Modify: `src-v2/shapes/cloud-callout.js`
- Modify: `test/anchor-audit.test.js`

- [ ] **Step 1: Write failing tests**

Add to `test/anchor-audit.test.js`:

```js
describe('mid/base anchors on registerShape shapes', () => {
  it('circle has mid/base anchors', async () => {
    await import('../src-v2/shapes/circle.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('circle');
    const geom = shape.savedGeometry({ center: { x: 50, y: 50 }, radius: 20, outerSep: 0 });
    const mid = shape.anchor('mid', geom);
    const base = shape.anchor('base', geom);
    assert.strictEqual(mid.x, 50);
    assert.strictEqual(base.x, 50);
    const midEast = shape.anchor('mid east', geom);
    assert.ok(midEast.x > 50);
    assert.strictEqual(midEast.y, 50);
  });

  it('rectangle has mid/base anchors', async () => {
    await import('../src-v2/shapes/rectangle.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('rectangle');
    const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 20, outerSep: 0 });
    const midEast = shape.anchor('mid east', geom);
    const baseWest = shape.anchor('base west', geom);
    assert.strictEqual(midEast.x, 40);
    assert.strictEqual(midEast.y, 0);
    assert.strictEqual(baseWest.x, -40);
    assert.strictEqual(baseWest.y, 0);
  });

  it('ellipse has mid/base anchors', async () => {
    await import('../src-v2/shapes/ellipse.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('ellipse');
    const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20, outerSep: 0 });
    const mid = shape.anchor('mid', geom);
    assert.strictEqual(mid.x, 0);
    assert.strictEqual(mid.y, 0);
  });

  it('rectangle callout has mid/base anchors', async () => {
    await import('../src-v2/shapes/rectangle-callout.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('rectangle callout');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 20, outerSep: 0,
      calloutPointerOffset: { x: 60, y: 40 },
    });
    const base = shape.anchor('base', geom);
    assert.strictEqual(base.x, 0);
  });

  it('ellipse callout has mid/base anchors', async () => {
    await import('../src-v2/shapes/ellipse-callout.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('ellipse callout');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 30, ry: 20, outerSep: 0,
      calloutPointerOffset: { x: 60, y: 40 },
    });
    const midWest = shape.anchor('mid west', geom);
    assert.ok(midWest.x < 0);
  });

  it('cloud callout has mid/base anchors', async () => {
    await import('../src-v2/shapes/cloud-callout.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('cloud callout');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 30, ry: 20, outerSep: 0,
      calloutPointerOffset: { x: 60, y: 40 },
    });
    const mid = shape.anchor('mid', geom);
    assert.strictEqual(mid.x, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/anchor-audit.test.js`
Expected: FAIL — `circle.anchor: unknown anchor "mid"`

- [ ] **Step 3: Add mid/base to circle.js**

In `src-v2/shapes/circle.js`, add to the `NAMED_ANCHORS` object and update the `anchor()` function. For circle, `mid east` = east at center y (which is just east), same for west variants.

Add cases in the `anchor()` function after the named anchor lookup:

```js
// mid/base: center point (no text baseline tracking)
if (name === 'mid' || name === 'base') {
  return { x: center.x, y: center.y };
}
if (name === 'mid east' || name === 'base east') {
  return { x: center.x + radius, y: center.y };
}
if (name === 'mid west' || name === 'base west') {
  return { x: center.x - radius, y: center.y };
}
```

Add to `ANCHOR_NAMES`: `'mid', 'base', 'mid east', 'mid west', 'base east', 'base west'`

- [ ] **Step 4: Add mid/base to rectangle.js**

Same pattern. `mid east` = `{ x: center.x + halfWidth, y: center.y }`.

```js
if (name === 'mid' || name === 'base') {
  return { x: center.x, y: center.y };
}
if (name === 'mid east' || name === 'base east') {
  return { x: center.x + hw, y: center.y };
}
if (name === 'mid west' || name === 'base west') {
  return { x: center.x - hw, y: center.y };
}
```

Add to `ANCHOR_NAMES`.

- [ ] **Step 5: Add mid/base to ellipse.js**

Same pattern. `mid east` = `{ x: center.x + rx, y: center.y }`.

```js
if (name === 'mid' || name === 'base') {
  return { x: center.x, y: center.y };
}
if (name === 'mid east' || name === 'base east') {
  return { x: center.x + rx, y: center.y };
}
if (name === 'mid west' || name === 'base west') {
  return { x: center.x - rx, y: center.y };
}
```

Add to `ANCHOR_NAMES`.

- [ ] **Step 6: Add mid/base to rectangle-callout.js**

Read the file to locate the `anchor()` function. Add the same 6 cases using `halfWidth` for east/west x. Add to anchor names list.

- [ ] **Step 7: Add mid/base to ellipse-callout.js**

Read the file to locate the `anchor()` function. Add the same 6 cases using `rx` for east/west x. Add to anchor names list.

- [ ] **Step 8: Add mid/base to cloud-callout.js**

Read the file to locate the `anchor()` function. Add the same 6 cases. Cloud callout uses the outer ellipse for east/west — use `borderPoint` with `{x:1, y:0}` for east x. Add to anchor names list.

- [ ] **Step 9: Run tests**

Run: `node --test test/anchor-audit.test.js`
Expected: all tests PASS

- [ ] **Step 10: Run full test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 11: Commit**

```bash
git add src-v2/shapes/circle.js src-v2/shapes/rectangle.js src-v2/shapes/ellipse.js \
  src-v2/shapes/rectangle-callout.js src-v2/shapes/ellipse-callout.js \
  src-v2/shapes/cloud-callout.js test/anchor-audit.test.js
git commit -m "Add mid/base anchor family to 6 legacy registerShape shapes"
```

---

### Task 3: Add `corner N` and `side N` anchors to regular polygon

**Files:**
- Modify: `src-v2/shapes/regular-polygon.js`
- Modify: `test/anchor-audit.test.js`

TikZ's regular polygon defines (lines 890–916 of `pgflibraryshapes.geometric.code.tex`):
- `corner N` — vertex N (1-indexed), at angle `startAngle + (N-1) * angleStep`, at `anchorRadius`
- `side N` — midpoint of edge between corner N and corner N+1, at `anchorRadius`

- [ ] **Step 1: Write failing tests**

Add to `test/anchor-audit.test.js`:

```js
describe('corner N / side N anchors on regular polygon', () => {
  it('pentagon has corner 1 through corner 5', async () => {
    await import('../src-v2/shapes/regular-polygon.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    for (let i = 1; i <= 5; i++) {
      const pt = shape.anchor(`corner ${i}`, geom);
      assert.ok(pt, `corner ${i} should exist`);
      // All corners should be at radius distance from center
      const dist = Math.sqrt(pt.x ** 2 + pt.y ** 2);
      assert.ok(Math.abs(dist - 30) < 0.01, `corner ${i} dist=${dist} should be ~30`);
    }
  });

  it('corner 1 of pentagon is at top (90 degrees)', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    const c1 = shape.anchor('corner 1', geom);
    // Pentagon with odd sides: startAngle=90, so corner 1 is at top (SVG: y=-30)
    assert.ok(Math.abs(c1.x) < 0.01, `corner 1 x=${c1.x} should be ~0`);
    assert.ok(c1.y < 0, `corner 1 y=${c1.y} should be negative (top)`);
  });

  it('pentagon has side 1 through side 5', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    for (let i = 1; i <= 5; i++) {
      const pt = shape.anchor(`side ${i}`, geom);
      assert.ok(pt, `side ${i} should exist`);
    }
  });

  it('side 1 is midpoint between corner 1 and corner 2', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    const c1 = shape.anchor('corner 1', geom);
    const c2 = shape.anchor('corner 2', geom);
    const s1 = shape.anchor('side 1', geom);
    assert.ok(Math.abs(s1.x - (c1.x + c2.x) / 2) < 0.01);
    assert.ok(Math.abs(s1.y - (c1.y + c2.y) / 2) < 0.01);
  });

  it('hexagon has corner 1 through corner 6 and side 1 through side 6', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 6, outerSep: 0,
    });
    for (let i = 1; i <= 6; i++) {
      assert.ok(shape.anchor(`corner ${i}`, geom), `corner ${i}`);
      assert.ok(shape.anchor(`side ${i}`, geom), `side ${i}`);
    }
  });

  it('corner N throws for N > sides', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    assert.throws(() => shape.anchor('corner 6', geom));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/anchor-audit.test.js`
Expected: FAIL — `regular polygon.anchor: unknown anchor "corner 1"`

- [ ] **Step 3: Add dynamicAnchor to regular-polygon.js**

In `src-v2/shapes/regular-polygon.js`, add a `dynamicAnchor` function to the `createShape` spec:

```js
dynamicAnchor(name, geom) {
  const { center: c, radius, sides, startAngle } = geom;
  const step = 360 / sides;
  const DEG = Math.PI / 180;

  const cornerMatch = name.match(/^corner (\d+)$/);
  if (cornerMatch) {
    const n = parseInt(cornerMatch[1], 10);
    if (n < 1 || n > sides) return null;
    const angle = (startAngle + (n - 1) * step) * DEG;
    return {
      x: c.x + radius * Math.cos(angle),
      y: c.y - radius * Math.sin(angle),  // SVG y-down
    };
  }

  const sideMatch = name.match(/^side (\d+)$/);
  if (sideMatch) {
    const n = parseInt(sideMatch[1], 10);
    if (n < 1 || n > sides) return null;
    const angle1 = (startAngle + (n - 1) * step) * DEG;
    const angle2 = (startAngle + n * step) * DEG;
    return {
      x: c.x + radius * (Math.cos(angle1) + Math.cos(angle2)) / 2,
      y: c.y - radius * (Math.sin(angle1) + Math.sin(angle2)) / 2,
    };
  }

  return null;
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/anchor-audit.test.js`
Expected: all tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-v2/shapes/regular-polygon.js test/anchor-audit.test.js
git commit -m "Add corner N / side N dynamic anchors to regular polygon"
```

---

### Task 4: Add `corner N` and `side N` anchors to preparation

**Files:**
- Modify: `src-v2/shapes/preparation.js`
- Modify: `test/anchor-audit.test.js`

Preparation has 6 fixed vertices (W, NW, NE, E, SE, SW). Corners are 1-indexed starting from west (left point), going clockwise. Sides are midpoints of consecutive edges.

- [ ] **Step 1: Write failing tests**

Add to `test/anchor-audit.test.js`:

```js
describe('corner N / side N anchors on preparation', () => {
  it('has corner 1 through corner 6', async () => {
    await import('../src-v2/shapes/preparation.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    for (let i = 1; i <= 6; i++) {
      const pt = shape.anchor(`corner ${i}`, geom);
      assert.ok(pt, `corner ${i} should exist`);
    }
  });

  it('has side 1 through side 6', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    for (let i = 1; i <= 6; i++) {
      const pt = shape.anchor(`side ${i}`, geom);
      assert.ok(pt, `side ${i} should exist`);
    }
  });

  it('side 1 is midpoint of corner 1 and corner 2', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    const c1 = shape.anchor('corner 1', geom);
    const c2 = shape.anchor('corner 2', geom);
    const s1 = shape.anchor('side 1', geom);
    assert.ok(Math.abs(s1.x - (c1.x + c2.x) / 2) < 0.01);
    assert.ok(Math.abs(s1.y - (c1.y + c2.y) / 2) < 0.01);
  });

  it('corner 7 throws', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    assert.throws(() => shape.anchor('corner 7', geom));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/anchor-audit.test.js`
Expected: FAIL — `preparation.anchor: unknown anchor "corner 1"`

- [ ] **Step 3: Add dynamicAnchor to preparation.js**

In `src-v2/shapes/preparation.js`, add `dynamicAnchor` to the createShape spec. The 6 vertices from `hexVertices` are indexed 0–5 (W, NW, NE, E, SE, SW). Corner N maps to vertex N-1.

```js
dynamicAnchor(name, geom) {
  const { center: c, halfWidth: hw, halfHeight: hh, pointWidth: pw } = geom;
  const verts = hexVertices(c.x, c.y, hw, hh, pw);

  const cornerMatch = name.match(/^corner (\d+)$/);
  if (cornerMatch) {
    const n = parseInt(cornerMatch[1], 10);
    if (n < 1 || n > 6) return null;
    return verts[n - 1];
  }

  const sideMatch = name.match(/^side (\d+)$/);
  if (sideMatch) {
    const n = parseInt(sideMatch[1], 10);
    if (n < 1 || n > 6) return null;
    const a = verts[n - 1];
    const b = verts[n % 6];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  return null;
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/anchor-audit.test.js`
Expected: all tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-v2/shapes/preparation.js test/anchor-audit.test.js
git commit -m "Add corner N / side N dynamic anchors to preparation shape"
```

---

### Task 5: Add shape-specific anchors to trapezium

**Files:**
- Modify: `src-v2/shapes/trapezium.js`
- Modify: `test/anchor-audit.test.js`

TikZ trapezium has: `bottom left corner`, `top left corner`, `top right corner`, `bottom right corner`, `left side`, `right side`, `top side`, `bottom side`.

- [ ] **Step 1: Write failing tests**

Add to `test/anchor-audit.test.js`:

```js
describe('trapezium shape-specific anchors', () => {
  it('has corner anchors', async () => {
    await import('../src-v2/shapes/trapezium.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('trapezium');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 30, halfHeight: 15, outerSep: 0,
    });
    for (const name of ['bottom left corner', 'top left corner', 'top right corner', 'bottom right corner']) {
      const pt = shape.anchor(name, geom);
      assert.ok(pt, `${name} should exist`);
    }
  });

  it('has side anchors (midpoints)', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('trapezium');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 30, halfHeight: 15, outerSep: 0,
    });
    for (const name of ['left side', 'right side', 'top side', 'bottom side']) {
      const pt = shape.anchor(name, geom);
      assert.ok(pt, `${name} should exist`);
    }
  });

  it('top side is midpoint of top left and top right corners', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('trapezium');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 30, halfHeight: 15, outerSep: 0,
    });
    const tl = shape.anchor('top left corner', geom);
    const tr = shape.anchor('top right corner', geom);
    const ts = shape.anchor('top side', geom);
    assert.ok(Math.abs(ts.x - (tl.x + tr.x) / 2) < 0.01);
    assert.ok(Math.abs(ts.y - (tl.y + tr.y) / 2) < 0.01);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/anchor-audit.test.js`
Expected: FAIL — unknown anchor

- [ ] **Step 3: Add corner and side anchors to trapezium namedAnchors**

In `src-v2/shapes/trapezium.js`, expand `namedAnchors` to include the 4 corners (= the 4 polygon vertices) and 4 sides (= midpoints of consecutive vertices):

```js
namedAnchors(geom) {
  const { center: c, halfWidth: hw, halfHeight: hh, leftAngle, rightAngle } = geom;
  const verts = trapeziumVertices(c.x, c.y, hw, hh, leftAngle, rightAngle);
  // verts: [0]=bottom left, [1]=top left, [2]=top right, [3]=bottom right
  return {
    north:       { x: c.x, y: c.y - hh }, south: { x: c.x, y: c.y + hh },
    east:        { x: c.x + hw, y: c.y }, west:  { x: c.x - hw, y: c.y },
    'north east': verts[2], 'north west': verts[1],
    'south east': verts[3], 'south west': verts[0],
    'bottom left corner': verts[0], 'top left corner': verts[1],
    'top right corner': verts[2], 'bottom right corner': verts[3],
    'left side':   { x: (verts[0].x + verts[1].x) / 2, y: (verts[0].y + verts[1].y) / 2 },
    'right side':  { x: (verts[2].x + verts[3].x) / 2, y: (verts[2].y + verts[3].y) / 2 },
    'top side':    { x: (verts[1].x + verts[2].x) / 2, y: (verts[1].y + verts[2].y) / 2 },
    'bottom side': { x: (verts[0].x + verts[3].x) / 2, y: (verts[0].y + verts[3].y) / 2 },
  };
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/anchor-audit.test.js`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src-v2/shapes/trapezium.js test/anchor-audit.test.js
git commit -m "Add corner and side anchors to trapezium (TikZ parity)"
```

---

### Task 6: Add shape-specific anchors to kite

**Files:**
- Modify: `src-v2/shapes/kite.js`
- Modify: `test/anchor-audit.test.js`

TikZ kite has: `upper vertex`, `lower vertex`, `left vertex`, `right vertex`, `upper left side`, `lower left side`, `upper right side`, `lower right side`.

- [ ] **Step 1: Write failing tests**

Add to `test/anchor-audit.test.js`:

```js
describe('kite shape-specific anchors', () => {
  it('has vertex anchors', async () => {
    await import('../src-v2/shapes/kite.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('kite');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 20, halfHeight: 30, outerSep: 0,
    });
    for (const name of ['upper vertex', 'lower vertex', 'left vertex', 'right vertex']) {
      const pt = shape.anchor(name, geom);
      assert.ok(pt, `${name} should exist`);
    }
  });

  it('has side anchors', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('kite');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 20, halfHeight: 30, outerSep: 0,
    });
    for (const name of ['upper left side', 'lower left side', 'upper right side', 'lower right side']) {
      const pt = shape.anchor(name, geom);
      assert.ok(pt, `${name} should exist`);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Add vertex and side anchors to kite namedAnchors**

Read `src-v2/shapes/kite.js` to understand its vertex structure. Add the 4 vertex anchors (= the 4 kite vertices: north=upper, south=lower, east=right, west=left) and 4 side anchors (= midpoints of consecutive vertices).

- [ ] **Step 4: Run tests and verify pass**

- [ ] **Step 5: Commit**

```bash
git add src-v2/shapes/kite.js test/anchor-audit.test.js
git commit -m "Add vertex and side anchors to kite shape (TikZ parity)"
```

---

### Task 7: Add shape-specific anchors to cylinder

**Files:**
- Modify: `src-v2/shapes/cylinder.js`
- Modify: `test/anchor-audit.test.js`

TikZ cylinder has: `top`, `bottom`, `shape center`. Our cylinder already has `before top`, `after top`, `before bottom`, `after bottom`. Missing: `top`, `bottom`, `shape center`.

- [ ] **Step 1: Write failing tests**

Add to `test/anchor-audit.test.js`:

```js
describe('cylinder shape-specific anchors', () => {
  it('has top, bottom, shape center', async () => {
    await import('../src-v2/shapes/cylinder.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('cylinder');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 20, halfHeight: 30, outerSep: 0,
    });
    const top = shape.anchor('top', geom);
    const bottom = shape.anchor('bottom', geom);
    const sc = shape.anchor('shape center', geom);
    assert.ok(top.y < 0, 'top should be above center');
    assert.ok(bottom.y > 0, 'bottom should be below center');
    assert.strictEqual(sc.x, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Add top, bottom, shape center to cylinder namedAnchors**

Read `src-v2/shapes/cylinder.js` to understand the ellipse cap geometry. `top` = center of top ellipse, `bottom` = center of bottom ellipse, `shape center` = geometric center of the visible body (may differ from text center).

- [ ] **Step 4: Run tests and verify pass**

- [ ] **Step 5: Commit**

```bash
git add src-v2/shapes/cylinder.js test/anchor-audit.test.js
git commit -m "Add top, bottom, shape center anchors to cylinder (TikZ parity)"
```

---

### Task 8: Add `chord center` anchor to semicircle

**Files:**
- Modify: `src-v2/shapes/semicircle.js`
- Modify: `test/anchor-audit.test.js`

TikZ semicircle has `chord center` — the midpoint of the flat edge (diameter).

- [ ] **Step 1: Write failing test**

```js
describe('semicircle chord center', () => {
  it('has chord center anchor', async () => {
    await import('../src-v2/shapes/semicircle.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('semicircle');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, outerSep: 0,
    });
    const cc = shape.anchor('chord center', geom);
    assert.ok(cc, 'chord center should exist');
    // chord center is at the bottom of the semicircle (flat edge)
    assert.strictEqual(cc.x, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Add chord center to semicircle namedAnchors**

The chord center is at the midpoint of the flat diameter edge. Read `src-v2/shapes/semicircle.js` to determine its position.

- [ ] **Step 4: Run tests and verify pass**

- [ ] **Step 5: Commit**

```bash
git add src-v2/shapes/semicircle.js test/anchor-audit.test.js
git commit -m "Add chord center anchor to semicircle (TikZ parity)"
```

---

### Task 9: Update documentation

**Files:**
- Modify: `docs/Manual/appendix-reference.md`

- [ ] **Step 1: Update Anchors section**

In the Anchors section of `appendix-reference.md`, update to reflect all new anchors:

```markdown
## Anchors

**Standard (all shapes):** `center`, `mid`, `base`, `north`, `south`, `east`, `west`, `north east`, `north west`, `south east`, `south west`, `mid east`, `mid west`, `base east`, `base west`

**Numeric:** Any angle in degrees (0=east, counterclockwise)

**Regular polygon:** `corner N`, `side N` (1-indexed, N = number of sides)

**Preparation:** `corner N`, `side N` (1-indexed, N = 1..6)

**Trapezium/Parallelogram:** `bottom left corner`, `top left corner`, `top right corner`, `bottom right corner`, `left side`, `right side`, `top side`, `bottom side`

**Kite:** `upper vertex`, `lower vertex`, `left vertex`, `right vertex`, `upper left side`, `lower left side`, `upper right side`, `lower right side`

**Cylinder:** `top`, `bottom`, `shape center`, `before top`, `after top`, `before bottom`, `after bottom`

**Semicircle:** `apex`, `arc start`, `arc end`, `chord center`

**Callout-specific:** `pointer` (at the tip of the speech bubble)

**Cloud-specific:** `puff N` (1-indexed, N = number of puffs)
```

- [ ] **Step 2: Commit**

```bash
git add docs/Manual/appendix-reference.md
git commit -m "Document all new anchors in Manual appendix"
```

---

### Task 10: Final full test suite

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests PASS, no regressions

- [ ] **Step 2: Verify anchor count**

Run a quick script to print anchor counts per shape and confirm they match expectations.
