/**
 * Ellipse callout shape for the TikZ-SVG library.
 *
 * Faithful reimplementation of PGF's ellipse callout from
 * pgflibraryshapes.callouts.code.tex (lines 61-331).
 *
 * The shape is an ellipse with a triangular pointer. The pointer
 * base spans `pointerArc` degrees on the ellipse, centered on
 * the direction from center to the pointer target.
 *
 * Coordinate conventions:
 *   - All computation in SVG coords (y-down)
 *   - Pointer stored as offset from center for emitter compat
 */

import { vecFromAngle } from '../core/math.js';
import { registerShape } from './shape.js';

// ── Helpers ─────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

/**
 * Angle on ellipse for a given direction.
 * Matches \pgfmathangleonellipse — returns the parametric angle
 * (in degrees) on the ellipse boundary for a given point.
 *
 * For an ellipse (rx, ry), a point (px, py) on the boundary
 * has parametric angle: atan2(py/ry, px/rx) converted to degrees.
 */
function angleonellipse(px, py, rx, ry) {
  return Math.atan2(py / ry, px / rx) / DEG;
}

/**
 * Point on ellipse at parametric angle (degrees).
 */
function ellipsePoint(cx, cy, rx, ry, angleDeg) {
  const rad = angleDeg * DEG;
  return { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) };
}

/**
 * Angle between lines tip→after and tip→before (for pointer anchor).
 */
function angleBetweenLines(tip, after, before) {
  const a1 = Math.atan2(after.y - tip.y, after.x - tip.x);
  const a2 = Math.atan2(before.y - tip.y, before.x - tip.x);
  let diff = (a2 - a1) / DEG;
  if (diff < 0) diff += 360;
  return diff;
}

/**
 * Compute pointer anchor.
 * Matches \pgf@lib@callouts@pointeranchor (lines 356-377).
 */
function computePointerAnchor(tipRel, beforeRel, afterRel, outerSep, aspect) {
  if (outerSep < 1e-10 || aspect < 1e-10) return { ...tipRel };

  const fullAngle = angleBetweenLines(tipRel, afterRel, beforeRel);
  const halfAngle = fullAngle / 2;
  const sinHalf = Math.sin(halfAngle * DEG);
  if (Math.abs(sinHalf) < 1e-10) return { ...tipRel };
  const offsetDist = outerSep / sinHalf * aspect;

  const angleToAfter = Math.atan2(afterRel.y - tipRel.y, afterRel.x - tipRel.x) / DEG;
  const bisectorAngle = (angleToAfter + halfAngle + 180) * DEG;

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
  'center', 'mid', 'base', 'north', 'south', 'east', 'west',
  'north east', 'north west', 'south east', 'south west',
  'mid east', 'mid west', 'base east', 'base west',
  'pointer',
];

function savedGeometry(config) {
  const {
    center,
    rx: inputRx, ry: inputRy,
    outerSep = 0,
    calloutPointerOffset = { x: 30, y: 25 },
    calloutPointerArc = 15,
    calloutPointerShorten = 0,
    calloutPointerAnchorAspect = 1,
  } = config;

  // Full dims (with outerSep) for anchors
  const rx = inputRx + outerSep;
  const ry = inputRy + outerSep;

  // Visual dims (without outerSep) for background path
  const vrx = inputRx;
  const vry = inputRy;

  // Resolve pointer tip
  let tipRel = shortenPointer(calloutPointerOffset, calloutPointerShorten);

  // Find the parametric angle on the ellipse for the pointer direction.
  // Use visual dims for the border point (matching TikZ's xpathradius/ypathradius).
  // PGF: \pgfpointborderellipse then \pgfmathangleonellipse
  //
  // In SVG coords: direction from center to pointer is tipRel.
  // The border point on the ellipse in that direction:
  const theta = Math.atan2(tipRel.y * vrx, tipRel.x * vry);
  const borderAngleDeg = theta / DEG; // parametric angle on ellipse

  // Before/after angles: ±pointerArc/2 from border angle
  const halfArc = calloutPointerArc / 2;
  const beforeAngleDeg = borderAngleDeg - halfArc;
  const afterAngleDeg = borderAngleDeg + halfArc;

  // Before/after points on the visual ellipse (relative to center)
  const beforeRel = {
    x: vrx * Math.cos(beforeAngleDeg * DEG),
    y: vry * Math.sin(beforeAngleDeg * DEG),
  };
  const afterRel = {
    x: vrx * Math.cos(afterAngleDeg * DEG),
    y: vry * Math.sin(afterAngleDeg * DEG),
  };

  // Pointer anchor
  const pointerAnchorRel = computePointerAnchor(
    tipRel, beforeRel, afterRel, outerSep, calloutPointerAnchorAspect
  );

  return {
    center: { x: center.x, y: center.y },
    rx, ry,       // full dims for anchors
    vrx, vry,     // visual dims for path
    outerSep,
    tipRel,
    beforeRel,
    afterRel,
    beforeAngleDeg,
    afterAngleDeg,
    pointerAnchorRel,
    // Preserve for emitter re-call
    calloutPointerOffset,
    calloutPointerArc,
    calloutPointerShorten,
    calloutPointerAnchorAspect,
  };
}

function anchor(name, geom) {
  const { center: c, rx, ry } = geom;

  switch (name) {
    case 'center':      return { x: c.x, y: c.y };
    case 'east':        return { x: c.x + rx, y: c.y };
    case 'west':        return { x: c.x - rx, y: c.y };
    case 'north':       return { x: c.x, y: c.y - ry };
    case 'south':       return { x: c.x, y: c.y + ry };
    case 'north east':  return borderPoint(geom, { x: Math.SQRT1_2, y: -Math.SQRT1_2 });
    case 'north west':  return borderPoint(geom, { x: -Math.SQRT1_2, y: -Math.SQRT1_2 });
    case 'south east':  return borderPoint(geom, { x: Math.SQRT1_2, y: Math.SQRT1_2 });
    case 'south west':  return borderPoint(geom, { x: -Math.SQRT1_2, y: Math.SQRT1_2 });
    case 'pointer':     return {
      x: c.x + geom.pointerAnchorRel.x,
      y: c.y + geom.pointerAnchorRel.y,
    };
    case 'mid':         return { x: c.x, y: c.y };
    case 'base':        return { x: c.x, y: c.y };
    case 'mid east':    return { x: c.x + rx, y: c.y };
    case 'base east':   return { x: c.x + rx, y: c.y };
    case 'mid west':    return { x: c.x - rx, y: c.y };
    case 'base west':   return { x: c.x - rx, y: c.y };
    default: {
      const angle = parseFloat(name);
      if (!Number.isNaN(angle)) {
        const dir = vecFromAngle(angle);
        return borderPoint(geom, dir);
      }
      throw new Error(`ellipse callout.anchor: unknown anchor "${name}"`);
    }
  }
}

/**
 * Ellipse border point. Uses full dimensions (with outerSep).
 */
function borderPoint(geom, direction) {
  const { center, rx, ry } = geom;
  const dx = direction.x, dy = direction.y;
  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
    return { x: center.x, y: center.y };
  }
  const theta = Math.atan2(dy * rx, dx * ry);
  return {
    x: center.x + rx * Math.cos(theta),
    y: center.y + ry * Math.sin(theta),
  };
}

/**
 * SVG path for the ellipse callout.
 *
 * Path order (matching TikZ lines 262-270):
 *   M pointer_tip
 *   L afterPt
 *   A (arc from afterAngle around to beforeAngle, the long way)
 *   Z (close back to pointer_tip)
 */
function backgroundPath(geom) {
  const { center: c, vrx, vry, tipRel, beforeRel, afterRel,
          beforeAngleDeg, afterAngleDeg } = geom;

  // Absolute positions
  const tip = { x: c.x + tipRel.x, y: c.y + tipRel.y };
  const afterPt = { x: c.x + afterRel.x, y: c.y + afterRel.y };
  const beforePt = { x: c.x + beforeRel.x, y: c.y + beforeRel.y };

  // The arc goes from afterPt to beforePt the LONG way around
  // (excluding the pointer opening).
  // Arc span = 360 - pointerArc
  let arcSpan = afterAngleDeg - beforeAngleDeg;
  if (arcSpan < 0) arcSpan += 360;
  const longArcSpan = 360 - arcSpan;
  const largeArc = longArcSpan > 180 ? 1 : 0;

  // SVG arc sweep: we go from afterPt to beforePt.
  // In SVG coords (y-down), the parametric angle increases clockwise.
  // The "long way" from after to before (skipping the pointer opening)
  // is a clockwise sweep.
  const sweep = 1;

  let d = `M ${tip.x} ${tip.y}`;
  d += ` L ${afterPt.x} ${afterPt.y}`;
  d += ` A ${vrx} ${vry} 0 ${largeArc} ${sweep} ${beforePt.x} ${beforePt.y}`;
  d += ' Z';
  return d;
}

function anchors() {
  return ANCHOR_NAMES;
}

const ellipseCalloutShape = { savedGeometry, anchor, borderPoint, backgroundPath, anchors };
registerShape('ellipse callout', ellipseCalloutShape);
export default ellipseCalloutShape;
