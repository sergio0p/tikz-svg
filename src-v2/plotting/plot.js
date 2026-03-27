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
 * Note: returns points in math coordinates (y-up). The caller is responsible
 * for coordinate system conversion (e.g., negating y for SVG) if needed.
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
