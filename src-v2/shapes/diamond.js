/**
 * Diamond shape — 4-sided rotated rectangle.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 234–342
 */

import { createShape, polygonBorderPoint } from './shape.js';

function diamondVertices(cx, cy, hw, hh) {
  return [
    { x: cx + hw, y: cy },     // east
    { x: cx,      y: cy - hh }, // north
    { x: cx - hw, y: cy },     // west
    { x: cx,      y: cy + hh }, // south
  ];
}

export default createShape('diamond', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 20) + outerSep,
      halfHeight: (halfHeight ?? 20) + outerSep,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    return {
      north:       { x: c.x,          y: c.y - hh },
      south:       { x: c.x,          y: c.y + hh },
      east:        { x: c.x + hw,     y: c.y },
      west:        { x: c.x - hw,     y: c.y },
      'north east': { x: c.x + hw / 2, y: c.y - hh / 2 },
      'north west': { x: c.x - hw / 2, y: c.y - hh / 2 },
      'south east': { x: c.x + hw / 2, y: c.y + hh / 2 },
      'south west': { x: c.x - hw / 2, y: c.y + hh / 2 },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    return polygonBorderPoint(c, direction, diamondVertices(c.x, c.y, hw, hh));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, outerSep } = geom;
    const s = outerSep * 1.414213;
    const hw = halfWidth - s;
    const hh = halfHeight - s;
    return `M ${cx + hw} ${cy} L ${cx} ${cy - hh} L ${cx - hw} ${cy} L ${cx} ${cy + hh} Z`;
  },
});
