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
 *
 * Outer sep (PGF pgfmoduleshapes.code.tex lines 938–1010):
 *   TikZ stores northeast/southwest with outer sep included.
 *   Anchors and borderPoint use the full dimensions (edges connect at outer boundary).
 *   backgroundPath uses visual dimensions (halfWidth/halfHeight - outerSep).
 */

import { vecFromAngle } from '../core/math.js';
import { registerShape } from './shape.js';

/**
 * Compute saved geometry from node configuration.
 * Stored halfWidth/halfHeight include outerSep, matching TikZ convention.
 * @param {Object} config - Must include `center`, `halfWidth`, `halfHeight`. Optional `outerSep`.
 * @returns {{ center, halfWidth: number, halfHeight: number, outerSep: number }}
 */
function savedGeometry(config) {
  const { center, halfWidth, halfHeight, outerSep = 0 } = config;
  return {
    center: { x: center.x, y: center.y },
    halfWidth: halfWidth + outerSep,
    halfHeight: halfHeight + outerSep,
    outerSep,
  };
}

/**
 * Resolve a named or numeric anchor to an absolute SVG point.
 * Uses full dimensions (includes outerSep).
 * @param {string} name
 * @param {Object} geom
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
 * Uses full dimensions (includes outerSep) — edges start here.
 *
 * PGF algorithm: mirror direction into first quadrant, test ray against
 * vertical and horizontal edges, pick closer intersection, mirror back.
 *
 * @param {Object} geom
 * @param {{ x: number, y: number }} direction
 * @returns {{ x: number, y: number }}
 */
function borderPoint(geom, direction) {
  const { center, halfWidth: hw, halfHeight: hh } = geom;
  const dx = direction.x;
  const dy = direction.y;

  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
    return { x: center.x, y: center.y };
  }

  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  let t;
  if (adx < 1e-10) {
    t = hh / ady;
  } else if (ady < 1e-10) {
    t = hw / adx;
  } else {
    const tVert = hw / adx;
    const tHoriz = hh / ady;
    t = Math.min(tVert, tHoriz);
  }

  return {
    x: center.x + dx * t,
    y: center.y + dy * t,
  };
}

/**
 * SVG path string for the rectangle background.
 * Uses visual dimensions (halfWidth/halfHeight - outerSep) — drawn rectangle
 * is smaller than the anchor boundary.
 * @param {Object} geom
 * @returns {string}
 */
function backgroundPath(geom) {
  const { center: { x: cx, y: cy }, halfWidth, halfHeight, outerSep } = geom;
  const hw = halfWidth - outerSep;
  const hh = halfHeight - outerSep;
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

function anchors() {
  return ANCHOR_NAMES;
}

const rectangleShape = { savedGeometry, anchor, borderPoint, backgroundPath, anchors };
registerShape('rectangle', rectangleShape);
export default rectangleShape;
