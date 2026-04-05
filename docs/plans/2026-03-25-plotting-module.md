**Status: COMPLETED** — Implemented in `src-v2/plotting/`. All tasks done.

# Plotting Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TikZ-compatible function plotting to the tikz-svg library: evaluate mathematical expressions over a domain, connect the sampled points using plot handlers (lineto, smooth, const, comb, bar), and optionally place marks at data points.

**Architecture:** Three layers mirroring PGF's architecture: (1) a function evaluator powered by math.js that samples expressions over a domain, (2) a plot handler registry that converts point streams into `Path` segments (lineto, curveto, const, comb, bar), (3) a plot mark registry that stamps SVG symbols at data points. The plot API returns a `Path` + mark positions, which callers render via the existing emitter or standalone.

**Tech Stack:** ES modules, math.js (v15, already installed), existing `Path` class from `core/path.js`, `node --test` + jsdom.

**Stop-at-any-step guarantee:** Each task ships a complete, tested feature. The library is fully usable after any task.

**PGF source references (in `docs/References/`):**
- `pgfmoduleplot.code.tex` — plot stream API, `\pgfplotxyfile`, `\pgfplotgnuplot`
- `pgflibraryplothandlers.code.tex` — 15+ handlers: curveto, closedcurve, comb, bar, const, jump
- `pgflibraryplotmarks.code.tex` — 27 mark definitions
- `tikz.code.tex` lines 1225–1330 — TikZ options: domain, samples, variable, smooth, handler dispatch

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-v2/plotting/evaluator.js` | **Create** | math.js expression compiler, domain sampling, parametric support |
| `src-v2/plotting/handlers.js` | **Create** | Plot handler registry: lineto, curveto (smooth), const, jump, comb, bar |
| `src-v2/plotting/marks.js` | **Create** | Plot mark registry: *, +, x, o, square, triangle, diamond, etc. |
| `src-v2/plotting/plot.js` | **Create** | Top-level `plot()` API: orchestrates evaluator → handler → path + marks |
| `src-v2/plotting/index.js` | **Create** | Public re-exports |
| `test/plotting-evaluator.test.js` | **Create** | Tests for expression evaluation and domain sampling |
| `test/plotting-handlers.test.js` | **Create** | Tests for each plot handler's path output |
| `test/plotting-marks.test.js` | **Create** | Tests for mark generation |
| `test/plotting-integration.test.js` | **Create** | End-to-end tests for the `plot()` API |

No existing files are modified. The plotting module is entirely additive.

---

### Task 1: Expression Evaluator

**What it does:** Compiles a math expression string (e.g., `"sin(x)"`, `"x^2 + 1"`, `"exp(-x/2) * cos(x)"`) using math.js, samples it over a domain `[start, end]` with a given number of samples, and returns an array of `{ x, y }` points. Supports parametric mode where `x` and `y` are both functions of `t`.

**TikZ equivalents:**
- `plot (\x, {sin(\x r)})` → `evaluate("sin(x)", { domain: [0, 6.28], samples: 25 })`
- `domain=0:4, samples=25` → `{ domain: [0, 4], samples: 25 }`
- `variable=\t, parametric` → `{ variable: 't', parametric: true }`
- `samples at={1,2,8,9,10}` → `{ samplesAt: [1,2,8,9,10] }`

**Files:**
- Create: `src-v2/plotting/evaluator.js`
- Create: `test/plotting-evaluator.test.js`

- [ ] **Step 1: Write failing tests for expression evaluation**

Create `test/plotting-evaluator.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sampleFunction, compileFn } from '../src-v2/plotting/evaluator.js';

describe('compileFn', () => {
  it('compiles and evaluates sin(x)', () => {
    const fn = compileFn('sin(x)');
    assert.ok(Math.abs(fn(0) - 0) < 1e-10);
    assert.ok(Math.abs(fn(Math.PI / 2) - 1) < 1e-10);
  });

  it('compiles x^2 + 1', () => {
    const fn = compileFn('x^2 + 1');
    assert.strictEqual(fn(0), 1);
    assert.strictEqual(fn(3), 10);
  });

  it('compiles with custom variable name', () => {
    const fn = compileFn('t^2', 't');
    assert.strictEqual(fn(4), 16);
  });

  it('handles exp, log, sqrt, abs', () => {
    const fn = compileFn('sqrt(abs(x))');
    assert.strictEqual(fn(4), 2);
    assert.strictEqual(fn(-9), 3);
  });

  it('handles pi and e constants', () => {
    const fn = compileFn('sin(pi)');
    assert.ok(Math.abs(fn(0) - 0) < 1e-10); // sin(pi) doesn't depend on x
  });
});

describe('sampleFunction', () => {
  it('samples sin(x) over [0, pi] with 5 samples', () => {
    const points = sampleFunction('sin(x)', { domain: [0, Math.PI], samples: 5 });
    assert.strictEqual(points.length, 5);
    // First point: x=0, y=0
    assert.ok(Math.abs(points[0].x) < 1e-10);
    assert.ok(Math.abs(points[0].y) < 1e-10);
    // Midpoint: x=pi/2, y=1
    assert.ok(Math.abs(points[2].x - Math.PI / 2) < 1e-10);
    assert.ok(Math.abs(points[2].y - 1) < 1e-10);
  });

  it('uses default domain [-5,5] and 25 samples', () => {
    const points = sampleFunction('x');
    assert.strictEqual(points.length, 25);
    assert.strictEqual(points[0].x, -5);
    assert.strictEqual(points[24].x, 5);
  });

  it('supports samplesAt for explicit x values', () => {
    const points = sampleFunction('x^2', { samplesAt: [1, 2, 3] });
    assert.strictEqual(points.length, 3);
    assert.strictEqual(points[0].y, 1);
    assert.strictEqual(points[1].y, 4);
    assert.strictEqual(points[2].y, 9);
  });

  it('supports parametric mode', () => {
    // Circle: x = cos(t), y = sin(t) over [0, 2*pi]
    const points = sampleFunction('cos(t)', {
      yExpr: 'sin(t)',
      variable: 't',
      domain: [0, 2 * Math.PI],
      samples: 5,
    });
    assert.strictEqual(points.length, 5);
    // First point: (cos(0), sin(0)) = (1, 0)
    assert.ok(Math.abs(points[0].x - 1) < 1e-10);
    assert.ok(Math.abs(points[0].y - 0) < 1e-10);
  });

  it('filters points outside yRange', () => {
    // tan(x) goes to infinity — range should clip
    const points = sampleFunction('tan(x)', {
      domain: [-1.5, 1.5],
      samples: 31,
      yRange: [-3, 3],
    });
    // Some points should be filtered (marked undefined)
    assert.ok(points.length <= 31);
    for (const p of points) {
      if (p.y !== undefined) {
        assert.ok(p.y >= -3 && p.y <= 3, `y=${p.y} out of range`);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/plotting-evaluator.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the evaluator**

Create `src-v2/plotting/evaluator.js`:

```js
/**
 * Mathematical expression evaluator for plot functions.
 * Uses math.js for safe expression parsing and evaluation.
 *
 * TikZ equivalents:
 *   plot (\x, {sin(\x r)})  →  sampleFunction('sin(x)', { domain: [0, 2*pi] })
 *   domain=0:4, samples=25  →  { domain: [0, 4], samples: 25 }
 *   samples at={1,2,3}      →  { samplesAt: [1,2,3] }
 *   variable=\t, parametric →  { variable: 't', yExpr: 'sin(t)' }
 *
 * Source: tikz.code.tex lines 1225–1319 (domain, samples, variable, parametric)
 */

import { compile } from 'mathjs';

/**
 * Compile a math expression string into a callable function.
 * @param {string} expr - e.g. 'sin(x)', 'x^2 + 1', 'exp(-t)'
 * @param {string} [variable='x'] - variable name
 * @returns {function(number): number}
 */
export function compileFn(expr, variable = 'x') {
  const compiled = compile(expr);
  return (value) => {
    const scope = { [variable]: value };
    return compiled.evaluate(scope);
  };
}

/**
 * Sample a function over a domain, returning an array of { x, y } points.
 *
 * @param {string} expr - math expression for y (or x in parametric mode)
 * @param {Object} [opts]
 * @param {[number, number]} [opts.domain=[-5, 5]] - [start, end]
 * @param {number} [opts.samples=25] - number of evenly-spaced sample points
 * @param {number[]} [opts.samplesAt] - explicit x values (overrides domain/samples)
 * @param {string} [opts.variable='x'] - variable name in expression
 * @param {string} [opts.yExpr] - if set, parametric mode: expr gives x, yExpr gives y
 * @param {[number, number]} [opts.yRange] - if set, points outside are marked undefined
 * @returns {{ x: number, y: number, undefined?: boolean }[]}
 */
export function sampleFunction(expr, opts = {}) {
  const domain = opts.domain ?? [-5, 5];
  const samples = Math.max(2, opts.samples ?? 25);
  const variable = opts.variable ?? 'x';
  const yRange = opts.yRange ?? null;

  // Build the list of parameter values
  let paramValues;
  if (opts.samplesAt) {
    paramValues = opts.samplesAt;
  } else {
    const [start, end] = domain;
    const step = (end - start) / (samples - 1);
    paramValues = [];
    for (let i = 0; i < samples; i++) {
      paramValues.push(start + i * step);
    }
  }

  // Compile expression(s)
  const isParametric = !!opts.yExpr;
  const xFn = compileFn(expr, variable);
  const yFn = isParametric ? compileFn(opts.yExpr, variable) : null;

  // Sample
  const points = [];
  for (const t of paramValues) {
    let x, y;
    try {
      if (isParametric) {
        x = xFn(t);
        y = yFn(t);
      } else {
        x = t;
        y = xFn(t);
      }
    } catch {
      points.push({ x: t, y: undefined, undefined: true });
      continue;
    }

    // Check for NaN/Infinity
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      points.push({ x, y: undefined, undefined: true });
      continue;
    }

    // Range filtering (TikZ range= option)
    if (yRange && (y < yRange[0] || y > yRange[1])) {
      points.push({ x, y: undefined, undefined: true });
      continue;
    }

    points.push({ x, y });
  }

  return points;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/plotting-evaluator.test.js`
Expected: All 11 tests PASS.

- [ ] **Step 5: Run full test suite for backward compatibility**

Run: `node --test`
Expected: All 191 + 11 = 202 tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/plotting/evaluator.js test/plotting-evaluator.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add math expression evaluator for plot functions (math.js)"
```

---

### Task 2: Plot Handlers

**What it does:** Implements a plot handler registry. Each handler receives an array of `{ x, y }` points and produces a `Path`. Handlers control how points are connected:

| Handler | TikZ option | Behavior |
|---|---|---|
| `lineto` | `sharp plot` (default) | Straight line segments |
| `curveto` | `smooth` | Cubic Bezier through points (tension-based) |
| `closedcurve` | `smooth cycle` | Closed smooth curve |
| `polygon` | `sharp cycle` | Closed straight-line polygon |
| `constlineto` | `const plot` | Staircase (step-before) |
| `constlinetoright` | `const plot mark right` | Staircase (step-after) |
| `constlinetomid` | `const plot mark mid` | Staircase (step-midpoint) |
| `jumpmarkleft` | `jump mark left` | Disconnected constant (left marks) |
| `jumpmarkright` | `jump mark right` | Disconnected constant (right marks) |
| `jumpmarkmid` | `jump mark mid` | Disconnected constant (mid marks) |
| `xcomb` | `xcomb` | Horizontal comb from y-axis |
| `ycomb` | `ycomb` | Vertical comb from x-axis |
| `ybar` | `ybar` | Filled vertical bars |
| `xbar` | `xbar` | Filled horizontal bars |

**Source:** `pgflibraryplothandlers.code.tex`, `pgfmoduleplot.code.tex` lines 218–270.

The smooth handler uses PGF's tension-based cubic Bezier algorithm (lines 24–105 of `pgflibraryplothandlers.code.tex`): for each interior point, control points are computed from the vector between the previous and next points, scaled by `0.2775 * tension` (default tension=0.5).

**Files:**
- Create: `src-v2/plotting/handlers.js`
- Create: `test/plotting-handlers.test.js`

- [ ] **Step 1: Write failing tests for plot handlers**

Create `test/plotting-handlers.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHandler, applyHandler } from '../src-v2/plotting/handlers.js';

const SQUARE = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
];
const SINE_3PT = [
  { x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 0 },
];
const WITH_UNDEF = [
  { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: undefined, undefined: true }, { x: 3, y: 3 }, { x: 4, y: 4 },
];

describe('lineto handler', () => {
  it('connects points with straight lines', () => {
    const path = applyHandler('lineto', SINE_3PT);
    const d = path.toSVGPath();
    assert.ok(d.startsWith('M'), 'should start with moveTo');
    assert.ok(d.includes('L'), 'should contain lineTo');
    // 1 moveTo + 2 lineTo
    assert.strictEqual((d.match(/M/g) || []).length, 1);
    assert.strictEqual((d.match(/L/g) || []).length, 2);
  });

  it('jumps over undefined points', () => {
    const path = applyHandler('lineto', WITH_UNDEF);
    const d = path.toSVGPath();
    // Should have 2 subpaths: M...L (0,1) then M...L (3,4)
    assert.strictEqual((d.match(/M/g) || []).length, 2);
  });
});

describe('curveto handler (smooth)', () => {
  it('produces cubic Bezier curves', () => {
    const points = [
      { x: 0, y: 0 }, { x: 3, y: 5 }, { x: 6, y: 3 }, { x: 9, y: 8 }, { x: 12, y: 0 },
    ];
    const path = applyHandler('curveto', points);
    const d = path.toSVGPath();
    assert.ok(d.includes('C'), 'should contain curveTo segments');
  });

  it('accepts tension option', () => {
    const points = [
      { x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 0 },
    ];
    const pathLow = applyHandler('curveto', points, { tension: 0.2 });
    const pathHigh = applyHandler('curveto', points, { tension: 1.0 });
    // Different tension should produce different paths
    assert.notStrictEqual(pathLow.toSVGPath(), pathHigh.toSVGPath());
  });
});

describe('closedcurve handler (smooth cycle)', () => {
  it('produces a closed smooth path', () => {
    const path = applyHandler('closedcurve', SQUARE);
    const d = path.toSVGPath();
    assert.ok(d.includes('C'), 'should contain curves');
    assert.ok(d.includes('Z'), 'should be closed');
  });
});

describe('polygon handler (sharp cycle)', () => {
  it('produces a closed straight-line path', () => {
    const path = applyHandler('polygon', SQUARE);
    const d = path.toSVGPath();
    assert.ok(d.includes('L'));
    assert.ok(d.includes('Z'));
    assert.ok(!d.includes('C'), 'no curves in polygon');
  });
});

describe('constlineto handler (const plot)', () => {
  it('produces staircase path', () => {
    const points = [{ x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 3 }];
    const path = applyHandler('constlineto', points);
    const d = path.toSVGPath();
    // Staircase: for each new point, first horizontal to new x, then vertical to new y
    // Should have more L segments than input points
    const lineCount = (d.match(/L/g) || []).length;
    assert.ok(lineCount >= 4, `expected >=4 lineTo, got ${lineCount}`);
  });
});

describe('ycomb handler', () => {
  it('produces vertical lines from baseline', () => {
    const points = [{ x: 2, y: 5 }, { x: 4, y: 8 }, { x: 6, y: 3 }];
    const path = applyHandler('ycomb', points);
    const d = path.toSVGPath();
    // 3 combs = 3 moveTo + 3 lineTo
    assert.strictEqual((d.match(/M/g) || []).length, 3);
    assert.strictEqual((d.match(/L/g) || []).length, 3);
  });
});

describe('ybar handler', () => {
  it('produces rectangles', () => {
    const points = [{ x: 2, y: 5 }, { x: 5, y: 8 }];
    const path = applyHandler('ybar', points, { barWidth: 4 });
    const d = path.toSVGPath();
    // Each bar is a rectangle: M + 3L + Z (or rect shorthand)
    assert.ok(d.includes('Z'), 'bars should be closed paths');
  });
});

describe('handler registry', () => {
  it('retrieves built-in handlers by name', () => {
    assert.ok(getHandler('lineto'));
    assert.ok(getHandler('curveto'));
    assert.ok(getHandler('closedcurve'));
    assert.ok(getHandler('polygon'));
    assert.ok(getHandler('constlineto'));
    assert.ok(getHandler('constlinetoright'));
    assert.ok(getHandler('constlinetomid'));
    assert.ok(getHandler('jumpmarkleft'));
    assert.ok(getHandler('jumpmarkright'));
    assert.ok(getHandler('jumpmarkmid'));
    assert.ok(getHandler('xcomb'));
    assert.ok(getHandler('ycomb'));
    assert.ok(getHandler('ybar'));
    assert.ok(getHandler('xbar'));
  });

  it('returns null for unknown handler', () => {
    assert.strictEqual(getHandler('nonexistent'), null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/plotting-handlers.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement plot handlers**

Create `src-v2/plotting/handlers.js`:

```js
/**
 * Plot handler registry.
 *
 * Each handler converts an array of {x, y} points into a Path.
 * Handlers control how sampled points are connected — the JS equivalent of
 * PGF's \pgfdeclareplothandler system.
 *
 * Source: pgflibraryplothandlers.code.tex, pgfmoduleplot.code.tex lines 218–270.
 */

import { Path } from '../core/path.js';

// ── Helpers ─────────────────────────────────────────────

/** Filter out undefined points, splitting into subpaths at jumps. */
function splitAtJumps(points) {
  const segments = [];
  let current = [];
  for (const p of points) {
    if (p.undefined || p.y === undefined) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push(p);
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

// ── Handlers ────────────────────────────────────────────

/**
 * Sharp plot (lineto) — straight lines between points.
 * PGF: \pgfplothandlerlineto (pgfmoduleplot.code.tex line 218)
 */
function linetoHandler(points, _opts) {
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    if (seg.length === 0) continue;
    path.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) {
      path.lineTo(seg[i].x, seg[i].y);
    }
  }
  return path;
}

/**
 * Smooth plot (curveto) — tension-based cubic Bezier through points.
 *
 * PGF algorithm (pgflibraryplothandlers.code.tex lines 24–105):
 * For each interior point P[i], compute the vector V = P[i+1] - P[i-1].
 * Control points are P[i] ± factor * V, where factor = 0.2775 * tension.
 * Default tension = 0.5, so default factor = 0.13875.
 *
 * The first segment uses the first point as its own support.
 * The last segment duplicates the last point as the end support.
 */
function curvetoHandler(points, opts = {}) {
  const tension = opts.tension ?? 0.5;
  const factor = 0.2775 * tension;
  const path = new Path();

  for (const seg of splitAtJumps(points)) {
    if (seg.length === 0) continue;
    if (seg.length === 1) {
      path.moveTo(seg[0].x, seg[0].y);
      continue;
    }
    if (seg.length === 2) {
      path.moveTo(seg[0].x, seg[0].y);
      path.lineTo(seg[1].x, seg[1].y);
      continue;
    }

    path.moveTo(seg[0].x, seg[0].y);

    // For each interior point, compute control points from the chord P[i+1] - P[i-1]
    // First segment: support1 = P[0] (no prior info)
    let prevSupport = { x: seg[0].x, y: seg[0].y };

    for (let i = 1; i < seg.length - 1; i++) {
      const prev = seg[i - 1];
      const curr = seg[i];
      const next = seg[i + 1];

      // Chord vector from prev to next
      const dx = (next.x - prev.x) * factor;
      const dy = (next.y - prev.y) * factor;

      // Support before current point
      const support1 = { x: curr.x - dx, y: curr.y - dy };
      // Support after current point (for next segment)
      const support2 = { x: curr.x + dx, y: curr.y + dy };

      path.curveTo(prevSupport.x, prevSupport.y, support1.x, support1.y, curr.x, curr.y);
      prevSupport = support2;
    }

    // Last segment: support2 = last point
    const last = seg[seg.length - 1];
    path.curveTo(prevSupport.x, prevSupport.y, last.x, last.y, last.x, last.y);
  }

  return path;
}

/**
 * Closed smooth curve — like curveto but wraps around.
 * PGF: \pgfplothandlerclosedcurve (pgflibraryplothandlers.code.tex line 117)
 */
function closedcurveHandler(points, opts = {}) {
  const tension = opts.tension ?? 0.5;
  const factor = 0.2775 * tension;
  const path = new Path();

  for (const seg of splitAtJumps(points)) {
    if (seg.length < 3) {
      // Fall back to polygon for < 3 points
      for (let i = 0; i < seg.length; i++) {
        i === 0 ? path.moveTo(seg[i].x, seg[i].y) : path.lineTo(seg[i].x, seg[i].y);
      }
      if (seg.length > 1) path.close();
      continue;
    }

    const n = seg.length;

    // Compute support points for all points (wrapping around)
    const supports = [];
    for (let i = 0; i < n; i++) {
      const prev = seg[(i - 1 + n) % n];
      const next = seg[(i + 1) % n];
      const dx = (next.x - prev.x) * factor;
      const dy = (next.y - prev.y) * factor;
      supports.push({
        before: { x: seg[i].x - dx, y: seg[i].y - dy },
        after: { x: seg[i].x + dx, y: seg[i].y + dy },
      });
    }

    path.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i <= n; i++) {
      const ci = i % n;
      const pi = i - 1;
      path.curveTo(
        supports[pi].after.x, supports[pi].after.y,
        supports[ci].before.x, supports[ci].before.y,
        seg[ci].x, seg[ci].y,
      );
    }
    path.close();
  }

  return path;
}

/**
 * Sharp cycle (polygon) — straight lines, closed.
 * PGF: \pgfplothandlerpolygon (pgfmoduleplot.code.tex line 245)
 */
function polygonHandler(points, _opts) {
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    if (seg.length === 0) continue;
    path.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) {
      path.lineTo(seg[i].x, seg[i].y);
    }
    path.close();
  }
  return path;
}

/**
 * Constant line (step-before) — staircase plot, mark on left.
 * PGF: \pgfplothandlerconstantlineto (pgflibraryplothandlers.code.tex line 610)
 *
 * For each point (x_i, y_i) after the first:
 *   1. horizontal line to (x_i, y_{i-1})  — keep old y
 *   2. vertical line to (x_i, y_i)        — step to new y
 */
function constlinetoHandler(points, _opts) {
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    if (seg.length === 0) continue;
    path.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) {
      path.lineTo(seg[i].x, seg[i - 1].y); // horizontal to new x, old y
      path.lineTo(seg[i].x, seg[i].y);      // vertical to new y
    }
  }
  return path;
}

/**
 * Constant line mark right — staircase, mark on right.
 * PGF: \pgfplothandlerconstantlinetomarkright (line 643)
 */
function constlinetorightHandler(points, _opts) {
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    if (seg.length === 0) continue;
    path.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) {
      path.lineTo(seg[i - 1].x, seg[i].y); // vertical to new y at old x
      path.lineTo(seg[i].x, seg[i].y);      // horizontal to new x
    }
  }
  return path;
}

/**
 * Constant line mark mid — staircase, step at midpoint.
 * PGF: \pgfplothandlerconstantlinetomarkmid (line 677)
 */
function constlinetomidHandler(points, _opts) {
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    if (seg.length === 0) continue;
    path.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) {
      const midX = (seg[i - 1].x + seg[i].x) / 2;
      path.lineTo(midX, seg[i - 1].y); // horizontal to midpoint, old y
      path.lineTo(midX, seg[i].y);      // vertical to new y
      path.lineTo(seg[i].x, seg[i].y);  // horizontal to new x
    }
  }
  return path;
}

/**
 * Jump mark left — disconnected staircase, marks on left.
 * PGF: \pgfplothandlerjumpmarkleft (line 750)
 */
function jumpmarkleftHandler(points, _opts) {
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    if (seg.length === 0) continue;
    path.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) {
      path.lineTo(seg[i].x, seg[i - 1].y); // horizontal to new x at old y
      path.moveTo(seg[i].x, seg[i].y);      // jump to new point
    }
  }
  return path;
}

/**
 * Jump mark right — disconnected staircase, marks on right.
 * PGF: \pgfplothandlerjumpmarkright (line 715)
 */
function jumpmarkrightHandler(points, _opts) {
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    if (seg.length === 0) continue;
    path.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) {
      path.moveTo(seg[i - 1].x, seg[i].y); // jump to old x at new y
      path.lineTo(seg[i].x, seg[i].y);      // horizontal to new x
    }
  }
  return path;
}

/**
 * Jump mark mid — disconnected staircase, marks at midpoint.
 * PGF: \pgfplothandlerjumpmarkmid (line 785)
 */
function jumpmarkmidHandler(points, _opts) {
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    if (seg.length === 0) continue;
    path.moveTo(seg[0].x, seg[0].y);
    for (let i = 1; i < seg.length; i++) {
      const midX = (seg[i - 1].x + seg[i].x) / 2;
      path.lineTo(midX, seg[i - 1].y);  // to midpoint at old y
      path.moveTo(midX, seg[i].y);       // jump to midpoint at new y
      path.lineTo(seg[i].x, seg[i].y);   // to new x
    }
  }
  return path;
}

/**
 * Y-comb — vertical lines from x-axis to each point.
 * PGF: \pgfplothandlerycomb (pgflibraryplothandlers.code.tex line 312)
 */
function ycombHandler(points, opts = {}) {
  const baseline = opts.baseline ?? 0;
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    for (const p of seg) {
      path.moveTo(p.x, baseline);
      path.lineTo(p.x, p.y);
    }
  }
  return path;
}

/**
 * X-comb — horizontal lines from y-axis to each point.
 * PGF: \pgfplothandlerxcomb (pgflibraryplothandlers.code.tex line 284)
 */
function xcombHandler(points, opts = {}) {
  const baseline = opts.baseline ?? 0;
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    for (const p of seg) {
      path.moveTo(baseline, p.y);
      path.lineTo(p.x, p.y);
    }
  }
  return path;
}

/**
 * Y-bar — vertical filled rectangles from x-axis.
 * PGF: \pgfplothandlerybar (pgflibraryplothandlers.code.tex line 405)
 */
function ybarHandler(points, opts = {}) {
  const barWidth = opts.barWidth ?? 10;
  const barShift = opts.barShift ?? 0;
  const baseline = opts.baseline ?? 0;
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    for (const p of seg) {
      const x = p.x - barWidth / 2 + barShift;
      const y = Math.min(baseline, p.y);
      const h = Math.abs(p.y - baseline);
      path.rect(x, y, barWidth, h);
    }
  }
  return path;
}

/**
 * X-bar — horizontal filled rectangles from y-axis.
 * PGF: \pgfplothandlerxbar (pgflibraryplothandlers.code.tex line 448)
 */
function xbarHandler(points, opts = {}) {
  const barWidth = opts.barWidth ?? 10;
  const barShift = opts.barShift ?? 0;
  const baseline = opts.baseline ?? 0;
  const path = new Path();
  for (const seg of splitAtJumps(points)) {
    for (const p of seg) {
      const y = p.y - barWidth / 2 + barShift;
      const x = Math.min(baseline, p.x);
      const w = Math.abs(p.x - baseline);
      path.rect(x, y, w, barWidth);
    }
  }
  return path;
}

// ── Registry ────────────────────────────────────────────

const HANDLERS = {
  lineto: linetoHandler,
  curveto: curvetoHandler,
  closedcurve: closedcurveHandler,
  polygon: polygonHandler,
  constlineto: constlinetoHandler,
  constlinetoright: constlinetorightHandler,
  constlinetomid: constlinetomidHandler,
  jumpmarkleft: jumpmarkleftHandler,
  jumpmarkright: jumpmarkrightHandler,
  jumpmarkmid: jumpmarkmidHandler,
  xcomb: xcombHandler,
  ycomb: ycombHandler,
  ybar: ybarHandler,
  xbar: xbarHandler,
};

// TikZ option names → handler names
const TIKZ_ALIASES = {
  'sharp plot': 'lineto',
  'smooth': 'curveto',
  'smooth cycle': 'closedcurve',
  'sharp cycle': 'polygon',
  'const plot': 'constlineto',
  'const plot mark left': 'constlineto',
  'const plot mark right': 'constlinetoright',
  'const plot mark mid': 'constlinetomid',
  'jump mark left': 'jumpmarkleft',
  'jump mark right': 'jumpmarkright',
  'jump mark mid': 'jumpmarkmid',
};

/**
 * Get a handler function by name.
 * @param {string} name - handler name or TikZ option name
 * @returns {Function|null}
 */
export function getHandler(name) {
  return HANDLERS[name] ?? HANDLERS[TIKZ_ALIASES[name]] ?? null;
}

/**
 * Apply a named handler to an array of points.
 * @param {string} handlerName
 * @param {{ x: number, y: number }[]} points
 * @param {Object} [opts] - handler-specific options (tension, barWidth, etc.)
 * @returns {Path}
 */
export function applyHandler(handlerName, points, opts = {}) {
  const handler = getHandler(handlerName);
  if (!handler) {
    throw new Error(`Unknown plot handler: "${handlerName}"`);
  }
  return handler(points, opts);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/plotting-handlers.test.js`
Expected: All 10 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/plotting/handlers.js test/plotting-handlers.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add 14 plot handlers (smooth, const, comb, bar, jump)"
```

---

### Task 3: Plot Marks

**What it does:** A registry of plot mark symbols (filled circle, plus, cross, square, triangle, diamond, etc.) that can be stamped at data point positions. Each mark is a function that returns a `Path` centered at the origin, scaled to the mark size. The caller is responsible for translating each mark to its data point position.

**Source:** `pgflibraryplotmarks.code.tex` (27 marks), `tikz.code.tex` lines 1267–1285 (mark, mark size, mark repeat, mark phase, mark indices).

**Files:**
- Create: `src-v2/plotting/marks.js`
- Create: `test/plotting-marks.test.js`

- [ ] **Step 1: Write failing tests for plot marks**

Create `test/plotting-marks.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMark, getMarkPositions, getMarkFillMode } from '../src-v2/plotting/marks.js';

describe('mark registry', () => {
  it('retrieves built-in marks', () => {
    for (const name of ['*', '+', 'x', 'o', '|', '-', 'square', 'square*',
      'triangle', 'triangle*', 'diamond', 'diamond*', 'pentagon', 'pentagon*']) {
      assert.ok(getMark(name), `mark "${name}" should exist`);
    }
  });

  it('returns null for unknown mark', () => {
    assert.strictEqual(getMark('nonexistent'), null);
  });

  it('distinguishes filled vs stroked marks', () => {
    assert.strictEqual(getMarkFillMode('*'), 'filled');
    assert.strictEqual(getMarkFillMode('o'), 'stroke');
    assert.strictEqual(getMarkFillMode('square'), 'stroke');
    assert.strictEqual(getMarkFillMode('square*'), 'filled');
    assert.strictEqual(getMarkFillMode('+'), 'stroke');
  });

  it('mark returns a Path with segments', () => {
    const markFn = getMark('*');
    const path = markFn(3); // size = 3
    assert.ok(!path.isEmpty(), 'mark path should not be empty');
    const d = path.toSVGPath();
    assert.ok(d.length > 0);
  });

  it('mark size scales the symbol', () => {
    const markFn = getMark('+');
    const small = markFn(2);
    const large = markFn(6);
    // Larger mark should have coordinates further from origin
    const smallBbox = small.bbox();
    const largeBbox = large.bbox();
    assert.ok(largeBbox.maxX > smallBbox.maxX);
  });
});

describe('getMarkPositions', () => {
  const points = [
    { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 },
    { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 },
  ];

  it('returns all positions by default', () => {
    const positions = getMarkPositions(points, {});
    assert.strictEqual(positions.length, 6);
  });

  it('respects markRepeat', () => {
    const positions = getMarkPositions(points, { markRepeat: 3 });
    // Every 3rd point: indices 0, 3 (1-indexed: 1st, 4th)
    assert.strictEqual(positions.length, 2);
  });

  it('respects markPhase', () => {
    const positions = getMarkPositions(points, { markRepeat: 2, markPhase: 2 });
    // Phase 2 means start at 2nd point: indices 1, 3, 5
    assert.strictEqual(positions.length, 3);
  });

  it('respects markIndices', () => {
    const positions = getMarkPositions(points, { markIndices: [1, 3, 6] });
    // 1-indexed: points at indices 0, 2, 5
    assert.strictEqual(positions.length, 3);
    assert.strictEqual(positions[0].x, 0);
    assert.strictEqual(positions[1].x, 2);
    assert.strictEqual(positions[2].x, 5);
  });

  it('skips undefined points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: undefined, undefined: true }, { x: 2, y: 2 }];
    const positions = getMarkPositions(pts, {});
    assert.strictEqual(positions.length, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/plotting-marks.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement plot marks**

Create `src-v2/plotting/marks.js`:

```js
/**
 * Plot mark registry.
 *
 * Each mark is a function(size) => Path that generates a mark symbol
 * centered at the origin with the given radius/size.
 *
 * Source: pgflibraryplotmarks.code.tex (27 marks)
 * Also: pgfmoduleplot.code.tex (mark placement infrastructure)
 * Also: tikz.code.tex lines 1267–1285 (mark, mark repeat, mark phase, mark indices)
 */

import { Path } from '../core/path.js';

// ── Mark definitions ────────────────────────────────────

function filledCircleMark(s) {
  return new Path().circle(0, 0, s);
}

function openCircleMark(s) {
  return new Path().circle(0, 0, s);
}

function plusMark(s) {
  const p = new Path();
  p.moveTo(0, -s).lineTo(0, s);
  p.moveTo(-s, 0).lineTo(s, 0);
  return p;
}

function crossMark(s) {
  const d = s * 0.7071; // s / sqrt(2)
  const p = new Path();
  p.moveTo(-d, -d).lineTo(d, d);
  p.moveTo(d, -d).lineTo(-d, d);
  return p;
}

function barVerticalMark(s) {
  return new Path().moveTo(0, -s).lineTo(0, s);
}

function barHorizontalMark(s) {
  return new Path().moveTo(-s, 0).lineTo(s, 0);
}

function squareMark(s) {
  return new Path().rect(-s, -s, 2 * s, 2 * s);
}

function filledSquareMark(s) {
  return new Path().rect(-s, -s, 2 * s, 2 * s);
}

function triangleMark(s) {
  // PGF: equilateral triangle with top vertex at (0, -s)
  // pgflibraryplotmarks.code.tex: vertices at 90°, 210°, 330° from center
  const p = new Path();
  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / 3;
    const x = s * Math.cos(angle);
    const y = -s * Math.sin(angle); // SVG y-down
    i === 0 ? p.moveTo(x, y) : p.lineTo(x, y);
  }
  p.close();
  return p;
}

function filledTriangleMark(s) {
  return triangleMark(s);
}

function diamondMark(s) {
  const p = new Path();
  p.moveTo(0, -s);
  p.lineTo(s * 0.75, 0);
  p.lineTo(0, s);
  p.lineTo(-s * 0.75, 0);
  p.close();
  return p;
}

function filledDiamondMark(s) {
  return diamondMark(s);
}

function pentagonMark(s) {
  const p = new Path();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / 5;
    const x = s * Math.cos(angle);
    const y = -s * Math.sin(angle); // SVG y-down
    i === 0 ? p.moveTo(x, y) : p.lineTo(x, y);
  }
  p.close();
  return p;
}

function filledPentagonMark(s) {
  return pentagonMark(s);
}

function asteriskMark(s) {
  const p = new Path();
  p.moveTo(0, -s).lineTo(0, s);
  for (const angle of [30, -30]) {
    const rad = (angle * Math.PI) / 180;
    const dx = s * Math.cos(rad);
    const dy = s * Math.sin(rad);
    p.moveTo(dx, -dy).lineTo(-dx, dy);
  }
  return p;
}

function starMark(s) {
  // PGF star: 5 spokes from center to tips (stroked, not filled polygon)
  // pgflibraryplotmarks.code.tex: lines from origin to 5 evenly spaced tips
  const p = new Path();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI / 2) + (2 * Math.PI * i) / 5;
    const x = s * Math.cos(angle);
    const y = -s * Math.sin(angle); // SVG y-down
    p.moveTo(0, 0);
    p.lineTo(x, y);
  }
  return p;
}

// ── Registry ────────────────────────────────────────────

const MARKS = {
  '*': filledCircleMark,
  'o': openCircleMark,
  '+': plusMark,
  'x': crossMark,
  '|': barVerticalMark,
  '-': barHorizontalMark,
  'square': squareMark,
  'square*': filledSquareMark,
  'triangle': triangleMark,
  'triangle*': filledTriangleMark,
  'diamond': diamondMark,
  'diamond*': filledDiamondMark,
  'pentagon': pentagonMark,
  'pentagon*': filledPentagonMark,
  'asterisk': asteriskMark,
  'star': starMark,
};

// Fill modes: 'filled' (solid fill), 'stroke' (outline/lines only)
const FILL_MODES = {
  '*': 'filled', 'o': 'stroke', '+': 'stroke', 'x': 'stroke',
  '|': 'stroke', '-': 'stroke',
  'square': 'stroke', 'square*': 'filled',
  'triangle': 'stroke', 'triangle*': 'filled',
  'diamond': 'stroke', 'diamond*': 'filled',
  'pentagon': 'stroke', 'pentagon*': 'filled',
  'asterisk': 'stroke', 'star': 'stroke',
};

/**
 * Get a mark function by name.
 * @param {string} name
 * @returns {(function(number): Path)|null}
 */
export function getMark(name) {
  return MARKS[name] ?? null;
}

/**
 * Get the fill mode for a mark ('filled' or 'stroke').
 * Callers use this to decide SVG fill/stroke attributes.
 * @param {string} name
 * @returns {'filled'|'stroke'}
 */
export function getMarkFillMode(name) {
  return FILL_MODES[name] ?? 'stroke';
}

/**
 * Compute which data points should receive marks, respecting
 * TikZ mark repeat, mark phase, and mark indices options.
 *
 * @param {{ x: number, y: number }[]} points
 * @param {Object} opts
 * @param {number} [opts.markRepeat] - place mark every N-th point
 * @param {number} [opts.markPhase=1] - 1-indexed offset for first mark
 * @param {number[]} [opts.markIndices] - explicit 1-indexed list of positions
 * @returns {{ x: number, y: number }[]}
 */
export function getMarkPositions(points, opts = {}) {
  // Filter out undefined points first
  const defined = points.filter(p => !p.undefined && p.y !== undefined);

  if (opts.markIndices) {
    // 1-indexed → 0-indexed
    return opts.markIndices
      .map(i => defined[i - 1])
      .filter(p => p !== undefined);
  }

  if (opts.markRepeat) {
    const phase = (opts.markPhase ?? 1) - 1; // convert to 0-indexed
    const repeat = opts.markRepeat;
    return defined.filter((_, i) => (i - phase) % repeat === 0 && i >= phase);
  }

  return defined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/plotting-marks.test.js`
Expected: All 10 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/plotting/marks.js test/plotting-marks.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add 16 plot marks (*, +, x, o, square, triangle, etc.)"
```

---

### Task 4: Top-Level Plot API

**What it does:** A single `plot()` function that orchestrates the three layers: evaluate → handle → return path + marks. Uses TikZ-compatible option names.

**API:**
```js
import { plot } from './src-v2/plotting/index.js';

// Plot sin(x) with smooth interpolation and circle marks
const result = plot('sin(x)', {
  domain: [0, 2 * Math.PI],
  samples: 50,
  handler: 'smooth',      // or 'sharp plot', 'const plot', 'ycomb', etc.
  tension: 0.5,
  mark: '*',
  markSize: 3,
  markRepeat: 5,
});
// result.path  → Path instance (for rendering)
// result.marks → [{ x, y }] positions where marks should go
// result.markPath → Path for the mark symbol
// result.points → raw sampled [{ x, y }] array

// Plot from inline coordinates
const result2 = plot(null, {
  coordinates: [{x:0,y:0}, {x:1,y:1}, {x:2,y:4}],
  handler: 'ybar',
  barWidth: 8,
});

// Parametric plot
const result3 = plot('cos(t)', {
  yExpr: 'sin(t)',
  variable: 't',
  domain: [0, 2 * Math.PI],
  samples: 100,
  handler: 'smooth',
});
```

**Files:**
- Create: `src-v2/plotting/plot.js`
- Create: `src-v2/plotting/index.js`
- Create: `test/plotting-integration.test.js`

- [ ] **Step 1: Write failing integration tests**

Create `test/plotting-integration.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src-v2/plotting/index.js';

describe('plot() API', () => {
  it('plots sin(x) with default options', () => {
    const result = plot('sin(x)', { domain: [0, Math.PI], samples: 5 });
    assert.ok(result.path, 'should have a path');
    assert.ok(!result.path.isEmpty(), 'path should not be empty');
    assert.strictEqual(result.points.length, 5);
    assert.strictEqual(result.marks, null); // no marks by default
  });

  it('plots with smooth handler', () => {
    const result = plot('x^2', {
      domain: [0, 3],
      samples: 10,
      handler: 'smooth',
    });
    const d = result.path.toSVGPath();
    assert.ok(d.includes('C'), 'smooth should produce curves');
  });

  it('plots with marks', () => {
    const result = plot('x', {
      domain: [0, 4],
      samples: 5,
      mark: '*',
      markSize: 3,
    });
    assert.ok(result.marks, 'should have marks');
    assert.strictEqual(result.marks.length, 5);
    assert.ok(result.markPath, 'should have markPath');
  });

  it('plots from inline coordinates', () => {
    const result = plot(null, {
      coordinates: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }],
    });
    assert.strictEqual(result.points.length, 3);
    assert.ok(!result.path.isEmpty());
  });

  it('plots parametric', () => {
    const result = plot('cos(t)', {
      yExpr: 'sin(t)',
      variable: 't',
      domain: [0, 2 * Math.PI],
      samples: 20,
      handler: 'smooth',
    });
    assert.strictEqual(result.points.length, 20);
    // First point should be near (1, 0)
    assert.ok(Math.abs(result.points[0].x - 1) < 0.01);
    assert.ok(Math.abs(result.points[0].y - 0) < 0.01);
  });

  it('plots ybar', () => {
    const result = plot(null, {
      coordinates: [{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 2 }],
      handler: 'ybar',
      barWidth: 6,
    });
    const d = result.path.toSVGPath();
    assert.ok(d.includes('Z'), 'ybar should produce closed rectangles');
  });

  it('supports ycomb', () => {
    const result = plot('sin(x)', {
      domain: [0, 6],
      samples: 7,
      handler: 'ycomb',
    });
    const d = result.path.toSVGPath();
    // 7 combs = 7 moveTo
    assert.strictEqual((d.match(/M/g) || []).length, 7);
  });

  it('supports yRange filtering', () => {
    const result = plot('tan(x)', {
      domain: [-1.5, 1.5],
      samples: 31,
      yRange: [-3, 3],
    });
    // All defined points should be within range
    for (const p of result.points) {
      if (!p.undefined) {
        assert.ok(p.y >= -3 && p.y <= 3);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/plotting-integration.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement plot.js**

Create `src-v2/plotting/plot.js`:

```js
/**
 * Top-level plot API.
 *
 * Orchestrates: expression evaluation → plot handler → path + marks.
 * TikZ equivalent of the `plot` path operation (tikz.code.tex Section 22).
 */

import { sampleFunction } from './evaluator.js';
import { applyHandler } from './handlers.js';
import { getMark, getMarkPositions } from './marks.js';

/**
 * Plot a mathematical function or set of coordinates.
 *
 * @param {string|null} expr - math expression (e.g., 'sin(x)'), or null for coordinates
 * @param {Object} [opts]
 * @param {[number,number]} [opts.domain=[-5,5]] - [start, end] for function sampling
 * @param {number} [opts.samples=25] - number of sample points
 * @param {number[]} [opts.samplesAt] - explicit parameter values (overrides domain/samples)
 * @param {string} [opts.variable='x'] - variable name
 * @param {string} [opts.yExpr] - if set, parametric mode: expr=x(t), yExpr=y(t)
 * @param {[number,number]} [opts.yRange] - clip y values to this range
 * @param {{ x:number, y:number }[]} [opts.coordinates] - inline points (used when expr is null)
 * @param {string} [opts.handler='lineto'] - plot handler name
 * @param {number} [opts.tension] - smoothing tension (for 'curveto'/'smooth')
 * @param {number} [opts.barWidth] - bar width (for 'ybar'/'xbar')
 * @param {number} [opts.barShift] - bar shift
 * @param {number} [opts.baseline] - baseline for comb/bar plots
 * @param {string} [opts.mark] - mark symbol name (e.g., '*', '+', 'x')
 * @param {number} [opts.markSize=3] - mark symbol size
 * @param {number} [opts.markRepeat] - place every N-th mark
 * @param {number} [opts.markPhase] - 1-indexed phase offset for marks
 * @param {number[]} [opts.markIndices] - explicit 1-indexed mark positions
 * @returns {{ path: Path, points: Array, marks: Array|null, markPath: Path|null }}
 */
export function plot(expr, opts = {}) {
  // 1. Get points
  let points;
  if (expr === null || expr === undefined) {
    points = opts.coordinates ?? [];
  } else {
    points = sampleFunction(expr, {
      domain: opts.domain,
      samples: opts.samples,
      samplesAt: opts.samplesAt,
      variable: opts.variable,
      yExpr: opts.yExpr,
      yRange: opts.yRange,
    });
  }

  // 2. Apply handler
  const handlerName = opts.handler ?? 'lineto';
  const path = applyHandler(handlerName, points, {
    tension: opts.tension,
    barWidth: opts.barWidth,
    barShift: opts.barShift,
    baseline: opts.baseline,
  });

  // 3. Compute marks
  let marks = null;
  let markPath = null;
  if (opts.mark) {
    const markFn = getMark(opts.mark);
    if (markFn) {
      marks = getMarkPositions(points, {
        markRepeat: opts.markRepeat,
        markPhase: opts.markPhase,
        markIndices: opts.markIndices,
      });
      markPath = markFn(opts.markSize ?? 3);
    }
  }

  return { path, points, marks, markPath };
}
```

- [ ] **Step 4: Create the public index**

Create `src-v2/plotting/index.js`:

```js
/**
 * Plotting module public API.
 *
 * TikZ Section 22: Plots of Functions
 */
export { plot } from './plot.js';
export { sampleFunction, compileFn } from './evaluator.js';
export { getHandler, applyHandler } from './handlers.js';
export { getMark, getMarkPositions, getMarkFillMode } from './marks.js';
```

- [ ] **Step 5: Run integration tests**

Run: `node --test test/plotting-integration.test.js`
Expected: All 8 tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/plotting/ test/plotting-integration.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add top-level plot() API with TikZ-compatible options"
```

---

## Verification Checklist

After all 4 tasks:

- [ ] `node --test` — all tests pass
- [ ] No existing files modified — entirely additive module
- [ ] `render()` and `renderAutomaton()` unchanged
- [ ] math.js is the only new dependency
- [ ] Plot module is standalone: `import { plot } from './src-v2/plotting/index.js'`

## What This Does NOT Cover (future work)

- **Rendering integration:** The `plot()` function returns a `Path` + mark positions, but does not render SVG directly. A future task would integrate this with `emitter.js` so users can add plots to `render()` configs.
- **Axes and ticks:** TikZ's `datavisualization` (Part VI) and `pgfplots` handle axes, ticks, legends. These are out of scope for this plan.
- **3D plots:** `pgfplotxyzfile` and 3D coordinates are not covered.
- **Polar comb:** The `polar comb` handler is omitted (specialized, rarely used).
- **Bar interval handlers:** `ybar interval` and `xbar interval` are omitted (require consecutive-point logic).
- **Additional marks:** The remaining 11 marks (Mercedes star, oplus, otimes, halfcircle, halfsquare, heart, text, 10-pointed star) can be added incrementally.
