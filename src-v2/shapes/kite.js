/**
 * Kite shape — quadrilateral with two pairs of adjacent equal sides.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 2362–3005
 */

import { createShape, polygonBorderPoint } from './shape.js';

function kiteVertices(cx, cy, hw, uh, lh) {
  return [
    { x: cx,      y: cy - uh },  // top
    { x: cx + hw, y: cy },       // right
    { x: cx,      y: cy + lh },  // bottom
    { x: cx - hw, y: cy },       // left
  ];
}

export default createShape('kite', {
  savedGeometry(config) {
    const { center, halfWidth, upperHeight, lowerHeight, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 15) + outerSep,
      upperHeight: (upperHeight ?? 20) + outerSep,
      lowerHeight: (lowerHeight ?? 20) + outerSep,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, upperHeight: uh, lowerHeight: lh } = geom;
    return {
      north:       { x: c.x, y: c.y - uh }, south: { x: c.x, y: c.y + lh },
      east:        { x: c.x + hw, y: c.y }, west:  { x: c.x - hw, y: c.y },
      'north east': { x: c.x + hw / 2, y: c.y - uh / 2 },
      'north west': { x: c.x - hw / 2, y: c.y - uh / 2 },
      'south east': { x: c.x + hw / 2, y: c.y + lh / 2 },
      'south west': { x: c.x - hw / 2, y: c.y + lh / 2 },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, upperHeight: uh, lowerHeight: lh } = geom;
    return polygonBorderPoint(c, direction, kiteVertices(c.x, c.y, hw, uh, lh));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, upperHeight, lowerHeight, outerSep } = geom;
    const v = kiteVertices(cx, cy, halfWidth - outerSep, upperHeight - outerSep, lowerHeight - outerSep);
    return `M ${v[0].x} ${v[0].y} L ${v[1].x} ${v[1].y} L ${v[2].x} ${v[2].y} L ${v[3].x} ${v[3].y} Z`;
  },
});
