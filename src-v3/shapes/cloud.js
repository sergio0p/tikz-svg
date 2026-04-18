/**
 * Cloud shape for the TikZ-SVG library.
 *
 * Faithful reimplementation of PGF's cloud shape from
 * pgflibraryshapes.symbols.code.tex (lines 612-1414).
 *
 * The cloud is drawn on an inner ellipse; each "puff" is a circular arc
 * approximated by two cubic Bézier half-arcs (Riskus 2006).
 * An outer (circum-) ellipse passes through the puff extremities
 * and is used for minimum-size clamping and simplified border anchors.
 *
 * Coordinate conventions:
 *   - SVG y-down: "north" = negative y
 *   - TikZ angles: 0° = east, CCW positive
 *   - PGF angles internally: 0° = east, CCW positive (y-up)
 *     We convert at the boundary.
 */

import { createShape } from './shape.js';

// ── Trig helpers (degrees) ──────────────────────────────────────────
const DEG = Math.PI / 180;
const sin = a => Math.sin(a * DEG);
const cos = a => Math.cos(a * DEG);
const tan = a => Math.tan(a * DEG);
const sec = a => 1 / cos(a);
const csc = a => 1 / sin(a);

/**
 * Angle in degrees from point `from` to point `to`.
 * Uses MATH convention (y-up, CCW positive) — matches PGF internal angles.
 * Returns value in [0, 360).
 */
function pgfAngleBetween(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let a = Math.atan2(dy, dx) / DEG;
  if (a < 0) a += 360;
  return a;
}

/** Distance between two points. */
function dist(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Point on ellipse at angle (degrees, math convention y-up). */
function ellipsePoint(cx, cy, rx, ry, angleDeg) {
  return {
    x: cx + rx * cos(angleDeg),
    y: cy + ry * sin(angleDeg),
  };
}

/** Rotate point around origin by angleDeg (math convention). */
function rotate(px, py, angleDeg) {
  const c = cos(angleDeg), s = sin(angleDeg);
  return { x: c * px - s * py, y: s * px + c * py };
}

// ── Puff parameter helper ───────────────────────────────────────────
// Matches \pgf@sh@getcloudpuffparameters (lines 1376-1414)

/**
 * Given the start and end points of a puff on the inner ellipse,
 * compute the arc geometry needed for drawing and border computation.
 *
 * @param {{x,y}} arcStart - start point of puff on inner ellipse (math coords)
 * @param {{x,y}} arcEnd   - end point of puff on inner ellipse (math coords)
 * @param {number} arcRadiusQuotient - precomputed 0.5 * sec((180-arc)/2)
 * @param {number} sinHalfComplementArc - sin((180-arc)/2)
 * @param {number} outerSep
 * @returns {Object}
 */
function getCloudPuffParameters(arcStart, arcEnd, arcRadiusQuotient, sinHalfComplementArc, outerSep) {
  // arcslope = angle from endpoint to startpoint
  const arcslope = pgfAngleBetween(arcEnd, arcStart);

  // Chord length and arc radius
  const chordLength = dist(arcStart, arcEnd);
  const halfChordLength = chordLength / 2;
  const arcRadius = chordLength * arcRadiusQuotient;
  const outerArcRadius = arcRadius + outerSep;

  // Segment height = arcRadius * (1 - sin((180-arc)/2))
  const segmentHeight = arcRadius * (1 - sinHalfComplementArc);

  // Circle center: start + rotate({-halfChord, segmentHeight - arcRadius}, arcslope)
  const localCx = -halfChordLength;
  const localCy = segmentHeight - arcRadius;
  const rotated = rotate(localCx, localCy, arcslope);
  const circleCenter = {
    x: arcStart.x + rotated.x,
    y: arcStart.y + rotated.y,
  };

  return { arcslope, halfChordLength, arcRadius, outerArcRadius, segmentHeight, circleCenter };
}

// ── Cloud shape ─────────────────────────────────────────────────────

export default createShape('cloud', {

  /**
   * Compute and cache all cloud geometry.
   * Matches \savedmacro\getradii (lines 613-806).
   *
   * Config inputs:
   *   center, outerSep,
   *   rx, ry (text half-dimensions passed from pipeline),
   *   cloudPuffs (default 10), cloudPuffArc (default 135),
   *   cloudIgnoreAspect (default false),
   *   cloudAnchorsUseEllipse (default false),
   *   minimumWidth, minimumHeight (optional)
   */
  savedGeometry(config) {
    const {
      center,
      outerSep = 0,
      rx: textHalfW = 0,
      ry: textHalfH = 0,
      cloudPuffs: puffs = 10,
      cloudPuffArc: arc = 135,
      cloudIgnoreAspect = false,
      cloudAnchorsUseEllipse = false,
      minimumWidth = 0,
      minimumHeight = 0,
    } = config;

    const anglestep = 360 / puffs;

    // ── Inner ellipse radii (from text + innerSep, scaled by √2) ──
    // TikZ: innerSep is already added to rx/ry by the pipeline.
    // The √2 factor comes from fitting a rectangle inside an ellipse.
    let xInner = textHalfW * Math.SQRT2;
    let yInner = textHalfH * Math.SQRT2;

    // Aspect ratio adjustment (PGF lines 637-650)
    // We skip this for now as our pipeline doesn't pass shape aspect;
    // cloudIgnoreAspect=true is the default effective behavior.
    // TODO: implement aspect ratio if needed.

    // ── Trig constants ──
    const halfComplementArc = (180 - arc) / 2;
    const arcRadiusQuotient = 0.5 * sec(halfComplementArc);
    const archeightQuotient = arcRadiusQuotient * (1 - sin(halfComplementArc));
    const sinHalfComplementArc = sin(halfComplementArc);
    const secHalfComplementArc = sec(halfComplementArc);

    // ── Cross-coupling factor k ──
    // k = sin(p/2) * (1 - cos(a/2)) / sin(a/2)
    const halfArc = arc / 2;
    const k = sin(anglestep / 2) * (1 - cos(halfArc)) / sin(halfArc);
    const cosHalfAnglestep = cos(anglestep / 2);

    // ── Outer (circum-) ellipse radii ──
    // X = x*cos(p/2) + k*y,  Y = y*cos(p/2) + k*x
    let xOuter = cosHalfAnglestep * xInner + k * yInner;
    let yOuter = cosHalfAnglestep * yInner + k * xInner;

    // Clamp to minimum dimensions
    xOuter = Math.max(xOuter, minimumWidth / 2);
    yOuter = Math.max(yOuter, minimumHeight / 2);

    // ── Recalculate inner radii from (possibly clamped) outer ──
    // x = (X*cos(p/2) - k*Y) / (cos²(p/2) - k²)
    // y = (Y*cos(p/2) - k*X) / (cos²(p/2) - k²)
    const denom = cosHalfAnglestep * cosHalfAnglestep - k * k;
    xInner = (xOuter * cosHalfAnglestep - k * yOuter) / denom;
    yInner = (yOuter * cosHalfAnglestep - k * xOuter) / denom;

    // ── Bézier constants ──
    const quarterArc = arc / 4;
    const sinQuarterArc = sin(quarterArc);
    const cosQuarterArc = cos(quarterArc);
    const tanQuarterArc = tan(quarterArc);

    return {
      center: { x: center.x, y: center.y },
      outerSep,
      // Preserve rx/ry for emitter re-call (savedGeometry is called again with ...geom)
      rx: textHalfW,
      ry: textHalfH,
      puffs,
      arc,
      anglestep,
      xInner,
      yInner,
      xOuter,
      yOuter,
      arcRadiusQuotient,
      sinHalfComplementArc,
      secHalfComplementArc,
      halfComplementArc,
      quarterArc,
      sinQuarterArc,
      cosQuarterArc,
      tanQuarterArc,
      k,
      cosHalfAnglestep,
      cloudAnchorsUseEllipse,
    };
  },

  // ── Named anchors ─────────────────────────────────────────────────
  // TikZ cloud: all directional anchors delegate to borderPoint.
  // We follow the same pattern.
  namedAnchors(geom) {
    const { center: c, xOuter, yOuter } = geom;
    // In SVG coords (y-down), we pass directions in SVG convention.
    // borderPoint expects SVG direction vectors.
    // For cloud, cardinal anchors use outer-radius-scaled directions
    // then call borderPoint (matching TikZ lines 823-878).
    //
    // NOTE: borderPoint handles the SVG↔math conversion internally.
    return {
      north:      cloudBorderPoint(geom, { x: 0,                     y: -yOuter }),
      south:      cloudBorderPoint(geom, { x: 0,                     y:  yOuter }),
      east:       cloudBorderPoint(geom, { x:  xOuter,               y: 0 }),
      west:       cloudBorderPoint(geom, { x: -xOuter,               y: 0 }),
      'north east': cloudBorderPoint(geom, { x:  0.707106 * xOuter, y: -0.707106 * yOuter }),
      'north west': cloudBorderPoint(geom, { x: -0.707106 * xOuter, y: -0.707106 * yOuter }),
      'south east': cloudBorderPoint(geom, { x:  0.707106 * xOuter, y:  0.707106 * yOuter }),
      'south west': cloudBorderPoint(geom, { x: -0.707106 * xOuter, y:  0.707106 * yOuter }),
    };
  },

  // ── Border point ──────────────────────────────────────────────────
  borderPoint(geom, direction) {
    return cloudBorderPoint(geom, direction);
  },

  // ── Background path ───────────────────────────────────────────────
  // Matches \backgroundpath (lines 894-1082).
  // Draws puffs at VISUAL size (no outerSep).
  backgroundPath(geom) {
    const {
      center: c, outerSep, puffs, anglestep,
      xInner, yInner,
      arcRadiusQuotient, sinHalfComplementArc,
      quarterArc, sinQuarterArc, cosQuarterArc, tanQuarterArc,
    } = geom;

    // All path computation in MATH coords (y-up), convert to SVG at the end.
    // Center in math coords: same x, negated y.
    const cx = c.x, cy = -c.y;

    // Start angle: 90 - anglestep/2
    let angle = 90 - anglestep / 2;

    // First arc point on inner ellipse
    const firstPt = ellipsePoint(cx, cy, xInner, yInner, angle);
    let endPt = firstPt;

    const segments = []; // collect { cp1, cp2, end } for cubic beziers

    for (let i = 1; i <= puffs; i++) {
      const startPt = endPt;

      if (i === puffs) {
        // Last puff closes back to first point exactly
        endPt = firstPt;
      } else {
        angle += anglestep;
        endPt = ellipsePoint(cx, cy, xInner, yInner, angle);
      }

      // Get puff parameters (in math coords, outerSep=0 for background path)
      const pp = getCloudPuffParameters(startPt, endPt, arcRadiusQuotient, sinHalfComplementArc, 0);

      // ── First half-arc Bézier ──
      const arcRotate1 = 90 - quarterArc + pp.arcslope;
      const sinR1 = sin(arcRotate1), cosR1 = cos(arcRotate1);
      const controlScale = pp.arcRadius * tanQuarterArc;

      // Control point 1 for first half-arc
      let kx = 0.552284745 * sinQuarterArc * controlScale;
      let ky = 0.552284745 * cosQuarterArc * controlScale;
      let cp1x = cosR1 * kx - sinR1 * ky + startPt.x;
      let cp1y = sinR1 * kx + cosR1 * ky + startPt.y;

      // Mid point of the full arc
      const midLocalX = -pp.halfChordLength;
      const midLocalY = pp.segmentHeight;
      const midRot = rotate(midLocalX, midLocalY, pp.arcslope);
      const midPt = { x: startPt.x + midRot.x, y: startPt.y + midRot.y };

      // Control point 2 for first half-arc
      kx = 0.552284745 * sinQuarterArc * controlScale;
      ky = -0.552284745 * cosQuarterArc * controlScale;
      let cp2x = cosR1 * kx - sinR1 * ky + midPt.x;
      let cp2y = sinR1 * kx + cosR1 * ky + midPt.y;

      segments.push({ cp1: { x: cp1x, y: cp1y }, cp2: { x: cp2x, y: cp2y }, end: midPt });

      // ── Second half-arc Bézier ──
      const arcRotate2 = quarterArc + 90 + pp.arcslope;
      const sinR2 = sin(arcRotate2), cosR2 = cos(arcRotate2);

      // Control point 1 for second half-arc
      kx = 0.552284745 * sinQuarterArc * controlScale;
      ky = 0.552284745 * cosQuarterArc * controlScale;
      cp1x = cosR2 * kx - sinR2 * ky + midPt.x;
      cp1y = sinR2 * kx + cosR2 * ky + midPt.y;

      // Control point 2 for second half-arc
      kx = 0.552284745 * sinQuarterArc * controlScale;
      ky = -0.552284745 * cosQuarterArc * controlScale;
      cp2x = cosR2 * kx - sinR2 * ky + endPt.x;
      cp2y = sinR2 * kx + cosR2 * ky + endPt.y;

      segments.push({ cp1: { x: cp1x, y: cp1y }, cp2: { x: cp2x, y: cp2y }, end: endPt });
    }

    // Build SVG path — convert math coords (y-up) to SVG (y-down): negate all y
    let d = `M ${firstPt.x} ${-firstPt.y}`;
    for (const seg of segments) {
      d += ` C ${seg.cp1.x} ${-seg.cp1.y} ${seg.cp2.x} ${-seg.cp2.y} ${seg.end.x} ${-seg.end.y}`;
    }
    d += ' Z';
    return d;
  },

  // ── Dynamic puff anchors ──────────────────────────────────────────
  // 'puff 1', 'puff 2', ... — apex of each puff.
  // Matches \pgf@sh@@cloudpuffanchor (lines 1330-1368).
  dynamicAnchor(name, geom) {
    const match = /^puff\s+(\d+)$/.exec(name);
    if (!match) return null;

    const n = parseInt(match[1], 10);
    if (n < 1 || n > geom.puffs) return null;

    const { center: c, anglestep, xInner, yInner, outerSep,
            arcRadiusQuotient, sinHalfComplementArc } = geom;

    // Math coords
    const cx = c.x, cy = -c.y;

    // Start angle for puff n (1-indexed)
    const halfAnglestep = anglestep / 2;
    const puffStartAngle = 90 - halfAnglestep + (n - 1) * anglestep;

    const arcStart = ellipsePoint(cx, cy, xInner, yInner, puffStartAngle);
    const arcEnd = ellipsePoint(cx, cy, xInner, yInner, puffStartAngle + anglestep);

    const pp = getCloudPuffParameters(arcStart, arcEnd, arcRadiusQuotient, sinHalfComplementArc, outerSep);

    // Puff apex: point on outer arc at arcslope + 90
    const anchorAngle = pp.arcslope + 90;
    const pt = {
      x: pp.circleCenter.x + pp.outerArcRadius * cos(anchorAngle),
      y: pp.circleCenter.y + pp.outerArcRadius * sin(anchorAngle),
    };

    // Convert math coords to SVG
    return { x: pt.x, y: -pt.y };
  },
});

// ── Border point implementation ─────────────────────────────────────
// Matches \anchorborder (lines 1089-1305).

/**
 * Find the point on the cloud border in the given direction.
 * Direction is in SVG coords (y-down).
 *
 * Two modes:
 *   - cloudAnchorsUseEllipse: simple ellipse border with outer radii
 *   - Precise (default): locate correct puff, binary search for exact point
 */
function cloudBorderPoint(geom, direction) {
  const { center, xOuter, yOuter, outerSep, cloudAnchorsUseEllipse } = geom;
  const dx = direction.x;
  const dy = direction.y;

  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
    return { x: center.x, y: center.y };
  }

  // ── Ellipse mode ──
  if (cloudAnchorsUseEllipse) {
    // Use pgfpointborderellipse with outer radii + outerSep
    const totalRx = xOuter + outerSep;
    const totalRy = yOuter + outerSep;
    const theta = Math.atan2(dy * totalRx, dx * totalRy);
    return {
      x: center.x + totalRx * Math.cos(theta),
      y: center.y + totalRy * Math.sin(theta),
    };
  }

  // ── Precise mode ──
  // Convert direction to math coords (negate y) for PGF-style angle computation
  const externalAngle = normalizeAngle(Math.atan2(-dy, dx) / DEG);

  return preciseBorderPoint(geom, externalAngle);
}

/**
 * Normalize angle to [0, 360).
 */
function normalizeAngle(a) {
  a = a % 360;
  if (a < 0) a += 360;
  return a;
}

/**
 * Precise border point: find the correct puff and binary-search within it.
 * Matches lines 1111-1304 of pgflibraryshapes.symbols.code.tex.
 *
 * @param {Object} geom - Cloud geometry
 * @param {number} externalAngle - Target angle in math convention [0,360)
 * @returns {{x,y}} Point in SVG coords
 */
function preciseBorderPoint(geom, externalAngle) {
  const {
    center: c, puffs, anglestep, xInner, yInner, outerSep,
    arcRadiusQuotient, sinHalfComplementArc, halfComplementArc, arc,
  } = geom;

  // Math coords center
  const cx = c.x, cy = -c.y;

  // ── Step 1: Locate the correct puff ──
  // Walk through miter points (junctions between puffs) to find which puff
  // contains the external angle.
  const halfAnglestep = anglestep / 2;

  // Find starting endAngle — the smallest end angle of the puff sequence
  let endAngle = 90 - halfAnglestep;
  while (endAngle - anglestep >= -anglestep) {
    endAngle -= anglestep;
  }

  let lastMiterAngle = 0;
  let foundEndAngle = endAngle;

  for (let i = 0; i < puffs; i++) {
    endAngle += anglestep;

    // Compute miter point: the junction between puffs, offset by outerSep
    const secondPt = ellipsePoint(cx, cy, xInner, yInner, endAngle);
    const thirdPt = ellipsePoint(cx, cy, xInner, yInner, endAngle + anglestep);
    const firstPt = ellipsePoint(cx, cy, xInner, yInner, endAngle - anglestep);

    const angleAlpha = pgfAngleBetween(firstPt, secondPt);
    const angleBeta = pgfAngleBetween(secondPt, thirdPt);

    // Miter offset: cosec of half the angle between adjacent edges + halfComplementArc
    const miterAngleArg = (angleBeta - angleAlpha) / 2 + halfComplementArc;
    const miterRadius = outerSep * csc(miterAngleArg);

    const miterDirection = (angleAlpha + angleBeta - 180) / 2;
    const miterPt = {
      x: secondPt.x + miterRadius * cos(miterDirection),
      y: secondPt.y + miterRadius * sin(miterDirection),
    };

    // Angle of miter point from origin
    let miterAngle = pgfAngleBetween({ x: cx, y: cy }, miterPt);
    // Guard against 360° = 0° wrapping
    if (miterAngle < lastMiterAngle) miterAngle += 360;
    lastMiterAngle = miterAngle;

    if (externalAngle <= miterAngle) {
      foundEndAngle = endAngle;
      break;
    }
    foundEndAngle = endAngle + anglestep;
  }

  // ── Step 2: Binary search within the puff ──
  const startAngle = normalizeAngle(normalizeAngle(foundEndAngle) - anglestep);
  const effectiveEndAngle = normalizeAngle(foundEndAngle);

  const arcStartPt = ellipsePoint(cx, cy, xInner, yInner, startAngle);
  const arcEndPt = ellipsePoint(cx, cy, xInner, yInner, effectiveEndAngle);

  const pp = getCloudPuffParameters(arcStartPt, arcEndPt, arcRadiusQuotient, sinHalfComplementArc, outerSep);

  // Handle arcs straddling 0°
  const straddles = effectiveEndAngle < startAngle;
  const targetAngle = straddles ? normalizeAngle(externalAngle + 180) : externalAngle;

  // Binary search: find the angle on the circular arc whose center-relative
  // angle best matches the external angle.
  let s = halfComplementArc;
  let e = halfComplementArc + arc;
  let nearestArcParam = (s + e) / 2;
  let nearestDist = 360;

  for (let iter = 0; iter < 20; iter++) {
    const p = (s + e) / 2;
    if (Math.abs(p - s) < 1e-6) break;

    // Point on the circular arc at parameter p
    const a = p + pp.arcslope;
    const arcPt = {
      x: pp.circleCenter.x + pp.outerArcRadius * cos(a),
      y: pp.circleCenter.y + pp.outerArcRadius * sin(a),
    };

    let q = pgfAngleBetween({ x: cx, y: cy }, arcPt);
    if (straddles) q = normalizeAngle(q + 180);

    if (Math.abs(targetAngle - q) < 0.01) {
      nearestArcParam = p;
      break;
    }

    if (targetAngle < q) {
      e = p;
    } else {
      s = p;
    }

    if (Math.abs(targetAngle - q) < nearestDist) {
      nearestDist = Math.abs(targetAngle - q);
      nearestArcParam = p;
    }
  }

  // Final point on outer arc
  const anchorAngle = nearestArcParam + pp.arcslope;
  const result = {
    x: pp.circleCenter.x + pp.outerArcRadius * cos(anchorAngle),
    y: pp.circleCenter.y + pp.outerArcRadius * sin(anchorAngle),
  };

  // Convert math coords to SVG (negate y)
  return { x: result.x, y: -result.y };
}
