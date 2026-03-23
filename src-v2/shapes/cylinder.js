/**
 * Cylinder shape — 3D projection with elliptical top/bottom.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 4035–end
 *
 * Parameters: halfWidth, halfHeight, aspectRatio (controls ellipse ry).
 * Drawn as: top ellipse + vertical sides + bottom arc.
 */

import { createShape } from './shape.js';
import { vecNormalize } from '../core/math.js';

export default createShape('cylinder', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, aspect = 0.25, outerSep = 0 } = config;
    const hw = (halfWidth ?? 20) + outerSep;
    const hh = (halfHeight ?? 30) + outerSep;
    // Ellipse vertical radius is aspect × halfWidth
    const ery = hw * aspect;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: hw,
      halfHeight: hh,
      ellipseRy: ery,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh, ellipseRy: ery } = geom;
    return {
      north:       { x: c.x, y: c.y - hh },
      south:       { x: c.x, y: c.y + hh },
      east:        { x: c.x + hw, y: c.y },
      west:        { x: c.x - hw, y: c.y },
      'north east': { x: c.x + hw, y: c.y - hh + ery },
      'north west': { x: c.x - hw, y: c.y - hh + ery },
      'south east': { x: c.x + hw, y: c.y + hh - ery },
      'south west': { x: c.x - hw, y: c.y + hh - ery },
      'before top': { x: c.x + hw, y: c.y - hh + ery },
      'after top':  { x: c.x - hw, y: c.y - hh + ery },
      'before bottom': { x: c.x + hw, y: c.y + hh - ery },
      'after bottom':  { x: c.x - hw, y: c.y + hh - ery },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    const d = vecNormalize(direction);
    if (d.x === 0 && d.y === 0) return { x: c.x, y: c.y };

    // Simplified: treat as a rectangle for border point computation
    const adx = Math.abs(d.x);
    const ady = Math.abs(d.y);
    let t;
    if (adx < 1e-10) {
      t = hh / ady;
    } else if (ady < 1e-10) {
      t = hw / adx;
    } else {
      t = Math.min(hw / adx, hh / ady);
    }
    return { x: c.x + d.x * t, y: c.y + d.y * t };
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, ellipseRy, outerSep } = geom;
    const hw = halfWidth - outerSep;
    const hh = halfHeight - outerSep;
    const ery = ellipseRy - outerSep * 0.25; // scale with aspect
    const topY = cy - hh + ery;   // center of top ellipse
    const botY = cy + hh - ery;   // center of bottom ellipse

    // Top ellipse (full), right side, bottom arc (visible half), left side
    return (
      // Top ellipse
      `M ${cx + hw} ${topY}` +
      ` A ${hw} ${ery} 0 1 0 ${cx - hw} ${topY}` +
      ` A ${hw} ${ery} 0 1 0 ${cx + hw} ${topY}` +
      // Right side down
      ` L ${cx + hw} ${botY}` +
      // Bottom arc (front half only)
      ` A ${hw} ${ery} 0 0 0 ${cx - hw} ${botY}` +
      // Left side up
      ` L ${cx - hw} ${topY}`
    );
  },
});
