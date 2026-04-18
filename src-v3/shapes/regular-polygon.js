/**
 * Regular polygon shape — N-sided convex polygon.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 685–946
 */

import { createShape, polygonBorderPoint } from './shape.js';

const DEG2RAD = Math.PI / 180;

function polygonVertices(cx, cy, radius, sides, startAngleDeg) {
  const verts = [];
  const step = 360 / sides;
  for (let i = 0; i < sides; i++) {
    const rad = (startAngleDeg + i * step) * DEG2RAD;
    verts.push({ x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) });
  }
  return verts;
}

export default createShape('regular polygon', {
  savedGeometry(config) {
    const { center, radius, sides = 5, outerSep = 0 } = config;
    const r = (radius ?? 20) + outerSep;
    const startAngle = sides % 2 === 1 ? 90 : 90 + 180 / sides;
    return { center: { x: center.x, y: center.y }, radius: r, sides, startAngle, outerSep };
  },

  namedAnchors(geom) {
    const { center: c, radius: r } = geom;
    return {
      north:       { x: c.x, y: c.y - r }, south: { x: c.x, y: c.y + r },
      east:        { x: c.x + r, y: c.y }, west:  { x: c.x - r, y: c.y },
      'north east': { x: c.x + r * Math.SQRT1_2, y: c.y - r * Math.SQRT1_2 },
      'north west': { x: c.x - r * Math.SQRT1_2, y: c.y - r * Math.SQRT1_2 },
      'south east': { x: c.x + r * Math.SQRT1_2, y: c.y + r * Math.SQRT1_2 },
      'south west': { x: c.x - r * Math.SQRT1_2, y: c.y + r * Math.SQRT1_2 },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, radius, sides, startAngle } = geom;
    return polygonBorderPoint(c, direction, polygonVertices(c.x, c.y, radius, sides, startAngle));
  },

  dynamicAnchor(name, geom) {
    const { center: c, radius, sides, startAngle } = geom;
    const step = 360 / sides;

    const cornerMatch = name.match(/^corner (\d+)$/);
    if (cornerMatch) {
      const n = parseInt(cornerMatch[1], 10);
      if (n < 1 || n > sides) return null;
      const rad = (startAngle + (n - 1) * step) * DEG2RAD;
      return {
        x: c.x + radius * Math.cos(rad),
        y: c.y - radius * Math.sin(rad),
      };
    }

    const sideMatch = name.match(/^side (\d+)$/);
    if (sideMatch) {
      const n = parseInt(sideMatch[1], 10);
      if (n < 1 || n > sides) return null;
      const rad1 = (startAngle + (n - 1) * step) * DEG2RAD;
      const rad2 = (startAngle + n * step) * DEG2RAD;
      return {
        x: c.x + radius * (Math.cos(rad1) + Math.cos(rad2)) / 2,
        y: c.y - radius * (Math.sin(rad1) + Math.sin(rad2)) / 2,
      };
    }

    return null;
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, radius, sides, startAngle, outerSep } = geom;
    const verts = polygonVertices(cx, cy, radius - outerSep, sides, startAngle);
    let d = `M ${verts[0].x} ${verts[0].y}`;
    for (let i = 1; i < verts.length; i++) d += ` L ${verts[i].x} ${verts[i].y}`;
    return d + ' Z';
  },
});
