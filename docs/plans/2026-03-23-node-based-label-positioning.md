# Node-Based Edge Label Positioning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make edge labels real nodes (rectangle shapes with anchors) so they position correctly via TikZ-faithful anchor selection and can participate in transforms.

**Architecture:** Labels become rectangle-shape nodes positioned by selecting a TikZ-style anchor based on edge tangent direction. The anchor point sits at the edge curve; the text body extends away. All work in `src-v2/` sandbox — `src/` is untouched.

**Tech Stack:** Pure ES modules, `node --test`, jsdom for DOM tests.

**Spec:** `docs/superpowers/specs/2026-03-22-anchor-based-label-positioning-design.md`

---

## File Structure

### New/Modified files (all in src-v2/)

| File | Action | Responsibility |
|------|--------|----------------|
| `src-v2/geometry/labels.js` | Rewrite | `computeLabelNode()`, `computeAnchor()`, `mirrorAnchor()`, `estimateTextSize()` |
| `src-v2/svg/emitter.js` | Modify | Replace `emitEdgeLabel()` with `emitLabelNode()` |
| `src-v2/index.js` | Modify | Call `computeLabelNode()`, thread `innerSep`, pass label node data to emitter |
| `src-v2/core/constants.js` | Modify | Add `innerSep: 3`, add `labelDistance: 0` |
| `src-v2/style/style.js` | Modify | Change hardcoded `labelDistance: 8` to use `DEFAULTS.labelDistance`, add `innerSep` to edge style base |

### New test files

| File | Tests |
|------|-------|
| `test/labels-node.test.js` | `computeAnchor`, `mirrorAnchor`, `estimateTextSize`, `computeLabelNode` center repositioning |
| `test/emitter-label-node.test.js` | `emitLabelNode` DOM structure verification |

### Sandbox setup (one-time)

| File | Action |
|------|--------|
| `src-v2/` | `cp -r src/ src-v2/` |
| `examples-v2/` | `cp -r examples/ examples-v2/` then sed import paths |

---

## Task 0: Create sandbox

- [ ] **Step 1: Copy src and examples**

```bash
cd /Users/sergiop/Dropbox/Scripts/tikz-svg
cp -r src/ src-v2/
cp -r examples/ examples-v2/
```

- [ ] **Step 2: Update import paths in example demos**

```bash
sed -i '' 's|../src/|../src-v2/|g' examples-v2/*.html
```

- [ ] **Step 3: Update constants.js defaults**

File: `src-v2/core/constants.js`

Add `innerSep` and add `labelDistance` to DEFAULTS:

```js
export const DEFAULTS = {
  nodeDistance: 60,
  onGrid: true,
  nodeRadius: 20,
  fontSize: 14,
  fontFamily: 'serif',
  edgeStrokeWidth: 1.5,
  edgeColor: '#000000',
  nodeFill: '#FFFFFF',
  nodeStroke: '#000000',
  nodeStrokeWidth: 1.5,
  arrowSize: 8,
  bendAngle: 30,
  loopSize: 25,
  loopAngle: 15,
  shadow: false,
  shadowDefaults: { dx: 2, dy: 2, blur: 3, color: 'rgba(0,0,0,0.25)' },
  acceptingInset: 3,
  initialArrowLength: 25,
  innerSep: 3,
  labelDistance: 0,
};
```

- [ ] **Step 3b: Update style.js to use DEFAULTS instead of hardcoded values**

File: `src-v2/style/style.js` — in `resolveEdgeStyle()`, change the base object (line 54) from hardcoded `labelDistance: 8` to use DEFAULTS, and add `innerSep`:

```js
  const base = {
    stroke: DEFAULTS.edgeColor,
    strokeWidth: DEFAULTS.edgeStrokeWidth,
    arrow: 'stealth',
    dashed: false,
    opacity: 1,
    bend: null,
    loop: null,
    labelPos: 0.5,
    labelSide: 'auto',
    labelDistance: DEFAULTS.labelDistance,
    innerSep: DEFAULTS.innerSep,
    className: null,
  };
```

- [ ] **Step 4: Verify existing tests still pass against src/**

Run: `npm test`
Expected: All 140 tests pass (src/ is untouched).

- [ ] **Step 5: Commit**

```bash
git add src-v2/ examples-v2/
git commit -m "chore: create src-v2 and examples-v2 sandbox for node-based labels

Updates constants.js defaults (innerSep, labelDistance) and style.js
to use DEFAULTS instead of hardcoded values."
```

---

## Task 1: `estimateTextSize` and `mirrorAnchor`

These are pure helper functions with no dependencies on the rest of the label system.

**Files:**
- Modify: `src-v2/geometry/labels.js`
- Create: `test/labels-node.test.js`

- [ ] **Step 1: Write failing tests for estimateTextSize**

File: `test/labels-node.test.js`

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTextSize, mirrorAnchor } from '../src-v2/geometry/labels.js';

describe('estimateTextSize', () => {
  it('single character at fontSize 14', () => {
    const size = estimateTextSize('0', 14);
    assert.strictEqual(size.width, 14 * 0.6);  // 8.4
    assert.strictEqual(size.height, 14);
  });

  it('multi-character label', () => {
    const size = estimateTextSize('0,1,L', 14);
    assert.strictEqual(size.width, 5 * 14 * 0.6);  // 42
    assert.strictEqual(size.height, 14);
  });

  it('empty string returns zero width', () => {
    const size = estimateTextSize('', 14);
    assert.strictEqual(size.width, 0);
    assert.strictEqual(size.height, 14);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/labels-node.test.js`
Expected: FAIL — `estimateTextSize` is not exported.

- [ ] **Step 3: Implement estimateTextSize**

File: `src-v2/geometry/labels.js` — add at the top of the file (after imports, before other functions):

```js
/**
 * Estimate text dimensions for a label string.
 * Uses a simple character-count heuristic (same as emitter.js viewBox estimator).
 * @param {string} text
 * @param {number} fontSize
 * @returns {{ width: number, height: number }}
 */
export function estimateTextSize(text, fontSize) {
  return {
    width: text.length * fontSize * 0.6,
    height: fontSize,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/labels-node.test.js`
Expected: 3 tests PASS.

- [ ] **Step 5: Write failing tests for mirrorAnchor**

Append to `test/labels-node.test.js`:

```js
describe('mirrorAnchor', () => {
  it('south east <-> north west', () => {
    assert.strictEqual(mirrorAnchor('south east'), 'north west');
    assert.strictEqual(mirrorAnchor('north west'), 'south east');
  });

  it('south west <-> north east', () => {
    assert.strictEqual(mirrorAnchor('south west'), 'north east');
    assert.strictEqual(mirrorAnchor('north east'), 'south west');
  });

  it('south <-> north', () => {
    assert.strictEqual(mirrorAnchor('south'), 'north');
    assert.strictEqual(mirrorAnchor('north'), 'south');
  });

  it('east <-> west', () => {
    assert.strictEqual(mirrorAnchor('east'), 'west');
    assert.strictEqual(mirrorAnchor('west'), 'east');
  });

  it('center stays center', () => {
    assert.strictEqual(mirrorAnchor('center'), 'center');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `node --test test/labels-node.test.js`
Expected: FAIL — `mirrorAnchor` is not exported.

- [ ] **Step 7: Implement mirrorAnchor**

File: `src-v2/geometry/labels.js` — add after `estimateTextSize`:

```js
const MIRROR = {
  'south east': 'north west',
  'north west': 'south east',
  'south west': 'north east',
  'north east': 'south west',
  'south': 'north',
  'north': 'south',
  'east': 'west',
  'west': 'east',
  'center': 'center',
};

/**
 * Mirror an anchor name (TikZ swap operation).
 * @param {string} anchor
 * @returns {string}
 */
export function mirrorAnchor(anchor) {
  return MIRROR[anchor] ?? anchor;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test test/labels-node.test.js`
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src-v2/geometry/labels.js test/labels-node.test.js
git commit -m "feat(labels): add estimateTextSize and mirrorAnchor helpers"
```

---

## Task 2: `computeAnchor`

The 8-way anchor selection from TikZ, converting SVG y-down tangents to TikZ y-up before applying the table.

**Files:**
- Modify: `src-v2/geometry/labels.js`
- Modify: `test/labels-node.test.js`

- [ ] **Step 1: Write failing tests for computeAnchor**

Append to `test/labels-node.test.js`:

Update the import line at the top of the file to:

```js
import { estimateTextSize, mirrorAnchor, computeAnchor } from '../src-v2/geometry/labels.js';
```

Then add the tests:

```js
describe('computeAnchor', () => {
  // Tangent vectors are in SVG coords (y-down).
  // computeAnchor negates y internally to convert to TikZ y-up.

  // Edge going right and down in SVG = right and up in TikZ → south east
  it('right-down SVG tangent (right-up TikZ) → south east', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: 1 }, 'left'), 'south east');
  });

  // Edge going right and up in SVG = right and down in TikZ → south west
  it('right-up SVG tangent (right-down TikZ) → south west', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: -1 }, 'left'), 'south west');
  });

  // Pure right → south
  it('pure right → south', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: 0 }, 'left'), 'south');
  });

  // Edge going left and down in SVG = left and up in TikZ → north east
  it('left-down SVG tangent (left-up TikZ) → north east', () => {
    assert.strictEqual(computeAnchor({ x: -1, y: 1 }, 'left'), 'north east');
  });

  // Edge going left and up in SVG = left and down in TikZ → north west
  it('left-up SVG tangent (left-down TikZ) → north west', () => {
    assert.strictEqual(computeAnchor({ x: -1, y: -1 }, 'left'), 'north west');
  });

  // Pure left → north
  it('pure left → north', () => {
    assert.strictEqual(computeAnchor({ x: -1, y: 0 }, 'left'), 'north');
  });

  // Pure down in SVG = pure up in TikZ → east
  it('pure down SVG (up TikZ) → east', () => {
    assert.strictEqual(computeAnchor({ x: 0, y: 1 }, 'left'), 'east');
  });

  // Pure up in SVG = pure down in TikZ → west
  it('pure up SVG (down TikZ) → west', () => {
    assert.strictEqual(computeAnchor({ x: 0, y: -1 }, 'left'), 'west');
  });

  // Degenerate zero tangent → west (TikZ fall-through)
  it('zero tangent → west', () => {
    assert.strictEqual(computeAnchor({ x: 0, y: 0 }, 'left'), 'west');
  });

  // Swap: right-down SVG → south east becomes north west
  it('swap: right-down SVG → north west', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: 1 }, 'right'), 'north west');
  });

  // Swap: pure right → south becomes north
  it('swap: pure right → north', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: 0 }, 'right'), 'north');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/labels-node.test.js`
Expected: FAIL — `computeAnchor` is not exported.

- [ ] **Step 3: Implement computeAnchor**

File: `src-v2/geometry/labels.js` — add after `mirrorAnchor`:

```js
/**
 * Select a TikZ-style anchor name based on edge tangent direction.
 *
 * Replicates tikz.code.tex lines 4484–4534.
 * Tangent is in SVG coordinates (y-down); we negate y to convert to TikZ (y-up).
 *
 * @param {{ x: number, y: number }} tangent - tangent vector in SVG coords
 * @param {string} side - 'left' (TikZ auto) or 'right' (TikZ swap)
 * @returns {string} anchor name ('south', 'north east', etc.)
 */
export function computeAnchor(tangent, side) {
  const norm = vecNormalize(tangent);
  const tx = norm.x;
  const ty = -norm.y;  // SVG y-down → TikZ y-up
  const T = 0.05;

  let anchor;
  if (Math.abs(tx) <= T && Math.abs(ty) <= T) {
    // Degenerate: matches TikZ fall-through (pgf@y > 0pt else → west)
    anchor = 'west';
  } else if (tx > T) {
    if (ty > T) anchor = 'south east';
    else if (ty < -T) anchor = 'south west';
    else anchor = 'south';
  } else if (tx < -T) {
    if (ty > T) anchor = 'north east';
    else if (ty < -T) anchor = 'north west';
    else anchor = 'north';
  } else {
    anchor = ty > 0 ? 'east' : 'west';
  }

  return side === 'right' ? mirrorAnchor(anchor) : anchor;
}
```

Note: `vecNormalize` is already imported at the top of `labels.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/labels-node.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-v2/geometry/labels.js test/labels-node.test.js
git commit -m "feat(labels): add computeAnchor with TikZ 8-way anchor selection"
```

---

## Task 3: `computeLabelNode`

The main function that combines text sizing, anchor selection, and center repositioning.

**Files:**
- Modify: `src-v2/geometry/labels.js`
- Modify: `test/labels-node.test.js`

- [ ] **Step 1: Write failing tests for computeLabelNode**

Update the import line at the top of `test/labels-node.test.js` to:

```js
import { estimateTextSize, mirrorAnchor, computeAnchor, computeLabelNode } from '../src-v2/geometry/labels.js';
```

Then add:

```js
describe('computeLabelNode', () => {
  // Helper: make a straight edge geometry going right (0,0) → (100,0)
  // After border clipping with r=20: startPoint (20,0) → endPoint (80,0)
  function straightRightEdge() {
    return {
      type: 'straight',
      startPoint: { x: 20, y: 0 },
      endPoint: { x: 80, y: 0 },
    };
  }

  it('label node center is shifted so anchor sits at edge point', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'left', distance: 0, innerSep: 3, fontSize: 14,
    });

    // Edge midpoint is (50, 0). Tangent is pure right → anchor 'south'.
    assert.strictEqual(result.anchor, 'south');

    // 'south' anchor on a rectangle is at (center.x, center.y + halfHeight).
    // halfHeight = fontSize/2 + innerSep = 7 + 3 = 10.
    // For south anchor to land at (50, 0): center.y = 0 - 10 = -10
    assert.strictEqual(result.center.x, 50);
    assert.strictEqual(result.center.y, -10);
  });

  it('swap side mirrors the anchor', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'right', distance: 0, innerSep: 3, fontSize: 14,
    });

    // Swap: south → north. north anchor at (center.x, center.y - halfHeight).
    // For north anchor at (50, 0): center.y = 0 + 10 = 10
    assert.strictEqual(result.anchor, 'north');
    assert.strictEqual(result.center.x, 50);
    assert.strictEqual(result.center.y, 10);
  });

  it('geom has correct halfWidth and halfHeight', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0,1,L', {
      pos: 0.5, side: 'left', distance: 0, innerSep: 3, fontSize: 14,
    });

    // textWidth = 5 * 14 * 0.6 = 42, halfWidth = 42/2 + 3 = 24
    // textHeight = 14, halfHeight = 14/2 + 3 = 10
    assert.strictEqual(result.geom.halfWidth, 24);
    assert.strictEqual(result.geom.halfHeight, 10);
  });

  it('distance offsets the edge point before anchor positioning', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'left', distance: 5, innerSep: 3, fontSize: 14,
    });

    // perpendicularOffset with tangent (1,0) and distance 5:
    //   x = 50 - 0*5 = 50, y = 0 + 1*5 = 5 (positive = down in SVG = left of rightward travel)
    // Anchor is still 'south'. halfHeight = 10.
    // center.y = 5 - 10 = -5
    assert.strictEqual(result.anchor, 'south');
    assert.strictEqual(result.center.x, 50);
    assert.strictEqual(result.center.y, -5);
  });

  it('returns null angle when sloped is false', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'left', distance: 0, innerSep: 3, fontSize: 14,
    });
    assert.strictEqual(result.angle, null);
  });

  it('returns angle and forces south anchor when sloped is true', () => {
    // Diagonal edge: tangent is (1, -1) normalized → ~45° up-right in SVG
    const edge = {
      type: 'straight',
      startPoint: { x: 0, y: 100 },
      endPoint: { x: 100, y: 0 },
    };
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'left', distance: 0, innerSep: 3, fontSize: 14,
      sloped: true,
    });

    // Sloped forces anchor to 'south' (or 'north' if angle flips)
    assert.ok(result.anchor === 'south' || result.anchor === 'north');
    assert.ok(typeof result.angle === 'number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/labels-node.test.js`
Expected: FAIL — `computeLabelNode` is not exported.

- [ ] **Step 3: Implement computeLabelNode**

File: `src-v2/geometry/labels.js` — **rewrite** the file. Keep the existing imports plus add the rectangle shape import. Remove old `computeLabelPosition`, `offsetBySide`, `crossMag`. Keep `slopeAngle` (internal helper).

```js
/**
 * Node-based label positioning along edges.
 *
 * Labels are rectangle-shape nodes positioned via TikZ-style anchor selection.
 * The selected anchor sits at the edge point; the text body extends away.
 */

import {
  vec,
  vecSub,
  vecNormalize,
  lerp,
  radToDeg,
  pointOnQuadBezier,
  tangentOnQuadBezier,
  pointOnCubicBezier,
  tangentOnCubicBezier,
  perpendicularOffset,
} from '../core/math.js';
import rectangleShape from '../shapes/rectangle.js';

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

/**
 * Estimate text dimensions for a label string.
 * @param {string} text
 * @param {number} fontSize
 * @returns {{ width: number, height: number }}
 */
export function estimateTextSize(text, fontSize) {
  return {
    width: text.length * fontSize * 0.6,
    height: fontSize,
  };
}

const MIRROR = {
  'south east': 'north west',
  'north west': 'south east',
  'south west': 'north east',
  'north east': 'south west',
  'south': 'north',
  'north': 'south',
  'east': 'west',
  'west': 'east',
  'center': 'center',
};

/**
 * Mirror an anchor name (TikZ swap operation).
 * @param {string} anchor
 * @returns {string}
 */
export function mirrorAnchor(anchor) {
  return MIRROR[anchor] ?? anchor;
}

/**
 * Select a TikZ-style anchor name based on edge tangent direction.
 * Replicates tikz.code.tex lines 4484–4534.
 * Tangent is in SVG coordinates (y-down); we negate y to convert to TikZ (y-up).
 *
 * @param {{ x: number, y: number }} tangent - tangent vector in SVG coords
 * @param {string} side - 'left' (TikZ auto) or 'right' (TikZ swap)
 * @returns {string}
 */
export function computeAnchor(tangent, side) {
  const norm = vecNormalize(tangent);
  const tx = norm.x;
  const ty = -norm.y;
  const T = 0.05;

  let anchor;
  if (Math.abs(tx) <= T && Math.abs(ty) <= T) {
    anchor = 'west';
  } else if (tx > T) {
    if (ty > T) anchor = 'south east';
    else if (ty < -T) anchor = 'south west';
    else anchor = 'south';
  } else if (tx < -T) {
    if (ty > T) anchor = 'north east';
    else if (ty < -T) anchor = 'north west';
    else anchor = 'north';
  } else {
    anchor = ty > 0 ? 'east' : 'west';
  }

  return side === 'right' ? mirrorAnchor(anchor) : anchor;
}

/**
 * Compute rotation angle for sloped labels (degrees).
 * Adjusted so text always reads left-to-right.
 * @param {{ x: number, y: number }} tangent
 * @returns {number}
 */
function slopeAngle(tangent) {
  let deg = radToDeg(Math.atan2(tangent.y, tangent.x));
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

/**
 * 2D cross-product magnitude. Positive when b is left of a.
 */
function crossMag(a, b) {
  return a.x * b.y - a.y * b.x;
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Compute label node geometry, anchor, center, and optional rotation.
 *
 * @param {Object} edgeGeometry - from computeEdgePath. Must include `type`,
 *   `startPoint`, `endPoint`, and control points for curved edges.
 * @param {string} labelText - the label string (used for size estimation).
 * @param {Object} [opts]
 * @param {number} [opts.pos=0.5]       - t along curve (0=start, 1=end)
 * @param {string} [opts.side='auto']   - 'left', 'right', or 'auto'
 * @param {number} [opts.distance=0]    - perpendicular offset from curve (px)
 * @param {number} [opts.innerSep=3]    - padding inside label rectangle (px)
 * @param {number} [opts.fontSize=14]   - font size for text estimation
 * @param {boolean} [opts.sloped=false] - rotate label along edge tangent
 * @returns {{ center: {x,y}, anchor: string, geom: Object, angle: number|null }}
 */
export function computeLabelNode(edgeGeometry, labelText, opts = {}) {
  const pos = opts.pos ?? 0.5;
  const side = opts.side ?? 'auto';
  const distance = opts.distance ?? 0;
  const innerSep = opts.innerSep ?? 3;
  const fontSize = opts.fontSize ?? 14;
  const sloped = opts.sloped ?? false;

  const { startPoint, endPoint, type } = edgeGeometry;

  // 1. Compute point and tangent on curve at pos
  let point, tangent;

  switch (type) {
    case 'quadratic': {
      const cp = edgeGeometry.controlPoint;
      point = pointOnQuadBezier(startPoint, cp, endPoint, pos);
      tangent = tangentOnQuadBezier(startPoint, cp, endPoint, pos);
      break;
    }
    case 'cubic': {
      const { cp1, cp2 } = edgeGeometry;
      point = pointOnCubicBezier(startPoint, cp1, cp2, endPoint, pos);
      tangent = tangentOnCubicBezier(startPoint, cp1, cp2, endPoint, pos);
      break;
    }
    case 'straight':
    default:
      point = vec(
        lerp(startPoint.x, endPoint.x, pos),
        lerp(startPoint.y, endPoint.y, pos),
      );
      tangent = vecSub(endPoint, startPoint);
  }

  // 2. Apply perpendicular distance offset
  let edgePoint = point;
  if (distance > 0) {
    // Resolve 'auto' side for distance offset
    let effectiveSide = side;
    if (side === 'auto') {
      const baseDir = vecNormalize(vecSub(endPoint, startPoint));
      const left = perpendicularOffset(point, tangent, distance);
      const right = perpendicularOffset(point, tangent, -distance);
      const dLeft = crossMag(baseDir, vecSub(left, startPoint));
      const dRight = crossMag(baseDir, vecSub(right, startPoint));
      effectiveSide = Math.abs(dLeft) >= Math.abs(dRight) ? 'left' : 'right';
    }
    const sign = effectiveSide === 'right' ? -1 : 1;
    edgePoint = perpendicularOffset(point, tangent, sign * distance);
  }

  // 3. Resolve side for anchor selection (auto → left or right)
  let anchorSide = side;
  if (side === 'auto') {
    const baseDir = vecNormalize(vecSub(endPoint, startPoint));
    const left = perpendicularOffset(point, tangent, 1);
    const dLeft = crossMag(baseDir, vecSub(left, startPoint));
    anchorSide = dLeft >= 0 ? 'left' : 'right';
  }

  // 4. Compute sloped angle and handle anchor override
  let angle = null;
  if (sloped) {
    angle = slopeAngle(tangent);
    // When sloped, force south/north. If slopeAngle flipped the text upright,
    // "above" and "below" swap in the rotated frame. If user also requested
    // swap (side='right'), that flips again. Use XOR to combine both.
    const rawDeg = radToDeg(Math.atan2(tangent.y, tangent.x));
    const flipped = rawDeg > 90 || rawDeg < -90;
    const wantSwap = (anchorSide === 'right');
    const effectivelyFlipped = flipped !== wantSwap;  // XOR
    anchorSide = effectivelyFlipped ? 'right' : 'left';
  }

  // 5. Select anchor
  const anchor = sloped
    ? (anchorSide === 'right' ? 'north' : 'south')
    : computeAnchor(tangent, anchorSide);

  // 6. Compute label rectangle geometry
  const { width: textWidth, height: textHeight } = estimateTextSize(labelText, fontSize);
  const halfWidth = (textWidth / 2) + innerSep;
  const halfHeight = (textHeight / 2) + innerSep;

  const tempGeom = rectangleShape.savedGeometry({
    center: edgePoint,
    halfWidth,
    halfHeight,
  });

  // 7. Reposition center so selected anchor lands at edgePoint
  const anchorPos = rectangleShape.anchor(anchor, tempGeom);
  const labelCenter = {
    x: edgePoint.x - (anchorPos.x - tempGeom.center.x),
    y: edgePoint.y - (anchorPos.y - tempGeom.center.y),
  };

  // 8. Return final geometry with corrected center
  const geom = rectangleShape.savedGeometry({
    center: labelCenter,
    halfWidth,
    halfHeight,
  });

  return { center: labelCenter, anchor, geom, angle };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/labels-node.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-v2/geometry/labels.js test/labels-node.test.js
git commit -m "feat(labels): add computeLabelNode with anchor-based positioning"
```

---

## Task 4: `emitLabelNode` in emitter

Replace `emitEdgeLabel()` with `emitLabelNode()` that emits a `<g>` containing `<rect>` + `<text>`.

**Files:**
- Modify: `src-v2/svg/emitter.js`
- Create: `test/emitter-label-node.test.js`

- [ ] **Step 1: Write failing test for emitLabelNode**

File: `test/emitter-label-node.test.js`

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Set up DOM globals before importing emitter
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

// Now import — emitter uses document.createElementNS
const { emitSVG } = await import('../src-v2/svg/emitter.js');

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg() {
  return document.createElementNS(SVG_NS, 'svg');
}

describe('emitLabelNode', () => {
  it('label produces a <g> with <rect> and <text> in label-layer', () => {
    const svg = makeSvg();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        from: 'a', to: 'b',
        label: 'test',
        path: 'M 0 0 L 100 0',
        edgeGeometry: { type: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 0 } },
        labelNode: {
          center: { x: 50, y: -10 },
          anchor: 'south',
          geom: { center: { x: 50, y: -10 }, halfWidth: 20, halfHeight: 10 },
          angle: null,
        },
        style: { stroke: '#000', strokeWidth: 1 },
      }],
      arrowDefs: [],
      shadowFilters: [],
    });

    const labelLayer = svg.querySelector('.label-layer');
    assert.ok(labelLayer, 'label-layer exists');

    const g = labelLayer.querySelector('g.label-node');
    assert.ok(g, 'label <g> exists');

    const rect = g.querySelector('rect');
    assert.ok(rect, '<rect> exists in label node');
    assert.strictEqual(rect.getAttribute('fill'), 'none');

    const text = g.querySelector('text');
    assert.ok(text, '<text> exists in label node');
    assert.strictEqual(text.textContent, 'test');
    assert.strictEqual(text.getAttribute('text-anchor'), 'middle');
  });

  it('no label node emitted when label is null', () => {
    const svg = makeSvg();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        from: 'a', to: 'b',
        label: null,
        path: 'M 0 0 L 100 0',
        edgeGeometry: { type: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 0 } },
        labelNode: null,
        style: { stroke: '#000', strokeWidth: 1 },
      }],
      arrowDefs: [],
      shadowFilters: [],
    });

    const labelLayer = svg.querySelector('.label-layer');
    assert.strictEqual(labelLayer.children.length, 0);
  });

  it('sloped label has transform with rotation', () => {
    const svg = makeSvg();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        from: 'a', to: 'b',
        label: 'sloped',
        path: 'M 0 0 L 100 -100',
        edgeGeometry: { type: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: -100 } },
        labelNode: {
          center: { x: 50, y: -50 },
          anchor: 'south',
          geom: { center: { x: 50, y: -50 }, halfWidth: 25, halfHeight: 10 },
          angle: -45,
        },
        style: { stroke: '#000', strokeWidth: 1 },
      }],
      arrowDefs: [],
      shadowFilters: [],
    });

    const g = svg.querySelector('.label-layer g.label-node');
    const transform = g.getAttribute('transform');
    assert.ok(transform, 'transform exists');
    // Should contain rotation since angle is not null
    assert.ok(transform.includes('matrix') || transform.includes('rotate'),
      'transform includes rotation');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/emitter-label-node.test.js`
Expected: FAIL — emitter still uses `emitEdgeLabel` and reads `labelPosition` instead of `labelNode`.

- [ ] **Step 3: Implement emitLabelNode in emitter**

File: `src-v2/svg/emitter.js`

Replace the `emitEdgeLabel` function (lines 232-258) with:

```js
/**
 * Emit a <g> for an edge label node containing <rect> + <text>.
 * @param {Object} edge
 * @returns {SVGGElement|null}
 */
function emitLabelNode(edge) {
  const { label, labelNode, style } = edge;
  if (!label || !labelNode) return null;

  const { center, geom, angle } = labelNode;

  // Build transform
  let transformStr;
  if (angle != null) {
    // Use Transform class for rotation
    const t = new Transform();
    t.translate(center.x, center.y);
    t.rotate(angle);  // slopeAngle returns screen-space angle, Transform.rotate matches SVG convention
    transformStr = t.toSVG();
  } else {
    transformStr = `translate(${center.x}, ${center.y})`;
  }

  const g = createSVGElement('g', {
    class: 'label-node',
    transform: transformStr,
  });

  // Background rect (invisible by default)
  const rect = createSVGElement('rect', {
    x: -geom.halfWidth,
    y: -geom.halfHeight,
    width: geom.halfWidth * 2,
    height: geom.halfHeight * 2,
    fill: 'none',
    stroke: 'none',
  });
  g.appendChild(rect);

  // Text centered in rect
  const text = createSVGElement('text', {
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-size': style.fontSize ?? DEFAULTS.fontSize,
    'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
    fill: style.labelColor ?? '#000000',
  });
  text.textContent = String(label);
  g.appendChild(text);

  return g;
}
```

Also add the Transform import at the top of `src-v2/svg/emitter.js`:

```js
import { Transform } from '../core/transform.js';
```

In `emitSVG()`, change the label emission block (lines 491-496) from:

```js
const labelEl = emitEdgeLabel(edge);
if (labelEl) {
  labelLayer.appendChild(labelEl);
  refs.labels.push(labelEl);
}
```

to:

```js
const labelEl = emitLabelNode(edge);
if (labelEl) {
  labelLayer.appendChild(labelEl);
  refs.labels.push(labelEl);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/emitter-label-node.test.js`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-v2/svg/emitter.js test/emitter-label-node.test.js
git commit -m "feat(emitter): replace emitEdgeLabel with emitLabelNode"
```

---

## Task 5: Wire pipeline in `index.js`

Connect `computeLabelNode` to the emitter by modifying Phase 4 in the render pipeline.

**Files:**
- Modify: `src-v2/index.js`

- [ ] **Step 1: Update imports in index.js**

File: `src-v2/index.js` — change the labels import:

```js
// Old:
import { computeLabelPosition } from './geometry/labels.js';

// New:
import { computeLabelNode } from './geometry/labels.js';
```

- [ ] **Step 2: Update Phase 4 label computation**

In `src-v2/index.js`, replace the label computation block (around lines 144-154):

```js
// Old:
if (edge.label != null) {
  const labelPos = computeLabelPosition(geom, {
    pos: edge.labelPos ?? edgeStyle.labelPos,
    side: edge.labelSide ?? edgeStyle.labelSide,
    distance: edge.labelDistance ?? edgeStyle.labelDistance,
    sloped: edge.sloped,
  });
  edgeLabelPositions.push(labelPos);
} else {
  edgeLabelPositions.push(null);
}
```

```js
// New:
if (edge.label != null) {
  const labelNode = computeLabelNode(geom, String(edge.label), {
    pos: edge.labelPos ?? edgeStyle.labelPos,
    side: edge.labelSide ?? edgeStyle.labelSide,
    distance: edge.labelDistance ?? edgeStyle.labelDistance,
    innerSep: edge.innerSep ?? edgeStyle.innerSep,
    fontSize: edgeStyle.fontSize ?? DEFAULTS.fontSize,
    sloped: edge.sloped,
  });
  edgeLabelPositions.push(labelNode);
} else {
  edgeLabelPositions.push(null);
}
```

- [ ] **Step 3: Update Phase 6 model construction**

In `src-v2/index.js`, in the edge model loop (around line 187-197), change `labelPosition` to `labelNode`:

```js
// Old:
model.edges.push({
  index: i,
  from: edges[i].from,
  to: edges[i].to,
  label: edges[i].label ?? null,
  path: edgeGeometries[i].path,
  edgeGeometry: edgeGeometries[i],
  labelPosition: edgeLabelPositions[i],
  style: resolvedEdgeStyles[i],
});

// New:
model.edges.push({
  index: i,
  from: edges[i].from,
  to: edges[i].to,
  label: edges[i].label ?? null,
  path: edgeGeometries[i].path,
  edgeGeometry: edgeGeometries[i],
  labelNode: edgeLabelPositions[i],
  style: resolvedEdgeStyles[i],
});
```

- [ ] **Step 4: Run all v2 tests**

Run: `node --test test/labels-node.test.js test/emitter-label-node.test.js`
Expected: All PASS.

Also run existing tests to confirm src/ is unaffected:
Run: `npm test`
Expected: All 140 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src-v2/index.js
git commit -m "feat(pipeline): wire computeLabelNode through render pipeline"
```

---

## Task 6: Visual QA with examples

Open the sandbox demos in a browser to verify label placement.

**Files:**
- Read: `examples-v2/tikz-diamond.html`, `examples-v2/example6-turing.html`

- [ ] **Step 1: Open examples-v2/tikz-diamond.html in browser**

Verify:
- All 4 states render correctly (positions, colors, shadows)
- Edge labels ("0", "1") appear beside edges, not centered on them
- Labels don't overlap edges
- Loop labels ("0" above q1, "1" below q2) appear correctly
- Initial arrow on q0 renders

- [ ] **Step 2: Open examples-v2/example6-turing.html in browser**

This is the best test — it has longer labels ("0,1,L", "1,1,R") on dense edges:

Verify:
- Labels like "0,1,L" don't overlap the edge line
- Bent edges (C→E, E→A with bend=45) have labels on the outer side
- Loop labels (B loop, D loop) are positioned correctly
- All 5 states render

- [ ] **Step 3: Compare against TikZ originals**

Open the TikZ source files for reference:
- `examples/tikz-sources/example5-orange-shadow.tex`
- `examples/tikz-sources/example6-turing.tex`

Compare label placement qualitatively. Labels should sit adjacent to edges (not on top of them), similar to the TikZ output.

- [ ] **Step 4: If issues found, fix and recommit**

Common issues to check:
- Labels too close or too far: adjust `innerSep` default in `src-v2/core/constants.js`
- Anchor on wrong side: verify y-negation in `computeAnchor`
- Transform rotation wrong direction: check the `-angle` sign in `emitLabelNode`

- [ ] **Step 5: Commit any fixes**

```bash
git add src-v2/
git commit -m "fix(labels): visual QA adjustments"
```

---

## Task 7: Migration script

Prepare the LECWeb migration command.

- [ ] **Step 1: Test the migration script on a dry run**

```bash
grep -n 'tikz-svg/src/automata' /Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/arbitrage.html /Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/financial-markets.html
```

Expected: 7 matching lines (6 in arbitrage, 1 in financial-markets).

- [ ] **Step 2: Document migration command**

The migration (to be run when user is ready):

```bash
sed -i '' 's|/tikz-svg/src/automata/automata.js|/tikz-svg/src-v2/automata/automata.js|g' \
  /Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/arbitrage.html \
  /Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/financial-markets.html
```

**Do NOT run this yet** — user will confirm when ready to migrate live pages.

- [ ] **Step 3: Final commit**

```bash
git add docs/
git commit -m "docs: add node-based label positioning spec and implementation plan"
```
