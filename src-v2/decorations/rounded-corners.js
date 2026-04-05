import { pointsToPath, parseSVGPath, isClosedPath } from './path-utils.js';
import { KAPPA } from '../core/path.js';

/**
 * Smooth polyline corners with cubic Bézier arcs.
 * Matches PGF's \pgfsetcornersarced / \pgfprocessround algorithm.
 *
 * For each interior corner at vertex B in polyline ...A→B→C...:
 * - Entry point P on segment AB, at distance min(radius, |AB|/2) from B
 * - Exit point Q on segment BC, at distance min(radius, |BC|/2) from B
 * - Replace corner with cubic Bézier: P → cp1 → cp2 → Q where
 *     cp1 = P + KAPPA * (B − P)
 *     cp2 = Q + KAPPA * (B − Q)
 *   This produces a quarter-circle arc approximation.
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
    const entry = {
      x: curr.x + (prev.x - curr.x) * (rad / dPrev),
      y: curr.y + (prev.y - curr.y) * (rad / dPrev),
    };
    const exit = {
      x: curr.x + (next.x - curr.x) * (rad / dNext),
      y: curr.y + (next.y - curr.y) * (rad / dNext),
    };
    const cp1 = {
      x: entry.x + KAPPA * (curr.x - entry.x),
      y: entry.y + KAPPA * (curr.y - entry.y),
    };
    const cp2 = {
      x: exit.x + KAPPA * (curr.x - exit.x),
      y: exit.y + KAPPA * (curr.y - exit.y),
    };
    return { entry, exit, cp1, cp2 };
  }

  const parts = [];

  if (closed) {
    const c0 = cornerGeometry(0);
    parts.push(c0 ? `M ${fmt(c0.exit)}` : `M ${fmt(points[0])}`);

    for (let i = 1; i < n; i++) {
      const c = cornerGeometry(i);
      if (c) {
        parts.push(`L ${fmt(c.entry)} C ${fmt(c.cp1)} ${fmt(c.cp2)} ${fmt(c.exit)}`);
      } else {
        parts.push(`L ${fmt(points[i])}`);
      }
    }
    // Close back through corner 0
    if (c0) {
      parts.push(`L ${fmt(c0.entry)} C ${fmt(c0.cp1)} ${fmt(c0.cp2)} ${fmt(c0.exit)}`);
    }
    parts.push('Z');
  } else {
    parts.push(`M ${fmt(points[0])}`);

    for (let i = 1; i < n - 1; i++) {
      const c = cornerGeometry(i);
      if (c) {
        parts.push(`L ${fmt(c.entry)} C ${fmt(c.cp1)} ${fmt(c.cp2)} ${fmt(c.exit)}`);
      } else {
        parts.push(`L ${fmt(points[i])}`);
      }
    }
    parts.push(`L ${fmt(points[n - 1])}`);
  }

  return parts.join(' ');
}

/**
 * Apply rounded corners to an SVG path data string (M/L/Z only).
 * Extracts polygon vertices, applies rounding, and returns a new path string.
 *
 * @param {string} pathData - SVG path data from backgroundPath()
 * @param {number} radius - Corner rounding radius (px)
 * @returns {string} Rounded SVG path data, or original if not a simple polygon
 */
export function roundPathCorners(pathData, radius) {
  if (radius <= 0) return pathData;
  const commands = parseSVGPath(pathData);
  const closed = isClosedPath(commands);

  // Extract vertices from M/L commands only
  const points = [];
  for (const cmd of commands) {
    if (cmd.type === 'M' || cmd.type === 'L') {
      points.push({ x: cmd.args[0], y: cmd.args[1] });
    } else if (cmd.type === 'Z') {
      // skip
    } else {
      // Path contains curves — not a simple polygon, return as-is
      return pathData;
    }
  }

  if (points.length < 3) return pathData;
  return applyRoundedCorners(points, radius, closed);
}
