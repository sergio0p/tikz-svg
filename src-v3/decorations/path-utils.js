/**
 * SVG path parsing, point sampling, and path emission utilities.
 * Supports commands: M, L, Q, C, Z (absolute only).
 */

/**
 * Parse an SVG path data string into an array of commands.
 * @param {string} d - SVG path data (e.g., "M 0 0 L 10 0 Q 5 10 10 0")
 * @returns {Array<{type: string, args: number[]}>}
 */
export function parseSVGPath(d) {
  const commands = [];
  const tokens = d.match(/[MLQCAZmlqcaz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return commands;

  let current = null;
  let nums = [];

  for (const token of tokens) {
    if (/[A-Za-z]/.test(token)) {
      if (current != null) {
        commands.push({ type: current.toUpperCase(), args: nums });
      }
      current = token;
      nums = [];
    } else {
      nums.push(parseFloat(token));
    }
  }
  if (current != null) {
    commands.push({ type: current.toUpperCase(), args: nums });
  }
  return commands;
}

/**
 * Check if a parsed path is closed (ends with Z).
 */
export function isClosedPath(commands) {
  return commands.length > 0 && commands[commands.length - 1].type === 'Z';
}

/**
 * Sample points along a parsed SVG path at approximately `interval` spacing.
 * Always includes start and end points of each segment.
 * For closed paths, the last point coincides with the first.
 *
 * @param {Array} commands - Output of parseSVGPath
 * @param {number} interval - Desired spacing between samples (px)
 * @returns {Array<{x: number, y: number}>}
 */
export function samplePath(commands, interval) {
  const points = [];
  let cx = 0, cy = 0;
  let mx = 0, my = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        cx = cmd.args[0]; cy = cmd.args[1];
        mx = cx; my = cy;
        if (points.length === 0) points.push({ x: cx, y: cy });
        break;
      case 'L':
        sampleLineSegment(points, cx, cy, cmd.args[0], cmd.args[1], interval);
        cx = cmd.args[0]; cy = cmd.args[1];
        break;
      case 'Q':
        sampleQuadraticSegment(points, cx, cy,
          cmd.args[0], cmd.args[1], cmd.args[2], cmd.args[3], interval);
        cx = cmd.args[2]; cy = cmd.args[3];
        break;
      case 'C':
        sampleCubicSegment(points, cx, cy,
          cmd.args[0], cmd.args[1], cmd.args[2], cmd.args[3],
          cmd.args[4], cmd.args[5], interval);
        cx = cmd.args[4]; cy = cmd.args[5];
        break;
      case 'Z':
        if (Math.hypot(cx - mx, cy - my) > 0.1) {
          sampleLineSegment(points, cx, cy, mx, my, interval);
        }
        cx = mx; cy = my;
        break;
    }
  }
  return points;
}

function sampleLineSegment(points, x0, y0, x1, y1, interval) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.round(len / interval));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    points.push({ x: x0 + t * (x1 - x0), y: y0 + t * (y1 - y0) });
  }
}

function sampleQuadraticSegment(points, x0, y0, cx, cy, x1, y1, interval) {
  const chordLen = Math.hypot(x1 - x0, y1 - y0);
  const polyLen = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
  const approxLen = (chordLen + polyLen) / 2;
  const steps = Math.max(2, Math.round(approxLen / interval));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push({
      x: u * u * x0 + 2 * u * t * cx + t * t * x1,
      y: u * u * y0 + 2 * u * t * cy + t * t * y1,
    });
  }
}

function sampleCubicSegment(points, x0, y0, c1x, c1y, c2x, c2y, x1, y1, interval) {
  const chordLen = Math.hypot(x1 - x0, y1 - y0);
  const polyLen = Math.hypot(c1x - x0, c1y - y0) +
                  Math.hypot(c2x - c1x, c2y - c1y) +
                  Math.hypot(x1 - c2x, y1 - c2y);
  const approxLen = (chordLen + polyLen) / 2;
  const steps = Math.max(2, Math.round(approxLen / interval));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push({
      x: u*u*u * x0 + 3*u*u*t * c1x + 3*u*t*t * c2x + t*t*t * x1,
      y: u*u*u * y0 + 3*u*u*t * c1y + 3*u*t*t * c2y + t*t*t * y1,
    });
  }
}

/**
 * Convert a point array to an SVG path data string.
 * @param {Array<{x: number, y: number}>} points
 * @param {boolean} closed - Append Z if true
 * @returns {string}
 */
export function pointsToPath(points, closed) {
  if (points.length === 0) return '';
  const n = (v) => Math.round(v * 100) / 100;
  const parts = [`M ${n(points[0].x)} ${n(points[0].y)}`];
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${n(points[i].x)} ${n(points[i].y)}`);
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

/**
 * Compute cumulative distance array for a point sequence.
 * @param {Array<{x: number, y: number}>} points
 * @returns {number[]} - dists[i] = total distance from points[0] to points[i]
 */
export function cumulativeDistances(points) {
  const d = [0];
  for (let i = 1; i < points.length; i++) {
    d.push(d[i - 1] + Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y
    ));
  }
  return d;
}
