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
  const r = (v) => Math.round(v * 100) / 100;
  const fmt = (p) => `${r(p.x)} ${r(p.y)}`;

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
