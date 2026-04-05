/**
 * Document shape — TikZ "tape" shape from pgflibraryshapes.symbols.code.tex (lines 2115–2557).
 *
 * A rectangle with optional wavy top and/or bottom edges drawn as elliptical arcs.
 *
 * Keys (matching TikZ):
 *   tapeBendTop:    'in and out' | 'out and in' | 'none'  (default: 'none' for document use)
 *   tapeBendBottom: 'in and out' | 'out and in' | 'none'  (default: 'in and out')
 *   tapeBendHeight: total height of a bend in px           (default: 5, matching TikZ 5pt)
 *
 * Arc geometry (from PGF source):
 *   halfBendHeight = tapeBendHeight / 2
 *   bendxradius    = cos(45°) × halfWidth   = 0.707106 × halfWidth
 *   bendyradius    = 1/(1-sin(45°)) × halfBendHeight = 3.414213 × halfBendHeight
 *
 * Each wavy side consists of two quarter-ellipse arcs:
 *   'in and out': first arc bends inward (toward center), second bends outward
 *   'out and in': first arc bends outward, second bends inward
 *
 * Coordinate convention: TikZ y-up → SVG y-down. All y values are negated.
 * The path is drawn clockwise (TikZ draws it in the same winding order).
 */

import { createShape, polygonBorderPoint } from './shape.js';

/**
 * Build SVG path for a wavy side using two elliptical arcs (SVG A command).
 *
 * TikZ draws arcs using \pgfpatharc{startAngle}{endAngle}{rx and ry}.
 * We convert to SVG arc commands. Each 90° arc becomes one A command.
 *
 * For the TOP side (TikZ y-up, our y-down):
 *   Path goes left-to-right: from (-hw, -hh) to (+hw, -hh)
 *   The bend extends upward (negative y in SVG) by halfBendHeight.
 *
 * For the BOTTOM side:
 *   Path goes right-to-left: from (+hw, +hh) to (-hw, +hh)
 *   The bend extends downward (positive y in SVG) by halfBendHeight.
 *
 * @param {number} x0 - start x
 * @param {number} y0 - start y (at halfHeight level, before bend offset)
 * @param {number} hw - halfWidth
 * @param {number} hbh - halfBendHeight
 * @param {string} style - 'in and out', 'out and in', or 'none'
 * @param {boolean} isTop - true for top side, false for bottom
 * @returns {string} SVG path fragment (excluding starting M/L, including endpoint)
 */
function wavySidePath(x0, y0, hw, hbh, brx, bry, style, isTop) {
  if (style === 'none') {
    // Straight line to the other corner
    const endX = isTop ? (x0 + 2 * hw) : (x0 - 2 * hw);
    return ` L ${endX} ${y0}`;
  }

  // The bend starts at halfBendHeight offset from the halfHeight line
  // SVG y-down: top bends go to y0 - hbh (upward), bottom bends go to y0 + hbh (downward)
  const bendDir = isTop ? -1 : 1;
  const bendStartY = y0 + bendDir * hbh;

  // Two quarter-ellipse arcs span the full width
  // Arc midpoint is at center x, bend endpoint is at opposite corner
  const cx = isTop ? (x0 + hw) : (x0 - hw);
  const endX = isTop ? (x0 + 2 * hw) : (x0 - 2 * hw);

  // SVG A command: A rx ry x-rotation large-arc-flag sweep-flag x y
  // Each arc is 90°, so large-arc = 0.
  // Sweep direction depends on bend style and side.

  if (style === 'in and out') {
    // TikZ: all three waypoints (start, mid, end) are at the same y (bendStartY).
    // "in and out" = first arc curves INWARD (toward center), second OUTWARD.
    //
    // SVG sweep flags depend on travel direction:
    //   Top (left-to-right): inward=UP needs sweep=0, outward=DOWN needs sweep=1
    //   Bottom (right-to-left): inward=UP needs sweep=0, outward=DOWN needs sweep=1
    //
    // Wait — "inward" means toward center for BOTH sides:
    //   Top: inward = toward positive y (DOWN in SVG) → sweep=1
    //   Bottom: inward = toward negative y (UP in SVG) → sweep=0
    //
    // For bottom going right-to-left, start is RIGHT of end:
    //   sweep=0 → CCW → goes UP (inward) ✓
    //   sweep=1 → CW → goes DOWN (outward) ✓
    // For top going left-to-right, start is LEFT of end:
    //   sweep=1 → CW → goes DOWN (inward for top) ✓
    //   sweep=0 → CCW → goes UP (outward for top) ✓
    const sweep1 = isTop ? 1 : 0; // inward arc
    const sweep2 = isTop ? 0 : 1; // outward arc
    return (
      ` L ${x0} ${bendStartY}` +
      ` A ${brx} ${bry} 0 0 ${sweep1} ${cx} ${bendStartY}` +
      ` A ${brx} ${bry} 0 0 ${sweep2} ${endX} ${bendStartY}`
    );
  }

  // 'out and in': reversed — first outward, second inward
  if (style === 'out and in') {
    const sweep1 = isTop ? 0 : 1; // outward arc
    const sweep2 = isTop ? 1 : 0; // inward arc
    return (
      ` L ${x0} ${bendStartY}` +
      ` A ${brx} ${bry} 0 0 ${sweep1} ${cx} ${bendStartY}` +
      ` A ${brx} ${bry} 0 0 ${sweep2} ${endX} ${bendStartY}`
    );
  }

  // Fallback: straight
  const endXFallback = isTop ? (x0 + 2 * hw) : (x0 - 2 * hw);
  return ` L ${endXFallback} ${y0}`;
}

/**
 * Compute the y-offset of a corner anchor due to a bend.
 * TikZ: for 'in and out' style, NE corner is at halfHeight + halfBendHeight + cothalfangleout * outerysep
 *        for 'out and in' style, NE corner is at halfHeight + halfBendHeight + cothalfanglein * outerysep
 * Since we don't track outerxsep/outerysep separately, we use outerSep for both.
 */
function cornerBendOffset(style, hbh) {
  if (style === 'none') return 0;
  return hbh;
}

export default createShape('document', {
  savedGeometry(config) {
    const {
      center,
      halfWidth,
      halfHeight,
      tapeBendTop = 'none',
      tapeBendBottom = 'in and out',
      tapeBendHeight = 5,
      outerSep = 0,
    } = config;

    const hw = (halfWidth ?? 30) + outerSep;
    const hbh = tapeBendHeight / 2;

    // TikZ adds halfBendHeight to halfHeight for each active bend
    // to make room for the wave (lines 2138–2145)
    let hh = (halfHeight ?? 20) + outerSep;

    // Bend radii (PGF source lines 2164–2176)
    const brx = 0.707106 * hw;    // cos(45°) × halfWidth
    const bry = 3.414213 * hbh;   // 1/(1-sin(45°)) × halfBendHeight

    return {
      center: { x: center.x, y: center.y },
      halfWidth: hw,
      halfHeight: hh,
      tapeBendTop,
      tapeBendBottom,
      tapeBendHeight,
      halfBendHeight: hbh,
      bendxradius: brx,
      bendyradius: bry,
      outerSep,
    };
  },

  namedAnchors(geom) {
    const { center: c, halfWidth: hw, halfHeight: hh, halfBendHeight: hbh,
            tapeBendTop: top, tapeBendBottom: bot } = geom;

    // Corner y-offsets from bends (SVG y-down: top corners go more negative, bottom more positive)
    const topOffset = cornerBendOffset(top, hbh);
    const botOffset = cornerBendOffset(bot, hbh);

    // North anchor: average of NE and NW y (both at same y for tape)
    const northY = c.y - hh - topOffset;
    const southY = c.y + hh + botOffset;

    return {
      north:        { x: c.x, y: northY },
      south:        { x: c.x, y: southY },
      east:         { x: c.x + hw, y: c.y },
      west:         { x: c.x - hw, y: c.y },
      // TikZ: NE/NW corners sit at halfHeight + bend offset (with different offsets for in-and-out vs out-and-in)
      // For 'in and out' top: NE at (hw, -(hh+hbh)), NW at (-hw, -(hh+hbh))
      // For 'none': NE at (hw, -hh)
      'north east': { x: c.x + hw, y: c.y - hh - topOffset },
      'north west': { x: c.x - hw, y: c.y - hh - topOffset },
      'south east': { x: c.x + hw, y: c.y + hh + botOffset },
      'south west': { x: c.x - hw, y: c.y + hh + botOffset },
    };
  },

  borderPoint(geom, direction) {
    const { center: c, halfWidth: hw, halfHeight: hh, halfBendHeight: hbh,
            tapeBendTop: top, tapeBendBottom: bot } = geom;

    // Approximate the wavy edges with polygon vertices for borderPoint intersection
    const topOff = cornerBendOffset(top, hbh);
    const botOff = cornerBendOffset(bot, hbh);

    if (top === 'none' && bot === 'none') {
      // Pure rectangle
      const verts = [
        { x: c.x - hw, y: c.y - hh },
        { x: c.x + hw, y: c.y - hh },
        { x: c.x + hw, y: c.y + hh },
        { x: c.x - hw, y: c.y + hh },
      ];
      return polygonBorderPoint(c, direction, verts);
    }

    // Build polygon approximation with sampled wave points
    const verts = [];
    // Top edge (left to right)
    if (top === 'none') {
      verts.push({ x: c.x - hw, y: c.y - hh });
      verts.push({ x: c.x + hw, y: c.y - hh });
    } else {
      const steps = 8;
      const bendDir = -1; // top goes upward in SVG
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = c.x - hw + 2 * hw * t;
        const wave = hbh * Math.sin(Math.PI * t) * (top === 'in and out' ? 1 : -1);
        verts.push({ x, y: c.y - hh + bendDir * hbh + wave * bendDir });
      }
    }
    // Bottom edge (right to left)
    if (bot === 'none') {
      verts.push({ x: c.x + hw, y: c.y + hh });
      verts.push({ x: c.x - hw, y: c.y + hh });
    } else {
      const steps = 8;
      const bendDir = 1; // bottom goes downward in SVG
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = c.x + hw - 2 * hw * t;
        const wave = hbh * Math.sin(Math.PI * t) * (bot === 'in and out' ? 1 : -1);
        verts.push({ x, y: c.y + hh + bendDir * hbh + wave * bendDir });
      }
    }
    return polygonBorderPoint(c, direction, verts);
  },

  backgroundPath(geom) {
    const { center: { x: cx, y: cy }, halfWidth, halfHeight, halfBendHeight: hbh,
            bendxradius: brx, bendyradius: bry,
            tapeBendTop: top, tapeBendBottom: bot, outerSep } = geom;

    const hw = halfWidth - outerSep;
    const hh = halfHeight - outerSep;

    // Path matches TikZ backgroundpath (lines 2335–2376), converted to SVG y-down.
    // TikZ starts at (-hw, 0) → (-hw, hh) → top bend → (hw, -hh) → bottom bend → close
    // In SVG y-down: TikZ +y = SVG -y
    // Start at left edge center, go up to top-left
    let d = `M ${cx - hw} ${cy}`;
    d += ` L ${cx - hw} ${cy - hh}`;

    // Top side (left to right)
    d += wavySidePath(cx - hw, cy - hh, hw, hbh, brx, bry, top, true);

    // Right edge down to bottom-right
    d += ` L ${cx + hw} ${cy + hh}`;

    // Bottom side (right to left)
    d += wavySidePath(cx + hw, cy + hh, hw, hbh, brx, bry, bot, false);

    d += ' Z';
    return d;
  },
});
