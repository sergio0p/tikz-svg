/**
 * Ellipse shape for the TikZ-SVG library.
 *
 * Coordinate conventions:
 *   - SVG y-down: "north" = negative y
 *   - TikZ angles: 0 = east, CCW positive
 *
 * borderPoint uses the parametric approach: given a direction (dx, dy),
 * compute the angle on the ellipse via atan2(dy * rx, dx * ry) and evaluate
 * the parametric ellipse at that angle.
 *
 * Outer sep: rx/ry include outerSep for anchors/borderPoint.
 * backgroundPath uses visual dimensions (rx/ry - outerSep).
 */

import { vecFromAngle } from '../core/math.js';
import { registerShape } from './shape.js';

/**
 * Compute saved geometry from node configuration.
 * Stored rx/ry include outerSep, matching TikZ convention.
 * @param {Object} config - Must include `center`, `rx`, `ry`. Optional `outerSep`.
 * @returns {{ center, rx: number, ry: number, outerSep: number }}
 */
function savedGeometry(config) {
  const { center, rx, ry, outerSep = 0 } = config;
  return {
    center: { x: center.x, y: center.y },
    rx: rx + outerSep,
    ry: ry + outerSep,
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
  const { center, rx, ry } = geom;

  switch (name) {
    case 'center':      return { x: center.x,      y: center.y };
    case 'east':        return { x: center.x + rx,  y: center.y };
    case 'west':        return { x: center.x - rx,  y: center.y };
    case 'north':       return { x: center.x,       y: center.y - ry };
    case 'south':       return { x: center.x,       y: center.y + ry };
    case 'north east':  return borderPoint(geom, { x:  Math.SQRT1_2, y: -Math.SQRT1_2 });
    case 'north west':  return borderPoint(geom, { x: -Math.SQRT1_2, y: -Math.SQRT1_2 });
    case 'south east':  return borderPoint(geom, { x:  Math.SQRT1_2, y:  Math.SQRT1_2 });
    case 'south west':  return borderPoint(geom, { x: -Math.SQRT1_2, y:  Math.SQRT1_2 });
    default: {
      const angle = parseFloat(name);
      if (!Number.isNaN(angle)) {
        const dir = vecFromAngle(angle);
        return borderPoint(geom, dir);
      }
      throw new Error(`ellipse.anchor: unknown anchor "${name}"`);
    }
  }
}

/**
 * Compute the point on the ellipse border in the given direction from center.
 * Uses full dimensions (includes outerSep) — edges start here.
 *
 * Given direction (dx, dy) the parametric angle on the ellipse is:
 *   theta = atan2(dy * rx, dx * ry)
 * and the border point is:
 *   (center.x + rx * cos(theta), center.y + ry * sin(theta))
 *
 * @param {Object} geom
 * @param {{ x: number, y: number }} direction
 * @returns {{ x: number, y: number }}
 */
function borderPoint(geom, direction) {
  const { center, rx, ry } = geom;
  const dx = direction.x;
  const dy = direction.y;

  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
    return { x: center.x, y: center.y };
  }

  const theta = Math.atan2(dy * rx, dx * ry);
  return {
    x: center.x + rx * Math.cos(theta),
    y: center.y + ry * Math.sin(theta),
  };
}

/**
 * SVG path string for the ellipse background.
 * Uses visual dimensions (rx/ry - outerSep) — drawn ellipse is smaller than anchor boundary.
 * @param {Object} geom
 * @returns {string}
 */
function backgroundPath(geom) {
  const { center: { x: cx, y: cy }, rx, ry, outerSep } = geom;
  const vrx = rx - outerSep;
  const vry = ry - outerSep;
  return (
    `M ${cx - vrx} ${cy}` +
    ` A ${vrx} ${vry} 0 1 0 ${cx + vrx} ${cy}` +
    ` A ${vrx} ${vry} 0 1 0 ${cx - vrx} ${cy}` +
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

const ellipseShape = { savedGeometry, anchor, borderPoint, backgroundPath, anchors };
registerShape('ellipse', ellipseShape);
export default ellipseShape;
