/**
 * Trapezium shape — quadrilateral with slanted sides.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 947–1524
 */

import { createShape, polygonBorderPoint } from './shape.js';

const DEG2RAD = Math.PI / 180;

function trapeziumVertices(cx, cy, hw, hh, leftAngleDeg, rightAngleDeg) {
  const leftExt = hh / Math.tan(leftAngleDeg * DEG2RAD);
  const rightExt = hh / Math.tan(rightAngleDeg * DEG2RAD);
  return [
    { x: cx - hw,            y: cy + hh },  // bottom left
    { x: cx - hw + leftExt,  y: cy - hh },  // top left
    { x: cx + hw - rightExt, y: cy - hh },  // top right
    { x: cx + hw,            y: cy + hh },  // bottom right
  ];
}

export default createShape('trapezium', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, leftAngle = 75, rightAngle = 75, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 25) + outerSep, halfHeight: (halfHeight ?? 15) + outerSep,
      leftAngle, rightAngle, outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh, leftAngle, rightAngle } = geom;
    const verts = trapeziumVertices(c.x, c.y, hw, hh, leftAngle, rightAngle);
    // verts: [0]=bottom left, [1]=top left, [2]=top right, [3]=bottom right
    return {
      north:       { x: c.x, y: c.y - hh }, south: { x: c.x, y: c.y + hh },
      east:        { x: c.x + hw, y: c.y }, west:  { x: c.x - hw, y: c.y },
      'north east': verts[2], 'north west': verts[1],
      'south east': verts[3], 'south west': verts[0],
      'bottom left corner': verts[0], 'top left corner': verts[1],
      'top right corner': verts[2], 'bottom right corner': verts[3],
      'left side':   { x: (verts[0].x + verts[1].x) / 2, y: (verts[0].y + verts[1].y) / 2 },
      'right side':  { x: (verts[2].x + verts[3].x) / 2, y: (verts[2].y + verts[3].y) / 2 },
      'top side':    { x: (verts[1].x + verts[2].x) / 2, y: (verts[1].y + verts[2].y) / 2 },
      'bottom side': { x: (verts[0].x + verts[3].x) / 2, y: (verts[0].y + verts[3].y) / 2 },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh, leftAngle, rightAngle } = geom;
    return polygonBorderPoint(c, direction, trapeziumVertices(c.x, c.y, hw, hh, leftAngle, rightAngle));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, leftAngle, rightAngle, outerSep } = geom;
    const v = trapeziumVertices(cx, cy, halfWidth - outerSep, halfHeight - outerSep, leftAngle, rightAngle);
    return `M ${v[0].x} ${v[0].y} L ${v[1].x} ${v[1].y} L ${v[2].x} ${v[2].y} L ${v[3].x} ${v[3].y} Z`;
  },
});
