import { cumulativeDistances } from './path-utils.js';

/**
 * Apply PGF-style random steps decoration to a sampled point array.
 *
 * Each interior point is offset by (rand*amplitude, rand*amplitude) in the
 * local tangent frame (x = along-path, y = perpendicular), matching the PGF
 * random steps decoration engine (pgflibrarydecorations.pathmorphing.code.tex:86-101).
 *
 * @param {Array<{x: number, y: number}>} points - Sampled path points
 * @param {number} amplitude - Maximum offset (px)
 * @param {SeededRandom} prng - Seeded PRNG instance
 * @param {Object} [options]
 * @param {boolean} [options.closed=false] - True for closed paths (no fixed endpoints)
 * @param {number} [options.fixedStart=0] - Distance from start to keep unmodified (pre region)
 * @param {number} [options.fixedEnd=0] - Distance from end to keep unmodified (post region)
 * @returns {Array<{x: number, y: number}>}
 */
export function applyRandomSteps(points, amplitude, prng, options = {}) {
  const { closed = false, fixedStart = 0, fixedEnd = 0 } = options;
  const n = points.length;
  if (n < 2) return points.map(p => ({ ...p }));

  const dists = cumulativeDistances(points);
  const totalLen = dists[n - 1];

  return points.map((p, i) => {
    // Open paths: preserve first and last points
    if (!closed && (i === 0 || i === n - 1)) return { x: p.x, y: p.y };

    // Pre/post fixed regions (open paths only)
    if (!closed && fixedStart > 0 && dists[i] < fixedStart) return { x: p.x, y: p.y };
    if (!closed && fixedEnd > 0 && dists[i] > totalLen - fixedEnd) return { x: p.x, y: p.y };

    // Compute tangent direction from neighboring points
    const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty);

    if (len < 1e-10) return { x: p.x, y: p.y };

    // Unit tangent and normal (perpendicular, 90° CCW)
    const ux = tx / len, uy = ty / len;
    const nx = -uy, ny = ux;

    // Random offsets in local frame (PGF: rand*amplitude for both axes)
    const alongOffset = prng.rand() * amplitude;
    const perpOffset = prng.rand() * amplitude;

    return {
      x: p.x + alongOffset * ux + perpOffset * nx,
      y: p.y + alongOffset * uy + perpOffset * ny,
    };
  });
}
