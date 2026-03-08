/**
 * Arrow marker definitions for SVG edges.
 * Returns plain data objects — no DOM creation.
 */

import { DEFAULTS } from '../core/constants.js';

// ────────────────────────────────────────────
// Arrow shape generators
// ────────────────────────────────────────────

/**
 * Stealth-style arrowhead (TikZ default): a filled triangle with a slight
 * notch at the back to give it the "stealth fighter" look.
 * @param {number} size
 * @returns {{ viewBox: string, path: string, refX: number, refY: number, markerWidth: number, markerHeight: number }}
 */
function stealthArrow(size) {
  const h = size * 0.7;
  const notch = size * 0.25;
  const halfH = h / 2;

  const path = `M 0 0 L ${size} ${halfH} L 0 ${h} L ${notch} ${halfH} Z`;

  return {
    viewBox: `0 0 ${size} ${h}`,
    path,
    refX: size,
    refY: halfH,
    markerWidth: size,
    markerHeight: h,
  };
}

// ────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────

/**
 * Get an arrow marker definition object.
 *
 * The returned object contains all the attributes needed to create an SVG
 * `<marker>` element plus its child `<path>`, but performs no DOM work itself.
 *
 * @param {Object} [opts]
 * @param {string} [opts.type='stealth'] - Arrow style: 'stealth' or 'none'.
 * @param {number} [opts.size]           - Arrow size in px (default: DEFAULTS.arrowSize).
 * @param {string} [opts.color]          - Fill color (default: DEFAULTS.edgeColor).
 * @param {string} [opts.id]             - Explicit marker id. Auto-generated if omitted.
 * @returns {{ id: string, viewBox: string, refX: number, refY: number,
 *             markerWidth: number, markerHeight: number, path: string,
 *             orient: string, color: string } | null}
 *   Returns null when type is 'none'.
 */
export function getArrowDef(opts = {}) {
  const type = opts.type ?? 'stealth';
  if (type === 'none') return null;

  const size = opts.size ?? DEFAULTS.arrowSize;
  const color = opts.color ?? DEFAULTS.edgeColor;
  const id = opts.id ?? `arrow-${type}-${size}-${color.replace('#', '')}`;

  const shape = stealthArrow(size);

  return {
    id,
    viewBox: shape.viewBox,
    refX: shape.refX,
    refY: shape.refY,
    markerWidth: shape.markerWidth,
    markerHeight: shape.markerHeight,
    path: shape.path,
    orient: 'auto',
    color,
  };
}
