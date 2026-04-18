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
 */

import { vecFromAngle } from '../core/math.js';
import { registerShape } from './shape.js';

/**
 * Compute saved geometry from node configuration.
 * @param {Object} config - Must include `center: { x, y }`,
 *   `rx: number` (horizontal semi-axis), and `ry: number` (vertical semi-axis).
 * @returns {{ center: { x: number, y: number }, rx: number, ry: number }}
 */
function savedGeometry(config) {
  const { center, rx, ry } = config;
  return {
    center: { x: center.x, y: center.y },
    rx,
    ry,
  };
}

/**
 * Resolve a named or numeric anchor to an absolute SVG point.
 * @param {string} name - Anchor name or TikZ angle in degrees.
 * @param {Object} geom - Saved geometry.
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
      // Numeric angle
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
 *
 * Given direction (dx, dy) the parametric angle on the ellipse is:
 *   theta = atan2(dy * rx, dx * ry)
 * and the border point is:
 *   (center.x + rx * cos(theta), center.y + ry * sin(theta))
 *
 * @param {Object} geom - Saved geometry.
 * @param {{ x: number, y: number }} direction - Direction vector (any length).
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
 * Uses two arc commands to form a complete ellipse.
 * @param {Object} geom - Saved geometry.
 * @returns {string}
 */
function backgroundPath(geom) {
  const { center: { x: cx, y: cy }, rx, ry } = geom;
  return (
    `M ${cx - rx} ${cy}` +
    ` A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy}` +
    ` A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}` +
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

const ellipseShape = { savedGeometry, anchor, borderPoint, backgroundPath, anchors };
registerShape('ellipse', ellipseShape);
export default ellipseShape;
