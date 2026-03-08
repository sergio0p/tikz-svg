/**
 * Label positioning along edges.
 * Computes the (x, y) placement and optional rotation angle for text labels
 * placed on straight, quadratic, or cubic edge paths.
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

// ────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────

/**
 * Compute perpendicular offset direction given a tangent and desired side.
 *
 * 'left'  → offset to the left of the travel direction (positive perpendicularOffset)
 * 'right' → offset to the right (negative perpendicularOffset)
 * 'auto'  → pick the side that places the label further from the straight
 *            line between the edge's start and end points (i.e., the "outer"
 *            side of a curve).
 *
 * @param {Object} point       - point on the curve
 * @param {Object} tangent     - tangent vector at that point
 * @param {Object} startPoint  - edge start
 * @param {Object} endPoint    - edge end
 * @param {string} side        - 'left', 'right', or 'auto'
 * @param {number} distance    - offset magnitude
 * @returns {{ x: number, y: number }}
 */
function offsetBySide(point, tangent, startPoint, endPoint, side, distance) {
  if (side === 'auto') {
    // Try both sides and pick the one further from the start–end baseline
    const left = perpendicularOffset(point, tangent, distance);
    const right = perpendicularOffset(point, tangent, -distance);

    const baseDir = vecNormalize(vecSub(endPoint, startPoint));
    // Signed distance from baseline for each candidate
    const dLeft = crossMag(baseDir, vecSub(left, startPoint));
    const dRight = crossMag(baseDir, vecSub(right, startPoint));

    return Math.abs(dLeft) >= Math.abs(dRight) ? left : right;
  }

  const sign = side === 'right' ? -1 : 1;
  return perpendicularOffset(point, tangent, sign * distance);
}

/**
 * 2D cross-product magnitude (a x b).
 * Positive when b is to the left of a.
 */
function crossMag(a, b) {
  return a.x * b.y - a.y * b.x;
}

/**
 * Compute the rotation angle (in degrees) for sloped labels.
 * The angle is adjusted so text always reads left-to-right.
 * @param {Object} tangent
 * @returns {number}
 */
function slopeAngle(tangent) {
  // atan2 in screen coordinates (y-down)
  let deg = radToDeg(Math.atan2(tangent.y, tangent.x));
  // Keep text upright: flip if angle would make it upside-down
  if (deg > 90) deg -= 180;
  if (deg < -90) deg += 180;
  return deg;
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Compute the position (and optional rotation) for a label on an edge.
 *
 * @param {Object} edgeGeometry - result from computeEdgePath / computeStraightEdge / etc.
 *   Must include `type` ('straight' | 'quadratic' | 'cubic'), `startPoint`, `endPoint`,
 *   and the relevant control point(s): `controlPoint` for quadratic, `cp1`/`cp2` for cubic.
 * @param {Object} [opts]
 * @param {number} [opts.pos=0.5]        - Parameter t along the curve (0 = start, 1 = end).
 * @param {string} [opts.side='auto']    - 'left', 'right', or 'auto'.
 * @param {number} [opts.distance=8]     - Perpendicular offset from the curve in px.
 * @param {boolean} [opts.sloped=false]  - If true, returns an angle to rotate the label
 *                                          along the curve tangent.
 * @returns {{ x: number, y: number, angle?: number }}
 */
export function computeLabelPosition(edgeGeometry, opts = {}) {
  const pos = opts.pos ?? 0.5;
  const side = opts.side ?? 'auto';
  const distance = opts.distance ?? 8;
  const sloped = opts.sloped ?? false;

  const { startPoint, endPoint, type } = edgeGeometry;

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

  // Apply perpendicular offset
  const positioned = distance > 0
    ? offsetBySide(point, tangent, startPoint, endPoint, side, distance)
    : point;

  const result = { x: positioned.x, y: positioned.y };

  if (sloped) {
    result.angle = slopeAngle(tangent);
  }

  return result;
}
