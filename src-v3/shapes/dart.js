/**
 * Dart shape — arrowhead-like concave quadrilateral.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 3006–3549
 */

import { createShape, polygonBorderPoint } from './shape.js';

function dartVertices(cx, cy, hw, tl, ti) {
  return [
    { x: cx + tl, y: cy },       // tip (east)
    { x: cx,      y: cy - hw },  // upper
    { x: cx - ti, y: cy },       // tail center (indented)
    { x: cx,      y: cy + hw },  // lower
  ];
}

export default createShape('dart', {
  savedGeometry(config) {
    const { center, halfWidth, tipLength, tailIndent, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 10) + outerSep,
      tipLength: (tipLength ?? 25) + outerSep,
      tailIndent: (tailIndent ?? 5) + outerSep,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, tipLength: tl, tailIndent: ti } = geom;
    return {
      north:       { x: c.x, y: c.y - hw }, south: { x: c.x, y: c.y + hw },
      east:        { x: c.x + tl, y: c.y }, west:  { x: c.x - ti, y: c.y },
      'north east': { x: c.x + tl / 2, y: c.y - hw / 2 },
      'north west': { x: c.x - ti, y: c.y - hw },
      'south east': { x: c.x + tl / 2, y: c.y + hw / 2 },
      'south west': { x: c.x - ti, y: c.y + hw },
      tip:          { x: c.x + tl, y: c.y },
      'tail center': { x: c.x - ti, y: c.y },
      'left tail':   { x: c.x, y: c.y - hw },
      'right tail':  { x: c.x, y: c.y + hw },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, tipLength: tl, tailIndent: ti } = geom;
    return polygonBorderPoint(c, direction, dartVertices(c.x, c.y, hw, tl, ti));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, tipLength, tailIndent, outerSep } = geom;
    const v = dartVertices(cx, cy, halfWidth - outerSep, tipLength - outerSep, tailIndent - outerSep);
    return `M ${v[0].x} ${v[0].y} L ${v[1].x} ${v[1].y} L ${v[2].x} ${v[2].y} L ${v[3].x} ${v[3].y} Z`;
  },
});
