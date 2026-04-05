/**
 * KaTeX math rendering for node/label content.
 *
 * Detects $...$ delimiters in labels and renders them via KaTeX
 * into <foreignObject> for SVG embedding. Falls back to plain <text>
 * when KaTeX is not loaded.
 *
 * KaTeX is an optional dependency — load via CDN:
 *   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
 *   <script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';

/** Regex: at least one $...$ pair (not escaped, not single $). */
const MATH_REGEX = /\$([^$]+)\$/;

/**
 * Check if a label contains $...$ math content.
 * @param {*} label
 * @returns {boolean}
 */
export function isMathLabel(label) {
  if (label == null || typeof label !== 'string' || label === '') return false;
  return MATH_REGEX.test(label);
}

/**
 * Strip $ delimiters from a label (for fallback plain-text rendering).
 * @param {string} label
 * @returns {string}
 */
export function stripMath(label) {
  if (typeof label !== 'string') return String(label ?? '');
  return label.replace(/\$([^$]+)\$/g, '$1');
}

/**
 * Check if KaTeX is loaded in the current environment.
 * @returns {boolean}
 */
export function isKaTeXAvailable() {
  return !!(typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function');
}

/**
 * Render a math label to KaTeX HTML string.
 * Handles mixed text+math: segments outside $...$ are plain text,
 * segments inside are rendered as math.
 * @param {string} label
 * @returns {string} HTML string
 */
function renderMathToHTML(label) {
  const parts = label.split(/(\$[^$]+\$)/);
  let html = '';
  for (const part of parts) {
    if (part.startsWith('$') && part.endsWith('$')) {
      const tex = part.slice(1, -1);
      try {
        html += window.katex.renderToString(tex, {
          throwOnError: false,
          displayMode: false,
        });
      } catch {
        html += escapeHTML(tex);
      }
    } else {
      html += escapeHTML(part);
    }
  }
  return html;
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Off-screen measurement ──────────────────────────────

let _measureDiv = null;

/**
 * Get or create the off-screen measurement div.
 * @returns {HTMLDivElement}
 */
function getMeasureDiv() {
  if (_measureDiv && _measureDiv.parentNode) return _measureDiv;
  _measureDiv = document.createElement('div');
  _measureDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;';
  document.body.appendChild(_measureDiv);
  return _measureDiv;
}

/** Track whether fonts have finished loading. */
let _fontsReady = false;
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => { _fontsReady = true; });
}

/** SVG elements that need re-render after fonts load. */
const _pendingReRenders = [];

/**
 * Register a render call for re-execution after fonts load.
 * @param {SVGElement} svgEl
 * @param {Object} config
 * @param {Function} renderFn
 */
export function registerPendingReRender(svgEl, config, renderFn) {
  if (_fontsReady) return; // fonts already loaded, no need
  _pendingReRenders.push({ svgEl, config, renderFn });
}

// Re-render all pending graphs once fonts are ready
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => {
    for (const { svgEl, config, renderFn } of _pendingReRenders) {
      try { renderFn(svgEl, config); } catch {}
    }
    _pendingReRenders.length = 0;
  });
}

/**
 * Measure rendered KaTeX HTML dimensions.
 * @param {string} html - KaTeX HTML string
 * @param {number} fontSize
 * @returns {{ width: number, height: number }}
 */
function measureKaTeXHTML(html, fontSize) {
  const div = getMeasureDiv();
  div.style.fontSize = `${fontSize}px`;
  div.innerHTML = html;
  const rect = div.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

// ── Public API ──────────────────────────────────────────

/**
 * Create label content — either KaTeX foreignObject or plain text fallback.
 *
 * @param {string} label
 * @param {{ fontSize: number, fontFamily: string, color: string }} opts
 * @returns {{ type: 'math'|'text', content: string, html?: string, width: number, height: number }}
 */
export function createLabelContent(label, opts) {
  const { fontSize = 14, fontFamily = 'serif', color = '#000' } = opts;
  const str = String(label);

  if (isMathLabel(str) && isKaTeXAvailable()) {
    const html = renderMathToHTML(str);
    const dim = measureKaTeXHTML(html, fontSize);
    // Estimate from TeX content length if measurement fails (e.g. hidden element)
    const texContent = stripMath(str);
    const estWidth = texContent.length * fontSize * 0.7;
    const estHeight = fontSize * 1.8;
    // Add padding to prevent clipping at foreignObject boundaries
    const pad = fontSize * 0.4;
    return {
      type: 'math',
      content: str,
      html,
      width: (dim.width > 0 ? dim.width : estWidth) + pad,
      height: (dim.height > 0 ? dim.height : estHeight) + pad,
    };
  }

  // Fallback: plain text (strip $ if present)
  const text = isMathLabel(str) ? stripMath(str) : str;
  const charWidth = fontSize * 0.6;
  return {
    type: 'text',
    content: text,
    width: text.length * charWidth,
    height: fontSize * 1.2,
  };
}

/**
 * Build a <foreignObject> SVG element containing KaTeX-rendered HTML.
 * Centered at origin (for use inside a translated <g>).
 * @param {string} html - KaTeX HTML
 * @param {number} width
 * @param {number} height
 * @param {{ fontSize: number, color: string }} opts
 * @returns {SVGForeignObjectElement}
 */
export function createMathForeignObject(html, width, height, opts) {
  const { fontSize = 14, color = '#000' } = opts;

  const fo = document.createElementNS(SVG_NS, 'foreignObject');
  fo.setAttribute('x', -width / 2);
  fo.setAttribute('y', -height / 2);
  fo.setAttribute('width', width);
  fo.setAttribute('height', height);
  fo.setAttribute('overflow', 'visible');

  const div = document.createElementNS(XHTML_NS, 'div');
  div.setAttribute('xmlns', XHTML_NS);
  div.style.fontSize = `${fontSize}px`;
  div.style.color = color;
  div.style.display = 'flex';
  div.style.alignItems = 'center';
  div.style.justifyContent = 'center';
  div.style.width = '100%';
  div.style.height = '100%';
  div.style.lineHeight = '1';
  div.innerHTML = html;

  fo.appendChild(div);
  return fo;
}
