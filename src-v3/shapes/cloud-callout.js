/**
 * Cloud callout shape for the TikZ-SVG library.
 *
 * Faithful reimplementation of PGF's cloud callout from
 * pgflibraryshapes.callouts.code.tex (lines 809-949).
 *
 * Inherits the cloud body and adds thought-bubble ellipses
 * along the line from the pointer to the cloud border.
 *
 * The cloud callout inherits all anchors and border computation
 * from the cloud shape, and adds a 'pointer' anchor.
 */

import { registerShape } from './shape.js';
import cloudShape from './cloud.js';

// ── Shape implementation ────────────────────────────────────────────

const ANCHOR_NAMES = [
  'center', 'north', 'south', 'east', 'west',
  'north east', 'north west', 'south east', 'south west',
  'pointer',
];

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

function savedGeometry(config) {
  // First compute the cloud geometry (we inherit everything from cloud)
  const cloudGeom = cloudShape.savedGeometry(config);

  // Extract cloud callout specific params
  const {
    calloutPointerOffset = { x: 30, y: 40 },
    calloutPointerShorten = 0,
    calloutPointerStartSize = 0.2, // fraction of cloud size
    calloutPointerEndSize = 0.1,   // fraction of cloud size
    calloutPointerSegments = 2,
  } = config;

  const tipRel = shortenPointer(calloutPointerOffset, calloutPointerShorten);

  return {
    ...cloudGeom,
    tipRel,
    calloutPointerOffset,
    calloutPointerShorten,
    calloutPointerStartSize,
    calloutPointerEndSize,
    calloutPointerSegments,
  };
}

function anchor(name, geom) {
  if (name === 'pointer') {
    return {
      x: geom.center.x + geom.tipRel.x,
      y: geom.center.y + geom.tipRel.y,
    };
  }
  // Delegate all other anchors to the cloud shape
  return cloudShape.anchor(name, geom);
}

function borderPoint(geom, direction) {
  return cloudShape.borderPoint(geom, direction);
}

/**
 * SVG path for the cloud callout.
 *
 * Draws the cloud body (from cloud shape) followed by thought-bubble
 * ellipses from the pointer tip toward the cloud border.
 *
 * Matches lines 859-933 of pgflibraryshapes.callouts.code.tex.
 */
function backgroundPath(geom) {
  const {
    center: c, xOuter, yInner, outerSep, tipRel,
    calloutPointerStartSize, calloutPointerEndSize,
    calloutPointerSegments,
  } = geom;

  // Start with the cloud body path
  let d = cloudShape.backgroundPath(geom);

  // Compute border point on the outer ellipse in the pointer direction
  // PGF: pgfpointborderellipse of (pointer - center) with (xOuter, yOuter)
  // We use the outer ellipse radii for the border
  const totalRx = xOuter + outerSep;
  const totalRy = (geom.yOuter ?? yInner) + outerSep;

  const theta = Math.atan2(tipRel.y * totalRx, tipRel.x * totalRy);
  const borderRel = {
    x: totalRx * Math.cos(theta),
    y: totalRy * Math.sin(theta),
  };

  // Distance from border to pointer tip
  const dx = tipRel.x - borderRel.x;
  const dy = tipRel.y - borderRel.y;
  const totalDist = Math.sqrt(dx * dx + dy * dy);
  if (totalDist < 1e-10 || calloutPointerSegments < 1) return d;

  // Direction from pointer toward center (for stepping)
  const angle = Math.atan2(-(tipRel.y), -(tipRel.x));
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);

  // Step distance between bubble centers
  const stepDist = totalDist / calloutPointerSegments;

  // Bubble sizes: start at pointer (small), grow toward cloud (large)
  // PGF: startSize and endSize are relative to cloud dimensions (2*xOuter, 2*yInner)
  const cloudW = 2 * xOuter;
  const cloudH = 2 * yInner;
  const endRx = calloutPointerEndSize * cloudW / 2;
  const endRy = calloutPointerEndSize * cloudH / 2;
  const startRx = calloutPointerStartSize * cloudW / 2;
  const startRy = calloutPointerStartSize * cloudH / 2;

  // Size step per segment
  const dRx = (startRx - endRx) / calloutPointerSegments;
  const dRy = (startRy - endRy) / calloutPointerSegments;

  // Draw ellipses from pointer toward border
  let currentRx = endRx;
  let currentRy = endRy;
  let currentDist = 0;

  for (let i = 0; i < calloutPointerSegments; i++) {
    const hrx = currentRx / 2;
    const hry = currentRy / 2;

    if (hrx > 0.1 && hry > 0.1) {
      // Center of this bubble
      const bubbleCx = c.x + tipRel.x + cosAngle * currentDist;
      const bubbleCy = c.y + tipRel.y + sinAngle * currentDist;

      // Draw ellipse as two SVG arcs
      d += ` M ${bubbleCx - hrx} ${bubbleCy}`;
      d += ` A ${hrx} ${hry} 0 1 0 ${bubbleCx + hrx} ${bubbleCy}`;
      d += ` A ${hrx} ${hry} 0 1 0 ${bubbleCx - hrx} ${bubbleCy}`;
      d += ' Z';
    }

    currentRx += dRx;
    currentRy += dRy;
    currentDist += stepDist;
  }

  return d;
}

function anchors() {
  return ANCHOR_NAMES;
}

const cloudCalloutShape = { savedGeometry, anchor, borderPoint, backgroundPath, anchors };
registerShape('cloud callout', cloudCalloutShape);
export default cloudCalloutShape;
