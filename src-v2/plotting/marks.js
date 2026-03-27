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
