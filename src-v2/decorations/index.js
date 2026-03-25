import { parseSVGPath, samplePath, isClosedPath, pointsToPath } from './path-utils.js';
import { applyRandomSteps } from './random-steps.js';
import { applyRoundedCorners } from './rounded-corners.js';
import { SeededRandom } from '../core/random.js';

/**
 * Apply a path decoration, transforming an SVG path data string.
 *
 * Pipeline: parse → sample → decorate → smooth → emit
 *
 * @param {string} pathData - SVG path data string
 * @param {Object} options
 * @param {string} [options.type='random steps'] - Decoration type
 * @param {number} [options.segmentLength=10] - Sampling interval (px)
 * @param {number} [options.amplitude=3] - Max random offset (px)
 * @param {number} [options.roundedCorners=0] - Corner smoothing radius (0 = sharp)
 * @param {number} [options.preLength=0] - Straight start segment (open paths only)
 * @param {number} [options.postLength=0] - Straight end segment (open paths only)
 * @param {number} [options.seed=42] - PRNG seed (ignored if prng is provided)
 * @param {SeededRandom} [options.prng] - Shared PRNG instance (takes precedence over seed)
 * @returns {string} Decorated SVG path data string
 */
export function morphPath(pathData, options = {}) {
  const {
    type = 'random steps',
    segmentLength = 10,
    amplitude = 3,
    roundedCorners = 0,
    preLength = 0,
    postLength = 0,
    seed = 42,
    prng,
  } = options;

  const rng = prng || new SeededRandom(seed);
  const commands = parseSVGPath(pathData);
  const closed = isClosedPath(commands);

  let points = samplePath(commands, segmentLength);

  // Too few points to decorate meaningfully
  if (points.length < 3) return pathData;

  switch (type) {
    case 'random steps':
      points = applyRandomSteps(points, amplitude, rng, {
        closed,
        fixedStart: closed ? 0 : preLength,
        fixedEnd: closed ? 0 : postLength,
      });
      break;
    default:
      return pathData;
  }

  if (roundedCorners > 0) {
    return applyRoundedCorners(points, roundedCorners, closed);
  }

  return pointsToPath(points, closed);
}

/**
 * Convert a native SVG shape (circle, ellipse, rectangle) to an SVG path string.
 * Used by the emitter to obtain a path that can be decorated.
 *
 * All paths are centered at the origin (local coordinates within the node's <g>).
 *
 * @param {string} shapeName - 'circle', 'ellipse', or 'rectangle'
 * @param {Object} geom - Shape geometry from savedGeometry()
 * @param {Object} [opts]
 * @param {number} [opts.inset=0] - Additional inset (for accepting double borders)
 * @returns {string} SVG path data string
 */
export function shapeToSVGPath(shapeName, geom, opts = {}) {
  const inset = opts.inset ?? 0;
  const outerSep = geom.outerSep ?? 0;

  switch (shapeName) {
    case 'circle': {
      const radius = Math.max(0, (geom.radius ?? 20) - outerSep - inset);
      const k = radius * 0.5522847498;
      return `M ${radius} 0 C ${radius} ${k} ${k} ${radius} 0 ${radius} ` +
             `C ${-k} ${radius} ${-radius} ${k} ${-radius} 0 ` +
             `C ${-radius} ${-k} ${-k} ${-radius} 0 ${-radius} ` +
             `C ${k} ${-radius} ${radius} ${-k} ${radius} 0 Z`;
    }
    case 'ellipse': {
      const rx = Math.max(0, (geom.rx ?? 30) - outerSep - inset);
      const ry = Math.max(0, (geom.ry ?? 20) - outerSep - inset);
      const kx = rx * 0.5522847498;
      const ky = ry * 0.5522847498;
      return `M ${rx} 0 C ${rx} ${ky} ${kx} ${ry} 0 ${ry} ` +
             `C ${-kx} ${ry} ${-rx} ${ky} ${-rx} 0 ` +
             `C ${-rx} ${-ky} ${-kx} ${-ry} 0 ${-ry} ` +
             `C ${kx} ${-ry} ${rx} ${-ky} ${rx} 0 Z`;
    }
    case 'rectangle': {
      const hw = Math.max(0, (geom.halfWidth ?? 20) - outerSep - inset);
      const hh = Math.max(0, (geom.halfHeight ?? 15) - outerSep - inset);
      return `M ${-hw} ${-hh} L ${hw} ${-hh} L ${hw} ${hh} L ${-hw} ${hh} Z`;
    }
    default:
      return '';
  }
}
