/**
 * Ellipse split enhanced shape — ellipse divided into N horizontal parts.
 * PGF source: tex/pgflibraryshapes.multipart.enhanced.code.tex
 *
 * Parameters:
 *   - parts (default 2): number of horizontal divisions (1–4)
 *   - drawSplits (default true): whether to draw chord lines between parts
 *   - rx, ry: ellipse radii
 *   - partAlign: 'left' | 'center' (default) | 'right'
 *
 * Each part is separated by a horizontal chord line.
 * Per-part anchors: 'one'/'text', 'two'/'lower', 'three', 'four'.
 *
 * Chord positions divide the ellipse into equal-area horizontal bands.
 * The equal-area formula is identical to the circle case (horizontal slicing
 * of an ellipse scales uniformly in x, preserving area ratios).
 */

import { createShape } from './shape.js';

const PART_NAMES = ['one', 'two', 'three', 'four'];

/**
 * Compute normalized chord offsets that divide into N equal-area bands.
 * Returns values in [-1, 1]; multiply by ry for actual y-offsets.
 * See circle-split.js for the derivation.
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
    offsets.push(-((lo + hi) / 2));
  }
  // Sort top-to-bottom (most negative first) — area formula counts from bottom
  offsets.sort((a, b) => a - b);
  return offsets;
}

/**
 * Chord half-width at y-offset dy from center of an ellipse with semi-axes (rx, ry).
 *   half-width = rx * sqrt(1 - (dy/ry)^2)
 */
function chordHalfWidth(rx, ry, yOffset) {
  const u = yOffset / ry;
  const val = 1 - u * u;
  return val > 0 ? rx * Math.sqrt(val) : 0;
}

export default createShape('ellipse split', {
  savedGeometry(config) {
    const { center, rx = 25, ry = 20, parts = 2, drawSplits = true, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      rx: rx + outerSep,
      ry: ry + outerSep,
      parts: Math.max(1, Math.min(4, parts)),
      drawSplits,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, rx, ry, parts } = geom;
    const chordYs = computeChordOffsets(parts).map(u => u * ry);

    // Compass anchors on the ellipse boundary
    const anchors = {
      north: { x: c.x, y: c.y - ry },
      south: { x: c.x, y: c.y + ry },
      east:  { x: c.x + rx, y: c.y },
      west:  { x: c.x - rx, y: c.y },
    };

    // Diagonal anchors via ellipse parametric form
    for (const [name, dx, dy] of [
      ['north east',  Math.SQRT1_2, -Math.SQRT1_2],
      ['north west', -Math.SQRT1_2, -Math.SQRT1_2],
      ['south east',  Math.SQRT1_2,  Math.SQRT1_2],
      ['south west', -Math.SQRT1_2,  Math.SQRT1_2],
    ]) {
      const theta = Math.atan2(dy * rx, dx * ry);
      anchors[name] = {
        x: c.x + rx * Math.cos(theta),
        y: c.y + ry * Math.sin(theta),
      };
    }

    // Per-part anchors: center of each band
    const boundaries = [-ry, ...chordYs, ry];
    for (let i = 0; i < parts && i < PART_NAMES.length; i++) {
      const bandCenter = (boundaries[i] + boundaries[i + 1]) / 2;
      anchors[PART_NAMES[i]] = { x: c.x, y: c.y + bandCenter };
    }

    // Aliases: text→one, lower→two
    if (anchors.one) anchors.text = { ...anchors.one };
    if (anchors.two) anchors.lower = { ...anchors.two };

    // Split anchors
    for (let i = 0; i < chordYs.length; i++) {
      const cy = chordYs[i];
      const hw = chordHalfWidth(rx, ry, cy);
      const name = PART_NAMES[i] + ' split';
      anchors[name]            = { x: c.x,      y: c.y + cy };
      anchors[name + ' east']  = { x: c.x + hw, y: c.y + cy };
      anchors[name + ' west']  = { x: c.x - hw, y: c.y + cy };
    }

    return anchors;
  },

  borderPoint(geom, direction) {
    const { center, rx, ry } = geom;
    const dx = direction.x;
    const dy = direction.y;
    if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
      return { x: center.x, y: center.y };
    }
    const theta = Math.atan2(dy * rx, dx * ry);
    return {
      x: center.x + rx * Math.cos(theta),
      y: center.y + ry * Math.sin(theta),
    };
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, rx, ry, parts, drawSplits, outerSep } = geom;
    const vrx = rx - outerSep;
    const vry = ry - outerSep;

    // Ellipse outline
    let d = `M ${cx - vrx} ${cy}` +
            ` A ${vrx} ${vry} 0 1 0 ${cx + vrx} ${cy}` +
            ` A ${vrx} ${vry} 0 1 0 ${cx - vrx} ${cy}` +
            ` Z`;

    // Chord lines
    if (drawSplits && parts > 1) {
      const chordYs = computeChordOffsets(parts).map(u => u * vry);
      for (const chordY of chordYs) {
        const hw = chordHalfWidth(vrx, vry, chordY);
        d += ` M ${cx - hw} ${cy + chordY} L ${cx + hw} ${cy + chordY}`;
      }
    }

    return d;
  },

  /**
   * Return per-part regions for fill and label placement.
   * clipRect covers each horizontal band; the emitter clips to the ellipse outline.
   */
  partRegions(geom) {
    const { center: c, rx, ry, parts, outerSep } = geom;
    const vrx = rx - outerSep;
    const vry = ry - outerSep;
    const chordYs = computeChordOffsets(parts).map(u => u * vry);
    const boundaries = [-vry, ...chordYs, vry];
    const regions = [];

    for (let i = 0; i < parts; i++) {
      const top = boundaries[i];
      const bottom = boundaries[i + 1];
      const bandCenter = (top + bottom) / 2;
      // Left/right edges follow the ellipse at the band's center y-position
      const hw = chordHalfWidth(vrx, vry, bandCenter);
      regions.push({
        clipRect: { x: c.x - vrx, y: c.y + top, width: vrx * 2, height: bottom - top },
        labelCenter: { x: c.x, y: c.y + bandCenter },
        leftEdge: c.x - hw,
        rightEdge: c.x + hw,
      });
    }
    return regions;
  },
});
