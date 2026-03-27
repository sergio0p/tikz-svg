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
