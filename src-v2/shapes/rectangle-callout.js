/**
 * Rectangle callout shape for the TikZ-SVG library.
 *
 * Faithful reimplementation of PGF's rectangle callout from
 * pgflibraryshapes.callouts.code.tex (lines 396-770).
 *
 * The shape is a rectangle with a triangular pointer that emerges
 * from one edge. The pointer base is placed on the edge closest
 * to the target, clamped away from corners.
 *
 * Coordinate conventions:
 *   - All internal computation in SVG coords (y-down)
 *   - Pointer target stored as offset from center for emitter compat
 */

import { vecFromAngle } from '../core/math.js';
import { registerShape } from './shape.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** Angle from a to b in degrees [0, 360), math convention (y-up, CCW). */
function angleBetweenPgf(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  let a = Math.atan2(dy, dx) * 180 / Math.PI;
  if (a < 0) a += 360;
  return a;
}

/** Angle between lines tip→after and tip→before (for pointer anchor). */
function angleBetweenLines(tip, after, before) {
  const a1 = Math.atan2(after.y - tip.y, after.x - tip.x);
  const a2 = Math.atan2(before.y - tip.y, before.x - tip.x);
  let diff = (a2 - a1) * 180 / Math.PI;
  if (diff < 0) diff += 360;
  return diff;
}

/**
 * Compute rectangle callout pointer geometry.
 * Matches \pgf@lib@rectanglecallout@pointer (lines 634-770).
 *
 * All coordinates are relative to the rectangle center (0,0).
 * Uses PGF math coords (y-up) internally, returns SVG coords.
 *
 * @param {{x,y}} pointerRel - pointer tip relative to center, in SVG coords
 * @param {number} hw - visual half-width (no outerSep)
 * @param {number} hh - visual half-height (no outerSep)
 * @param {number} pw - pointer width
 * @returns {{ beforeRel, afterRel, cornerRels }}
 */
function computeRectPointer(pointerRel, hw, hh, pw) {
  // Convert pointer to PGF math coords (negate y)
  const px = pointerRel.x;
  const py = -pointerRel.y;

  // Border point: where ray from origin to pointer hits the rectangle
  // pgfpointborderrectangle({px,py}, {hw,hh})
  const adx = Math.abs(px), ady = Math.abs(py);
  let bx, by;
  if (adx < 1e-10 && ady < 1e-10) {
    bx = 0; by = 0;
  } else if (adx < 1e-10) {
    bx = 0; by = py > 0 ? hh : -hh;
  } else if (ady < 1e-10) {
    bx = px > 0 ? hw : -hw; by = 0;
  } else {
    const tx = hw / adx, ty = hh / ady;
    const t = Math.min(tx, ty);
    bx = px * t / Math.sqrt(px * px + py * py) * Math.sqrt(px * px + py * py);
    by = py * t / Math.sqrt(px * px + py * py) * Math.sqrt(px * px + py * py);
    // Simpler: just clamp
    if (tx < ty) {
      bx = px > 0 ? hw : -hw;
      by = py * hw / adx;
    } else {
      by = py > 0 ? hh : -hh;
      bx = px * hh / ady;
    }
  }

  // Border angle (PGF math coords, y-up)
  const borderAngle = angleBetweenPgf(0, 0, bx, by);

  // Max clamping range: halfDim - pointerWidth (keep away from corners)
  const xa = hw - pw; // max |x| for border base
  const ya = hh - pw; // max |y| for border base

  // Determine which side and compute pointer base offset
  let xc = 0, yc = 0;
  let xb = bx, yb = by;
  let corners;

  // Corner angles (PGF math coords, y-up)
  const angleTopRight = angleBetweenPgf(0, 0, hw, hh);
  const angleTopLeft = angleBetweenPgf(0, 0, -hw, hh);
  const angleBottomLeft = angleBetweenPgf(0, 0, -hw, -hh);
  const angleBottomRight = angleBetweenPgf(0, 0, hw, -hh);

  if (borderAngle < angleTopRight ||
      (borderAngle > angleBottomRight && borderAngle >= angleBottomRight)) {
    // RIGHT side (or wraps around 0°)
    // Check both conditions: < topRight (first quadrant) or > bottomRight (fourth quadrant wrapping)
    if (borderAngle < angleTopRight) {
      // First quadrant: RIGHT side
      yc = pw / 2;
      if (yb > ya) yb = ya;
      // Corners: TR → TL → BL → BR (math coords)
      corners = [
        { x: hw, y: hh }, { x: -hw, y: hh },
        { x: -hw, y: -hh }, { x: hw, y: -hh },
      ];
    } else {
      // Fourth quadrant wrap: RIGHT side (border angle > bottomRight)
      yc = pw / 2;
      if (yb < -ya) yb = -ya;
      corners = [
        { x: hw, y: hh }, { x: -hw, y: hh },
        { x: -hw, y: -hh }, { x: hw, y: -hh },
      ];
    }
  } else if (borderAngle < angleTopLeft) {
    // TOP side (PGF y-up = SVG bottom)
    xc = -pw / 2;
    if (xb > xa) xb = xa;
    else if (xb < -xa) xb = -xa;
    // Corners: TL → BL → BR → TR
    corners = [
      { x: -hw, y: hh }, { x: -hw, y: -hh },
      { x: hw, y: -hh }, { x: hw, y: hh },
    ];
  } else if (borderAngle < angleBottomLeft) {
    // LEFT side
    yc = -pw / 2;
    if (yb > ya) yb = ya;
    else if (yb < -ya) yb = -ya;
    // Corners: BL → BR → TR → TL
    corners = [
      { x: -hw, y: -hh }, { x: hw, y: -hh },
      { x: hw, y: hh }, { x: -hw, y: hh },
    ];
  } else if (borderAngle < angleBottomRight) {
    // BOTTOM side (PGF y-up = SVG top)
    xc = pw / 2;
    if (xb > xa) xb = xa;
    else if (xb < -xa) xb = -xa;
    // Corners: BR → TR → TL → BL
    corners = [
      { x: hw, y: -hh }, { x: hw, y: hh },
      { x: -hw, y: hh }, { x: -hw, y: -hh },
    ];
  } else {
    // Wraps back to RIGHT side (angle >= bottomRight, past 360°)
    yc = pw / 2;
    if (yb < -ya) yb = -ya;
    corners = [
      { x: hw, y: hh }, { x: -hw, y: hh },
      { x: -hw, y: -hh }, { x: hw, y: -hh },
    ];
  }

  // Before/after callout pointer (PGF math coords, relative to center)
  const beforeMath = { x: xb - xc, y: yb - yc };
  const afterMath = { x: xb + xc, y: yb + yc };

  // Convert everything to SVG coords (negate y)
  return {
    beforeRel: { x: beforeMath.x, y: -beforeMath.y },
    afterRel: { x: afterMath.x, y: -afterMath.y },
    cornerRels: corners.map(c => ({ x: c.x, y: -c.y })),
  };
}

/**
 * Compute the pointer anchor point.
 * Matches \pgf@lib@callouts@pointeranchor (lines 356-377).
 *
 * The anchor is offset from the tip along the angle bisector
 * of the pointer triangle, by outerSep / sin(halfAngle).
 *
 * All inputs in SVG coords, relative to center.
 */
function computePointerAnchor(tipRel, beforeRel, afterRel, outerSep, aspect) {
  if (outerSep < 1e-10 || aspect < 1e-10) return { ...tipRel };

  // Angle between the two edges at the tip
  const fullAngle = angleBetweenLines(tipRel, afterRel, beforeRel);
  const halfAngle = fullAngle / 2;

  // Distance to offset: outerSep / sin(halfAngle)
  const sinHalf = Math.sin(halfAngle * Math.PI / 180);
  if (Math.abs(sinHalf) < 1e-10) return { ...tipRel };
  let offsetDist = outerSep / sinHalf * aspect;

  // Direction: bisector from tip toward the after edge, rotated by halfAngle + 180°
  const angleToAfter = Math.atan2(afterRel.y - tipRel.y, afterRel.x - tipRel.x) * 180 / Math.PI;
  const bisectorAngle = (angleToAfter + halfAngle + 180) * Math.PI / 180;

  return {
    x: tipRel.x + offsetDist * Math.cos(bisectorAngle),
    y: tipRel.y + offsetDist * Math.sin(bisectorAngle),
  };
}

/**
 * Shorten pointer tip toward center by a given amount.
 */
function shortenPointer(tipRel, amount) {
  if (amount <= 0) return tipRel;
  const d = Math.sqrt(tipRel.x * tipRel.x + tipRel.y * tipRel.y);
  if (d < 1e-10) return tipRel;
  const scale = Math.max(0, d - amount) / d;
  return { x: tipRel.x * scale, y: tipRel.y * scale };
}

// ── Shape implementation ────────────────────────────────────────────

const ANCHOR_NAMES = [
  'center', 'north', 'south', 'east', 'west',
  'north east', 'north west', 'south east', 'south west',
  'pointer',
];

/**
 * Compute saved geometry.
 * Stores all dimensions with outerSep for anchors.
 * Pointer geometry stored as offsets from center.
 */
function savedGeometry(config) {
  const {
    center,
    halfWidth, halfHeight,
    outerSep = 0,
    calloutPointerOffset = { x: 30, y: 25 }, // default: lower-right
    calloutPointerWidth = 7,
    calloutPointerShorten = 0,
    calloutPointerAnchorAspect = 1,
  } = config;

  // Full dims (with outerSep) for anchors
  const hw = halfWidth + outerSep;
  const hh = halfHeight + outerSep;

  // Resolve pointer tip as relative offset (may have been shortened)
  let tipRel = shortenPointer(calloutPointerOffset, calloutPointerShorten);

  // Compute pointer geometry using VISUAL dims (halfWidth without outerSep)
  const { beforeRel, afterRel, cornerRels } = computeRectPointer(
    tipRel, halfWidth, halfHeight, calloutPointerWidth
  );

  // Compute pointer anchor
  const pointerAnchorRel = computePointerAnchor(
    tipRel, beforeRel, afterRel, outerSep, calloutPointerAnchorAspect
  );

  return {
    center: { x: center.x, y: center.y },
    halfWidth: hw,
    halfHeight: hh,
    outerSep,
    // Pointer data as offsets from center
    tipRel,
    beforeRel,
    afterRel,
    cornerRels,
    pointerAnchorRel,
    // Preserve for emitter re-call
    calloutPointerOffset,
    calloutPointerWidth,
    calloutPointerShorten,
    calloutPointerAnchorAspect,
  };
}

function anchor(name, geom) {
  const { center: c, halfWidth: hw, halfHeight: hh } = geom;

  switch (name) {
    case 'center':      return { x: c.x, y: c.y };
    case 'north':       return { x: c.x, y: c.y - hh };
    case 'south':       return { x: c.x, y: c.y + hh };
    case 'east':        return { x: c.x + hw, y: c.y };
    case 'west':        return { x: c.x - hw, y: c.y };
    case 'north east':  return { x: c.x + hw, y: c.y - hh };
    case 'north west':  return { x: c.x - hw, y: c.y - hh };
    case 'south east':  return { x: c.x + hw, y: c.y + hh };
    case 'south west':  return { x: c.x - hw, y: c.y + hh };
    case 'pointer':     return {
      x: c.x + geom.pointerAnchorRel.x,
      y: c.y + geom.pointerAnchorRel.y,
    };
    default: {
      const angle = parseFloat(name);
      if (!Number.isNaN(angle)) {
        const dir = vecFromAngle(angle);
        return borderPoint(geom, dir);
      }
      throw new Error(`rectangle callout.anchor: unknown anchor "${name}"`);
    }
  }
}

/**
 * Rectangle border point (same as rectangle shape).
 * Uses full dimensions (with outerSep).
 */
function borderPoint(geom, direction) {
  const { center, halfWidth: hw, halfHeight: hh } = geom;
  const dx = direction.x, dy = direction.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);

  if (adx < 1e-10 && ady < 1e-10) return { x: center.x, y: center.y };

  let t;
  if (adx < 1e-10) t = hh / ady;
  else if (ady < 1e-10) t = hw / adx;
  else t = Math.min(hw / adx, hh / ady);

  return { x: center.x + dx * t, y: center.y + dy * t };
}

/**
 * SVG path for the rectangle callout.
 * Uses stored relative offsets + center from geom.
 *
 * Path order (matching TikZ):
 *   beforePt → tip (no rounding) → afterPt (no rounding) →
 *   corner1 → corner2 → corner3 → corner4 → close (no rounding)
 */
function backgroundPath(geom) {
  const { center: c, tipRel, beforeRel, afterRel, cornerRels } = geom;

  // Absolute positions
  const tip = { x: c.x + tipRel.x, y: c.y + tipRel.y };
  const before = { x: c.x + beforeRel.x, y: c.y + beforeRel.y };
  const after = { x: c.x + afterRel.x, y: c.y + afterRel.y };
  const corners = cornerRels.map(cr => ({ x: c.x + cr.x, y: c.y + cr.y }));

  let d = `M ${before.x} ${before.y}`;
  d += ` L ${tip.x} ${tip.y}`;
  d += ` L ${after.x} ${after.y}`;
  for (const corner of corners) {
    d += ` L ${corner.x} ${corner.y}`;
  }
  d += ' Z';
  return d;
}

function anchors() {
  return ANCHOR_NAMES;
}

const rectangleCalloutShape = { savedGeometry, anchor, borderPoint, backgroundPath, anchors };
registerShape('rectangle callout', rectangleCalloutShape);
export default rectangleCalloutShape;
