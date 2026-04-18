import { DEFAULTS, LINE_WIDTHS, DASH_PATTERNS } from '../core/constants.js';
import { StyleRegistry, resolveGroupStyle } from './registry.js';

/**
 * Resolve a strokeWidth value: TikZ named widths → pt number; numbers pass through.
 */
export function resolveLineWidth(v) {
  if (typeof v === 'string' && v in LINE_WIDTHS) return LINE_WIDTHS[v];
  return v;
}

/**
 * Resolve a `dash` value: named TikZ pattern | numeric array | raw string | null.
 * Returns the SVG stroke-dasharray string, or null to omit the attribute.
 */
export function resolveDash(v) {
  if (v == null || v === 'solid') return null;
  if (Array.isArray(v)) return v.join(' ');
  if (typeof v === 'string' && v in DASH_PATTERNS) return DASH_PATTERNS[v];
  return v;
}

/**
 * Resolve dasharray for an element, honoring new `dash` key and legacy
 * `dashed`/`dotted` booleans. Returns SVG dasharray string or null.
 */
export function resolveStrokeDash(style) {
  if (style.dash != null) return resolveDash(style.dash);
  if (style.dotted) return typeof style.dotted === 'string' ? style.dotted : '2 3';
  if (style.dashed) return typeof style.dashed === 'string' ? style.dashed : '6 4';
  return null;
}

/**
 * Collect optional stroke attributes (cap/join/miter/fill-rule) from a resolved style.
 * Returns an attribute bag with only the keys the caller should set. TikZ
 * cap name `rect` is translated to SVG `square`.
 */
export function resolveStrokeAttrs(style) {
  const out = {};
  if (style.lineCap) {
    out['stroke-linecap'] = style.lineCap === 'rect' ? 'square' : style.lineCap;
  }
  if (style.lineJoin) {
    out['stroke-linejoin'] = style.lineJoin;
  }
  if (style.miterLimit != null) {
    out['stroke-miterlimit'] = style.miterLimit;
  }
  if (style.fillRule) {
    out['fill-rule'] = style.fillRule;
  }
  return out;
}

/** TikZ named font sizes → pixel equivalents. */
const FONT_SIZE_MAP = {
  tiny: 7, scriptsize: 8, footnotesize: 9, small: 10,
  normalsize: 12, large: 14, Large: 17, LARGE: 20, huge: 24, Huge: 28,
};

/**
 * TikZ `color=NAME` shorthand. Spread layer.color onto the named fields,
 * but only where the layer has not already set them explicitly.
 * Returns a new object; never mutates input.
 */
function spreadColor(layer, fields) {
  if (!layer || layer.color == null) return layer;
  const out = { ...layer };
  for (const f of fields) {
    if (out[f] === undefined) out[f] = layer.color;
  }
  return out;
}

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
    decoration: null,
    innerSep: DEFAULTS.innerSep,
    minimumWidth: 0,
    minimumHeight: 0,
    textWidth: 0,
    align: 'center',
    anchor: null,
    xshift: 0,
    yshift: 0,
    rotate: 0,
    nodeScale: 1,
    roundedCorners: 0,
  };
  // Merge: DEFAULTS → stateStyle → group style → expanded named style + per-node
  const registry = new StyleRegistry(config.styles);
  const nodeColorFields = ['stroke', 'fill', 'labelColor'];
  const stateStyle = spreadColor(registry.expand(config.stateStyle || {}), nodeColorFields);
  const groupStyle = spreadColor(resolveGroupStyle(config.groups, 'nodes', nodeId, registry), nodeColorFields);
  const nodeProps = config.states?.[nodeId] || {};
  const expandedProps = spreadColor(registry.expand(nodeProps), nodeColorFields);
  const merged = { ...base, ...stateStyle, ...groupStyle, ...expandedProps };
  // Resolve named font sizes
  if (typeof merged.fontSize === 'string') {
    merged.fontSize = FONT_SIZE_MAP[merged.fontSize] ?? DEFAULTS.fontSize;
  }
  merged.strokeWidth = resolveLineWidth(merged.strokeWidth);
  return merged;
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
    labelDistance: DEFAULTS.labelDistance,
    innerSep: DEFAULTS.innerSep,
    shortenStart: DEFAULTS.shortenStart,
    shortenEnd: DEFAULTS.shortenEnd,
    className: null,
    decoration: null,
  };
  // Merge: DEFAULTS → edgeStyle → group style → expanded named style + per-edge
  const registry = new StyleRegistry(config.styles);
  const edgeColorFields = ['stroke'];
  const edgeStyle = spreadColor(registry.expand(config.edgeStyle || {}), edgeColorFields);
  const groupStyle = spreadColor(resolveGroupStyle(config.groups, 'edges', edgeIndex, registry), edgeColorFields);
  const edgeProps = config.edges?.[edgeIndex] || {};
  const expandedProps = spreadColor(registry.expand(edgeProps), edgeColorFields);
  const merged = { ...base, ...edgeStyle, ...groupStyle, ...expandedProps };
  merged.strokeWidth = resolveLineWidth(merged.strokeWidth);
  return merged;
}

/**
 * Resolve effective style for a plot.
 * Merge order: DEFAULTS → config.plotStyle → per-plot properties
 * @param {number} plotIndex
 * @param {Object} config - full config object
 * @returns {Object} resolved style
 */
export function resolvePlotStyle(plotIndex, config) {
  const base = {
    stroke: DEFAULTS.plotColor,
    strokeWidth: DEFAULTS.plotStrokeWidth,
    fill: DEFAULTS.plotFill,
    handler: DEFAULTS.plotHandler,
    tension: undefined,
    barWidth: undefined,
    barShift: undefined,
    baseline: undefined,
    mark: undefined,
    markSize: DEFAULTS.markSize,
    markRepeat: undefined,
    markPhase: undefined,
    markIndices: undefined,
    dashed: false,
    opacity: 1,
    className: null,
    lineJoin: 'round',
  };
  const registry = new StyleRegistry(config.styles);
  const plotColorFields = ['stroke'];
  const plotStyle = spreadColor(registry.expand(config.plotStyle || {}), plotColorFields);
  const plotProps = config.plots?.[plotIndex] || {};
  const expandedProps = spreadColor(registry.expand(plotProps), plotColorFields);
  const merged = { ...base, ...plotStyle, ...expandedProps };
  merged.strokeWidth = resolveLineWidth(merged.strokeWidth);
  return merged;
}

/**
 * Parse a TikZ arrow spec string into start/end tip names.
 * '->'  → { start: null, end: 'stealth' }
 * '<->' → { start: 'stealth', end: 'stealth' }
 * '<-'  → { start: 'stealth', end: null }
 * @param {string} [spec]
 * @returns {{ start: string|null, end: string|null }}
 */
function parseArrowSpec(spec) {
  if (!spec || spec === 'none' || spec === '-') {
    return { start: null, end: null };
  }
  return {
    start: spec.startsWith('<') ? 'stealth' : null,
    end: spec.endsWith('>') ? 'stealth' : null,
  };
}

/**
 * Resolve effective style for a free-form path (\draw).
 * Merge order: DEFAULTS → config.pathStyle → per-path properties
 * @param {number} pathIndex
 * @param {Object} config - full config object
 * @returns {Object} resolved style
 */
export function resolvePathStyle(pathIndex, config) {
  const base = {
    stroke: DEFAULTS.pathColor,
    strokeWidth: DEFAULTS.pathStrokeWidth,
    fill: 'none',
    dashed: false,
    dotted: false,
    opacity: 1,
    className: null,
    decoration: null,
  };
  const registry = new StyleRegistry(config.styles);
  const pathColorFields = ['stroke'];
  const pathStyle = spreadColor(registry.expand(config.pathStyle || {}), pathColorFields);
  const pathProps = config.paths?.[pathIndex] || {};
  const expandedProps = spreadColor(registry.expand(pathProps), pathColorFields);
  const merged = { ...base, ...pathStyle, ...expandedProps };

  merged.strokeWidth = resolveLineWidth(merged.strokeWidth);

  if (merged.thick) {
    merged.strokeWidth = 2.4;
  }

  const arrowSpec = parseArrowSpec(merged.arrow);
  merged.arrowStart = arrowSpec.start;
  merged.arrowEnd = arrowSpec.end;

  return merged;
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
