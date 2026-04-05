/**
 * Parallelogram shape — trapezium with fixed angles (leftAngle=120, rightAngle=60).
 * TikZ: \node[trapezium, trapezium left angle=120, trapezium right angle=60]
 */

import { createShape, polygonBorderPoint } from './shape.js';

const DEG2RAD = Math.PI / 180;
const LEFT_ANGLE = 120;
const RIGHT_ANGLE = 60;

function vertices(cx, cy, hw, hh) {
  const leftExt = hh / Math.tan(LEFT_ANGLE * DEG2RAD);
  const rightExt = hh / Math.tan(RIGHT_ANGLE * DEG2RAD);
  return [
    { x: cx - hw,             y: cy + hh },  // bottom left
    { x: cx - hw + leftExt,   y: cy - hh },  // top left
    { x: cx + hw - rightExt,  y: cy - hh },  // top right
    { x: cx + hw,             y: cy + hh },  // bottom right
  ];
}

export default createShape('parallelogram', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 25) + outerSep,
      halfHeight: (halfHeight ?? 15) + outerSep,
      leftAngle: LEFT_ANGLE, rightAngle: RIGHT_ANGLE, outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    const verts = vertices(c.x, c.y, hw, hh);
    return {
      north:        { x: c.x, y: c.y - hh },
      south:        { x: c.x, y: c.y + hh },
      east:         { x: c.x + hw, y: c.y },
      west:         { x: c.x - hw, y: c.y },
      'north east': verts[2], 'north west': verts[1],
      'south east': verts[3], 'south west': verts[0],
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    return polygonBorderPoint(c, direction, vertices(c.x, c.y, hw, hh));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, outerSep } = geom;
    const v = vertices(cx, cy, halfWidth - outerSep, halfHeight - outerSep);
    return `M ${v[0].x} ${v[0].y} L ${v[1].x} ${v[1].y} L ${v[2].x} ${v[2].y} L ${v[3].x} ${v[3].y} Z`;
  },
});
