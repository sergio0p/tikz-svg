**Status: COMPLETED** — Implemented in `src-v2/decorations/`. All tasks done.

# Decorations Module (random steps / wavy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add path decoration support to src-v2, starting with the `random steps` decoration and `rounded corners` smoothing — enabling the TikZ `wavy` style on both edges and node borders.

**Architecture:** New `decorations/` module provides `morphPath(svgPathData, options)` which: (1) parses the SVG path into commands, (2) samples points along it at `segmentLength` intervals, (3) applies random offsets in the local tangent frame (matching PGF's decoration engine), (4) optionally smooths corners with quadratic beziers, (5) emits a new SVG path string. The emitter calls `morphPath` when a style includes a `decoration` property. A seeded PRNG ensures deterministic rendering (matching PGF's `\pgfmathsetseed`).

**Tech Stack:** Pure ES modules, jsdom for tests, `node --test`

---

## PGF Reference

Implementation is based on these PGF source files (in `docs/References/`):

| File | Key mechanism |
|------|--------------|
| `pgflibrarydecorations.pathmorphing.code.tex:86-101` | `random steps`: walks path at `segmentLength` intervals, adds `(rand*amplitude, rand*amplitude)` offset in local frame |
| `pgfmoduledecorations.code.tex:39-62` | Decoration params: `segmentamplitude`, `segmentlength` defaults (2.5pt, 10pt) |
| `tikzlibrarydecorations.code.tex:44-68` | `pre`/`post` meta-decoration: straight lineto for `preLength` at start, main decoration in middle, straight lineto for `postLength` at end |
| `pgfcorepathconstruct.code.tex:64` | `\pgfsetcornersarced`: replaces polyline corners with arcs |

The user's `wavy` TikZ style (from `E510_LEC_SPR26.tex:69`):
```tex
wavy/.style = {
  rounded corners,
  decorate,
  decoration={random steps, segment length=.8cm, amplitude=.1cm,
              pre=lineto, pre length=.1cm, post=lineto, post length=.1cm}
}
```

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src-v2/core/random.js` | Seeded PRNG (mulberry32), `rand()` returns [-1, 1] |
| `src-v2/decorations/path-utils.js` | SVG path parser, point sampler along curves, path emitter |
| `src-v2/decorations/random-steps.js` | Random steps offset algorithm (tangent-frame offsets) |
| `src-v2/decorations/rounded-corners.js` | Polyline corner smoothing via quadratic beziers |
| `src-v2/decorations/index.js` | `morphPath()` dispatcher: parse → sample → decorate → smooth → emit |
| `test/decorations-random.test.js` | PRNG tests |
| `test/decorations-path-utils.test.js` | Path parsing + sampling tests |
| `test/decorations-random-steps.test.js` | Offset algorithm tests |
| `test/decorations-rounded-corners.test.js` | Corner smoothing tests |
| `test/decorations-morph-path.test.js` | End-to-end morphPath tests |
| `test/decorations-emitter.test.js` | Emitter integration tests |

### Modified files

| File | Change |
|------|--------|
| `src-v2/svg/emitter.js` | Apply `morphPath` to edge paths and node borders when `decoration` is set; add `shapeToSVGPath` helper for native shapes |
| `src-v2/style/style.js` | Add `decoration: null` to base style objects |
| `src-v2/index.js` | Thread `seed` config through to resolved model |

---

## API Design

A `decoration` property on node or edge styles triggers path morphing:

```js
// Per-edge decoration
edges: [{ from: 'A', to: 'B', decoration: {
  type: 'random steps',
  segmentLength: 23,   // px (default: 10)
  amplitude: 2.8,      // px (default: 3)
  roundedCorners: 4,   // px (default: 0, meaning sharp)
  preLength: 2.8,      // px — straight segment at start (open paths only)
  postLength: 2.8,     // px — straight segment at end (open paths only)
}}]

// Via named style (using existing StyleRegistry)
styles: {
  wavy: { decoration: {
    type: 'random steps', segmentLength: 23, amplitude: 2.8,
    roundedCorners: 4, preLength: 2.8, postLength: 2.8,
  }}
},
stateStyle: { style: 'wavy' },  // applies to all nodes

// Global PRNG seed (matches PGF's \pgfmathsetseed)
seed: 666,
```

---

## Task 1: Seeded PRNG

**Files:**
- Create: `src-v2/core/random.js`
- Test: `test/decorations-random.test.js`

- [ ] **Step 1: Write failing test**

```js
// test/decorations-random.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../src-v2/core/random.js';

describe('SeededRandom', () => {
  it('produces deterministic sequence from same seed', () => {
    const a = new SeededRandom(123);
    const b = new SeededRandom(123);
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(a.rand(), b.rand());
    }
  });

  it('produces values in [-1, 1]', () => {
    const rng = new SeededRandom(456);
    for (let i = 0; i < 1000; i++) {
      const v = rng.rand();
      assert.ok(v >= -1 && v <= 1, `value ${v} out of range`);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    const va = Array.from({ length: 10 }, () => a.rand());
    const vb = Array.from({ length: 10 }, () => b.rand());
    assert.notDeepStrictEqual(va, vb);
  });

  it('covers both positive and negative values', () => {
    const rng = new SeededRandom(789);
    let hasPos = false, hasNeg = false;
    for (let i = 0; i < 100; i++) {
      const v = rng.rand();
      if (v > 0) hasPos = true;
      if (v < 0) hasNeg = true;
    }
    assert.ok(hasPos, 'should produce positive values');
    assert.ok(hasNeg, 'should produce negative values');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/decorations-random.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SeededRandom**

```js
// src-v2/core/random.js

/**
 * Seeded pseudo-random number generator (mulberry32 variant).
 * Matches PGF's rand semantics: returns values in [-1, 1].
 */
export class SeededRandom {
  constructor(seed = 42) {
    this._state = seed | 0;
    if (this._state === 0) this._state = 1;
  }

  /** Returns a float in [-1, 1]. Two calls with same seed produce identical sequences. */
  rand() {
    let t = this._state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 2147483648 - 1;
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/decorations-random.test.js`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-v2/core/random.js test/decorations-random.test.js
git commit -m "feat(decorations): add SeededRandom PRNG for deterministic decoration rendering"
```

---

## Task 2: SVG Path Parsing & Point Sampling

**Files:**
- Create: `src-v2/decorations/path-utils.js`
- Test: `test/decorations-path-utils.test.js`

- [ ] **Step 1: Write failing tests**

```js
// test/decorations-path-utils.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSVGPath,
  samplePath,
  pointsToPath,
  isClosedPath,
  cumulativeDistances,
} from '../src-v2/decorations/path-utils.js';

describe('parseSVGPath', () => {
  it('parses M L commands', () => {
    const cmds = parseSVGPath('M 10 20 L 30 40');
    assert.deepStrictEqual(cmds, [
      { type: 'M', args: [10, 20] },
      { type: 'L', args: [30, 40] },
    ]);
  });

  it('parses comma-separated args', () => {
    const cmds = parseSVGPath('M10,20L30,40');
    assert.deepStrictEqual(cmds, [
      { type: 'M', args: [10, 20] },
      { type: 'L', args: [30, 40] },
    ]);
  });

  it('parses negative numbers', () => {
    const cmds = parseSVGPath('M -5 -3 L 10 -7');
    assert.strictEqual(cmds[0].args[0], -5);
    assert.strictEqual(cmds[0].args[1], -3);
    assert.strictEqual(cmds[1].args[1], -7);
  });

  it('parses Q (quadratic) commands', () => {
    const cmds = parseSVGPath('M 0 0 Q 5 10 10 0');
    assert.strictEqual(cmds[1].type, 'Q');
    assert.deepStrictEqual(cmds[1].args, [5, 10, 10, 0]);
  });

  it('parses C (cubic) commands', () => {
    const cmds = parseSVGPath('M 0 0 C 3 10 7 10 10 0');
    assert.strictEqual(cmds[1].type, 'C');
    assert.deepStrictEqual(cmds[1].args, [3, 10, 7, 10, 10, 0]);
  });

  it('parses Z (close) command', () => {
    const cmds = parseSVGPath('M 0 0 L 10 0 L 10 10 Z');
    assert.strictEqual(cmds[3].type, 'Z');
    assert.deepStrictEqual(cmds[3].args, []);
  });
});

describe('isClosedPath', () => {
  it('returns true for paths ending with Z', () => {
    assert.ok(isClosedPath(parseSVGPath('M 0 0 L 10 0 Z')));
  });

  it('returns false for open paths', () => {
    assert.ok(!isClosedPath(parseSVGPath('M 0 0 L 10 0')));
  });
});

describe('samplePath', () => {
  it('samples a horizontal line at regular intervals', () => {
    const cmds = parseSVGPath('M 0 0 L 20 0');
    const pts = samplePath(cmds, 10);
    assert.strictEqual(pts.length, 3); // 0, 10, 20
    assert.deepStrictEqual(pts[0], { x: 0, y: 0 });
    assert.deepStrictEqual(pts[1], { x: 10, y: 0 });
    assert.deepStrictEqual(pts[2], { x: 20, y: 0 });
  });

  it('samples a vertical line', () => {
    const cmds = parseSVGPath('M 0 0 L 0 30');
    const pts = samplePath(cmds, 10);
    assert.strictEqual(pts.length, 4); // 0, 10, 20, 30
    assert.ok(Math.abs(pts[3].y - 30) < 0.01);
  });

  it('samples a closed triangle path', () => {
    const cmds = parseSVGPath('M 0 0 L 30 0 L 30 30 Z');
    const pts = samplePath(cmds, 10);
    // 30 + 30 + ~42.4 ≈ 102.4 total → ~10 segments
    assert.ok(pts.length >= 10);
    // First and last should be same (closed)
    assert.ok(Math.abs(pts[0].x - pts[pts.length - 1].x) < 0.5);
    assert.ok(Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.5);
  });

  it('samples a quadratic bezier', () => {
    const cmds = parseSVGPath('M 0 0 Q 10 20 20 0');
    const pts = samplePath(cmds, 5);
    assert.ok(pts.length >= 4);
    // Midpoint should be above y=0 (curve goes up)
    const mid = pts[Math.floor(pts.length / 2)];
    assert.ok(mid.y > 0);
  });

  it('samples a cubic bezier', () => {
    const cmds = parseSVGPath('M 0 0 C 5 20 15 20 20 0');
    const pts = samplePath(cmds, 5);
    assert.ok(pts.length >= 4);
    const mid = pts[Math.floor(pts.length / 2)];
    assert.ok(mid.y > 0);
  });
});

describe('pointsToPath', () => {
  it('produces M/L path for open polyline', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    assert.strictEqual(pointsToPath(pts, false), 'M 0 0 L 10 0 L 10 10');
  });

  it('appends Z for closed paths', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    assert.ok(pointsToPath(pts, true).endsWith('Z'));
  });
});

describe('cumulativeDistances', () => {
  it('computes cumulative distance array', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 8 }];
    const d = cumulativeDistances(pts);
    assert.strictEqual(d[0], 0);
    assert.ok(Math.abs(d[1] - 5) < 0.01);
    assert.ok(Math.abs(d[2] - 10) < 0.01);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/decorations-path-utils.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement path-utils.js**

```js
// src-v2/decorations/path-utils.js

/**
 * SVG path parsing, point sampling, and path emission utilities.
 * Supports commands: M, L, Q, C, Z (absolute only).
 */

/**
 * Parse an SVG path data string into an array of commands.
 * @param {string} d - SVG path data (e.g., "M 0 0 L 10 0 Q 5 10 10 0")
 * @returns {Array<{type: string, args: number[]}>}
 */
export function parseSVGPath(d) {
  const commands = [];
  const tokens = d.match(/[MLQCAZmlqcaz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return commands;

  let current = null;
  let nums = [];

  for (const token of tokens) {
    if (/[A-Za-z]/.test(token)) {
      if (current != null) {
        commands.push({ type: current.toUpperCase(), args: nums });
      }
      current = token;
      nums = [];
    } else {
      nums.push(parseFloat(token));
    }
  }
  if (current != null) {
    commands.push({ type: current.toUpperCase(), args: nums });
  }
  return commands;
}

/**
 * Check if a parsed path is closed (ends with Z).
 */
export function isClosedPath(commands) {
  return commands.length > 0 && commands[commands.length - 1].type === 'Z';
}

/**
 * Sample points along a parsed SVG path at approximately `interval` spacing.
 * Always includes start and end points of each segment.
 * For closed paths, the last point coincides with the first.
 *
 * @param {Array} commands - Output of parseSVGPath
 * @param {number} interval - Desired spacing between samples (px)
 * @returns {Array<{x: number, y: number}>}
 */
export function samplePath(commands, interval) {
  const points = [];
  let cx = 0, cy = 0;
  let mx = 0, my = 0;  // moveto position (for Z)

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        cx = cmd.args[0]; cy = cmd.args[1];
        mx = cx; my = cy;
        if (points.length === 0) points.push({ x: cx, y: cy });
        break;
      case 'L':
        sampleLineSegment(points, cx, cy, cmd.args[0], cmd.args[1], interval);
        cx = cmd.args[0]; cy = cmd.args[1];
        break;
      case 'Q':
        sampleQuadraticSegment(points, cx, cy,
          cmd.args[0], cmd.args[1], cmd.args[2], cmd.args[3], interval);
        cx = cmd.args[2]; cy = cmd.args[3];
        break;
      case 'C':
        sampleCubicSegment(points, cx, cy,
          cmd.args[0], cmd.args[1], cmd.args[2], cmd.args[3],
          cmd.args[4], cmd.args[5], interval);
        cx = cmd.args[4]; cy = cmd.args[5];
        break;
      case 'Z':
        if (Math.hypot(cx - mx, cy - my) > 0.1) {
          sampleLineSegment(points, cx, cy, mx, my, interval);
        }
        cx = mx; cy = my;
        break;
    }
  }
  return points;
}

function sampleLineSegment(points, x0, y0, x1, y1, interval) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.round(len / interval));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points.push({ x: x0 + t * (x1 - x0), y: y0 + t * (y1 - y0) });
  }
}

function sampleQuadraticSegment(points, x0, y0, cx, cy, x1, y1, interval) {
  const chordLen = Math.hypot(x1 - x0, y1 - y0);
  const polyLen = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
  const approxLen = (chordLen + polyLen) / 2;
  const steps = Math.max(2, Math.round(approxLen / interval));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push({
      x: u * u * x0 + 2 * u * t * cx + t * t * x1,
      y: u * u * y0 + 2 * u * t * cy + t * t * y1,
    });
  }
}

function sampleCubicSegment(points, x0, y0, c1x, c1y, c2x, c2y, x1, y1, interval) {
  const chordLen = Math.hypot(x1 - x0, y1 - y0);
  const polyLen = Math.hypot(c1x - x0, c1y - y0) +
                  Math.hypot(c2x - c1x, c2y - c1y) +
                  Math.hypot(x1 - c2x, y1 - c2y);
  const approxLen = (chordLen + polyLen) / 2;
  const steps = Math.max(2, Math.round(approxLen / interval));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push({
      x: u*u*u * x0 + 3*u*u*t * c1x + 3*u*t*t * c2x + t*t*t * x1,
      y: u*u*u * y0 + 3*u*u*t * c1y + 3*u*t*t * c2y + t*t*t * y1,
    });
  }
}

/**
 * Convert a point array to an SVG path data string.
 * @param {Array<{x: number, y: number}>} points
 * @param {boolean} closed - Append Z if true
 * @returns {string}
 */
export function pointsToPath(points, closed) {
  if (points.length === 0) return '';
  const n = (v) => Math.round(v * 100) / 100;
  const parts = [`M ${n(points[0].x)} ${n(points[0].y)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${n(points[i].x)} ${n(points[i].y)}`);
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

/**
 * Compute cumulative distance array for a point sequence.
 * @param {Array<{x: number, y: number}>} points
 * @returns {number[]} - dists[i] = total distance from points[0] to points[i]
 */
export function cumulativeDistances(points) {
  const d = [0];
  for (let i = 1; i < points.length; i++) {
    d.push(d[i - 1] + Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    ));
  }
  return d;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/decorations-path-utils.test.js`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-v2/decorations/path-utils.js test/decorations-path-utils.test.js
git commit -m "feat(decorations): add SVG path parser and point sampler"
```

---

## Task 3: Random Steps Algorithm

**Files:**
- Create: `src-v2/decorations/random-steps.js`
- Test: `test/decorations-random-steps.test.js`

The PGF algorithm (lines 86-101 of `pgflibrarydecorations.pathmorphing.code.tex`):
- Walks along the input path in steps of `segmentLength`
- At each step, emits a `lineto` at position `(segmentLength + rand*amplitude, rand*amplitude)` in the **local frame** (x = along path, y = perpendicular)
- The decoration engine rotates each step to follow the path tangent

Our equivalent: sample points along the path, compute tangent/normal at each point, apply random offsets in the tangent frame.

- [ ] **Step 1: Write failing test**

```js
// test/decorations-random-steps.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyRandomSteps } from '../src-v2/decorations/random-steps.js';
import { SeededRandom } from '../src-v2/core/random.js';

describe('applyRandomSteps', () => {
  it('preserves endpoints on open paths', () => {
    const prng = new SeededRandom(42);
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
    const result = applyRandomSteps(pts, 3, prng, { closed: false });
    assert.strictEqual(result[0].x, 0);
    assert.strictEqual(result[0].y, 0);
    assert.strictEqual(result[2].x, 20);
    assert.strictEqual(result[2].y, 0);
  });

  it('offsets interior points within amplitude bounds', () => {
    const prng = new SeededRandom(42);
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push({ x: i * 10, y: 0 });
    const result = applyRandomSteps(pts, 3, prng, { closed: false });
    for (let i = 1; i < result.length - 1; i++) {
      // Along-path offset: original x ± 3, perpendicular: y ± 3
      // With tangent-frame offsets, the bound is sqrt(2)*3 in worst case
      assert.ok(Math.abs(result[i].x - pts[i].x) <= 5, `x offset too large at ${i}`);
      assert.ok(Math.abs(result[i].y - pts[i].y) <= 5, `y offset too large at ${i}`);
    }
  });

  it('offsets ALL points on closed paths (no fixed endpoints)', () => {
    const prng = new SeededRandom(42);
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const result = applyRandomSteps(pts, 3, prng, { closed: true });
    // At least some points should be offset
    let anyOffset = false;
    for (let i = 0; i < result.length; i++) {
      if (result[i].x !== pts[i].x || result[i].y !== pts[i].y) anyOffset = true;
    }
    assert.ok(anyOffset, 'closed path should have offset points');
  });

  it('is deterministic (same seed → same result)', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
    const a = applyRandomSteps(pts, 3, new SeededRandom(99), { closed: false });
    const b = applyRandomSteps(pts, 3, new SeededRandom(99), { closed: false });
    assert.deepStrictEqual(a, b);
  });

  it('respects fixedStart/fixedEnd distances (pre/post regions)', () => {
    const prng = new SeededRandom(42);
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push({ x: i * 10, y: 0 });
    // fixedStart=15 means first 15px are unmodified (points 0 and 1)
    // fixedEnd=15 means last 15px are unmodified (points 9 and 10)
    const result = applyRandomSteps(pts, 3, prng, {
      closed: false, fixedStart: 15, fixedEnd: 15,
    });
    // Point at x=0 (dist=0) and x=10 (dist=10) should be untouched
    assert.strictEqual(result[0].x, 0);
    assert.strictEqual(result[1].x, 10);
    assert.strictEqual(result[1].y, 0);
    // Point at x=90 (dist=90) and x=100 (dist=100) should be untouched
    assert.strictEqual(result[9].x, 90);
    assert.strictEqual(result[10].x, 100);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/decorations-random-steps.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement random-steps.js**

```js
// src-v2/decorations/random-steps.js

import { cumulativeDistances } from './path-utils.js';

/**
 * Apply PGF-style random steps decoration to a sampled point array.
 *
 * Each interior point is offset by (rand*amplitude, rand*amplitude) in the
 * local tangent frame (x = along-path, y = perpendicular), matching the PGF
 * random steps decoration engine.
 *
 * @param {Array<{x: number, y: number}>} points - Sampled path points
 * @param {number} amplitude - Maximum offset (px), matching PGF's \pgfdecorationsegmentamplitude
 * @param {SeededRandom} prng - Seeded PRNG instance
 * @param {Object} [options]
 * @param {boolean} [options.closed=false] - True for closed paths (no fixed endpoints)
 * @param {number} [options.fixedStart=0] - Distance from start to keep unmodified (pre region)
 * @param {number} [options.fixedEnd=0] - Distance from end to keep unmodified (post region)
 * @returns {Array<{x: number, y: number}>}
 */
export function applyRandomSteps(points, amplitude, prng, options = {}) {
  const { closed = false, fixedStart = 0, fixedEnd = 0 } = options;
  const n = points.length;
  if (n < 2) return points.map(p => ({ ...p }));

  const dists = cumulativeDistances(points);
  const totalLen = dists[n - 1];

  return points.map((p, i) => {
    // Open paths: preserve first and last points
    if (!closed && (i === 0 || i === n - 1)) return { x: p.x, y: p.y };

    // Pre/post fixed regions (open paths only)
    if (!closed && fixedStart > 0 && dists[i] < fixedStart) return { x: p.x, y: p.y };
    if (!closed && fixedEnd > 0 && dists[i] > totalLen - fixedEnd) return { x: p.x, y: p.y };

    // Compute tangent direction from neighboring points
    const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty);

    if (len < 1e-10) return { x: p.x, y: p.y };

    // Unit tangent and normal (perpendicular, 90° CCW)
    const ux = tx / len, uy = ty / len;
    const nx = -uy, ny = ux;

    // Random offsets in local frame (PGF: rand*amplitude for both axes)
    const alongOffset = prng.rand() * amplitude;
    const perpOffset = prng.rand() * amplitude;

    return {
      x: p.x + alongOffset * ux + perpOffset * nx,
      y: p.y + alongOffset * uy + perpOffset * ny,
    };
  });
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/decorations-random-steps.test.js`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-v2/decorations/random-steps.js test/decorations-random-steps.test.js
git commit -m "feat(decorations): add random steps algorithm with tangent-frame offsets"
```

---

## Task 4: Rounded Corners Smoothing

**Files:**
- Create: `src-v2/decorations/rounded-corners.js`
- Test: `test/decorations-rounded-corners.test.js`

Replaces each polyline corner with a quadratic bezier arc, matching PGF's `\pgfsetcornersarced`. For each vertex B in a polyline A→B→C:
- Entry point P = B + radius toward A
- Exit point Q = B + radius toward C
- Replace corner with: `L P Q Bx By Qx Qy` (quadratic bezier with B as control point)

- [ ] **Step 1: Write failing test**

```js
// test/decorations-rounded-corners.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyRoundedCorners } from '../src-v2/decorations/rounded-corners.js';

describe('applyRoundedCorners', () => {
  it('produces Q commands for interior corners on open paths', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const path = applyRoundedCorners(pts, 3, false);
    assert.ok(path.includes('Q'), 'should contain quadratic bezier');
    assert.ok(path.startsWith('M 0 0'), 'should start at first point');
    assert.ok(path.endsWith('10 10'), 'should end at last point');
  });

  it('preserves endpoints on open paths', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const path = applyRoundedCorners(pts, 3, false);
    // Path should start with M 0 0 and end with L 10 10
    assert.ok(path.startsWith('M 0 0'));
    assert.ok(path.includes('L 10 10'));
  });

  it('rounds all corners on closed paths', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 10, y: 10 }, { x: 0, y: 10 },
    ];
    const path = applyRoundedCorners(pts, 3, true);
    // 4 corners → 4 Q commands
    const qCount = (path.match(/Q/g) || []).length;
    assert.strictEqual(qCount, 4);
    assert.ok(path.endsWith('Z'));
  });

  it('clamps radius to half segment length', () => {
    // Segment length is 4, radius 10 → effective radius should be 2
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 10 }];
    const path = applyRoundedCorners(pts, 10, false);
    assert.ok(path.includes('Q'), 'should still produce a curve');
  });

  it('returns plain path when radius is 0', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const path = applyRoundedCorners(pts, 0, false);
    assert.ok(!path.includes('Q'));
  });

  it('handles fewer than 3 points gracefully', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const path = applyRoundedCorners(pts, 3, false);
    assert.ok(!path.includes('Q'));
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/decorations-rounded-corners.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement rounded-corners.js**

```js
// src-v2/decorations/rounded-corners.js

import { pointsToPath } from './path-utils.js';

/**
 * Smooth polyline corners with quadratic bezier arcs.
 * Matches PGF's \pgfsetcornersarced behavior.
 *
 * For each interior corner at vertex B in polyline ...A→B→C...:
 * - Entry point P on segment AB, at distance min(radius, |AB|/2) from B
 * - Exit point Q on segment BC, at distance min(radius, |BC|/2) from B
 * - Replace corner with: L P, Q B Q (quadratic bezier with B as control point)
 *
 * @param {Array<{x: number, y: number}>} points
 * @param {number} radius - Corner rounding radius (px)
 * @param {boolean} closed - True for closed paths (all corners rounded)
 * @returns {string} SVG path data string
 */
export function applyRoundedCorners(points, radius, closed) {
  if (radius <= 0 || points.length < 3) {
    return pointsToPath(points, closed);
  }

  const n = points.length;
  const fmt = (p) => `${r(p.x)} ${r(p.y)}`;
  const r = (v) => Math.round(v * 100) / 100;

  function cornerGeometry(i) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const dPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const dNext = Math.hypot(next.x - curr.x, next.y - curr.y);
    const rad = Math.min(radius, dPrev / 2, dNext / 2);
    if (rad < 0.1) return null;
    return {
      entry: {
        x: curr.x + (prev.x - curr.x) * (rad / dPrev),
        y: curr.y + (prev.y - curr.y) * (rad / dPrev),
      },
      exit: {
        x: curr.x + (next.x - curr.x) * (rad / dNext),
        y: curr.y + (next.y - curr.y) * (rad / dNext),
      },
      vertex: curr,
    };
  }

  const parts = [];

  if (closed) {
    // Closed path: all corners are rounded, start at exit of corner 0
    const c0 = cornerGeometry(0);
    parts.push(c0 ? `M ${fmt(c0.exit)}` : `M ${fmt(points[0])}`);

    for (let i = 1; i < n; i++) {
      const c = cornerGeometry(i);
      if (c) {
        parts.push(`L ${fmt(c.entry)} Q ${fmt(c.vertex)} ${fmt(c.exit)}`);
      } else {
        parts.push(`L ${fmt(points[i])}`);
      }
    }
    // Close back through corner 0
    if (c0) {
      parts.push(`L ${fmt(c0.entry)} Q ${fmt(c0.vertex)} ${fmt(c0.exit)}`);
    }
    parts.push('Z');
  } else {
    // Open path: first and last points are preserved, interior corners rounded
    parts.push(`M ${fmt(points[0])}`);

    for (let i = 1; i < n - 1; i++) {
      const c = cornerGeometry(i);
      if (c) {
        parts.push(`L ${fmt(c.entry)} Q ${fmt(c.vertex)} ${fmt(c.exit)}`);
      } else {
        parts.push(`L ${fmt(points[i])}`);
      }
    }
    parts.push(`L ${fmt(points[n - 1])}`);
  }

  return parts.join(' ');
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/decorations-rounded-corners.test.js`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src-v2/decorations/rounded-corners.js test/decorations-rounded-corners.test.js
git commit -m "feat(decorations): add rounded corners polyline smoothing"
```

---

## Task 5: morphPath Dispatcher

**Files:**
- Create: `src-v2/decorations/index.js`
- Test: `test/decorations-morph-path.test.js`

Orchestrates the full pipeline: parse → sample → decorate → smooth → emit.

- [ ] **Step 1: Write failing test**

```js
// test/decorations-morph-path.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { morphPath } from '../src-v2/decorations/index.js';
import { SeededRandom } from '../src-v2/core/random.js';

describe('morphPath', () => {
  it('returns a valid SVG path for a straight line', () => {
    const result = morphPath('M 0 0 L 100 0', {
      type: 'random steps', segmentLength: 10, amplitude: 3, seed: 42,
    });
    assert.ok(result.startsWith('M '));
    assert.ok(result.includes('L '));
    // Should have multiple L segments (original was just one)
    assert.ok((result.match(/L /g) || []).length > 2);
  });

  it('preserves endpoints for open paths', () => {
    const result = morphPath('M 0 0 L 100 0', {
      type: 'random steps', segmentLength: 20, amplitude: 5, seed: 42,
    });
    assert.ok(result.startsWith('M 0 0'));
    assert.ok(result.endsWith('L 100 0'));
  });

  it('produces Q commands when roundedCorners is set', () => {
    const result = morphPath('M 0 0 L 50 0 L 100 0', {
      type: 'random steps', segmentLength: 10, amplitude: 3,
      roundedCorners: 4, seed: 42,
    });
    assert.ok(result.includes('Q'), 'should have quadratic bezier curves');
  });

  it('closes the path for closed input', () => {
    const result = morphPath('M 0 0 L 50 0 L 50 50 L 0 50 Z', {
      type: 'random steps', segmentLength: 10, amplitude: 3, seed: 42,
    });
    assert.ok(result.endsWith('Z'));
  });

  it('is deterministic with same seed', () => {
    const opts = { type: 'random steps', segmentLength: 10, amplitude: 3, seed: 99 };
    const a = morphPath('M 0 0 L 100 0', opts);
    const b = morphPath('M 0 0 L 100 0', opts);
    assert.strictEqual(a, b);
  });

  it('accepts a shared PRNG instance', () => {
    const prng = new SeededRandom(42);
    const result = morphPath('M 0 0 L 100 0', {
      type: 'random steps', segmentLength: 10, amplitude: 3, prng,
    });
    assert.ok(result.startsWith('M '));
  });

  it('returns original path if too short to decorate', () => {
    const result = morphPath('M 0 0 L 5 0', {
      type: 'random steps', segmentLength: 20, amplitude: 3, seed: 42,
    });
    // Only 2 points sampled → too short → returns original
    assert.strictEqual(result, 'M 0 0 L 5 0');
  });

  it('handles pre/post fixed regions', () => {
    const result = morphPath('M 0 0 L 100 0', {
      type: 'random steps', segmentLength: 10, amplitude: 5,
      preLength: 10, postLength: 10, seed: 42,
    });
    // Path should start with M 0 0 (pre region preserved)
    assert.ok(result.startsWith('M 0 0'));
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/decorations-morph-path.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement index.js**

```js
// src-v2/decorations/index.js

import { parseSVGPath, samplePath, isClosedPath, pointsToPath } from './path-utils.js';
import { applyRandomSteps } from './random-steps.js';
import { applyRoundedCorners } from './rounded-corners.js';
import { SeededRandom } from '../core/random.js';

/**
 * Apply a path decoration, transforming an SVG path data string.
 *
 * Pipeline: parse → sample → decorate → smooth → emit
 *
 * @param {string} pathData - SVG path data string
 * @param {Object} options
 * @param {string} [options.type='random steps'] - Decoration type
 * @param {number} [options.segmentLength=10] - Sampling interval (px)
 * @param {number} [options.amplitude=3] - Max random offset (px)
 * @param {number} [options.roundedCorners=0] - Corner smoothing radius (0 = sharp)
 * @param {number} [options.preLength=0] - Straight start segment (open paths only)
 * @param {number} [options.postLength=0] - Straight end segment (open paths only)
 * @param {number} [options.seed=42] - PRNG seed (ignored if prng is provided)
 * @param {SeededRandom} [options.prng] - Shared PRNG instance (takes precedence over seed)
 * @returns {string} Decorated SVG path data string
 */
export function morphPath(pathData, options = {}) {
  const {
    type = 'random steps',
    segmentLength = 10,
    amplitude = 3,
    roundedCorners = 0,
    preLength = 0,
    postLength = 0,
    seed = 42,
    prng,
  } = options;

  const rng = prng || new SeededRandom(seed);
  const commands = parseSVGPath(pathData);
  const closed = isClosedPath(commands);

  // Sample the path into evenly-spaced points
  let points = samplePath(commands, segmentLength);

  // Too few points to decorate meaningfully
  if (points.length < 3) return pathData;

  // Apply the decoration
  switch (type) {
    case 'random steps':
      points = applyRandomSteps(points, amplitude, rng, {
        closed,
        fixedStart: closed ? 0 : preLength,
        fixedEnd: closed ? 0 : postLength,
      });
      break;
    default:
      return pathData;  // Unknown decoration type — pass through
  }

  // Apply corner smoothing
  if (roundedCorners > 0) {
    return applyRoundedCorners(points, roundedCorners, closed);
  }

  return pointsToPath(points, closed);
}

/**
 * Convert a native SVG shape (circle, ellipse, rectangle) to an SVG path string.
 * Used by the emitter to obtain a path that can be decorated.
 *
 * All paths are centered at the origin (local coordinates within the node's <g>).
 *
 * @param {string} shapeName - 'circle', 'ellipse', or 'rectangle'
 * @param {Object} geom - Shape geometry from savedGeometry()
 * @param {Object} [opts]
 * @param {number} [opts.inset=0] - Additional inset (for accepting double borders)
 * @returns {string} SVG path data string
 */
export function shapeToSVGPath(shapeName, geom, opts = {}) {
  const inset = opts.inset ?? 0;
  const outerSep = geom.outerSep ?? 0;

  switch (shapeName) {
    case 'circle': {
      const radius = Math.max(0, (geom.radius ?? 20) - outerSep - inset);
      // 4-segment cubic bezier approximation of a circle
      const k = radius * 0.5522847498;
      return `M ${radius} 0 C ${radius} ${k} ${k} ${radius} 0 ${radius} ` +
             `C ${-k} ${radius} ${-radius} ${k} ${-radius} 0 ` +
             `C ${-radius} ${-k} ${-k} ${-radius} 0 ${-radius} ` +
             `C ${k} ${-radius} ${radius} ${-k} ${radius} 0 Z`;
    }
    case 'ellipse': {
      const rx = Math.max(0, (geom.rx ?? 30) - outerSep - inset);
      const ry = Math.max(0, (geom.ry ?? 20) - outerSep - inset);
      const kx = rx * 0.5522847498;
      const ky = ry * 0.5522847498;
      return `M ${rx} 0 C ${rx} ${ky} ${kx} ${ry} 0 ${ry} ` +
             `C ${-kx} ${ry} ${-rx} ${ky} ${-rx} 0 ` +
             `C ${-rx} ${-ky} ${-kx} ${-ry} 0 ${-ry} ` +
             `C ${kx} ${-ry} ${rx} ${-ky} ${rx} 0 Z`;
    }
    case 'rectangle': {
      const hw = Math.max(0, (geom.halfWidth ?? 20) - outerSep - inset);
      const hh = Math.max(0, (geom.halfHeight ?? 15) - outerSep - inset);
      return `M ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh} L ${-hw} ${hh} Z`;
    }
    default:
      return '';  // Other shapes use backgroundPath() directly
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/decorations-morph-path.test.js`
Expected: all tests PASS

- [ ] **Step 5: Write additional tests for shapeToSVGPath**

```js
// Append to test/decorations-morph-path.test.js
import { shapeToSVGPath } from '../src-v2/decorations/index.js';

describe('shapeToSVGPath', () => {
  it('generates a closed path for circle', () => {
    const path = shapeToSVGPath('circle', { radius: 20, outerSep: 0 });
    assert.ok(path.startsWith('M 20 0'));
    assert.ok(path.endsWith('Z'));
    assert.ok(path.includes('C'));  // cubic approximation
  });

  it('generates a closed path for ellipse', () => {
    const path = shapeToSVGPath('ellipse', { rx: 30, ry: 20, outerSep: 0 });
    assert.ok(path.startsWith('M 30 0'));
    assert.ok(path.endsWith('Z'));
  });

  it('generates a closed rectangle path', () => {
    const path = shapeToSVGPath('rectangle', {
      halfWidth: 20, halfHeight: 15, outerSep: 0,
    });
    assert.ok(path.includes('M -20 -15'));
    assert.ok(path.includes('L 20 -15'));
    assert.ok(path.endsWith('Z'));
  });

  it('applies inset for accepting borders', () => {
    const outer = shapeToSVGPath('circle', { radius: 20, outerSep: 0 });
    const inner = shapeToSVGPath('circle', { radius: 20, outerSep: 0 }, { inset: 3 });
    // Inner should start with smaller radius
    assert.ok(outer.startsWith('M 20'));
    assert.ok(inner.startsWith('M 17'));
  });
});
```

- [ ] **Step 6: Run all tests, verify pass**

Run: `node --test test/decorations-morph-path.test.js`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src-v2/decorations/index.js test/decorations-morph-path.test.js
git commit -m "feat(decorations): add morphPath dispatcher and shapeToSVGPath helper"
```

---

## Task 6: Style Cascade Integration

**Files:**
- Modify: `src-v2/style/style.js` — add `decoration: null` to base styles
- Modify: `src-v2/index.js` — thread `seed` config to resolved model

- [ ] **Step 1: Add decoration to base style objects**

In `src-v2/style/style.js`, add `decoration: null` to the `base` object in both `resolveNodeStyle` (line ~23, after `className: null`) and `resolveEdgeStyle` (line ~62, after `className: null`):

```js
// In resolveNodeStyle base object, add:
    decoration: null,

// In resolveEdgeStyle base object, add:
    decoration: null,
```

- [ ] **Step 2: Thread seed config to the resolved model**

In `src-v2/index.js`, add `seed` to the model object (line ~243, after `shadowFilters`):

```js
  const model = {
    nodes: {},
    edges: [],
    arrowDefs,
    shadowFilters,
    seed: config.seed,  // PRNG seed for decorations
  };
```

- [ ] **Step 3: Run existing tests to verify no regression**

Run: `node --test test/`
Expected: all existing tests PASS (no breakage from adding null decoration field)

- [ ] **Step 4: Commit**

```bash
git add src-v2/style/style.js src-v2/index.js
git commit -m "feat(decorations): add decoration property to style cascade and seed to model"
```

---

## Task 7: Emitter Integration

**Files:**
- Modify: `src-v2/svg/emitter.js`
- Test: `test/decorations-emitter.test.js`

The emitter needs three changes:
1. Create a shared PRNG in `emitSVG()` and thread it to `emitEdgePath()` and `emitNode()`
2. In `emitEdgePath()`: morph the edge path when `style.decoration` is set
3. In `createShapeElement()`: when `style.decoration` is set, convert native shapes to paths via `shapeToSVGPath`, then morph

- [ ] **Step 1: Write failing test**

```js
// test/decorations-emitter.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Set up DOM globals before importing emitter
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

import { emitSVG } from '../src-v2/svg/emitter.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function createSVG() {
  return document.createElementNS(SVG_NS, 'svg');
}

describe('emitter decoration integration', () => {
  it('applies decoration to edge paths', () => {
    const svg = createSVG();
    const model = {
      nodes: {
        A: {
          id: 'A',
          center: { x: 0, y: 0 },
          geom: { radius: 20, outerSep: 0 },
          style: { shape: 'circle', fill: '#fff', stroke: '#000', strokeWidth: 1 },
          label: 'A',
        },
        B: {
          id: 'B',
          center: { x: 100, y: 0 },
          geom: { radius: 20, outerSep: 0 },
          style: { shape: 'circle', fill: '#fff', stroke: '#000', strokeWidth: 1 },
          label: 'B',
        },
      },
      edges: [{
        index: 0, from: 'A', to: 'B', label: null,
        path: 'M 20 0 L 80 0',
        edgeGeometry: { startPoint: { x: 20, y: 0 }, endPoint: { x: 80, y: 0 }, type: 'straight' },
        labelNode: null,
        style: {
          stroke: '#000', strokeWidth: 1, arrow: null, arrowId: null,
          decoration: { type: 'random steps', segmentLength: 10, amplitude: 3 },
        },
      }],
      arrowDefs: [],
      shadowFilters: [],
      seed: 42,
    };

    emitSVG(svg, model);

    const edgePaths = svg.querySelectorAll('.edge-layer path');
    assert.strictEqual(edgePaths.length, 1);
    const d = edgePaths[0].getAttribute('d');
    // Decorated path should have more L segments than original "M ... L ..."
    const lCount = (d.match(/L /g) || []).length;
    assert.ok(lCount > 2, `expected multiple L segments, got ${lCount}`);
  });

  it('applies decoration to node borders', () => {
    const svg = createSVG();
    const model = {
      nodes: {
        A: {
          id: 'A',
          center: { x: 0, y: 0 },
          geom: { radius: 20, outerSep: 0 },
          style: {
            shape: 'circle', fill: '#fff', stroke: '#000', strokeWidth: 1,
            decoration: { type: 'random steps', segmentLength: 10, amplitude: 2 },
          },
          label: 'A',
        },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      seed: 42,
    };

    emitSVG(svg, model);

    const nodeGroup = svg.querySelector('.node-layer g');
    // When decorated, circle should be rendered as <path> not <circle>
    const circles = nodeGroup.querySelectorAll('circle');
    const paths = nodeGroup.querySelectorAll('path');
    assert.strictEqual(circles.length, 0, 'decorated circle should not use <circle>');
    assert.ok(paths.length >= 1, 'decorated circle should render as <path>');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/decorations-emitter.test.js`
Expected: FAIL — decoration not applied (edge path unchanged, circle still `<circle>`)

- [ ] **Step 3: Modify emitSVG to create PRNG**

In `src-v2/svg/emitter.js`, add import at top:

```js
import { morphPath, shapeToSVGPath } from '../decorations/index.js';
import { SeededRandom } from '../core/random.js';
```

In `emitSVG()` (line ~534), create a PRNG and pass it to emission functions:

```js
export function emitSVG(svgEl, resolved) {
  const {
    nodes = {},
    edges = [],
    shadowFilters = [],
    arrowDefs = [],
    seed,
  } = resolved;

  // PRNG for deterministic decoration rendering
  const prng = new SeededRandom(seed ?? 42);

  // ... existing code through edge/node loops, pass prng:

  // In the edge loop (line ~568):
  for (const edge of edges) {
    const pathEl = emitEdgePath(edge, prng);      // ← add prng argument
    // ...
  }

  // In the node loop (line ~586):
  for (const [id, node] of Object.entries(nodes)) {
    const g = emitNode(id, node, prng);            // ← add prng argument
    // ...
  }
```

- [ ] **Step 4: Modify emitEdgePath to apply decoration**

Add `prng` parameter and morph the path when `decoration` is set:

```js
function emitEdgePath(edge, prng) {
  let { path, style } = edge;

  // Apply decoration if configured
  if (style.decoration) {
    path = morphPath(path, { ...style.decoration, prng });
  }

  const attrs = {
    d: path,
    fill: 'none',
    stroke: style.stroke ?? DEFAULTS.edgeColor,
    'stroke-width': style.strokeWidth ?? DEFAULTS.edgeStrokeWidth,
  };
  // ... rest of existing code unchanged
```

- [ ] **Step 5: Modify createShapeElement to support decoration**

Add decoration handling before the shape switch statement. When `style.decoration` is set, convert the native shape to a path, morph it, and return a `<path>` element:

```js
function createShapeElement(geom, style, opts = {}) {
  const inset = opts.inset ?? 0;
  const outerSep = geom.outerSep ?? 0;
  const fill = opts.fillOverride ?? style.fill ?? DEFAULTS.nodeFill;
  const stroke = style.stroke ?? DEFAULTS.nodeStroke;
  const strokeWidth = style.strokeWidth ?? DEFAULTS.nodeStrokeWidth;
  const shapeName = style.shape ?? 'circle';

  // ── Decoration path: convert shape to path string, morph, emit ──
  if (style.decoration && opts.prng) {
    let pathStr = '';
    // Try native shape conversion first
    if (['circle', 'ellipse', 'rectangle'].includes(shapeName)) {
      pathStr = shapeToSVGPath(shapeName, geom, { inset });
    } else {
      // Use backgroundPath from shape implementation
      const shapeImpl = opts.shape;
      if (shapeImpl && shapeImpl.backgroundPath) {
        const localGeom = shapeImpl.savedGeometry({ ...geom, center: { x: 0, y: 0 } });
        if (inset > 0) localGeom.outerSep = (localGeom.outerSep ?? 0) + inset;
        pathStr = shapeImpl.backgroundPath(localGeom);
      }
    }
    if (pathStr) {
      const decorated = morphPath(pathStr, { ...style.decoration, prng: opts.prng });
      return createSVGElement('path', {
        d: decorated, fill, stroke, 'stroke-width': strokeWidth,
      });
    }
  }

  // ── Existing switch (unchanged) ──
  switch (shapeName) {
    case 'rectangle': { /* ... existing code ... */ }
    case 'ellipse': { /* ... existing code ... */ }
    case 'circle': { /* ... existing code ... */ }
    default: { /* ... existing code ... */ }
  }
}
```

- [ ] **Step 6: Thread prng through emitNode → createShapeElement**

In `emitNode()`, add `prng` parameter and pass it through to `createShapeElement`:

```js
function emitNode(id, node, prng) {
  const { center, geom, style, label, shape } = node;
  // ...
  const shapeEl = createShapeElement(geom, style, { shape, prng });
  // ... and for accepting inner shape:
  if (style.accepting) {
    const inset = style.acceptingInset ?? DEFAULTS.acceptingInset;
    const innerEl = createShapeElement(geom, style, { inset, fillOverride: 'none', shape, prng });
    g.appendChild(innerEl);
  }
  // ...
```

- [ ] **Step 7: Run tests to verify pass**

Run: `node --test test/decorations-emitter.test.js`
Expected: all tests PASS

Run: `node --test test/`
Expected: all existing tests PASS (no regression)

- [ ] **Step 8: Commit**

```bash
git add src-v2/svg/emitter.js test/decorations-emitter.test.js
git commit -m "feat(decorations): integrate morphPath into emitter for edges and node borders"
```

---

## Task 8: End-to-End Integration Test

**Files:**
- Create: `examples-v2/decoration-demo.html`
- Test: visual inspection + `test/decorations-integration.test.js`

- [ ] **Step 1: Write an automated integration test**

```js
// test/decorations-integration.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

import { render } from '../src-v2/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('decoration integration', () => {
  it('renders wavy edges using named style', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 666,
      styles: {
        wavy: {
          decoration: {
            type: 'random steps',
            segmentLength: 23,
            amplitude: 2.8,
            roundedCorners: 4,
            preLength: 2.8,
            postLength: 2.8,
          },
        },
      },
      states: {
        A: { position: [0, 0] },
        B: { position: { right: 'A' } },
      },
      edges: [
        { from: 'A', to: 'B', label: 'wavy', style: 'wavy' },
      ],
    });

    const paths = svg.querySelectorAll('.edge-layer path');
    assert.strictEqual(paths.length, 1);
    const d = paths[0].getAttribute('d');
    // Should have Q commands from rounded corners
    assert.ok(d.includes('Q'), 'wavy edge should have rounded corners');
  });

  it('renders wavy node borders via stateStyle', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 666,
      stateStyle: {
        decoration: {
          type: 'random steps',
          segmentLength: 15,
          amplitude: 2,
          roundedCorners: 3,
        },
      },
      states: {
        q0: { position: [0, 0] },
      },
      edges: [],
    });

    const nodeGroup = svg.querySelector('.node-layer g');
    const paths = nodeGroup.querySelectorAll('path');
    assert.ok(paths.length >= 1, 'decorated node should render as path');
    const circles = nodeGroup.querySelectorAll('circle');
    assert.strictEqual(circles.length, 0, 'no native circle when decorated');
  });

  it('renders wavy ellipse node borders', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 666,
      states: {
        q0: {
          position: [0, 0],
          shape: 'ellipse',
          rx: 40,
          ry: 25,
          decoration: {
            type: 'random steps',
            segmentLength: 15,
            amplitude: 2,
          },
        },
      },
      edges: [],
    });

    const nodeGroup = svg.querySelector('.node-layer g');
    const paths = nodeGroup.querySelectorAll('path');
    assert.ok(paths.length >= 1, 'decorated ellipse should render as path');
    const ellipses = nodeGroup.querySelectorAll('ellipse');
    assert.strictEqual(ellipses.length, 0, 'no native ellipse when decorated');
  });

  it('is deterministic across render calls', () => {
    const svg1 = document.createElementNS(SVG_NS, 'svg');
    const svg2 = document.createElementNS(SVG_NS, 'svg');
    const config = {
      seed: 123,
      stateStyle: {
        decoration: { type: 'random steps', segmentLength: 10, amplitude: 3 },
      },
      states: { q0: { position: [0, 0] } },
      edges: [],
    };

    render(svg1, config);
    render(svg2, config);

    const d1 = svg1.querySelector('.node-layer path')?.getAttribute('d');
    const d2 = svg2.querySelector('.node-layer path')?.getAttribute('d');
    assert.strictEqual(d1, d2, 'same seed should produce identical output');
  });
});
```

- [ ] **Step 2: Run test to verify pass**

Run: `node --test test/decorations-integration.test.js`
Expected: all tests PASS

- [ ] **Step 3: Create visual demo page**

```html
<!-- examples-v2/decoration-demo.html -->
<!DOCTYPE html>
<html>
<head>
  <title>tikz-svg: Decoration Demo (wavy style)</title>
  <style>
    body { font-family: system-ui; padding: 2rem; background: #f8f8f8; }
    .demo { margin: 2rem 0; background: white; padding: 1rem; border-radius: 8px; }
    svg { border: 1px solid #ddd; }
    h2 { color: #333; }
  </style>
</head>
<body>
  <h1>Decoration Demo: <code>wavy</code> style</h1>
  <p>Matches TikZ <code>decoration={random steps}</code> with <code>rounded corners</code>.</p>

  <div class="demo">
    <h2>Wavy Edges</h2>
    <svg id="demo-edges" width="500" height="200"></svg>
  </div>

  <div class="demo">
    <h2>Wavy Node Borders</h2>
    <svg id="demo-nodes" width="500" height="200"></svg>
  </div>

  <div class="demo">
    <h2>Wavy Ellipse Nodes (matching LEC style)</h2>
    <svg id="demo-ellipse" width="500" height="200"></svg>
  </div>

  <script type="module">
    import { render } from '../src-v2/index.js';

    const wavy = {
      type: 'random steps',
      segmentLength: 23,
      amplitude: 2.8,
      roundedCorners: 4,
      preLength: 2.8,
      postLength: 2.8,
    };

    // Demo 1: Wavy edges
    render(document.getElementById('demo-edges'), {
      seed: 666,
      nodeDistance: 120,
      states: {
        A: { position: [0, 0], label: 'A' },
        B: { position: { right: 'A' }, label: 'B' },
        C: { position: { right: 'B' }, label: 'C' },
      },
      edges: [
        { from: 'A', to: 'B', label: 'wavy', decoration: wavy },
        { from: 'B', to: 'C', label: 'normal' },
      ],
    });

    // Demo 2: Wavy circle nodes
    render(document.getElementById('demo-nodes'), {
      seed: 666,
      stateStyle: {
        decoration: { type: 'random steps', segmentLength: 15, amplitude: 2, roundedCorners: 3 },
        fill: '#e3f2fd',
        strokeWidth: 2,
      },
      nodeDistance: 120,
      states: {
        q0: { position: [0, 0], label: 'Start' },
        q1: { position: { right: 'q0' }, label: 'End' },
      },
      edges: [{ from: 'q0', to: 'q1' }],
    });

    // Demo 3: Wavy ellipse (matching LEC wavy style on ellipses)
    render(document.getElementById('demo-ellipse'), {
      seed: 666,
      nodeDistance: 150,
      states: {
        finite: {
          position: [0, 0],
          label: 'T = {0,1,...,T}',
          shape: 'ellipse', rx: 50, ry: 25,
          fill: '#ffcdd2', strokeWidth: 3,
          decoration: wavy,
        },
        infinite: {
          position: { right: 'finite' },
          label: 'T = {0,1,...,∞}',
          shape: 'ellipse', rx: 50, ry: 25,
          fill: '#bbdefb', strokeWidth: 3,
          decoration: wavy,
        },
      },
      edges: [],
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Visual inspection**

Open `examples-v2/decoration-demo.html` in a browser. Verify:
- Wavy edges have visible random wobble with smooth corners
- Wavy node borders look hand-drawn (not jagged)
- Ellipse nodes have wavy borders matching the LEC style
- Normal (non-decorated) edges and nodes render normally
- Refreshing the page produces identical output (deterministic)

- [ ] **Step 5: Commit**

```bash
git add test/decorations-integration.test.js examples-v2/decoration-demo.html
git commit -m "feat(decorations): add integration tests and visual demo for wavy style"
```

---

## Task 9: Run Full Test Suite & Final Audit

- [ ] **Step 1: Run all tests**

```bash
node --test test/
```

Expected: all tests PASS (existing + new decoration tests)

- [ ] **Step 2: Old code compatibility audit (per tikz-svg-builder skill)**

Check each item:

1. **Emitter**: Does `createShapeElement` handle decoration for ALL shape types?
   - Verify: circle, ellipse, rectangle go through `shapeToSVGPath`
   - Verify: other shapes go through `backgroundPath()` fallback
   - Both paths feed into `morphPath()` when `decoration` is set

2. **Pipeline**: Does `index.js` pass decoration config correctly?
   - Verify: `seed` flows from config → model → emitSVG

3. **ViewBox**: Does `expandBBoxFromElement` handle `<path>` elements from decorated shapes?
   - Check: decorated circles/ellipses produce `<path>` instead of `<circle>`/`<ellipse>`
   - Verify: the viewBox computation still includes these elements

4. **Style cascade**: Does `decoration: null` default correctly in `resolveNodeStyle` and `resolveEdgeStyle`?
   - Verify: `null` doesn't trigger decoration (emitter checks `if (style.decoration)`)

5. **Existing shapes**: Non-decorated shapes are completely unaffected?
   - The decoration branch is guarded by `if (style.decoration && opts.prng)`
   - No decoration → existing switch runs exactly as before

6. **Named styles**: Does `StyleRegistry.expand()` propagate `decoration` objects?
   - The registry already deep-merges style properties — verify `decoration` object survives

- [ ] **Step 3: Fix any issues found in audit**

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "fix(decorations): address compatibility audit findings"
```
