/**
 * Shape registry and factory.
 * Shapes register themselves on import; consumers look them up by name.
 */

import { vecFromAngle, vecNormalize } from '../core/math.js';

const registry = {};

/**
 * Find the closest intersection of a ray from `origin` in `dir` with a convex polygon.
 * Used by polygon-based shapes for borderPoint.
 *
 * @param {{ x, y }} origin - Ray origin (typically shape center)
 * @param {{ x, y }} dir - Ray direction (will be normalized)
 * @param {{ x, y }[]} vertices - Polygon vertices in order
 * @returns {{ x, y }}
 */
export function polygonBorderPoint(origin, dir, vertices) {
  const d = vecNormalize(dir);
  if (d.x === 0 && d.y === 0) return { x: origin.x, y: origin.y };

  const n = vertices.length;
  let bestT = Infinity;
  let bestPt = { x: origin.x, y: origin.y };

  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    // Edge vector E = B - A
    const ex = b.x - a.x, ey = b.y - a.y;
    // F = Origin - A (ray origin relative to segment start)
    const fx = origin.x - a.x, fy = origin.y - a.y;
    // D × E (2D cross product)
    const denom = d.x * ey - d.y * ex;
    if (Math.abs(denom) < 1e-10) continue;
    // t = (E × F) / (D × E), u = (D × F) / (D × E)
    const t = (ex * fy - ey * fx) / denom;
    const u = (d.x * fy - d.y * fx) / denom;
    if (t > 1e-10 && u >= -1e-10 && u <= 1 + 1e-10 && t < bestT) {
      bestT = t;
      bestPt = { x: origin.x + d.x * t, y: origin.y + d.y * t };
    }
  }
  return bestPt;
}

/**
 * Register a shape implementation under a given name.
 * @param {string} name - e.g. 'circle', 'rectangle', 'ellipse'
 * @param {Object} shapeImpl - Must expose savedGeometry, anchor,
 *   borderPoint, backgroundPath, and anchors.
 */
export function registerShape(name, shapeImpl) {
  registry[name] = shapeImpl;
}

/**
 * Retrieve a registered shape by name.
 * @param {string} name
 * @returns {Object} The shape implementation.
 * @throws {Error} If the shape has not been registered.
 */
export function getShape(name) {
  const shape = registry[name];
  if (!shape) {
    throw new Error(`getShape: unknown shape "${name}"`);
  }
  return shape;
}

/**
 * Factory for creating and registering shapes with common boilerplate.
 *
 * Handles:
 *   - outerSep storage in savedGeometry
 *   - 'center' anchor (always geom.center)
 *   - Numeric angle anchors (delegate to borderPoint via vecFromAngle)
 *   - Unknown anchor error with shape name
 *   - anchors() list derived from namedAnchors keys
 *   - Self-registration
 *
 * @param {string} name - Shape name for registry
 * @param {Object} spec
 * @param {Function} spec.savedGeometry - (config) => geom object. Factory adds outerSep to config.
 * @param {Function} spec.namedAnchors - (geom) => { anchorName: {x,y}, ... }. Do NOT include 'center'.
 * @param {Function} spec.borderPoint - (geom, direction) => {x,y}. Direction is a unit-ish vector.
 * @param {Function} spec.backgroundPath - (geom) => SVG path string. Should use visual dimensions (subtract outerSep).
 * @param {Function} [spec.dynamicAnchor] - (name, geom) => {x,y}|null. For parameterised anchors (e.g. 'puff 3').
 * @returns {Object} The registered shape implementation.
 */
export function createShape(name, spec) {
  const anchorNameCache = ['center', 'mid', 'base', 'mid east', 'mid west', 'base east', 'base west',
    ...Object.keys(spec.namedAnchors({
    // Probe call with dummy geom to extract anchor names.
    // namedAnchors must return consistent keys regardless of geom values.
    center: { x: 0, y: 0 }, outerSep: 0, _probe: true,
  }))];

  const shape = {
    savedGeometry(config) {
      const outerSep = config.outerSep ?? 0;
      const geom = spec.savedGeometry({ ...config, outerSep });
      // Ensure outerSep is stored
      if (geom.outerSep == null) geom.outerSep = outerSep;
      return geom;
    },

    anchor(anchorName, geom) {
      if (anchorName === 'center') {
        return { x: geom.center.x, y: geom.center.y };
      }

      // mid/base anchors — TikZ text-baseline anchors.
      // Without text baseline tracking, mid = base = center y.
      // East/west variants use the shape's east/west border x at center y.
      if (anchorName === 'mid' || anchorName === 'base') {
        return { x: geom.center.x, y: geom.center.y };
      }
      if (anchorName === 'mid east' || anchorName === 'base east') {
        const named = spec.namedAnchors(geom);
        if (named.east) return { x: named.east.x, y: geom.center.y };
        return shape.borderPoint(geom, { x: 1, y: 0 });
      }
      if (anchorName === 'mid west' || anchorName === 'base west') {
        const named = spec.namedAnchors(geom);
        if (named.west) return { x: named.west.x, y: geom.center.y };
        return shape.borderPoint(geom, { x: -1, y: 0 });
      }

      const named = spec.namedAnchors(geom);
      if (anchorName in named) {
        return named[anchorName];
      }

      // Dynamic anchors (e.g. 'puff 3' for cloud shape)
      if (spec.dynamicAnchor) {
        const pt = spec.dynamicAnchor(anchorName, geom);
        if (pt) return pt;
      }

      // Numeric angle → borderPoint
      const angle = parseFloat(anchorName);
      if (!Number.isNaN(angle)) {
        const dir = vecFromAngle(angle);
        return shape.borderPoint(geom, dir);
      }

      throw new Error(`${name}.anchor: unknown anchor "${anchorName}"`);
    },

    borderPoint: spec.borderPoint,
    backgroundPath: spec.backgroundPath,

    anchors() {
      return anchorNameCache;
    },
  };

  if (spec.partRegions) {
    shape.partRegions = spec.partRegions;
  }

  registerShape(name, shape);
  return shape;
}
