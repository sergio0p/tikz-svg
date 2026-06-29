/**
 * Watercolor decoration — algorithmic washes via Tyler Hobbs–style recursive
 * midpoint polygon deformation, stacked as many low-opacity layers.
 *
 * Design notes: src-v2/docs/WATERCOLOR.md
 *
 * Pure module: points/path-string in, structured data out. No DOM.
 * Determinism comes from a seeded PRNG (core/random.js gauss()).
 */

import {
  parseSVGPath, samplePath, isClosedPath, pointsToPath, cumulativeDistances,
} from './path-utils.js';
import { SeededRandom } from '../core/random.js';

/**
 * Recursively deform a polygon by displacing each edge's midpoint along its
 * normal by a Gaussian offset scaled by the edge length. Length-scaling makes
 * the recursion self-similar: variance decays geometrically as edges shorten,
 * with no explicit schedule (Hobbs's technique).
 *
 * Each point carries an arc-length parameter `t ∈ [0,1]`; child midpoints
 * inherit the mean of their parents' `t`. The optional `weight(t)` multiplies
 * displacement, so `weight(t) = 0` over a region yields a hard "wash up to the
 * line" edge with no clipping — the directional-bleed mechanism.
 *
 * @param {Array<{x:number,y:number,t?:number}>} points - Base polygon vertices
 * @param {Object} options
 * @param {number} [options.rounds=4] - Subdivision passes (point count doubles each)
 * @param {number} [options.magnitude=0.18] - Displacement as a fraction of edge length
 * @param {SeededRandom} options.prng - Seeded PRNG (required)
 * @param {boolean} [options.closed=false] - Treat as a closed loop
 * @param {(t:number)=>number} [options.weight] - Per-arc-length amplitude multiplier
 * @returns {Array<{x:number,y:number,t:number}>}
 */
export function deformPolygon(points, options = {}) {
  const { rounds = 4, magnitude = 0.18, prng, closed = false } = options;
  if (!prng) throw new Error('deformPolygon requires a prng');
  const weight = typeof options.weight === 'function' ? options.weight : () => 1;

  const n0 = points.length;
  let pts = points.map((p, i) => ({
    x: p.x,
    y: p.y,
    t: p.t !== undefined ? p.t : (closed ? i / n0 : i / Math.max(1, n0 - 1)),
  }));

  for (let r = 0; r < rounds; r++) {
    const out = [];
    const edges = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < edges; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      out.push(a);

      const ex = b.x - a.x, ey = b.y - a.y;
      const elen = Math.hypot(ex, ey);
      // On the closing edge of a closed loop, b.t wraps to ~0; treat it as 1
      // so the midpoint parameter stays monotone for weight().
      const bt = (closed && i === edges - 1) ? 1 : b.t;
      const mt = (a.t + bt) / 2;

      let mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (elen > 1e-9) {
        const nx = -ey / elen, ny = ex / elen;
        const disp = prng.gauss() * magnitude * elen * weight(mt);
        mx += nx * disp;
        my += ny * disp;
      }
      out.push({ x: mx, y: my, t: mt });
    }
    if (!closed) out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/**
 * Sweep an open polyline into a closed ribbon polygon by offsetting each vertex
 * along its normal by a half-width profile, walking out one side and back the
 * other. Feeds the same fill pipeline as closed shapes, so strokes become
 * washes too.
 *
 * @param {Array<{x:number,y:number}>} points - Spine polyline
 * @param {Object} options
 * @param {number} [options.width=12] - Nominal full stroke width (px)
 * @param {(t:number)=>number} [options.widthProfile] - Width multiplier over t∈[0,1]
 * @returns {Array<{x:number,y:number,t:number}>} closed ribbon polygon
 */
export function sweepRibbon(points, options = {}) {
  const { width = 12 } = options;
  const profile = typeof options.widthProfile === 'function'
    ? options.widthProfile
    : (t) => Math.sin(Math.PI * t) ** 0.5; // gentle brush taper at both ends
  const n = points.length;
  if (n < 2) return points.map(p => ({ x: p.x, y: p.y, t: 0 }));

  const dists = cumulativeDistances(points);
  const total = dists[n - 1] || 1;
  const left = [], right = [];

  for (let i = 0; i < n; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x, ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len, ny = tx / len;
    const t = dists[i] / total;
    const hw = Math.max(0, profile(t)) * width / 2;
    left.push({ x: points[i].x + nx * hw, y: points[i].y + ny * hw });
    right.push({ x: points[i].x - nx * hw, y: points[i].y - ny * hw });
  }

  // left edge forward, right edge backward → one closed loop
  const ribbon = left.concat(right.reverse());
  const m = ribbon.length;
  return ribbon.map((p, i) => ({ x: p.x, y: p.y, t: i / m }));
}

/**
 * Split any edge longer than maxLen into equal sub-segments so the base polygon
 * has roughly uniform edge lengths before deformation. samplePath flattens
 * curves but leaves straight edges whole, so without this a rectangle (4 long
 * edges) would deform far more violently than a circle (many short ones) —
 * roughness would depend on shape type. Inserting collinear points changes
 * neither the outline nor its bounding box.
 *
 * @param {Array<{x:number,y:number}>} points
 * @param {number} maxLen - Target maximum edge length (px)
 * @param {boolean} closed
 * @returns {Array<{x:number,y:number}>}
 */
function subdivideEdges(points, maxLen, closed) {
  const n = points.length;
  if (!(maxLen > 0) || n < 2) return points;
  const out = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i], b = points[(i + 1) % n];
    out.push({ ...a });
    const dx = b.x - a.x, dy = b.y - a.y;
    const steps = Math.floor(Math.hypot(dx, dy) / maxLen);
    for (let s = 1; s <= steps; s++) {
      const u = s / (steps + 1);
      out.push({ x: a.x + dx * u, y: a.y + dy * u });
    }
  }
  if (!closed) out.push({ ...points[n - 1] });
  return out;
}

/**
 * Build a stacked-layer watercolor wash from an SVG path string.
 *
 * Returns `{ nominal, layers }` where `nominal` is the undeformed sampled path
 * (use this for bounding-box measurement so bleed never inflates the viewBox)
 * and `layers` is an array of `{ d, opacity }` to render as sibling <path>
 * elements inside one <g>, all the same fill.
 *
 * Outer layers get more deformation rounds and more spread; inner layers fewer.
 * Stacking keeps pigment dense toward the spine/centre and feathery at the edge
 * (Hobbs's pigment-concentration trick); edge darkening emerges for free.
 *
 * @param {string} pathData - SVG path data string (M/L/Q/C/Z)
 * @param {Object} [options]
 * @param {number} [options.layers=10] - Number of stacked layers
 * @param {number} [options.segmentLength=20] - Coarse sampling interval (px); coarse on purpose
 * @param {number} [options.spread=0.30] - Base displacement fraction (roughness)
 * @param {number} [options.rounds=5] - Base subdivision rounds
 * @param {number} [options.opacity=0.15] - Per-layer fill opacity
 * @param {boolean} [options.concentrate=true] - Vary rounds/spread by layer for pigment centre
 * @param {SeededRandom} [options.prng] - Shared PRNG (takes precedence over seed)
 * @param {number} [options.seed=42] - PRNG seed when prng not given
 * @param {(t:number)=>number} [options.weight] - Per-arc-length bleed amplitude
 * @param {boolean} [options.closed] - Override closed detection (e.g. for ribbons)
 * @param {Array} [options.points] - Pre-sampled polygon; bypasses pathData sampling
 * @returns {{nominal: string, layers: Array<{d: string, opacity: number}>}}
 */
export function watercolorLayers(pathData, options = {}) {
  const {
    layers = 10,
    segmentLength = 20,
    spread = 0.30,
    rounds = 5,
    opacity = 0.15,
    concentrate = true,
    seed = 42,
    weight,
  } = options;

  const rng = options.prng || new SeededRandom(seed);

  let basePts, closed;
  if (Array.isArray(options.points)) {
    basePts = options.points.map(p => ({ ...p }));
    closed = options.closed ?? true;
  } else {
    const commands = parseSVGPath(pathData);
    closed = options.closed ?? isClosedPath(commands);
    let sampled = samplePath(commands, segmentLength);
    // Drop the duplicated closing point so subdivision doesn't double the seam.
    if (closed && sampled.length > 1) {
      const f = sampled[0], l = sampled[sampled.length - 1];
      if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) sampled = sampled.slice(0, -1);
    }
    basePts = sampled;
  }

  // Uniform edge lengths → shape-independent roughness (see subdivideEdges).
  basePts = subdivideEdges(basePts, segmentLength, closed);

  const nominal = pointsToPath(basePts, closed);
  if (basePts.length < 3) {
    return { nominal, layers: [{ d: nominal, opacity }] };
  }

  const out = [];
  for (let k = 0; k < layers; k++) {
    const f = layers === 1 ? 1 : k / (layers - 1); // 0 (inner) → 1 (outer)
    const layerRounds = concentrate ? Math.max(1, Math.round(rounds * (0.5 + f))) : rounds;
    const layerSpread = concentrate ? spread * (0.6 + 0.8 * f) : spread;
    const deformed = deformPolygon(basePts, {
      rounds: layerRounds,
      magnitude: layerSpread,
      prng: rng,
      weight,
      closed,
    });
    out.push({ d: pointsToPath(deformed, closed), opacity });
  }
  return { nominal, layers: out };
}

/**
 * Build a stacked-layer watercolor wash for a STROKE: sweep an open spine path
 * into a closed ribbon, then wash the ribbon exactly like a closed shape. The
 * pigment is the caller's stroke colour; overlaps darken by the same source-over
 * stacking as a fill wash, so a `\filldraw` outline gets an authentic dark rim.
 *
 * The returned `nominal` is the undeformed ribbon outline (spine ± width/2), so
 * the bounding box covers the brush width but not the bleed beyond it.
 *
 * @param {string} pathData - SVG path data for the spine
 * @param {Object} [options] - all watercolorLayers() options, plus:
 * @param {number} [options.width=12] - Nominal brush width (px)
 * @param {(t:number)=>number} [options.widthProfile] - Width multiplier over t∈[0,1]
 * @returns {{nominal: string, layers: Array<{d: string, opacity: number}>}}
 */
export function watercolorRibbon(pathData, options = {}) {
  const { width = 12, widthProfile, segmentLength = 20 } = options;
  const commands = parseSVGPath(pathData);
  let spine = samplePath(commands, segmentLength);
  // Densify straight runs so the brush taper renders along them, not only on
  // curves (samplePath flattens curves but leaves straight edges whole).
  spine = subdivideEdges(spine, segmentLength, false);
  if (spine.length < 2) return { nominal: pathData, layers: [] };
  const ribbon = sweepRibbon(spine, { width, widthProfile });
  return watercolorLayers(null, { ...options, points: ribbon, closed: true });
}
