/**
 * Diamond shape — 4-sided rotated rectangle.
 * PGF source: pgflibraryshapes.geometric.code.tex lines 234–342
 *
 * TikZ diamond sizing (with default aspect=1):
 *   xa = textHalfW + innerSep
 *   ya = textHalfH + innerSep
 *   halfW = xa + aspect * ya    (= xa + ya when aspect=1)
 *   halfH = aspect_inv * xa + ya (= xa + ya when aspect=1)
 *   halfW = max(halfW, minimumWidth/2)
 *   halfH = max(halfH, minimumHeight/2)
 *   halfW += outerSep
 *   halfH += outerSep
 *
 * The pipeline passes rx = textHalfW + innerSep (for diamond shapes,
 * without minimumWidth clamping). The diamond applies the aspect
 * transform and minimumWidth internally.
 */

import { createShape, polygonBorderPoint } from './shape.js';

function diamondVertices(cx, cy, hw, hh) {
  return [
    { x: cx + hw, y: cy },     // east
    { x: cx,      y: cy - hh }, // north
    { x: cx - hw, y: cy },     // west
    { x: cx,      y: cy + hh }, // south
  ];
}

export default createShape('diamond', {
  savedGeometry(config) {
    const {
      center,
      // rx/ry = textHalfW + innerSep (from pipeline, no minimumWidth)
      rx: xa, ry: ya,
      halfWidth: legacyHW, halfHeight: legacyHH,
      outerSep = 0,
      shapeAspect = 1,
      minimumWidth = 0,
      minimumHeight = 0,
    } = config;

    // Support both rx/ry (new pipeline path) and halfWidth/halfHeight (legacy)
    const textXA = xa ?? legacyHW ?? 20;
    const textYA = ya ?? legacyHH ?? 20;

    // TikZ diamond transform: halfW = xa + aspect * ya
    let hw = textXA + shapeAspect * textYA;
    let hh = (1 / shapeAspect) * textXA + textYA;

    // Clamp to minimum dimensions
    hw = Math.max(hw, minimumWidth / 2);
    hh = Math.max(hh, minimumHeight / 2);

    // Add outerSep
    hw += outerSep;
    hh += outerSep;

    return {
      center: { x: center.x, y: center.y },
      halfWidth: hw,
      halfHeight: hh,
      outerSep,
      // Preserve for emitter re-call
      rx: textXA,
      ry: textYA,
      shapeAspect,
      minimumWidth,
      minimumHeight,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    return {
      north:       { x: c.x,          y: c.y - hh },
      south:       { x: c.x,          y: c.y + hh },
      east:        { x: c.x + hw,     y: c.y },
      west:        { x: c.x - hw,     y: c.y },
      'north east': { x: c.x + hw / 2, y: c.y - hh / 2 },
      'north west': { x: c.x - hw / 2, y: c.y - hh / 2 },
      'south east': { x: c.x + hw / 2, y: c.y + hh / 2 },
      'south west': { x: c.x - hw / 2, y: c.y + hh / 2 },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    return polygonBorderPoint(c, direction, diamondVertices(c.x, c.y, hw, hh));
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, outerSep } = geom;
    const s = outerSep * 1.414213;
    const hw = halfWidth - s;
    const hh = halfHeight - s;
    return `M ${cx + hw} ${cy} L ${cx} ${cy - hh} L ${cx - hw} ${cy} L ${cx} ${cy + hh} Z`;
  },
});
