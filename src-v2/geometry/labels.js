/**
 * Node-based label positioning along edges.
 *
 * Labels are rectangle-shape nodes positioned via TikZ-style anchor selection.
 * The selected anchor sits at the edge point; the text body extends away.
 */

import {
  vec,
  vecSub,
  vecLength,
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
// Text sizing and anchor helpers
// ────────────────────────────────────────────

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
  const ty = -norm.y;  // SVG y-down → TikZ y-up
  const T = 0.05;

  let anchor;
  if (Math.abs(tx) <= T && Math.abs(ty) <= T) {
    anchor = 'west';  // degenerate fallback — matches TikZ fall-through
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

// ────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────

/**
 * 2D cross-product magnitude. Positive when b is left of a.
 */
function crossMag(a, b) {
  return a.x * b.y - a.y * b.x;
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
 * Resolve 'auto' side to 'left' or 'right' based on curve geometry.
 * Picks the side that places the label further from the start–end baseline
 * (the "outer" side of a curve). Straight edges default to 'left'.
 */
function resolveAutoSide(point, tangent, startPoint, endPoint) {
  const diff = vecSub(endPoint, startPoint);
  // For self-loops, start and end are both on the same node border — close together.
  // The baseline is nearly degenerate, giving unreliable auto-side. Default to 'left'.
  // Threshold: typical loop border-point distance is ~10-15px for r=20 nodes.
  if (vecLength(diff) < 20) return 'left';
  const baseDir = vecNormalize(diff);
  const left = perpendicularOffset(point, tangent, 1);
  const dLeft = crossMag(baseDir, vecSub(left, startPoint));
  // In SVG y-down, positive cross = visual RIGHT, negative = visual LEFT.
  // If the left-offset point is on the visual LEFT (negative cross), LEFT is the outer side.
  return dLeft >= 0 ? 'right' : 'left';
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

  // Use the unshortened (raw) geometry for label positioning.
  // TikZ places labels on the original path; shortening only affects drawing.
  const labelGeom = edgeGeometry.raw ?? edgeGeometry;
  const { startPoint, endPoint, type } = labelGeom;

  // 1. Compute point and tangent on curve at pos
  let point, tangent;

  switch (type) {
    case 'quadratic': {
      const cp = labelGeom.controlPoint;
      point = pointOnQuadBezier(startPoint, cp, endPoint, pos);
      tangent = tangentOnQuadBezier(startPoint, cp, endPoint, pos);
      break;
    }
    case 'cubic': {
      const { cp1, cp2 } = labelGeom;
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

  // 2. Resolve 'auto' side
  let effectiveSide = side;
  if (side === 'auto') {
    effectiveSide = resolveAutoSide(point, tangent, startPoint, endPoint);
  }

  // 3. Apply perpendicular distance offset
  let edgePoint = point;
  if (distance > 0) {
    const sign = effectiveSide === 'right' ? -1 : 1;
    edgePoint = perpendicularOffset(point, tangent, sign * distance);
  }

  // 4. Compute sloped angle and handle anchor override
  let angle = null;
  let anchorSide = effectiveSide;

  if (sloped) {
    angle = slopeAngle(tangent);
    // When sloped, force south/north. If slopeAngle flipped the text upright,
    // "above" and "below" swap in the rotated frame. If user also requested
    // swap (side='right'), that flips again. Use XOR to combine both.
    const rawDeg = radToDeg(Math.atan2(tangent.y, tangent.x));
    const flipped = rawDeg > 90 || rawDeg < -90;
    const wantSwap = (effectiveSide === 'right');
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
