/**
 * Isosceles triangle shape — triangle with two equal sides, apex at top.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 1992–2361
 */

import { createShape, polygonBorderPoint } from './shape.js';

function triangleVertices(cx, cy, hw, hh) {
  return [
    { x: cx,      y: cy - hh },  // apex (north)
    { x: cx + hw, y: cy + hh },  // bottom right
    { x: cx - hw, y: cy + hh },  // bottom left
  ];
}

export default createShape('isosceles triangle', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 20) + outerSep, halfHeight: (halfHeight ?? 20) + outerSep,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    return {
      north:        { x: c.x, y: c.y - hh },
      south:        { x: c.x, y: c.y + hh },
      east:         { x: c.x + hw, y: c.y + hh },
      west:         { x: c.x - hw, y: c.y + hh },
      'north east':  { x: c.x + hw / 2, y: c.y },
      'north west':  { x: c.x - hw / 2, y: c.y },
      'south east':  { x: c.x + hw, y: c.y + hh },
      'south west':  { x: c.x - hw, y: c.y + hh },
      apex:          { x: c.x, y: c.y - hh },
      'left corner':  { x: c.x - hw, y: c.y + hh },
      'right corner': { x: c.x + hw, y: c.y + hh },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    return polygonBorderPoint(c, direction, triangleVertices(c.x, c.y, hw, hh));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, outerSep } = geom;
    const hw = halfWidth - outerSep, hh = halfHeight - outerSep;
    return `M ${cx} ${cy - hh} L ${cx + hw} ${cy + hh} L ${cx - hw} ${cy + hh} Z`;
  },
});
