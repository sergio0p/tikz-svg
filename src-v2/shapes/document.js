/**
 * Document shape — rectangle with wavy bottom edge.
 * Based on TikZ "tape" shape (pgflibraryshapes.symbols.code.tex lines 2115–2557).
 * Uses bottom bend only ("in and out" style) for the standard flowchart document icon.
 *
 * TikZ tape draws the wave as two quarter-ellipse arcs with:
 *   bendxradius = 0.707 * halfWidth (cos 45°)
 *   bendyradius = 3.414 * halfBendHeight (1/(1-sin 45°))
 * We approximate with cubic Bézier curves (SVG C command).
 */

import { createShape, polygonBorderPoint } from './shape.js';

/**
 * Generate cubic Bézier control points for the wavy bottom edge.
 * The wave is an S-curve: right half curves down, left half curves back up.
 */
function wavyBottomPath(cx, cy, hw, hh, bendH) {
  const k = 0.5522847; // cubic Bézier approximation of quarter circle

  // Right half: from bottom-right corner down to center trough
  const r1x = cx + hw,   r1y = cy + hh;
  const m1x = cx,         m1y = cy + hh + bendH;
  const c1x = r1x - hw * k, c1y = r1y;
  const c2x = m1x + hw * k, c2y = m1y;

  // Left half: from center trough back up to bottom-left corner
  const r2x = cx - hw,   r2y = cy + hh;
  const c3x = m1x - hw * k, c3y = m1y;
  const c4x = r2x + hw * k, c4y = r2y;

  return { r1x, r1y, c1x, c1y, c2x, c2y, m1x, m1y, c3x, c3y, c4x, c4y, r2x, r2y };
}

export default createShape('document', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, bendHeight = 5, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 30) + outerSep,
      halfHeight: (halfHeight ?? 20) + outerSep,
      bendHeight, outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh, bendHeight: bh } = geom;
    return {
      north:        { x: c.x, y: c.y - hh },
      south:        { x: c.x, y: c.y + hh + bh },
      east:         { x: c.x + hw, y: c.y },
      west:         { x: c.x - hw, y: c.y },
      'north east': { x: c.x + hw, y: c.y - hh },
      'north west': { x: c.x - hw, y: c.y - hh },
      'south east': { x: c.x + hw, y: c.y + hh },
      'south west': { x: c.x - hw, y: c.y + hh },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh, bendHeight: bh } = geom;
    // Approximate wavy bottom with sampled polygon points
    const steps = 8;
    const bottomPts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = c.x + hw - 2 * hw * t;
      const wave = bh * Math.sin(Math.PI * t);
      bottomPts.push({ x, y: c.y + hh + wave });
    }
    const verts = [
      { x: c.x - hw, y: c.y - hh },
      { x: c.x + hw, y: c.y - hh },
      ...bottomPts,
    ];
    return polygonBorderPoint(c, direction, verts);
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, bendHeight, outerSep } = geom;
    const hw = halfWidth - outerSep;
    const hh = halfHeight - outerSep;
    const bh = bendHeight;
    const w = wavyBottomPath(cx, cy, hw, hh, bh);
    return (
      `M ${cx - hw} ${cy - hh}` +
      ` L ${cx + hw} ${cy - hh}` +
      ` L ${w.r1x} ${w.r1y}` +
      ` C ${w.c1x} ${w.c1y} ${w.c2x} ${w.c2y} ${w.m1x} ${w.m1y}` +
      ` C ${w.c3x} ${w.c3y} ${w.c4x} ${w.c4y} ${w.r2x} ${w.r2y}` +
      ` Z`
    );
  },
});
