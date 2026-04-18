/**
 * Shared utilities for multipart split shapes (rectangle split, circle split, ellipse split).
 */

/**
 * Part name constants matching PGF naming convention.
 * Rectangle split uses up to 20; circle/ellipse split use up to 4.
 */
export const PART_NAMES = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];

/**
 * Compute Y positions of chord lines that divide a circle/ellipse into N equal-area bands.
 * Returns array of N-1 normalized offsets in [-1, 1], sorted top-to-bottom
 * (most negative first, for SVG y-down where negative = above center).
 *
 * For N=2: chord at 0 (diameter).
 * For N=3,4: solve for equal areas using the circular segment area formula:
 *   A(u) = r^2 * (pi - arccos(u) + u*sqrt(1-u^2))
 * ranges from 0 (u=-1) to pi*r^2 (u=1).
 *
 * Works for ellipses too — horizontal slicing preserves area ratios.
 */
export function computeChordOffsets(parts) {
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
  offsets.sort((a, b) => a - b);
  return offsets;
}

/**
 * Chord half-width at y-offset from center of an ellipse with semi-axes (rx, ry).
 * For a circle, pass rx = ry = r.
 *   half-width = rx * sqrt(1 - (yOffset/ry)^2)
 */
export function chordHalfWidth(rx, ry, yOffset) {
  const u = yOffset / ry;
  const val = 1 - u * u;
  return val > 0 ? rx * Math.sqrt(val) : 0;
}
