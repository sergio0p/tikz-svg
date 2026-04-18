/**
 * Circle shape for the TikZ-SVG library.
 *
 * Coordinate conventions:
 *   - SVG y-down: "above" / "north" = negative y
 *   - TikZ angles: 0 = east, CCW positive
 */

import { vecFromAngle, vecScale, vecAdd, vecNormalize } from '../core/math.js';
import { registerShape } from './shape.js';

/** Named anchor offsets (unit vectors, SVG y-down). */
const NAMED_ANCHORS = {
  center:      { x:  0, y:  0 },
  east:        { x:  1, y:  0 },
  west:        { x: -1, y:  0 },
  north:       { x:  0, y: -1 },
  south:       { x:  0, y:  1 },
  'north east': { x:  Math.SQRT1_2, y: -Math.SQRT1_2 },
  'north west': { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  'south east': { x:  Math.SQRT1_2, y:  Math.SQRT1_2 },
  'south west': { x: -Math.SQRT1_2, y:  Math.SQRT1_2 },
};

const ANCHOR_NAMES = Object.keys(NAMED_ANCHORS);

/**
 * Compute saved geometry from node configuration.
 * @param {Object} config - Must include `center: { x, y }` and `radius: number`.
 * @returns {{ center: { x: number, y: number }, radius: number }}
 */
function savedGeometry(config) {
  const { center, radius } = config;
  return { center: { x: center.x, y: center.y }, radius };
}

/**
 * Resolve a named or numeric anchor to an absolute SVG point.
 * @param {string} name - Anchor name (e.g. 'north', 'center') or a numeric
 *   string interpreted as a TikZ angle in degrees.
 * @param {Object} geom - Saved geometry from `savedGeometry()`.
 * @returns {{ x: number, y: number }}
 */
function anchor(name, geom) {
  const { center, radius } = geom;

  // Named anchor
  const dir = NAMED_ANCHORS[name];
  if (dir) {
    return vecAdd(center, vecScale(dir, radius));
  }

  // Numeric angle (TikZ degrees)
  const angle = parseFloat(name);
  if (!Number.isNaN(angle)) {
    return vecAdd(center, vecScale(vecFromAngle(angle), radius));
  }

  throw new Error(`circle.anchor: unknown anchor "${name}"`);
}

/**
 * Point on the circle border in the direction of `direction` from center.
 * @param {Object} geom - Saved geometry.
 * @param {{ x: number, y: number }} direction - Direction vector (need not be
 *   unit length; will be normalised internally).
 * @returns {{ x: number, y: number }}
 */
function borderPoint(geom, direction) {
  const { center, radius } = geom;
  const unit = vecNormalize(direction);
  if (unit.x === 0 && unit.y === 0) return { x: center.x, y: center.y };
  return vecAdd(center, vecScale(unit, radius));
}

/**
 * SVG path string for the circle background.
 * Uses two arc commands to form a complete circle.
 * @param {Object} geom - Saved geometry.
 * @returns {string}
 */
function backgroundPath(geom) {
  const { center: { x: cx, y: cy }, radius: r } = geom;
  return (
    `M ${cx - r} ${cy}` +
    ` A ${r} ${r} 0 1 0 ${cx + r} ${cy}` +
    ` A ${r} ${r} 0 1 0 ${cx - r} ${cy}` +
    ` Z`
  );
}

/**
 * List of supported anchor names.
 * @returns {string[]}
 */
function anchors() {
  return ANCHOR_NAMES;
}

const circleShape = { savedGeometry, anchor, borderPoint, backgroundPath, anchors };
registerShape('circle', circleShape);
export default circleShape;
