/**
 * Rectangle split shape — rectangle divided into N parts.
 * PGF source: pgflibraryshapes.multipart.code.tex lines 431–1257
 *
 * Parameters: parts (default 2), halfWidth, halfHeight, horizontal (default false).
 * Each part can have its own content. Divider lines separate parts.
 *
 * Keys implemented:
 *   - parts: number of divisions (2–20)
 *   - horizontal: if true, split left-to-right instead of top-to-bottom
 *   - drawSplits: if true (default), draw divider lines between parts
 *   - partHeights: optional array of relative heights per part (default: equal)
 *   - partAlign: 'left' | 'center' (default) | 'right' — text alignment within parts
 */

import { createShape } from './shape.js';
import { vecNormalize } from '../core/math.js';
import { PART_NAMES } from './split-utils.js';

/**
 * Compute the Y offsets of each split line (top-to-bottom layout).
 * Returns array of {y} values for each divider, plus part centers.
 */
function computeSplitPositions(cy, hh, parts, partHeights) {
  const totalH = hh * 2;
  const heights = partHeights ??
    Array.from({ length: parts }, () => totalH / parts);

  const positions = { dividers: [], partCenters: [] };
  let y = cy - hh; // start at top

  for (let i = 0; i < parts; i++) {
    const h = heights[i] ?? totalH / parts;
    positions.partCenters.push(y + h / 2);
    y += h;
    if (i < parts - 1) {
      positions.dividers.push(y);
    }
  }
  return positions;
}

// PGF aliases: text→one, second→two, third→three, fourth→four
const PART_ALIASES = {
  text: 'one', second: 'two', third: 'three', fourth: 'four',
};

function buildAnchors(geom) {
  const { center: c, halfWidth: hw, halfHeight: hh, parts, horizontal } = geom;
  const anchors = {
    north:       { x: c.x,      y: c.y - hh },
    south:       { x: c.x,      y: c.y + hh },
    east:        { x: c.x + hw, y: c.y },
    west:        { x: c.x - hw, y: c.y },
    'north east': { x: c.x + hw, y: c.y - hh },
    'north west': { x: c.x - hw, y: c.y - hh },
    'south east': { x: c.x + hw, y: c.y + hh },
    'south west': { x: c.x - hw, y: c.y + hh },
  };

  // Per-part anchors
  if (!horizontal) {
    const pos = computeSplitPositions(c.y, hh, parts, geom.partHeights);
    for (let i = 0; i < parts && i < PART_NAMES.length; i++) {
      const name = PART_NAMES[i];
      const py = pos.partCenters[i];
      anchors[name] = { x: c.x, y: py };
      anchors[`${name} north`] = { x: c.x, y: i === 0 ? c.y - hh : pos.dividers[i - 1] };
      anchors[`${name} south`] = { x: c.x, y: i === parts - 1 ? c.y + hh : pos.dividers[i] };
      anchors[`${name} east`]  = { x: c.x + hw, y: py };
      anchors[`${name} west`]  = { x: c.x - hw, y: py };
    }
    // Split anchors (on the divider lines)
    for (let i = 0; i < pos.dividers.length && i < PART_NAMES.length; i++) {
      const name = PART_NAMES[i];
      const dy = pos.dividers[i];
      anchors[`${name} split`]       = { x: c.x, y: dy };
      anchors[`${name} split east`]  = { x: c.x + hw, y: dy };
      anchors[`${name} split west`]  = { x: c.x - hw, y: dy };
    }
  } else {
    // Horizontal split: divide left-to-right
    const totalW = hw * 2;
    const partW = totalW / parts;
    for (let i = 0; i < parts && i < PART_NAMES.length; i++) {
      const name = PART_NAMES[i];
      const px = c.x - hw + partW * i + partW / 2;
      anchors[name] = { x: px, y: c.y };
      anchors[`${name} north`] = { x: px, y: c.y - hh };
      anchors[`${name} south`] = { x: px, y: c.y + hh };
    }
    for (let i = 0; i < parts - 1 && i < PART_NAMES.length; i++) {
      const name = PART_NAMES[i];
      const dx = c.x - hw + partW * (i + 1);
      anchors[`${name} split`]       = { x: dx, y: c.y };
      anchors[`${name} split north`] = { x: dx, y: c.y - hh };
      anchors[`${name} split south`] = { x: dx, y: c.y + hh };
    }
  }

  // PGF anchor aliases
  for (const [alias, target] of Object.entries(PART_ALIASES)) {
    if (anchors[target]) {
      anchors[alias] = { ...anchors[target] };
      // Also copy compound anchors (e.g. "text east" → "one east")
      for (const suffix of [' north', ' south', ' east', ' west', ' split', ' split east', ' split west', ' split north', ' split south']) {
        if (anchors[target + suffix]) {
          anchors[alias + suffix] = { ...anchors[target + suffix] };
        }
      }
    }
  }

  return anchors;
}

export default createShape('rectangle split', {
  savedGeometry(config) {
    const { center, halfWidth, halfHeight, parts = 2, horizontal = false,
            partHeights, drawSplits = true, outerSep = 0 } = config;
    return {
      center: { x: center.x, y: center.y },
      halfWidth: (halfWidth ?? 25) + outerSep,
      halfHeight: (halfHeight ?? 20) + outerSep,
      parts,
      horizontal,
      partHeights,
      drawSplits,
      outerSep,
    };
  },

  namedAnchors(geom) {
    return buildAnchors(geom);
  },

  borderPoint(geom, direction) {
    // Rectangle border — same as rectangle shape
    const { center: c, halfWidth: hw, halfHeight: hh } = geom;
    const d = vecNormalize(direction);
    if (d.x === 0 && d.y === 0) return { x: c.x, y: c.y };

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
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, parts, horizontal,
            partHeights, drawSplits, outerSep } = geom;
    const hw = halfWidth - outerSep;
    const hh = halfHeight - outerSep;

    // Outer rectangle
    let d = `M ${cx - hw} ${cy - hh}` +
            ` L ${cx + hw} ${cy - hh}` +
            ` L ${cx + hw} ${cy + hh}` +
            ` L ${cx - hw} ${cy + hh}` +
            ` Z`;

    // Divider lines
    if (drawSplits) {
      if (!horizontal) {
        const pos = computeSplitPositions(cy, hh, parts, partHeights);
        for (const dy of pos.dividers) {
          d += ` M ${cx - hw} ${dy} L ${cx + hw} ${dy}`;
        }
      } else {
        const partW = (hw * 2) / parts;
        for (let i = 1; i < parts; i++) {
          const dx = cx - hw + partW * i;
          d += ` M ${dx} ${cy - hh} L ${dx} ${cy + hh}`;
        }
      }
    }

    return d;
  },

  /**
   * Return per-part regions for fill and label placement.
   * Each region has a clipRect (covering the part's band) and a labelCenter.
   * Coordinates are relative to geom.center.
   */
  partRegions(geom) {
    const { center: c, halfWidth, halfHeight, parts, horizontal, partHeights, outerSep } = geom;
    const hw = halfWidth - outerSep;
    const hh = halfHeight - outerSep;
    const regions = [];

    if (!horizontal) {
      const pos = computeSplitPositions(c.y, hh, parts, partHeights);
      const tops = [c.y - hh, ...pos.dividers];
      const bottoms = [...pos.dividers, c.y + hh];
      for (let i = 0; i < parts; i++) {
        regions.push({
          clipRect: { x: c.x - hw, y: tops[i], width: hw * 2, height: bottoms[i] - tops[i] },
          labelCenter: { x: c.x, y: pos.partCenters[i] },
          leftEdge: c.x - hw,
          rightEdge: c.x + hw,
        });
      }
    } else {
      const partW = (hw * 2) / parts;
      for (let i = 0; i < parts; i++) {
        const x = c.x - hw + partW * i;
        regions.push({
          clipRect: { x, y: c.y - hh, width: partW, height: hh * 2 },
          labelCenter: { x: x + partW / 2, y: c.y },
          leftEdge: x,
          rightEdge: x + partW,
        });
      }
    }
    return regions;
  },
});
