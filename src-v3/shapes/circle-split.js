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
import { PART_NAMES, computeChordOffsets, chordHalfWidth } from './split-utils.js';

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

    const chordYs = chordUs.map(u => u * r);
    const boundaries = [-r, ...chordYs, r];
    for (let i = 0; i < parts && i < PART_NAMES.length; i++) {
      const bandCenter = (boundaries[i] + boundaries[i + 1]) / 2;
      anchors[PART_NAMES[i]] = { x: c.x, y: c.y + bandCenter };
    }

    if (anchors.one) anchors.text = { ...anchors.one };
    if (anchors.two) anchors.lower = { ...anchors.two };

    for (let i = 0; i < chordYs.length; i++) {
      const cy = chordYs[i];
      const hw = chordHalfWidth(r, r, cy);
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

    let d = `M ${cx - r} ${cy}` +
            ` A ${r} ${r} 0 1 0 ${cx + r} ${cy}` +
            ` A ${r} ${r} 0 1 0 ${cx - r} ${cy}` +
            ` Z`;

    if (drawSplits && parts > 1) {
      const chordYs = computeChordOffsets(parts).map(u => u * r);
      for (const chordY of chordYs) {
        const hw = chordHalfWidth(r, r, chordY);
        d += ` M ${cx - hw} ${cy + chordY} L ${cx + hw} ${cy + chordY}`;
      }
    }

    return d;
  },

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
      const hw = chordHalfWidth(r, r, bandCenter);
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
