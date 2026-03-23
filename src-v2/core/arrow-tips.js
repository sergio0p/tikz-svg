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
      lineEnd: inset,                   // line stops at the notch (TikZ: lineEnd ≈ inset)
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
// Additional arrow tip definitions from pgflibraryarrows.meta.code.tex
// ────────────────────────────────────────────

/**
 * Straight Barb — simple V-shaped angle.
 * pgflibraryarrows.meta.code.tex line 129
 */
const StraightBarbDef = {
  defaults: { length: 3, width: 6, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;
    const d = `M 0 ${halfW} L ${length} 0 L 0 ${-halfW}`;
    return { d, lineEnd: length * 0.8, tipEnd: length, visualBackEnd: 0, fillMode: 'stroke' };
  },
};

/**
 * Hooks — arc-based barb.
 * pgflibraryarrows.meta.code.tex line 221
 */
const HooksDef = {
  defaults: { length: 1.5, width: 6, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;
    // Semicircular hooks
    const r = halfW;
    const d = [
      `M ${length} ${-r}`,
      `A ${r} ${r} 0 0 0 ${length} ${r}`,
    ].join(' ');
    return { d, lineEnd: length, tipEnd: length, visualBackEnd: 0, fillMode: 'stroke' };
  },
};

/**
 * Arc Barb — single arc barb.
 * pgflibraryarrows.meta.code.tex line 333
 */
const ArcBarbDef = {
  defaults: { length: 3, width: 6, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;
    // Approximate arc with cubic Bezier
    const k = 0.55228; // Bezier approximation constant for quarter circle
    const d = [
      `M 0 ${halfW}`,
      `C ${length * k} ${halfW * 0.6}, ${length * 0.8} ${halfW * 0.1}, ${length} 0`,
      `C ${length * 0.8} ${-halfW * 0.1}, ${length * k} ${-halfW * 0.6}, 0 ${-halfW}`,
    ].join(' ');
    return { d, lineEnd: length * 0.7, tipEnd: length, visualBackEnd: 0, fillMode: 'stroke' };
  },
};

/**
 * Tee Barb — T-shaped perpendicular barb with optional forward bar.
 * pgflibraryarrows.meta.code.tex line 439
 * Our existing 'Bar' is Tee Barb with length=0. Full Tee Barb has a forward bar.
 */
const TeeBarbDef = {
  defaults: { length: 3, width: 6, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width, inset } = p;
    const halfW = width / 2;
    // Vertical bar at x=0, optional horizontal bars extending to x=length-inset
    const fwd = length - inset;
    const back = -inset;
    let d = `M 0 ${-halfW} L 0 ${halfW}`;
    if (length > 0) {
      d += ` M ${back} ${halfW} L ${fwd} ${halfW}`;
      d += ` M ${back} ${-halfW} L ${fwd} ${-halfW}`;
    }
    return { d, lineEnd: 0, tipEnd: Math.max(fwd, 0), visualBackEnd: Math.min(back, 0), fillMode: 'stroke' };
  },
};

/**
 * Classical TikZ Rightarrow — curved barb (legacy TikZ style).
 * pgflibraryarrows.meta.code.tex line 528
 */
const ClassicalTikZRightarrowDef = {
  defaults: { length: 3, width: 5.8, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;
    const d = [
      `M 0 ${halfW}`,
      `C ${0.067 * length} ${0.3125 * halfW}, ${0.8 * length} ${0.03125 * halfW}, ${length} 0`,
      `C ${0.8 * length} ${-0.03125 * halfW}, ${0.067 * length} ${-0.3125 * halfW}, 0 ${-halfW}`,
    ].join(' ');
    return { d, lineEnd: length * 0.4, tipEnd: length, visualBackEnd: 0, fillMode: 'stroke' };
  },
};

/**
 * Computer Modern Rightarrow — precise CM math arrow.
 * pgflibraryarrows.meta.code.tex line 663
 * (Our existing 'To' is this tip.)
 */
const ComputerModernRightarrowDef = ToDef;

/**
 * Implies — double stroke implies arrow (⇒).
 * pgflibraryarrows.meta.code.tex line 761
 */
const ImpliesDef = {
  defaults: { length: 4, width: 5, inset: 0, lineWidth: 1 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;
    // Double curve (like ⇒)
    const d = [
      `M 0 ${halfW}`,
      `C ${0.3 * length} ${0.25 * halfW}, ${0.7 * length} ${0.05 * halfW}, ${length} 0`,
      `C ${0.7 * length} ${-0.05 * halfW}, ${0.3 * length} ${-0.25 * halfW}, 0 ${-halfW}`,
    ].join(' ');
    return { d, lineEnd: length * 0.3, tipEnd: length, visualBackEnd: 0, fillMode: 'stroke' };
  },
};

/**
 * Kite — like Stealth but with reversed inset direction.
 * pgflibraryarrows.meta.code.tex line 1031
 */
const KiteTipDef = {
  defaults: { length: 6, width: 3, inset: 1.5, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width, inset, open } = p;
    const halfW = width / 2;
    // Kite: tip → upper-side at inset → back → lower-side at inset → close
    const d = [
      `M ${length} 0`,
      `L ${inset} ${halfW}`,
      `L 0 0`,
      `L ${inset} ${-halfW}`,
      'Z',
    ].join(' ');
    return { d, lineEnd: inset * 0.5, tipEnd: length, visualBackEnd: 0, fillMode: open ? 'stroke' : 'filled' };
  },
};

/**
 * Square — simple filled rectangle.
 * pgflibraryarrows.meta.code.tex line 1163
 */
const SquareDef = {
  defaults: { length: 4.24, width: 4.24, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width, open } = p;
    const halfW = width / 2;
    const d = `M 0 ${-halfW} L ${length} ${-halfW} L ${length} ${halfW} L 0 ${halfW} Z`;
    return { d, lineEnd: 0, tipEnd: length, visualBackEnd: 0, fillMode: open ? 'stroke' : 'filled' };
  },
};

/**
 * Round Cap — semicircular cap.
 * pgflibraryarrows.meta.code.tex line 1285
 */
const RoundCapDef = {
  defaults: { length: 1.5, width: 3, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;
    const k = 0.55228;
    const d = [
      `M 0 ${halfW}`,
      `C ${length * k} ${halfW}, ${length} ${halfW * k}, ${length} 0`,
      `C ${length} ${-halfW * k}, ${length * k} ${-halfW}, 0 ${-halfW}`,
      'Z',
    ].join(' ');
    return { d, lineEnd: 0, tipEnd: length, visualBackEnd: 0, fillMode: 'filled' };
  },
};

/**
 * Butt Cap — rectangular cap.
 * pgflibraryarrows.meta.code.tex line 1334
 */
const ButtCapDef = {
  defaults: { length: 1.5, width: 3, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;
    const d = `M 0 ${halfW} L ${length} ${halfW} L ${length} ${-halfW} L 0 ${-halfW} Z`;
    return { d, lineEnd: 0, tipEnd: length, visualBackEnd: 0, fillMode: 'filled' };
  },
};

/**
 * Triangle Cap — pointed triangular cap.
 * pgflibraryarrows.meta.code.tex line 1376
 */
const TriangleCapDef = {
  defaults: { length: 1.5, width: 3, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const halfW = width / 2;
    const d = `M 0 ${halfW} L ${length} 0 L 0 ${-halfW} Z`;
    return { d, lineEnd: 0, tipEnd: length, visualBackEnd: 0, fillMode: 'filled' };
  },
};

/**
 * Fast Triangle — double-triangle bowtie shape.
 * pgflibraryarrows.meta.code.tex line 1422
 */
const FastTriangleDef = {
  defaults: { length: 1.5, width: 3, inset: 1.5, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width, inset } = p;
    const halfW = width / 2;
    const d = [
      `M 0 ${halfW}`,
      `L ${inset} ${halfW}`,
      `L ${inset + length} 0`,
      `L ${inset} ${-halfW}`,
      `L 0 ${-halfW}`,
      `L ${length} 0`,
      'Z',
    ].join(' ');
    return { d, lineEnd: 0, tipEnd: length + inset, visualBackEnd: 0, fillMode: 'filled' };
  },
};

/**
 * Fast Round — bowtie with curved lobes.
 * pgflibraryarrows.meta.code.tex line 1452
 */
const FastRoundDef = {
  defaults: { length: 1.5, width: 3, inset: 1.5, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width, inset } = p;
    const halfW = width / 2;
    const k = 0.55228;
    const d = [
      `M 0 ${halfW}`,
      `L ${inset} ${halfW}`,
      `C ${inset + length * k} ${halfW}, ${inset + length} ${halfW * k}, ${inset + length} 0`,
      `C ${inset + length} ${-halfW * k}, ${inset + length * k} ${-halfW}, ${inset} ${-halfW}`,
      `L 0 ${-halfW}`,
      `C ${length * k} ${-halfW}, ${length} ${-halfW * k}, ${length} 0`,
      `C ${length} ${halfW * k}, ${length * k} ${halfW}, 0 ${halfW}`,
      'Z',
    ].join(' ');
    return { d, lineEnd: 0, tipEnd: length + inset, visualBackEnd: 0, fillMode: 'filled' };
  },
};

/**
 * Rays — radial lines emanating from center.
 * pgflibraryarrows.meta.code.tex line 1515
 */
const RaysDef = {
  defaults: { length: 6, width: 6, inset: 0, lineWidth: 0.6 },
  path(userParams) {
    const p = resolveParams(this, userParams);
    const { length, width } = p;
    const n = 4; // default number of rays
    const halfL = length / 2;
    const halfW = width / 2;
    const cx = halfL, cy = 0;
    let d = '';
    const step = 360 / n;
    for (let i = 0; i < n; i++) {
      const angle = i * step * Math.PI / 180;
      const ex = cx + halfL * Math.cos(angle);
      const ey = cy + halfW * Math.sin(angle);
      d += `M ${cx} ${cy} L ${ex} ${ey} `;
    }
    return { d: d.trim(), lineEnd: 0, tipEnd: length, visualBackEnd: 0, fillMode: 'stroke' };
  },
};

// ────────────────────────────────────────────
// Default registry with all built-in tips
// ────────────────────────────────────────────

export const defaultRegistry = new ArrowTipRegistry();

// Geometric (filled)
defaultRegistry.register('Stealth', StealthDef);
defaultRegistry.register('Latex', LatexDef);
defaultRegistry.register('Kite', KiteTipDef);
defaultRegistry.register('Square', SquareDef);
defaultRegistry.register('Circle', CircleDef);

// Barbs (stroked)
defaultRegistry.register('Straight Barb', StraightBarbDef);
defaultRegistry.register('Hooks', HooksDef);
defaultRegistry.register('Arc Barb', ArcBarbDef);
defaultRegistry.register('Tee Barb', TeeBarbDef);
defaultRegistry.register('Classical TikZ Rightarrow', ClassicalTikZRightarrowDef);
defaultRegistry.register('Computer Modern Rightarrow', ComputerModernRightarrowDef);
defaultRegistry.register('Implies', ImpliesDef);

// Caps (filled)
defaultRegistry.register('Round Cap', RoundCapDef);
defaultRegistry.register('Butt Cap', ButtCapDef);
defaultRegistry.register('Triangle Cap', TriangleCapDef);
defaultRegistry.register('Fast Triangle', FastTriangleDef);
defaultRegistry.register('Fast Round', FastRoundDef);

// Special
defaultRegistry.register('Rays', RaysDef);

// ────────────────────────────────────────────
// Aliases (pgflibraryarrows.meta.code.tex lines 1591–1601)
// ────────────────────────────────────────────

// These register the same tip definition under a convenience name
defaultRegistry.register('To', ToDef);                    // = Computer Modern Rightarrow
defaultRegistry.register('Bar', BarDef);                  // = Tee Barb[length=0]
defaultRegistry.register('Bracket', BracketDef);          // = Tee Barb[inset',length]
defaultRegistry.register('LaTeX', LatexDef);              // = Latex
defaultRegistry.register('Triangle', StealthDef);         // = Stealth[inset=0,angle=60] (approx)
defaultRegistry.register('Rectangle', SquareDef);         // = Square (approx)
defaultRegistry.register('Ellipse', CircleDef);           // = Circle (approx)
defaultRegistry.register('Diamond', KiteTipDef);          // = Kite[inset'=0.5] (approx)
defaultRegistry.register('Parenthesis', ArcBarbDef);      // = Arc Barb[arc=120] (approx)
