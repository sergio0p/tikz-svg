/**
 * Semicircle shape — half circle with flat chord at bottom.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 1525–1991
 *
 * Parameters: radius. Flat edge is at the bottom (south), arc at top.
 */

import { createShape } from './shape.js';
import { vecNormalize } from '../core/math.js';

const DEG2RAD = Math.PI / 180;

export default createShape('semicircle', {
  savedGeometry(config) {
    const { center, radius, outerSep = 0 } = config;
    const r = (radius ?? 20) + outerSep;
    return {
      center: { x: center.x, y: center.y },
      radius: r,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, radius: r } = geom;
    // Arc center is at center.y (the chord is at center.y, arc extends upward)
    return {
      north:       { x: c.x, y: c.y - r },           // top of arc
      south:       { x: c.x, y: c.y },                // center of chord
      east:        { x: c.x + r, y: c.y },            // right end of chord
      west:        { x: c.x - r, y: c.y },            // left end of chord
      'north east': { x: c.x + r * Math.SQRT1_2, y: c.y - r * Math.SQRT1_2 },
      'north west': { x: c.x - r * Math.SQRT1_2, y: c.y - r * Math.SQRT1_2 },
      'south east': { x: c.x + r, y: c.y },
      'south west': { x: c.x - r, y: c.y },
      'arc start':  { x: c.x + r, y: c.y },
      'arc end':    { x: c.x - r, y: c.y },
      apex:         { x: c.x, y: c.y - r },
      'chord center': { x: c.x, y: c.y },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, radius: r } = geom;
    const d = vecNormalize(direction);
    if (d.x === 0 && d.y === 0) return { x: c.x, y: c.y };

    // If direction points upward (into the arc), intersect with circle
    if (d.y <= 0) {
      return { x: c.x + d.x * r, y: c.y + d.y * r };
    }

    // Direction points downward — intersect with the flat chord (y = c.y)
    // But the chord only extends from -r to +r horizontally
    // Ray: (c.x + t*d.x, c.y + t*d.y) where c.y + t*d.y = c.y → t = 0
    // For downward direction, the border is the chord at y = c.y
    // Clamp x to the chord extent
    if (d.y > 0) {
      // The closest point on the chord in direction d
      // Actually: for a ray going down from center, it hits the chord immediately (t=0 = center)
      // We need to use the circle intersection even for downward-ish directions
      // if they point toward the arc portion. The chord is at y = center.y.
      // For directions that would exit through the flat bottom:
      const xAtChord = c.x; // ray at t=0 is at center
      // Use circle border and clamp y
      const circPt = { x: c.x + d.x * r, y: c.y + d.y * r };
      if (circPt.y <= c.y) return circPt;
      // Hit the chord: find t where y = c.y (that's t=0, which is center)
      // Actually, border for downward direction = the chord edge closest to the ray
      return { x: Math.max(c.x - r, Math.min(c.x + r, c.x + d.x * r)), y: c.y };
    }
    return { x: c.x + d.x * r, y: c.y + d.y * r };
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, radius, outerSep } = geom;
    const r = radius - outerSep;
    // Arc from east to west (180° arc above the chord)
    return (
      `M ${cx + r} ${cy}` +
      ` A ${r} ${r} 0 1 0 ${cx - r} ${cy}` +
      ` Z`
    );
  },
});
