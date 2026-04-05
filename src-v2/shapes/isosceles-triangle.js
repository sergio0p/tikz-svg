/**
 * Isosceles triangle shape — apex pointing right (matching TikZ default).
 * PGF source: pgflibraryshapes.geometric.code.tex lines 1992–2361
 *
 * In PGF local coords the apex is at (+x, 0) and the base is vertical,
 * so the default orientation has the apex pointing east (right).
 *
 * minimumWidth  → base width (vertical extent)
 * minimumHeight → base-to-apex distance (horizontal extent)
 */

import { createShape, polygonBorderPoint } from './shape.js';

function triangleVertices(cx, cy, hw, hh) {
  // hw = half base width (vertical), hh = half height base-to-apex (horizontal)
  return [
    { x: cx + hh, y: cy },        // apex (right)
    { x: cx - hh, y: cy + hw },   // base bottom (SVG y-down)
    { x: cx - hh, y: cy - hw },   // base top
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
      north:         { x: c.x, y: c.y - hw },
      south:         { x: c.x, y: c.y + hw },
      east:          { x: c.x + hh, y: c.y },
      west:          { x: c.x - hh, y: c.y },
      'north east':  { x: c.x + hh / 2, y: c.y - hw / 2 },
      'north west':  { x: c.x - hh, y: c.y - hw },
      'south east':  { x: c.x + hh / 2, y: c.y + hw / 2 },
      'south west':  { x: c.x - hh, y: c.y + hw },
      apex:          { x: c.x + hh, y: c.y },
      'left corner':  { x: c.x - hh, y: c.y - hw },
      'right corner': { x: c.x - hh, y: c.y + hw },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    return polygonBorderPoint(c, direction, triangleVertices(c.x, c.y, hw, hh));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, outerSep } = geom;
    const hw = halfWidth - outerSep, hh = halfHeight - outerSep;
    return `M ${cx + hh} ${cy} L ${cx - hh} ${cy + hw} L ${cx - hh} ${cy - hw} Z`;
  },
});
