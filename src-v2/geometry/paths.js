/**
 * Free-form path geometry.
 *
 * Builds SVG path strings from point arrays and computes
 * label positions along paths by linear interpolation.
 *
 * TikZ equivalent: \draw (a)--(b)--(c);
 * Source: pgfcorepathconstruct.code.tex (moveto, lineto, closepath)
 */

/**
 * Build an SVG path string and segment data from an array of points.
 *
 * @param {{ x: number, y: number }[]} points
 * @param {{ cycle?: boolean }} [opts]
 * @returns {{ d: string, segments: Array, totalLength: number }}
 */
export function buildPathGeometry(points, opts = {}) {
  if (!points || points.length === 0) {
    return { d: '', segments: [], totalLength: 0 };
  }

  if (points.length === 1) {
    return {
      d: `M ${points[0].x} ${points[0].y}`,
      segments: [],
      totalLength: 0,
    };
  }

  const parts = [`M ${points[0].x} ${points[0].y}`];
  const segments = [];
  let totalLength = 0;

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    parts.push(`L ${to.x} ${to.y}`);

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    totalLength += length;

    segments.push({ from, to, length, cumLength: totalLength });
  }

  if (opts.cycle) {
    const from = points[points.length - 1];
    const to = points[0];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    totalLength += length;
    segments.push({ from, to, length, cumLength: totalLength });
    parts.push('Z');
  }

  return { d: parts.join(' '), segments, totalLength };
}

/**
 * Compute a position along a path at fractional parameter t.
 *
 * @param {Array<{ from, to, length, cumLength }>} segments
 * @param {number} totalLength
 * @param {number} t - 0 = start, 1 = end
 * @returns {{ x: number, y: number, angle: number }}
 */
export function computePathLabelPosition(segments, totalLength, t) {
  if (segments.length === 0) {
    return { x: 0, y: 0, angle: 0 };
  }

  const targetDist = t * totalLength;

  for (const seg of segments) {
    const segStart = seg.cumLength - seg.length;
    if (targetDist <= seg.cumLength || seg === segments[segments.length - 1]) {
      const localT = seg.length > 0 ? (targetDist - segStart) / seg.length : 0;
      const clampedT = Math.max(0, Math.min(1, localT));

      const x = seg.from.x + (seg.to.x - seg.from.x) * clampedT;
      const y = seg.from.y + (seg.to.y - seg.from.y) * clampedT;
      const angle = Math.atan2(seg.to.y - seg.from.y, seg.to.x - seg.from.x);

      return { x, y, angle };
    }
  }

  const last = segments[segments.length - 1];
  return { x: last.to.x, y: last.to.y, angle: 0 };
}
