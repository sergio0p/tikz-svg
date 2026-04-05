/**
 * Preparation shape — horizontally-elongated hexagon (ISO 5807 flowchart symbol).
 * A rectangle with pointed left and right ends.
 *
 * 6 vertices:
 *        NW ─────── NE
 *       /               \
 *   W                     E
 *       \               /
 *        SW ─────── SE
 *
 * pointWidth controls how far the east/west points extend inward from the
 * rectangle edge. Default: halfHeight (45° angles).
 */

import { createShape, polygonBorderPoint } from './shape.js';

function hexVertices(cx, cy, hw, hh, pw) {
  return [
    { x: cx - hw,      y: cy },      // W (left point)
    { x: cx - hw + pw, y: cy - hh }, // NW
    { x: cx + hw - pw, y: cy - hh }, // NE
    { x: cx + hw,      y: cy },      // E (right point)
    { x: cx + hw - pw, y: cy + hh }, // SE
    { x: cx - hw + pw, y: cy + hh }, // SW
  ];
}

export default createShape('preparation', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, pointWidth, outerSep = 0 } = config;
    const hw = (halfWidth ?? 35) + outerSep;
    const hh = (halfHeight ?? 15) + outerSep;
    const pw = pointWidth ?? hh;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: hw, halfHeight: hh, pointWidth: pw, outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh, pointWidth: pw } = geom;
    const verts = hexVertices(c.x, c.y, hw, hh, pw);
    return {
      north:        { x: c.x, y: c.y - hh },
      south:        { x: c.x, y: c.y + hh },
      east:         verts[3],
      west:         verts[0],
      'north east': verts[2],
      'north west': verts[1],
      'south east': verts[4],
      'south west': verts[5],
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh, pointWidth: pw } = geom;
    return polygonBorderPoint(c, direction, hexVertices(c.x, c.y, hw, hh, pw));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, pointWidth, outerSep } = geom;
    const v = hexVertices(cx, cy, halfWidth - outerSep, halfHeight - outerSep, pointWidth);
    return `M ${v[0].x} ${v[0].y} L ${v[1].x} ${v[1].y} L ${v[2].x} ${v[2].y} L ${v[3].x} ${v[3].y} L ${v[4].x} ${v[4].y} L ${v[5].x} ${v[5].y} Z`;
  },
});
