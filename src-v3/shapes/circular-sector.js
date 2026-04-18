/**
 * Circular sector (pie slice) shape.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 3550–4034
 *
 * Parameters: radius, sectorAngle (default 60°).
 * The sector opens upward (north) with the point at the center.
 */

import { createShape } from './shape.js';
import { vecNormalize } from '../core/math.js';

const DEG2RAD = Math.PI / 180;

export default createShape('circular sector', {
  savedGeometry(config) {
    const { center, radius, sectorAngle = 60, outerSep = 0 } = config;
    const r = (radius ?? 20) + outerSep;
    return {
      center: { x: center.x, y: center.y },
      radius: r,
      sectorAngle,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, radius: r, sectorAngle } = geom;
    const half = sectorAngle / 2;
    // Sector point (apex) at center, arc extends upward
    // Arc start at 90-half degrees, arc end at 90+half degrees (TikZ convention)
    const startRad = (90 - half) * DEG2RAD;
    const endRad = (90 + half) * DEG2RAD;
    return {
      north:       { x: c.x, y: c.y - r },
      south:       { x: c.x, y: c.y },
      east:        { x: c.x + r * Math.cos(startRad), y: c.y - r * Math.sin(startRad) },
      west:        { x: c.x + r * Math.cos(endRad),   y: c.y - r * Math.sin(endRad) },
      'north east': { x: c.x + r * Math.SQRT1_2, y: c.y - r * Math.SQRT1_2 },
      'north west': { x: c.x - r * Math.SQRT1_2, y: c.y - r * Math.SQRT1_2 },
      'south east': { x: c.x + r / 2, y: c.y },
      'south west': { x: c.x - r / 2, y: c.y },
      'arc start':  { x: c.x + r * Math.cos(startRad), y: c.y - r * Math.sin(startRad) },
      'arc end':    { x: c.x + r * Math.cos(endRad),   y: c.y - r * Math.sin(endRad) },
      'shape center': { x: c.x, y: c.y },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, radius: r, sectorAngle } = geom;
    const d = vecNormalize(direction);
    if (d.x === 0 && d.y === 0) return { x: c.x, y: c.y };

    const half = sectorAngle / 2;
    const startRad = (90 - half) * DEG2RAD;
    const endRad = (90 + half) * DEG2RAD;

    // Sector vertices: center, arc-start, arc-end
    const arcStart = { x: c.x + r * Math.cos(startRad), y: c.y - r * Math.sin(startRad) };
    const arcEnd   = { x: c.x + r * Math.cos(endRad),   y: c.y - r * Math.sin(endRad) };

    // Check intersection with the two radial edges (center→arcStart, center→arcEnd)
    // and with the arc
    const rayAngle = Math.atan2(-d.y, d.x); // TikZ convention (negate y)
    const rayAngleDeg = rayAngle / DEG2RAD;
    const normAngle = ((rayAngleDeg % 360) + 360) % 360;

    // Is the ray within the arc's angular range?
    const arcStartDeg = ((90 - half) % 360 + 360) % 360;
    const arcEndDeg = ((90 + half) % 360 + 360) % 360;

    // Simple approach: try ray-segment for each edge, and ray-circle for the arc
    // Use the closest positive intersection

    // Ray-circle intersection
    const circT = r; // distance from center to circle in direction d
    const circPt = { x: c.x + d.x * r, y: c.y + d.y * r };

    // Check if circPt is within the arc angular range
    const ptAngle = Math.atan2(-(circPt.y - c.y), circPt.x - c.x);
    const ptDeg = ((ptAngle / DEG2RAD) % 360 + 360) % 360;

    // Check if angle is within sector (simplified — works for sectors < 180°)
    const lo = Math.min(arcStartDeg, arcEndDeg);
    const hi = Math.max(arcStartDeg, arcEndDeg);
    if (ptDeg >= lo && ptDeg <= hi) return circPt;

    // Otherwise intersect with the two radial edges
    const edges = [
      [c, arcStart],
      [c, arcEnd],
    ];
    let bestT = Infinity;
    let bestPt = circPt;

    for (const [a, b] of edges) {
      const ex = b.x - a.x, ey = b.y - a.y;
      const fx = a.x - c.x, fy = a.y - c.y;
      const denom = d.x * ey - d.y * ex;
      if (Math.abs(denom) < 1e-10) continue;
      const t = (ex * fy - ey * fx) / denom;
      const u = (d.x * fy - d.y * fx) / denom;
      if (t > 0 && u >= 0 && u <= 1 && t < bestT) {
        bestT = t;
        bestPt = { x: c.x + d.x * t, y: c.y + d.y * t };
      }
    }
    return bestPt;
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, radius, sectorAngle, outerSep } = geom;
    const r = radius - outerSep;
    const half = sectorAngle / 2;
    const startRad = (90 - half) * DEG2RAD;
    const endRad = (90 + half) * DEG2RAD;
    const sx = cx + r * Math.cos(startRad);
    const sy = cy - r * Math.sin(startRad);
    const ex = cx + r * Math.cos(endRad);
    const ey = cy - r * Math.sin(endRad);
    const largeArc = sectorAngle > 180 ? 1 : 0;
    return (
      `M ${cx} ${cy}` +
      ` L ${sx} ${sy}` +
      ` A ${r} ${r} 0 ${largeArc} 0 ${ex} ${ey}` +
      ` Z`
    );
  },
});
