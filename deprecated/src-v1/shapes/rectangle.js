/**
 * Rectangle shape for the TikZ-SVG library.
 *
 * Coordinate conventions:
 *   - SVG y-down: "north" = negative y
 *   - TikZ angles: 0 = east, CCW positive
 *
 * borderPoint uses the PGF/TikZ algorithm: mirror the direction vector into
 * the first quadrant, test the ray against the vertical and horizontal edges,
 * then mirror the result back.
 */

import { vecFromAngle } from '../core/math.js';
import { registerShape } from './shape.js';

/**
 * Compute saved geometry from node configuration.
 * @param {Object} config - Must include `center: { x, y }`,
 *   `halfWidth: number`, and `halfHeight: number`.
 * @returns {{ center: { x: number, y: number }, halfWidth: number, halfHeight: number }}
 */
function savedGeometry(config) {
  const { center, halfWidth, halfHeight } = config;
  return {
    center: { x: center.x, y: center.y },
    halfWidth,
    halfHeight,
  };
}

/**
 * Resolve a named or numeric anchor to an absolute SVG point.
 * @param {string} name - Anchor name or TikZ angle in degrees.
 * @param {Object} geom - Saved geometry.
 * @returns {{ x: number, y: number }}
 */
function anchor(name, geom) {
  const { center, halfWidth: hw, halfHeight: hh } = geom;

  switch (name) {
    case 'center':      return { x: center.x,      y: center.y };
    case 'north':       return { x: center.x,      y: center.y - hh };
    case 'south':       return { x: center.x,      y: center.y + hh };
    case 'east':        return { x: center.x + hw,  y: center.y };
    case 'west':        return { x: center.x - hw,  y: center.y };
    case 'north east':  return { x: center.x + hw,  y: center.y - hh };
    case 'north west':  return { x: center.x - hw,  y: center.y - hh };
    case 'south east':  return { x: center.x + hw,  y: center.y + hh };
    case 'south west':  return { x: center.x - hw,  y: center.y + hh };
    default: {
      // Numeric angle
      const angle = parseFloat(name);
      if (!Number.isNaN(angle)) {
        const dir = vecFromAngle(angle);
        return borderPoint(geom, dir);
      }
      throw new Error(`rectangle.anchor: unknown anchor "${name}"`);
    }
  }
}

/**
 * Point on the rectangle border in the given direction from center.
 *
 * PGF algorithm summary:
 * 1. Mirror direction into first quadrant (positive x, positive y).
 * 2. If the ray is essentially zero-length, return center.
 * 3. Compute where the ray hits the vertical edge (x = halfWidth) and the
 *    horizontal edge (y = halfHeight).
 * 4. Pick the closer intersection.
 * 5. Mirror the result back to the original quadrant.
 *
 * @param {Object} geom - Saved geometry.
 * @param {{ x: number, y: number }} direction - Direction vector (any length).
 * @returns {{ x: number, y: number }}
 */
function borderPoint(geom, direction) {
  const { center, halfWidth: hw, halfHeight: hh } = geom;
  const dx = direction.x;
  const dy = direction.y;

  // Degenerate direction
  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
    return { x: center.x, y: center.y };
  }

  // Mirror into first quadrant
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  // Scale factors for hitting each edge
  let t;
  if (adx < 1e-10) {
    // Purely vertical
    t = hh / ady;
  } else if (ady < 1e-10) {
    // Purely horizontal
    t = hw / adx;
  } else {
    const tVert = hw / adx;   // time to hit vertical edge
    const tHoriz = hh / ady;  // time to hit horizontal edge
    t = Math.min(tVert, tHoriz);
  }

  return {
    x: center.x + dx * t,
    y: center.y + dy * t,
  };
}

/**
 * SVG path string for the rectangle background.
 * @param {Object} geom - Saved geometry.
 * @returns {string}
 */
function backgroundPath(geom) {
  const { center: { x: cx, y: cy }, halfWidth: hw, halfHeight: hh } = geom;
  return (
    `M ${cx - hw} ${cy - hh}` +
    ` L ${cx + hw} ${cy - hh}` +
    ` L ${cx + hw} ${cy + hh}` +
    ` L ${cx - hw} ${cy + hh}` +
    ` Z`
  );
}

const ANCHOR_NAMES = [
  'center', 'north', 'south', 'east', 'west',
  'north east', 'north west', 'south east', 'south west',
];

/** List of supported anchor names. */
function anchors() {
  return ANCHOR_NAMES;
}

const rectangleShape = { savedGeometry, anchor, borderPoint, backgroundPath, anchors };
registerShape('rectangle', rectangleShape);
export default rectangleShape;
