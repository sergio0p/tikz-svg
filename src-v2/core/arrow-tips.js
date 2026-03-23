/**
 * Arrow tip registry and built-in tip definitions.
 *
 * This module is additive — it does NOT modify the existing geometry/arrows.js.
 * It provides a registry of arrow tip definitions with precise geometry based
 * on the PGF/TikZ arrow library.
 */

// ────────────────────────────────────────────
// ArrowTipRegistry
// ────────────────────────────────────────────

export class ArrowTipRegistry {
  /** @type {Map<string, ArrowTipDef>} */
  #tips = new Map();

  /**
   * Register a named arrow tip definition.
   * @param {string} name
   * @param {ArrowTipDef} def
   */
  register(name, def) {
    this.#tips.set(name, def);
  }

  /**
   * Retrieve an arrow tip definition by name.
   * @param {string} name
   * @returns {ArrowTipDef | undefined}
   */
  get(name) {
    return this.#tips.get(name);
  }

  /**
   * Check whether a tip name is registered.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this.#tips.has(name);
  }

  /**
   * List all registered tip names.
   * @returns {string[]}
   */
  names() {
    return [...this.#tips.keys()];
  }
}

// ────────────────────────────────────────────
// Helper: merge user params with definition defaults
// ────────────────────────────────────────────

function resolveParams(def, userParams = {}) {
  return {
    length: userParams.length ?? def.defaults.length,
    width: userParams.width ?? def.defaults.width,
    inset: userParams.inset ?? def.defaults.inset ?? 0,
    lineWidth: userParams.lineWidth ?? def.defaults.lineWidth ?? 0.6,
    open: userParams.open ?? false,
  };
}

// ────────────────────────────────────────────
// Built-in arrow tip definitions
// ────────────────────────────────────────────

/**
 * Stealth — the classic TikZ "stealth fighter" arrow.
 * A kite/diamond shape with an inset notch at the back.
 *
 * PGF defaults: length = 3pt * 4.5 ≈ 4.5, width' = 0.75, inset' = 0.325
 */
const StealthDef = {
  defaults: {
    length: 5,
    width: 3.75,        // length * 0.75
    inset: 1.625,       // length * 0.325
    lineWidth: 0.6,
  },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width, inset, open } = p;
    const halfW = width / 2;

    // 4-point kite: tip → upper-back → inset-notch → lower-back → close
    // Origin is at the tip (rightmost point), arrow extends leftward.
    const d = [
      `M ${length} 0`,          // tip
      `L 0 ${halfW}`,           // upper back corner
      `L ${inset} 0`,           // inset notch
      `L 0 ${-halfW}`,          // lower back corner
      'Z',
    ].join(' ');

    return {
      d,
      lineEnd: length,                  // shorten main path by full tip length
      tipEnd: length,                   // full extent from origin to tip
      visualBackEnd: inset,             // where the tip visually starts (notch)
      fillMode: open ? 'stroke' : 'filled',
    };
  },
};

/**
 * Latex — the curved LaTeX arrow (Computer Modern \rightarrow style, filled).
 *
 * PGF defaults: length = 3pt * 4.5 ≈ 4.5, width' = 0.75
 * Uses cubic Bezier curves for the characteristic curved shape.
 */
const LatexDef = {
  defaults: {
    length: 5,
    width: 3.75,        // length * 0.75
    inset: 0,
    lineWidth: 0.6,
  },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width, open } = p;
    const halfW = width / 2;

    // PGF Bezier curves for the Latex tip shape
    const d = [
      `M ${length} 0`,
      `C ${(0.877192 * length).toFixed(3)} ${(0.077922 * halfW).toFixed(3)},` +
        ` ${(0.337381 * length).toFixed(3)} ${(0.519480 * halfW).toFixed(3)},` +
        ` 0 ${halfW.toFixed(3)}`,
      `L 0 ${(-halfW).toFixed(3)}`,
      `C ${(0.337381 * length).toFixed(3)} ${(-0.519480 * halfW).toFixed(3)},` +
        ` ${(0.877192 * length).toFixed(3)} ${(-0.077922 * halfW).toFixed(3)},` +
        ` ${length} 0`,
      'Z',
    ].join(' ');

    return {
      d,
      lineEnd: length * 0.5,           // line ends partway into the arrow
      tipEnd: length,
      visualBackEnd: 0,
      fillMode: open ? 'stroke' : 'filled',
    };
  },
};

/**
 * To — stroked curved barb (Computer Modern Rightarrow style, stroke only).
 *
 * PGF defaults: length = 1.6pt * 2.2 ≈ 3.52, width' ≈ 2.097
 * Two cubic Bezier curves forming the barb shape (no fill, stroke only).
 */
const ToDef = {
  defaults: {
    length: 3.2,
    width: 3.36,        // length * 1.05
    inset: 0,
    lineWidth: 0.6,
  },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;

    // PGF Computer Modern Rightarrow, translated so tip is at (length, 0)
    const d = [
      `M 0 ${halfW.toFixed(3)}`,
      `C ${(0.18269 * length).toFixed(3)} ${(0.2 * halfW).toFixed(3)},` +
        ` ${(0.58981 * length).toFixed(3)} ${(0.05833 * halfW).toFixed(3)},` +
        ` ${length.toFixed(3)} 0`,
      `C ${(0.58981 * length).toFixed(3)} ${(-0.05833 * halfW).toFixed(3)},` +
        ` ${(0.18269 * length).toFixed(3)} ${(-0.2 * halfW).toFixed(3)},` +
        ` 0 ${(-halfW).toFixed(3)}`,
    ].join(' ');

    return {
      d,
      lineEnd: length * 0.3,
      tipEnd: length,
      visualBackEnd: 0,
      fillMode: 'stroke',
    };
  },
};

/**
 * Bar (Tee Barb) — a simple perpendicular line.
 *
 * PGF defaults: width = 3pt * 4 = 12 (total), so half = 6
 */
const BarDef = {
  defaults: {
    length: 0,
    width: 6,           // half-width each side → total 12 in PGF units
    inset: 0,
    lineWidth: 0.6,
  },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { width } = p;
    const halfW = width / 2;

    // Simple vertical line at x=0
    const d = `M 0 ${-halfW} L 0 ${halfW}`;

    return {
      d,
      lineEnd: 0,
      tipEnd: 0,
      visualBackEnd: 0,
      fillMode: 'stroke',
    };
  },
};

/**
 * Circle — a circle/dot at the tip.
 *
 * PGF defaults: length = 2.39pt * 3.19 ≈ 7.63 (diameter), width' = 1 (equal).
 * We use a simpler default of ~4.8 for our coordinate system.
 */
const CircleDef = {
  defaults: {
    length: 4.8,
    width: 4.8,
    inset: 0,
    lineWidth: 0.6,
  },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, open } = p;
    const r = length / 2;

    // Full circle via two SVG arcs, centered at (r, 0)
    const d = [
      `M ${length} 0`,
      `A ${r} ${r} 0 1 0 0 0`,
      `A ${r} ${r} 0 1 0 ${length} 0`,
      'Z',
    ].join(' ');

    return {
      d,
      lineEnd: length * 0.1,           // line ends just at the circle boundary
      tipEnd: length,
      visualBackEnd: 0,
      fillMode: open ? 'stroke' : 'filled',
    };
  },
};

/**
 * Bracket — square bracket shape (three-segment open bracket).
 *
 * Based on pgflibraryarrows.code.tex "square bracket".
 */
const BracketDef = {
  defaults: {
    length: 2.5,
    width: 5,
    inset: 0,
    lineWidth: 0.6,
  },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;

    // Three-segment bracket: top-left → top-right → bottom-right → bottom-left
    const d = [
      `M ${-length} ${-halfW}`,
      `L 0 ${-halfW}`,
      `L 0 ${halfW}`,
      `L ${-length} ${halfW}`,
    ].join(' ');

    return {
      d,
      lineEnd: 0,
      tipEnd: 0,
      visualBackEnd: -length,
      fillMode: 'stroke',
    };
  },
};

// ────────────────────────────────────────────
// createMarker convenience function
// ────────────────────────────────────────────

let markerCounter = 0;

/**
 * Create an SVG `<marker>` element with the tip path inside.
 *
 * @param {Document} document  - DOM document for creating elements
 * @param {string} tipName     - registered tip name
 * @param {object} [params]    - override params (length, width, inset, lineWidth, open)
 * @param {object} [edgeStyle] - edge style info: { color, fillColor }
 * @returns {{ element: SVGMarkerElement, id: string } | null}
 */
export function createMarker(document, tipName, params = {}, edgeStyle = {}) {
  const def = defaultRegistry.get(tipName);
  if (!def) return null;

  const result = def.path(params);
  const id = `arrow-tip-${tipName}-${++markerCounter}`;
  const color = edgeStyle.color ?? '#000000';
  const fillColor = edgeStyle.fillColor ?? color;

  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('orient', 'auto');
  marker.setAttribute('markerUnits', 'userSpaceOnUse');

  // Compute a bounding box for the viewBox
  const p = resolveParams(def, params);
  const pad = p.lineWidth;
  const w = (p.length || p.width) + pad * 2;
  const h = p.width + pad * 2;

  marker.setAttribute('viewBox', `${-pad} ${-h / 2} ${w + pad} ${h}`);
  marker.setAttribute('refX', `${result.tipEnd}`);
  marker.setAttribute('refY', '0');
  marker.setAttribute('markerWidth', `${w}`);
  marker.setAttribute('markerHeight', `${h}`);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', result.d);

  if (result.fillMode === 'filled') {
    path.setAttribute('fill', fillColor);
    path.setAttribute('stroke', 'none');
  } else if (result.fillMode === 'stroke') {
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', `${p.lineWidth}`);
  } else {
    // 'both'
    path.setAttribute('fill', fillColor);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', `${p.lineWidth}`);
  }

  marker.appendChild(path);

  return { element: marker, id };
}

// ────────────────────────────────────────────
// Default registry with all built-in tips
// ────────────────────────────────────────────

export const defaultRegistry = new ArrowTipRegistry();

defaultRegistry.register('Stealth', StealthDef);
defaultRegistry.register('Latex', LatexDef);
defaultRegistry.register('To', ToDef);
defaultRegistry.register('Bar', BarDef);
defaultRegistry.register('Circle', CircleDef);
defaultRegistry.register('Bracket', BracketDef);
