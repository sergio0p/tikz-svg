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
    const verts = kiteVertices(c.x, c.y, hw, uh, lh);
    // verts: [0]=top, [1]=right, [2]=bottom, [3]=left
    return {
      north:       { x: c.x, y: c.y - uh }, south: { x: c.x, y: c.y + lh },
      east:        { x: c.x + hw, y: c.y }, west:  { x: c.x - hw, y: c.y },
      'north east': { x: c.x + hw / 2, y: c.y - uh / 2 },
      'north west': { x: c.x - hw / 2, y: c.y - uh / 2 },
      'south east': { x: c.x + hw / 2, y: c.y + lh / 2 },
      'south west': { x: c.x - hw / 2, y: c.y + lh / 2 },
      'upper vertex': verts[0], 'lower vertex': verts[2],
      'left vertex': verts[3], 'right vertex': verts[1],
      'upper left side':  { x: (verts[0].x + verts[3].x) / 2, y: (verts[0].y + verts[3].y) / 2 },
      'upper right side': { x: (verts[0].x + verts[1].x) / 2, y: (verts[0].y + verts[1].y) / 2 },
      'lower left side':  { x: (verts[2].x + verts[3].x) / 2, y: (verts[2].y + verts[3].y) / 2 },
      'lower right side': { x: (verts[2].x + verts[1].x) / 2, y: (verts[2].y + verts[1].y) / 2 },
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
