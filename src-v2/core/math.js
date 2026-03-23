/**
 * Vector math and geometry helpers.
 * All angles follow TikZ convention: 0° = east, counterclockwise positive.
 * SVG y-axis is inverted (down = positive), so vecFromAngle(90) = { x: 0, y: -1 }.
 */

export function vec(x, y) {
  return { x, y };
}

export function vecAdd(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vecSub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vecScale(v, s) {
  return { x: v.x * s, y: v.y * s };
}

export function vecLength(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vecNormalize(v) {
  const len = vecLength(v);
  if (len < 1e-10) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Unit vector from angle in degrees (TikZ convention: CCW from east, SVG y-down).
 * 0° → right (1, 0), 90° → up (0, -1), 180° → left (-1, 0), 270° → down (0, 1)
 */
export function vecFromAngle(degrees) {
  const rad = degToRad(degrees);
  return { x: Math.cos(rad), y: -Math.sin(rad) };
}

export function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Angle in degrees from point `from` to point `to` (TikZ convention).
 * Returns value in [−180, 180].
 */
export function angleBetween(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // SVG y-down → negate dy for TikZ convention
  return radToDeg(Math.atan2(-dy, dx));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Point on quadratic Bézier at parameter t ∈ [0,1]. */
export function pointOnQuadBezier(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

/** Tangent vector on quadratic Bézier at parameter t. */
export function tangentOnQuadBezier(p0, p1, p2, t) {
  const mt = 1 - t;
  return {
    x: 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

/** Point on cubic Bézier at parameter t ∈ [0,1]. */
export function pointOnCubicBezier(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y,
  };
}

/** Tangent vector on cubic Bézier at parameter t. */
export function tangentOnCubicBezier(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x: 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

/** Offset a point perpendicular to the tangent direction by `distance`. Positive = left of tangent. */
export function perpendicularOffset(point, tangent, distance) {
  const norm = vecNormalize(tangent);
  // Perpendicular (rotated 90° CCW in screen coords, which is left of direction)
  return {
    x: point.x - norm.y * distance,
    y: point.y + norm.x * distance,
  };
}
