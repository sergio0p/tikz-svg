/**
 * Arrow marker definitions for SVG edges.
 *
 * Delegates to core/arrow-tips.js registry for tip geometry.
 * Returns data objects for SVG <marker> creation, plus lineEnd/tipEnd
 * for automatic path shortening (matching TikZ's pgfcorearrows.code.tex).
 */

import { DEFAULTS } from '../core/constants.js';
import { defaultRegistry } from '../core/arrow-tips.js';

// Map user-facing config names (lowercase) to registry names (PascalCase)
// Map user-facing config names to registry names.
// Users can use lowercase or the PascalCase registry name directly.
const TIP_NAME_MAP = {
  // Geometric (filled)
  stealth:  'Stealth',
  latex:    'Latex',
  kite:     'Kite',
  square:   'Square',
  circle:   'Circle',
  // Barbs (stroked)
  'straight barb': 'Straight Barb',
  hooks:    'Hooks',
  'arc barb': 'Arc Barb',
  'tee barb': 'Tee Barb',
  to:       'To',
  bar:      'Bar',
  bracket:  'Bracket',
  parenthesis: 'Parenthesis',
  implies:  'Implies',
  'classical tikz rightarrow': 'Classical TikZ Rightarrow',
  'computer modern rightarrow': 'Computer Modern Rightarrow',
  // Caps
  'round cap': 'Round Cap',
  'butt cap':  'Butt Cap',
  'triangle cap': 'Triangle Cap',
  'fast triangle': 'Fast Triangle',
  'fast round': 'Fast Round',
  // Special
  rays:     'Rays',
  // Aliases
  triangle: 'Triangle',
  rectangle: 'Rectangle',
  ellipse:  'Ellipse',
  diamond:  'Diamond',
};

/**
 * Get an arrow marker definition object.
 *
 * Uses the arrow-tips.js registry for tip geometry. Returns all attributes
 * needed for an SVG <marker> plus lineEnd/tipEnd for auto-shortening.
 *
 * TikZ auto-shortening (pgfcorearrows.code.tex lines 788-820):
 *   auto_shorten = tipEnd - lineEnd
 *   total_shorten = auto_shorten + user_shorten
 *
 * @param {Object} [opts]
 * @param {string} [opts.type='stealth'] - Arrow style name
 * @param {number} [opts.size]           - Arrow size in px (scales length param)
 * @param {string} [opts.color]          - Fill/stroke color
 * @param {boolean} [opts.open]          - Stroke-only (no fill)
 * @param {string} [opts.id]             - Explicit marker id
 * @returns {{ id, viewBox, refX, refY, markerWidth, markerHeight, path, orient,
 *             color, fillMode, lineEnd, tipEnd } | null}
 */
export function getArrowDef(opts = {}) {
  const type = opts.type ?? 'stealth';
  if (type === 'none') return null;

  const registryName = TIP_NAME_MAP[type.toLowerCase()] ?? type;
  const def = defaultRegistry.get(registryName);

  if (!def) {
    // Fallback: unknown tip name, try as-is
    return null;
  }

  const size = opts.size ?? DEFAULTS.arrowSize;
  const color = opts.color ?? DEFAULTS.edgeColor;
  const open = opts.open ?? false;

  // Scale tip params proportionally to requested size vs default length
  const scale = size / def.defaults.length;
  const params = {
    length: size,
    width: def.defaults.width * scale,
    inset: (def.defaults.inset ?? 0) * scale,
    lineWidth: def.defaults.lineWidth,
    open,
  };

  const result = def.path(params);
  const id = opts.id ?? `arrow-${type}-${size}-${color.replace('#', '')}`;

  // Compute marker dimensions with padding for stroke
  const pad = params.lineWidth;
  const w = (params.length || params.width) + pad * 2;
  const h = params.width + pad * 2;

  // Build path element attributes based on fillMode
  let pathFill, pathStroke, pathStrokeWidth;
  if (result.fillMode === 'filled') {
    pathFill = color;
    pathStroke = 'none';
    pathStrokeWidth = null;
  } else if (result.fillMode === 'stroke') {
    pathFill = 'none';
    pathStroke = color;
    pathStrokeWidth = params.lineWidth;
  } else {
    pathFill = color;
    pathStroke = color;
    pathStrokeWidth = params.lineWidth;
  }

  return {
    id,
    viewBox: `${-pad} ${-h / 2} ${w + pad} ${h}`,
    // refX = lineEnd: the marker's line-end point sits at the (shortened) path endpoint.
    // The tip extends forward by (tipEnd - lineEnd) to reach the original border.
    refX: result.lineEnd,
    refY: 0,
    markerWidth: w,
    markerHeight: h,
    path: result.d,
    orient: 'auto',
    color,
    pathFill,
    pathStroke,
    pathStrokeWidth,
    fillMode: result.fillMode,
    // For auto-shortening (TikZ pgfcorearrows.code.tex lines 788-820)
    lineEnd: result.lineEnd,
    tipEnd: result.tipEnd,
  };
}
