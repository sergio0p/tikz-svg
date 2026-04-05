/**
 * Circle shape for the TikZ-SVG library.
 *
 * Coordinate conventions:
 *   - SVG y-down: "above" / "north" = negative y
 *   - TikZ angles: 0 = east, CCW positive
 *
 * Outer sep (PGF pgfmoduleshapes.code.tex lines 1249–1327):
 *   TikZ stores radius = visual_radius + outer_sep.
 *   Anchors and borderPoint use the full radius (edges start at outer boundary).
 *   backgroundPath uses visual_radius = radius - outer_sep (drawn circle is smaller).
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

const ANCHOR_NAMES = [...Object.keys(NAMED_ANCHORS), 'mid', 'base', 'mid east', 'mid west', 'base east', 'base west'];

/**
 * Compute saved geometry from node configuration.
 * The stored radius includes outerSep, matching TikZ convention.
 * @param {Object} config - Must include `center`, `radius`. Optional `outerSep`.
 * @returns {{ center, radius: number, outerSep: number }}
 */
function savedGeometry(config) {
  const { center, radius, outerSep = 0 } = config;
  return {
    center: { x: center.x, y: center.y },
    radius: radius + outerSep,
    outerSep,
  };
}

/**
 * Resolve a named or numeric anchor to an absolute SVG point.
 * Uses the full radius (includes outerSep).
 * @param {string} name
 * @param {Object} geom
 * @returns {{ x: number, y: number }}
 */
function anchor(name, geom) {
  const { center, radius } = geom;

  const dir = NAMED_ANCHORS[name];
  if (dir) {
    return vecAdd(center, vecScale(dir, radius));
  }

  if (name === 'mid' || name === 'base') return { x: center.x, y: center.y };
  if (name === 'mid east' || name === 'base east') return { x: center.x + radius, y: center.y };
  if (name === 'mid west' || name === 'base west') return { x: center.x - radius, y: center.y };

  const angle = parseFloat(name);
  if (!Number.isNaN(angle)) {
    return vecAdd(center, vecScale(vecFromAngle(angle), radius));
  }

  throw new Error(`circle.anchor: unknown anchor "${name}"`);
}

/**
 * Point on the circle border in the given direction from center.
 * Uses the full radius (includes outerSep) — edges start here.
 * @param {Object} geom
 * @param {{ x: number, y: number }} direction
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
 * Uses visual radius (radius - outerSep) — the drawn circle is smaller than the anchor boundary.
 * @param {Object} geom
 * @returns {string}
 */
function backgroundPath(geom) {
  const { center: { x: cx, y: cy }, radius, outerSep } = geom;
  const r = radius - outerSep;
  return (
    `M ${cx - r} ${cy}` +
    ` A ${r} ${r} 0 1 0 ${cx + r} ${cy}` +
    ` A ${r} ${r} 0 1 0 ${cx - r} ${cy}` +
    ` Z`
  );
}

function anchors() {
  return ANCHOR_NAMES;
}

const circleShape = { savedGeometry, anchor, borderPoint, backgroundPath, anchors };
registerShape('circle', circleShape);
export default circleShape;
