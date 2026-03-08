/**
 * Shape registry.
 * Shapes register themselves on import; consumers look them up by name.
 */

const registry = {};

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
