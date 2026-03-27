/**
 * Circle split enhanced shape — circle divided into N horizontal parts.
 * PGF source: tex/pgflibraryshapes.multipart.enhanced.code.tex
 *
 * Parameters:
 *   - parts (default 2): number of horizontal divisions (1–4)
 *   - drawSplits (default true): whether to draw chord lines between parts
 *   - radius: circle radius
 *   - partAlign: 'left' | 'center' (default) | 'right'
 *
 * Each part is separated by a horizontal chord line.
 * Per-part anchors: 'one'/'text', 'two'/'lower', 'three', 'four'.
 *
 * Matches TikZ circle split / circle split enhanced behavior:
 *   - For N=2: chord at y=0 (diameter), matching TikZ circle split exactly
 *   - For N=3,4: chords divide circle into equal-area horizontal bands
 */

import { createShape } from './shape.js';
import { vecNormalize } from '../core/math.js';

const PART_NAMES = ['one', 'two', 'three', 'four'];

/**
 * Compute Y positions of chord lines that divide a circle into N equal-area bands.
 * Returns array of N-1 normalized offsets in [-1, 1] (SVG y-down: negative = above center).
 *
 * For N=2: chord at 0 (diameter), matching TikZ circle split.
 * For N=3,4: solve for equal areas using the circular segment area formula.
 *
 * Area from bottom (u=-1) to height u:
 *   A(u) = r^2 * (pi - arccos(u) + u*sqrt(1-u^2))
 * ranges from 0 (u=-1) to pi*r^2 (u=1).
 * We solve A(u) = k * pi * r^2 / N for k=1..N-1.
 */
function computeChordOffsets(parts) {
  if (parts <= 1) return [];
  if (parts === 2) return [0];

  const offsets = [];
  for (let k = 1; k < parts; k++) {
    const target = k * Math.PI / parts;
    let lo = -1, hi = 1;
    for (let iter = 0; iter < 60; iter++) {
      const mid = (lo + hi) / 2;
      const f = Math.PI - Math.acos(mid) + mid * Math.sqrt(1 - mid * mid);
      if (f < target) lo = mid;
      else hi = mid;
    }
    // Negate: SVG y-down means upper part has negative y
    offsets.push(-((lo + hi) / 2));
  }
  // Sort top-to-bottom (most negative first) — area formula counts from bottom
  offsets.sort((a, b) => a - b);
  return offsets;
}

/**
 * Chord half-width at normalized offset u from center: sqrt(1 - u^2), scaled by radius.
 */
function chordHalfWidth(r, yOffset) {
  const u = yOffset / r;
  const val = 1 - u * u;
  return val > 0 ? r * Math.sqrt(val) : 0;
}

export default createShape('circle split', {
  savedGeometry(config) {
    const { center, radius = 20, parts = 2, drawSplits = true, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      radius: radius + outerSep,
      parts: Math.max(1, Math.min(4, parts)),
      drawSplits,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, radius: r, parts } = geom;
    const chordUs = computeChordOffsets(parts);

    // Compass anchors on the circle boundary
    const anchors = {
      north:        { x: c.x,                       y: c.y - r },
      south:        { x: c.x,                       y: c.y + r },
      east:         { x: c.x + r,                   y: c.y },
      west:         { x: c.x - r,                   y: c.y },
      'north east': { x: c.x + r * Math.SQRT1_2,   y: c.y - r * Math.SQRT1_2 },
      'north west': { x: c.x - r * Math.SQRT1_2,   y: c.y - r * Math.SQRT1_2 },
      'south east': { x: c.x + r * Math.SQRT1_2,   y: c.y + r * Math.SQRT1_2 },
      'south west': { x: c.x - r * Math.SQRT1_2,   y: c.y + r * Math.SQRT1_2 },
    };

    // Per-part anchors: center of each band
    const chordYs = chordUs.map(u => u * r);
    const boundaries = [-r, ...chordYs, r];
    for (let i = 0; i < parts && i < PART_NAMES.length; i++) {
      const bandCenter = (boundaries[i] + boundaries[i + 1]) / 2;
      anchors[PART_NAMES[i]] = { x: c.x, y: c.y + bandCenter };
    }

    // Aliases: text→one, lower→two
    if (anchors.one) anchors.text = { ...anchors.one };
    if (anchors.two) anchors.lower = { ...anchors.two };

    // Split anchors (on the chord lines)
    for (let i = 0; i < chordYs.length; i++) {
      const cy = chordYs[i];
      const hw = chordHalfWidth(r, cy);
      const name = PART_NAMES[i] + ' split';
      anchors[name]            = { x: c.x,      y: c.y + cy };
      anchors[name + ' east']  = { x: c.x + hw, y: c.y + cy };
      anchors[name + ' west']  = { x: c.x - hw, y: c.y + cy };
    }

    return anchors;
  },

  borderPoint(geom, direction) {
    const { center, radius } = geom;
    const unit = vecNormalize(direction);
    if (unit.x === 0 && unit.y === 0) return { x: center.x, y: center.y };
    return { x: center.x + unit.x * radius, y: center.y + unit.y * radius };
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, radius, parts, drawSplits, outerSep } = geom;
    const r = radius - outerSep;

    // Circle outline
    let d = `M ${cx - r} ${cy}` +
            ` A ${r} ${r} 0 1 0 ${cx + r} ${cy}` +
            ` A ${r} ${r} 0 1 0 ${cx - r} ${cy}` +
            ` Z`;

    // Chord lines
    if (drawSplits && parts > 1) {
      const chordYs = computeChordOffsets(parts).map(u => u * r);
      for (const chordY of chordYs) {
        const hw = chordHalfWidth(r, chordY);
        d += ` M ${cx - hw} ${cy + chordY} L ${cx + hw} ${cy + chordY}`;
      }
    }

    return d;
  },

  /**
   * Return per-part regions for fill and label placement.
   * clipRect covers each horizontal band; the emitter clips to the circle outline.
   */
  partRegions(geom) {
    const { center: c, radius, parts, outerSep } = geom;
    const r = radius - outerSep;
    const chordYs = computeChordOffsets(parts).map(u => u * r);
    const boundaries = [-r, ...chordYs, r];
    const regions = [];

    for (let i = 0; i < parts; i++) {
      const top = boundaries[i];
      const bottom = boundaries[i + 1];
      const bandCenter = (top + bottom) / 2;
      // Left/right edges follow the circle at the band's center y-position
      const hw = chordHalfWidth(r, bandCenter);
      regions.push({
        clipRect: { x: c.x - r, y: c.y + top, width: r * 2, height: bottom - top },
        labelCenter: { x: c.x, y: c.y + bandCenter },
        leftEdge: c.x - hw,
        rightEdge: c.x + hw,
      });
    }
    return regions;
  },
});
