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
 * Note: returns points in math coordinates (y-up). The caller is responsible
 * for coordinate system conversion (e.g., negating y for SVG) if needed.
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
