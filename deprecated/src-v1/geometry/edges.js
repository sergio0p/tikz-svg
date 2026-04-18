/**
 * Edge path computation for straight, bent, and self-loop edges.
 * Returns SVG path data strings and key geometry points.
 *
 * Each node object is expected to have:
 *   { center: { x, y }, shape: shapeImpl, geom: savedGeometry }
 * where shapeImpl.borderPoint(center, geom, direction) returns a point on the border.
 */

import {
  vec,
  vecAdd,
  vecSub,
  vecScale,
  vecLength,
  vecNormalize,
  vecFromAngle,
  angleBetween,
} from '../core/math.js';
import { DEFAULTS } from '../core/constants.js';

// ────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────

/**
 * Get the border point of a node in a given direction vector.
 * @param {Object} node
 * @param {{ x: number, y: number }} direction - unit-ish direction vector
 * @returns {{ x: number, y: number }}
 */
function borderPt(node, direction) {
  return node.shape.borderPoint(node.geom, direction);
}

/**
 * Resolve a bend specification into a signed angle in degrees.
 * - 'left'  → +defaultAngle  (curve bows to the left)
 * - 'right' → −defaultAngle  (curve bows to the right)
 * - number  → that number directly (positive = left, negative = right)
 * @param {string|number} bend
 * @param {number} defaultAngle
 * @returns {number}
 */
function resolveBendAngle(bend, defaultAngle) {
  if (bend === 'left') return defaultAngle;
  if (bend === 'right') return -defaultAngle;
  if (typeof bend === 'number') return bend;
  // Fallback: treat truthy string as left
  return defaultAngle;
}

/**
 * Find the intersection of two rays.
 *   ray1: point p1, direction d1
 *   ray2: point p2, direction d2
 * Returns the intersection point, or the midpoint of p1–p2 if rays are parallel.
 */
function rayIntersection(p1, d1, p2, d2) {
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < 1e-10) {
    // Parallel — return midpoint as fallback
    return vec((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  }
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / denom;
  return vec(p1.x + t * d1.x, p1.y + t * d1.y);
}

// ────────────────────────────────────────────
// Loop direction presets
// ────────────────────────────────────────────

const LOOP_PRESETS = {
  above: { out: 120, in: 60 },
  below: { out: 240, in: 300 },
  left:  { out: 150, in: 210 },
  right: { out: 30,  in: 330 },
};

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Compute a straight-line edge between two nodes.
 * @param {Object} sourceNode
 * @param {Object} targetNode
 * @returns {{ path: string, startPoint: Object, endPoint: Object, type: 'straight' }}
 */
export function computeStraightEdge(sourceNode, targetNode) {
  const dir = vecNormalize(vecSub(targetNode.center, sourceNode.center));
  const revDir = vecScale(dir, -1);

  const startPoint = borderPt(sourceNode, dir);
  const endPoint = borderPt(targetNode, revDir);

  const path = `M ${startPoint.x} ${startPoint.y} L ${endPoint.x} ${endPoint.y}`;

  return { path, startPoint, endPoint, type: 'straight' };
}

/**
 * Compute a bent (quadratic Bezier) edge between two nodes.
 *
 * TikZ semantics: `bend left=30` means the curve bows to the left of the
 * travel direction by 30 degrees.  The departure angle is rotated +30 from
 * the baseline and the arrival angle is rotated -30 from the reverse
 * baseline, so the tangent rays meet at a single control point.
 *
 * @param {Object} sourceNode
 * @param {Object} targetNode
 * @param {string|number} bend - 'left', 'right', or angle in degrees
 * @param {Object} [defaults]
 * @returns {{ path: string, startPoint: Object, endPoint: Object, controlPoint: Object, type: 'quadratic' }}
 */
export function computeBentEdge(sourceNode, targetNode, bend, defaults = {}) {
  const bendDefault = defaults.bendAngle ?? DEFAULTS.bendAngle;
  const bendAngle = resolveBendAngle(bend, bendDefault);

  // Base angle from source center to target center (TikZ convention)
  const baseAngle = angleBetween(sourceNode.center, targetNode.center);

  // Departure: rotate base angle by +bendAngle
  const departureAngle = baseAngle + bendAngle;
  // Arrival: the reverse base angle rotated by -bendAngle
  const arrivalAngle = baseAngle + 180 - bendAngle;

  const departureDir = vecFromAngle(departureAngle);
  const arrivalDir = vecFromAngle(arrivalAngle);

  const startPoint = borderPt(sourceNode, departureDir);
  const endPoint = borderPt(targetNode, arrivalDir);

  // Control point = intersection of the two tangent rays
  const controlPoint = rayIntersection(
    startPoint, departureDir,
    endPoint, arrivalDir
  );

  const path = `M ${startPoint.x} ${startPoint.y} Q ${controlPoint.x} ${controlPoint.y} ${endPoint.x} ${endPoint.y}`;

  return { path, startPoint, endPoint, controlPoint, type: 'quadratic' };
}

/**
 * Compute a self-loop edge on a single node.
 *
 * @param {Object} node
 * @param {string|Object} loop - preset name ('above', 'below', 'left', 'right')
 *   or object { out, in, looseness? }
 * @param {Object} [defaults]
 * @returns {{ path: string, startPoint: Object, endPoint: Object, cp1: Object, cp2: Object, type: 'cubic' }}
 */
export function computeLoopEdge(node, loop, defaults = {}) {
  const loopSize = defaults.loopSize ?? DEFAULTS.loopSize;

  const preset = typeof loop === 'string'
    ? (LOOP_PRESETS[loop] ?? LOOP_PRESETS.above)
    : null;

  const outAngle = preset?.out ?? loop?.out ?? 120;
  const inAngle = preset?.in ?? loop?.in ?? 60;
  const looseness = loop?.looseness ?? 1;

  const effectiveSize = loopSize * looseness;

  const outDir = vecFromAngle(outAngle);
  const inDir = vecFromAngle(inAngle);

  const startPoint = borderPt(node, outDir);
  const endPoint = borderPt(node, inDir);

  const cp1 = vecAdd(startPoint, vecScale(outDir, effectiveSize));
  const cp2 = vecAdd(endPoint, vecScale(inDir, effectiveSize));

  const path = `M ${startPoint.x} ${startPoint.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${endPoint.x} ${endPoint.y}`;

  return { path, startPoint, endPoint, cp1, cp2, type: 'cubic' };
}

/**
 * Unified edge path dispatcher.
 *
 * @param {Object} sourceNode
 * @param {Object|null} targetNode - null for self-loops
 * @param {Object} edgeConfig - { bend?, loop?, out?, in?, looseness? }
 * @param {Object} [defaults]
 * @returns {Object} Edge geometry (shape depends on edge type)
 */
export function computeEdgePath(sourceNode, targetNode, edgeConfig = {}, defaults = {}) {
  // Self-loop: explicit loop property, or source === target
  if (edgeConfig.loop || targetNode === null || targetNode === sourceNode) {
    const loopSpec = edgeConfig.loop || 'above';

    // Allow explicit out/in/looseness to override a string preset
    if (edgeConfig.out != null || edgeConfig.in != null) {
      return computeLoopEdge(sourceNode, {
        out: edgeConfig.out ?? 120,
        in: edgeConfig.in ?? 60,
        looseness: edgeConfig.looseness ?? 1,
      }, defaults);
    }

    return computeLoopEdge(sourceNode, loopSpec, defaults);
  }

  // Explicit out/in angles on a non-loop edge: treat as bent with computed angles
  if (edgeConfig.out != null && edgeConfig.in != null) {
    const looseness = edgeConfig.looseness ?? 1;
    const outDir = vecFromAngle(edgeConfig.out);
    const inDir = vecFromAngle(edgeConfig.in);

    const startPoint = borderPt(sourceNode, outDir);
    const endPoint = borderPt(targetNode, inDir);

    // Scale control-point distance by looseness and the distance between centers
    const dist = vecLength(vecSub(targetNode.center, sourceNode.center));
    const cpDist = dist * 0.3928 * looseness; // 0.3928 ≈ TikZ default factor for looseness 1

    const cp1 = vecAdd(startPoint, vecScale(outDir, cpDist));
    const cp2 = vecAdd(endPoint, vecScale(inDir, cpDist));

    const path = `M ${startPoint.x} ${startPoint.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${endPoint.x} ${endPoint.y}`;

    return { path, startPoint, endPoint, cp1, cp2, type: 'cubic' };
  }

  // Bent edge
  if (edgeConfig.bend != null) {
    return computeBentEdge(sourceNode, targetNode, edgeConfig.bend, defaults);
  }

  // Default: straight
  return computeStraightEdge(sourceNode, targetNode);
}
