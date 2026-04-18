/**
 * Universal coordinate resolver.
 * Converts various point representations into { x, y } SVG coordinates.
 */

/**
 * Resolve a point from various input formats.
 * @param {Object|string} point - One of:
 *   - { x, y }           -> absolute SVG coordinates (returned as-is)
 *   - 'nodeName'         -> center of a named node (requires nodeRegistry)
 *   - 'nodeName.anchor'  -> specific anchor on a named node
 * @param {Object} opts
 * @param {Object} [opts.nodeRegistry] - Map of node names to node objects.
 *   Each node object must have a `shape` (with an `anchor(name, geom)` method)
 *   and a `geom` (the saved geometry from `savedGeometry()`).
 * @returns {{ x: number, y: number }}
 * @throws {Error} If the point format is unrecognised or a referenced node/anchor
 *   cannot be found.
 */
export function resolvePoint(point, opts = {}) {
  // Already a coordinate pair
  if (typeof point === 'object' && point !== null && 'x' in point && 'y' in point) {
    return { x: point.x, y: point.y };
  }

  if (typeof point !== 'string') {
    throw new Error(`resolvePoint: unsupported point type "${typeof point}"`);
  }

  const { nodeRegistry } = opts;
  if (!nodeRegistry) {
    throw new Error(
      `resolvePoint: string point "${point}" requires a nodeRegistry`
    );
  }

  // Split on first '.' only — node names may not contain dots, anchor names may.
  const dotIndex = point.indexOf('.');
  const nodeName = dotIndex === -1 ? point : point.slice(0, dotIndex);
  const anchorName = dotIndex === -1 ? 'center' : point.slice(dotIndex + 1);

  const node = nodeRegistry[nodeName];
  if (!node) {
    throw new Error(`resolvePoint: unknown node "${nodeName}"`);
  }

  const { shape, geom } = node;
  if (!shape || !geom) {
    throw new Error(
      `resolvePoint: node "${nodeName}" is missing shape or geometry`
    );
  }

  return shape.anchor(anchorName, geom);
}
