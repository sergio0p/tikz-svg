import { DEFAULTS } from '../core/constants.js';

/**
 * Resolve effective style for a node.
 * Merge order: DEFAULTS → config.stateStyle → config.states[id] properties
 * @param {string} nodeId
 * @param {Object} config - full config object
 * @returns {Object} resolved style with: radius, fill, stroke, strokeWidth, fontSize, fontFamily,
 *   shadow, dashed, opacity, shape, accepting, initial, acceptingInset, labelColor, className
 */
export function resolveNodeStyle(nodeId, config) {
  const base = {
    radius: DEFAULTS.nodeRadius,
    fill: DEFAULTS.nodeFill,
    stroke: DEFAULTS.nodeStroke,
    strokeWidth: DEFAULTS.nodeStrokeWidth,
    fontSize: DEFAULTS.fontSize,
    fontFamily: DEFAULTS.fontFamily,
    shadow: DEFAULTS.shadow,
    dashed: false,
    opacity: 1,
    shape: 'circle',
    accepting: false,
    initial: false,
    acceptingInset: DEFAULTS.acceptingInset,
    labelColor: '#000000',
    className: null,
  };
  // Merge stateStyle (global overrides), then per-node properties
  const stateStyle = config.stateStyle || {};
  const nodeProps = config.states?.[nodeId] || {};
  return { ...base, ...stateStyle, ...nodeProps };
}

/**
 * Resolve effective style for an edge.
 * Merge order: DEFAULTS → config.edgeStyle → per-edge properties
 * @param {number} edgeIndex
 * @param {Object} config - full config object
 * @returns {Object} resolved style with: stroke, strokeWidth, arrow, dashed, opacity,
 *   bend, loop, labelPos, labelSide, labelDistance, className
 */
export function resolveEdgeStyle(edgeIndex, config) {
  const base = {
    stroke: DEFAULTS.edgeColor,
    strokeWidth: DEFAULTS.edgeStrokeWidth,
    arrow: 'stealth',
    dashed: false,
    opacity: 1,
    bend: null,
    loop: null,
    labelPos: 0.5,
    labelSide: 'auto',
    labelDistance: 8,
    className: null,
  };
  const edgeStyle = config.edgeStyle || {};
  const edgeProps = config.edges?.[edgeIndex] || {};
  return { ...base, ...edgeStyle, ...edgeProps };
}

/**
 * Collect unique shadow filter definitions from resolved node styles.
 * shadow: true → DEFAULTS.shadowDefaults
 * shadow: { dx, dy, blur, color } → use as-is
 * Deduplicate by serializing params to create stable IDs.
 * @param {Object} resolvedNodes - map of nodeId → resolved style objects
 * @returns {Array<{ id, dx, dy, blur, color }>}
 */
export function collectShadowFilters(resolvedNodes) {
  const seen = new Map();
  for (const style of Object.values(resolvedNodes)) {
    if (!style.shadow) continue;

    const shadow = style.shadow === true
      ? { ...DEFAULTS.shadowDefaults }
      : { ...style.shadow };
    const key = `${shadow.dx}-${shadow.dy}-${shadow.blur}-${shadow.color}`;

    if (!seen.has(key)) {
      seen.set(key, { id: `shadow-${seen.size}`, ...shadow });
    }
    style._shadowFilterId = seen.get(key).id;
  }
  return [...seen.values()];
}
