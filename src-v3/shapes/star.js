/**
 * Star shape — N-pointed star with inner and outer radii.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 378–684
 */

import { createShape, polygonBorderPoint } from './shape.js';

const DEG2RAD = Math.PI / 180;

function starVertices(cx, cy, outerR, innerR, points, startAngleDeg) {
  const verts = [];
  const step = 180 / points;
  for (let i = 0; i < 2 * points; i++) {
    const angleDeg = startAngleDeg + i * step;
    const r = i % 2 === 0 ? outerR : innerR;
    const rad = angleDeg * DEG2RAD;
    verts.push({ x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) });
  }
  return verts;
}

export default createShape('star', {
  savedGeometry(config) {
    const { center, outerRadius, innerRadius, pointRatio = 1.5, starPoints = 5, outerSep = 0 } = config;
    const oR = (outerRadius ?? 20) + outerSep;
    const iR = innerRadius != null ? innerRadius + outerSep : oR / pointRatio;
    return {
      center: { x: center.x, y: center.y },
      outerRadius: oR, innerRadius: iR, starPoints,
      startAngle: 90, outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, outerRadius: oR } = geom;
    return {
      north:       { x: c.x,      y: c.y - oR },
      south:       { x: c.x,      y: c.y + oR },
      east:        { x: c.x + oR, y: c.y },
      west:        { x: c.x - oR, y: c.y },
      'north east': { x: c.x + oR * Math.SQRT1_2, y: c.y - oR * Math.SQRT1_2 },
      'north west': { x: c.x - oR * Math.SQRT1_2, y: c.y - oR * Math.SQRT1_2 },
      'south east': { x: c.x + oR * Math.SQRT1_2, y: c.y + oR * Math.SQRT1_2 },
      'south west': { x: c.x - oR * Math.SQRT1_2, y: c.y + oR * Math.SQRT1_2 },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, outerRadius, innerRadius, starPoints, startAngle } = geom;
    return polygonBorderPoint(c, direction,
      starVertices(c.x, c.y, outerRadius, innerRadius, starPoints, startAngle));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, outerRadius, innerRadius, starPoints, startAngle, outerSep } = geom;
    const verts = starVertices(cx, cy, outerRadius - outerSep, innerRadius - outerSep, starPoints, startAngle);
    if (verts.length === 0) return '';
    let d = `M ${verts[0].x} ${verts[0].y}`;
    for (let i = 1; i < verts.length; i++) d += ` L ${verts[i].x} ${verts[i].y}`;
    return d + ' Z';
  },
});
