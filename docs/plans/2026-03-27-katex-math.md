# KaTeX Math Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render LaTeX math in node and label content using KaTeX, so `$\frac{1}{4}$` produces a proper stacked fraction instead of plain text.

**Architecture:** A `katex-renderer.js` module detects `$...$` delimiters in labels, renders them via `window.katex.renderToString()`, and produces `<foreignObject>` elements containing the KaTeX HTML. The module is a drop-in replacement for the plain `<text>` rendering — the emitter calls it instead of creating `<text>` directly when math is detected. For node auto-sizing, an off-screen measurement div computes exact rendered dimensions. KaTeX is an optional dependency — when `window.katex` is absent, labels fall back to plain `<text>` with the `$` delimiters stripped.

**Tech Stack:** KaTeX 0.16+ (CDN), `<foreignObject>` for SVG embedding, existing emitter pipeline. Tests: `node --test` + jsdom (math detection and fallback logic testable; actual rendering requires browser).

**Stop-at-any-step guarantee:** Each task ships a complete, tested feature.

**KaTeX CDN:**
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
```

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-v2/core/katex-renderer.js` | **Create** | Math detection, KaTeX rendering, foreignObject creation, measurement, fallback |
| `src-v2/svg/emitter.js` | **Modify** | Use katex-renderer for labels in `emitNode`, `emitLabelNode`, `emitDrawPath` |
| `src-v2/core/text-measure.js` | **Modify** | Add `measureKaTeX()` for off-screen KaTeX measurement |
| `test/katex-math.test.js` | **Create** | Tests for math detection, fallback, dimension estimation |
| `examples-v2/katex-demo.html` | **Create** | Demo with math fractions, subscripts, Greek letters |

---

### Task 1: Math Detection and Fallback

**What it does:** Creates the `katex-renderer.js` module with `isMathLabel()` to detect `$...$` content, `stripMath()` to remove delimiters for fallback, and `isKaTeXAvailable()` to check if the library is loaded. These are pure functions testable in jsdom.

**Files:**
- Create: `src-v2/core/katex-renderer.js`
- Create: `test/katex-math.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/katex-math.test.js`:

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { isMathLabel, stripMath, isKaTeXAvailable, createLabelContent } from '../src-v2/core/katex-renderer.js';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  document = dom.window.document;
});

describe('isMathLabel', () => {
  it('detects $...$ math', () => {
    assert.strictEqual(isMathLabel('$x^2$'), true);
    assert.strictEqual(isMathLabel('$\\frac{1}{4}$'), true);
  });

  it('detects mixed text and math', () => {
    assert.strictEqual(isMathLabel('value: $x^2$'), true);
    assert.strictEqual(isMathLabel('$a$ and $b$'), true);
  });

  it('rejects plain text', () => {
    assert.strictEqual(isMathLabel('hello'), false);
    assert.strictEqual(isMathLabel('q0'), false);
    assert.strictEqual(isMathLabel(''), false);
  });

  it('rejects null/undefined', () => {
    assert.strictEqual(isMathLabel(null), false);
    assert.strictEqual(isMathLabel(undefined), false);
  });

  it('rejects single $ (not paired)', () => {
    assert.strictEqual(isMathLabel('costs $5'), false);
  });
});

describe('stripMath', () => {
  it('removes $ delimiters', () => {
    assert.strictEqual(stripMath('$x^2$'), 'x^2');
    assert.strictEqual(stripMath('$\\frac{1}{4}$'), '\\frac{1}{4}');
  });

  it('handles mixed text and math', () => {
    assert.strictEqual(stripMath('value: $x^2$'), 'value: x^2');
  });

  it('passes through non-math text', () => {
    assert.strictEqual(stripMath('hello'), 'hello');
  });
});

describe('isKaTeXAvailable', () => {
  it('returns false when window.katex is not loaded', () => {
    assert.strictEqual(isKaTeXAvailable(), false);
  });
});

describe('createLabelContent (fallback mode)', () => {
  it('returns text element when KaTeX not available', () => {
    const result = createLabelContent('$x^2$', {
      fontSize: 14,
      fontFamily: 'serif',
      color: '#000',
    });
    assert.strictEqual(result.type, 'text');
    assert.strictEqual(result.content, 'x^2');
    assert.ok(result.width > 0);
    assert.ok(result.height > 0);
  });

  it('returns text for non-math labels', () => {
    const result = createLabelContent('hello', {
      fontSize: 14,
      fontFamily: 'serif',
      color: '#000',
    });
    assert.strictEqual(result.type, 'text');
    assert.strictEqual(result.content, 'hello');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/katex-math.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement katex-renderer.js**

Create `src-v2/core/katex-renderer.js`:

```js
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
  return typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function';
}

/**
 * Render a math label to KaTeX HTML string.
 * Handles mixed text+math: segments outside $...$ are plain text,
 * segments inside are rendered as math.
 * @param {string} label
 * @param {{ fontSize: number, color: string }} opts
 * @returns {string} HTML string
 */
function renderMathToHTML(label, opts) {
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
 * Returns a descriptor object that the emitter uses to build SVG elements.
 * This keeps DOM creation in the emitter where it belongs.
 *
 * @param {string} label
 * @param {{ fontSize: number, fontFamily: string, color: string }} opts
 * @returns {{ type: 'math'|'text', content: string, html?: string, width: number, height: number }}
 */
export function createLabelContent(label, opts) {
  const { fontSize = 14, fontFamily = 'serif', color = '#000' } = opts;
  const str = String(label);

  if (isMathLabel(str) && isKaTeXAvailable()) {
    const html = renderMathToHTML(str, opts);
    const dim = measureKaTeXHTML(html, fontSize);
    return {
      type: 'math',
      content: str,
      html,
      width: dim.width || fontSize * str.length * 0.5,
      height: dim.height || fontSize * 1.2,
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/katex-math.test.js`
Expected: All 11 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/core/katex-renderer.js test/katex-math.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add KaTeX math detection, rendering, and fallback module"
```

---

### Task 2: Wire KaTeX into the Emitter

**What it does:** Updates the three label-rendering sites in the emitter (`emitNode`, `emitLabelNode`, `emitDrawPath`) to use `createLabelContent` and `createMathForeignObject`. When a label contains math and KaTeX is loaded, renders a `<foreignObject>` instead of `<text>`. Otherwise falls back to existing plain text behavior.

**Files:**
- Modify: `src-v2/svg/emitter.js`
- Modify: `test/katex-math.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/katex-math.test.js`:

```js
import { emitSVG } from '../src-v2/svg/emitter.js';

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

const circleShape = {
  savedGeometry(c) { return c; },
  backgroundPath() { return ''; },
  borderPoint(g, d) { return g.center; },
  namedAnchors() { return {}; },
};

describe('emitter math fallback (no KaTeX loaded)', () => {
  it('renders $x^2$ as plain text "x^2" in fallback mode', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 20, outerSep: 0.75 },
          shape: circleShape,
          style: { shape: 'circle', radius: 20, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: '$x^2$' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
    });
    const text = svg.querySelector('#node-a text');
    assert.ok(text, 'should have text element (fallback)');
    assert.strictEqual(text.textContent, 'x^2');
  });

  it('renders non-math labels unchanged', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 20, outerSep: 0.75 },
          shape: circleShape,
          style: { shape: 'circle', radius: 20, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'hello' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
    });
    const text = svg.querySelector('#node-a text');
    assert.strictEqual(text.textContent, 'hello');
  });

  it('strips $ from edge labels in fallback', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        index: 0, from: 'a', to: 'b', label: '$\\alpha$', path: 'M 0 0 L 100 0',
        edgeGeometry: { path: 'M 0 0 L 100 0' },
        labelNode: { center: { x: 50, y: -10 }, geom: { halfWidth: 20, halfHeight: 8 }, angle: null },
        style: { stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
      }],
      arrowDefs: [],
      shadowFilters: [],
    });
    const text = svg.querySelector('.label-node text');
    assert.ok(text, 'should have label text');
    assert.strictEqual(text.textContent, '\\alpha');
  });

  it('strips $ from draw-path inline labels in fallback', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 200 0',
        style: { stroke: '#000', strokeWidth: 1, fill: 'none' },
        arrowStartId: null, arrowEndId: null,
        labelNodes: [{ x: 200, y: 0, label: '$e_1$', anchor: 'right', fontSize: 14, fontFamily: 'serif' }],
      }],
    });
    const text = svg.querySelector('.draw-label');
    assert.strictEqual(text.textContent, 'e_1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/katex-math.test.js`
Expected: FAIL — emitter still renders `$x^2$` with dollar signs.

- [ ] **Step 3: Import katex-renderer in emitter**

Add import at the top of `src-v2/svg/emitter.js`:

```js
import { isMathLabel, stripMath, createLabelContent, createMathForeignObject } from '../core/katex-renderer.js';
```

- [ ] **Step 4: Update emitNode single-label rendering**

In `emitNode`, replace the single-label `else if` block. The key change: use `createLabelContent` to decide between math and text, then either create `<foreignObject>` or `<text>`.

Replace the single-label block (the `} else if (label != null && label !== '') {` section that handles non-multipart labels):

```js
  } else if (label != null && label !== '') {
    const fontSize = style.fontSize ?? DEFAULTS.fontSize;
    const textWidth = style.textWidth ?? 0;
    const labelStr = String(label);
    const labelContent = createLabelContent(labelStr, {
      fontSize,
      fontFamily: style.fontFamily ?? DEFAULTS.fontFamily,
      color: style.labelColor ?? '#000000',
    });

    if (labelContent.type === 'math') {
      // KaTeX rendering via foreignObject
      const fo = createMathForeignObject(labelContent.html, labelContent.width, labelContent.height, {
        fontSize,
        color: style.labelColor ?? '#000000',
      });
      g.appendChild(fo);
    } else {
      // Plain text rendering (existing behavior, with $ stripping)
      const text = labelContent.content;
      const lines = wrapText(text, textWidth, fontSize);

      if (lines.length > 1 || textWidth > 0) {
        const align = style.align ?? 'center';
        const textAnchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
        const xOffset = align === 'left' ? -(textWidth / 2) : align === 'right' ? (textWidth / 2) : 0;

        const textEl = createSVGElement('text', {
          'text-anchor': textAnchor,
          'font-size': fontSize,
          'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
          fill: style.labelColor ?? '#000000',
        });

        const lineHeight = fontSize * 1.3;
        const totalHeight = lines.length * lineHeight;
        const startY = -(totalHeight / 2) + lineHeight / 2;

        for (let i = 0; i < lines.length; i++) {
          const tspan = createSVGElement('tspan', {
            x: xOffset,
            dy: i === 0 ? startY : lineHeight,
          });
          tspan.textContent = lines[i];
          textEl.appendChild(tspan);
        }
        g.appendChild(textEl);
      } else {
        const textEl = createSVGElement('text', {
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-size': fontSize,
          'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
          fill: style.labelColor ?? '#000000',
        });
        textEl.textContent = text;
        g.appendChild(textEl);
      }
    }
  }
```

- [ ] **Step 5: Update emitLabelNode (edge labels)**

In `emitLabelNode`, replace the text creation with math-aware rendering:

Replace:
```js
  // Text centered in rect
  const text = createSVGElement('text', {
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-size': style.fontSize ?? DEFAULTS.fontSize,
    'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
    fill: style.labelColor ?? '#000000',
  });
  text.textContent = String(label);
  g.appendChild(text);
```

With:
```js
  // Text or math centered in rect
  const fontSize = style.fontSize ?? DEFAULTS.fontSize;
  const labelStr = String(label);
  const labelContent = createLabelContent(labelStr, {
    fontSize,
    fontFamily: style.fontFamily ?? DEFAULTS.fontFamily,
    color: style.labelColor ?? '#000000',
  });

  if (labelContent.type === 'math') {
    const fo = createMathForeignObject(labelContent.html, labelContent.width, labelContent.height, {
      fontSize,
      color: style.labelColor ?? '#000000',
    });
    g.appendChild(fo);
  } else {
    const textEl = createSVGElement('text', {
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': fontSize,
      'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
      fill: style.labelColor ?? '#000000',
    });
    textEl.textContent = labelContent.content;
    g.appendChild(textEl);
  }
```

- [ ] **Step 6: Update emitDrawPath inline labels**

In `emitDrawPath`, replace the text creation in the label loop:

Replace:
```js
      const text = createSVGElement('text', {
        x: ln.x + anchorInfo.dx,
        y: ln.y + anchorInfo.dy,
        'text-anchor': anchorInfo.textAnchor,
        'dominant-baseline': anchorInfo.baseline,
        'font-size': ln.fontSize ?? DEFAULTS.fontSize,
        'font-family': ln.fontFamily ?? DEFAULTS.fontFamily,
        fill: ln.color ?? '#000',
        class: 'draw-label',
      });
      text.textContent = String(ln.label);
      labelLayer.appendChild(text);
```

With:
```js
      const labelStr = String(ln.label);
      const fontSize = ln.fontSize ?? DEFAULTS.fontSize;
      const labelContent = createLabelContent(labelStr, {
        fontSize,
        fontFamily: ln.fontFamily ?? DEFAULTS.fontFamily,
        color: ln.color ?? '#000',
      });

      if (labelContent.type === 'math') {
        // Math: use foreignObject wrapped in a <g> for positioning
        const mathG = createSVGElement('g', {
          class: 'draw-label',
          transform: `translate(${ln.x + anchorInfo.dx},${ln.y + anchorInfo.dy})`,
        });
        const fo = createMathForeignObject(labelContent.html, labelContent.width, labelContent.height, {
          fontSize,
          color: ln.color ?? '#000',
        });
        mathG.appendChild(fo);
        labelLayer.appendChild(mathG);
      } else {
        const text = createSVGElement('text', {
          x: ln.x + anchorInfo.dx,
          y: ln.y + anchorInfo.dy,
          'text-anchor': anchorInfo.textAnchor,
          'dominant-baseline': anchorInfo.baseline,
          'font-size': fontSize,
          'font-family': ln.fontFamily ?? DEFAULTS.fontFamily,
          fill: ln.color ?? '#000',
          class: 'draw-label',
        });
        text.textContent = labelContent.content;
        labelLayer.appendChild(text);
      }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test test/katex-math.test.js`
Expected: All 15 tests PASS.

- [ ] **Step 8: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/svg/emitter.js test/katex-math.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: wire KaTeX rendering into emitter with fallback"
```

---

### Task 3: KaTeX-Aware Node Auto-Sizing

**What it does:** Updates `estimateTextDimensions` to use KaTeX measurement when available, producing accurate dimensions for math content like `$\frac{1}{4}$` (which is taller than wide, unlike the character-count heuristic's estimate). This makes auto-sized nodes properly fit their math content.

**Files:**
- Modify: `src-v2/core/text-measure.js`
- Modify: `test/katex-math.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/katex-math.test.js`:

```js
import { estimateTextDimensions } from '../src-v2/core/text-measure.js';

describe('text measurement with math (fallback)', () => {
  it('estimates $\\frac{1}{4}$ using stripped text when KaTeX unavailable', () => {
    const dim = estimateTextDimensions('$\\frac{1}{4}$', 14);
    // Stripped to '\frac{1}{4}' — character heuristic
    assert.ok(dim.width > 0, 'should have width');
    assert.ok(dim.height > 0, 'should have height');
  });

  it('estimates mixed text+math', () => {
    const dim = estimateTextDimensions('value: $x^2$', 14);
    assert.ok(dim.width > 0, 'should have width');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/katex-math.test.js`
Expected: FAIL — `estimateTextDimensions` still uses `$` in character count.

- [ ] **Step 3: Update estimateTextDimensions to strip math**

In `src-v2/core/text-measure.js`, add import and math stripping:

```js
import { isMathLabel, stripMath, isKaTeXAvailable, createLabelContent } from './katex-renderer.js';
```

Update `estimateTextDimensions` — at the start, after the null check, add:

```js
  // If math label and KaTeX available, use actual rendered dimensions
  if (isMathLabel(str) && isKaTeXAvailable()) {
    const content = createLabelContent(str, { fontSize, fontFamily: 'serif', color: '#000' });
    return { width: content.width, height: content.height };
  }

  // Strip $ delimiters for character-count estimation
  const measured = isMathLabel(str) ? stripMath(str) : str;
```

Then use `measured` instead of `str` for the rest of the function:

Replace `const explicitLines = str.split('\\\\');` with `const explicitLines = measured.split('\\\\');`

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/katex-math.test.js`
Expected: All 17 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/core/text-measure.js test/katex-math.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: KaTeX-aware text measurement for node auto-sizing"
```

---

### Task 4: Visual Demo with KaTeX

**What it does:** Creates a demo that loads KaTeX from CDN and shows math rendering in nodes, edge labels, and path labels. Includes the economics diagram with proper `$\frac{1}{4}$` fractions.

**Files:**
- Create: `examples-v2/katex-demo.html`

- [ ] **Step 1: Create the demo**

Create `examples-v2/katex-demo.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>tikz-svg: KaTeX Math Rendering Demo</title>
  <!-- KaTeX CSS + JS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
  <!-- mathjs for plot expressions -->
  <script src="https://cdn.jsdelivr.net/npm/mathjs@15.1.1/lib/browser/math.js"></script>
  <script type="importmap">
  {
    "imports": {
      "mathjs": "./mathjs-shim.js"
    }
  }
  </script>
  <style>
    body { font-family: system-ui; padding: 2rem; background: #f8f8f8; max-width: 900px; margin: 0 auto; }
    .demo { margin: 2rem 0; background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    svg { border: 1px solid #eee; display: block; margin: 0.5rem 0; }
    h2 { color: #333; margin-top: 0; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>KaTeX Math Rendering Demo</h1>
  <p>Labels with <code>$...$</code> are rendered as LaTeX math via KaTeX.</p>

  <div class="demo">
    <h2>Math in nodes</h2>
    <svg id="demo1" width="700" height="200"></svg>
  </div>

  <div class="demo">
    <h2>Economics diagram with proper fractions</h2>
    <svg id="demo2" width="500" height="400"></svg>
  </div>

  <div class="demo">
    <h2>Mixed text and math</h2>
    <svg id="demo3" width="600" height="150"></svg>
  </div>

  <script type="module">
    import { render } from '../src-v2/index.js';

    // Demo 1: Math in nodes
    render(document.getElementById('demo1'), {
      states: {
        frac: { position: { x: 80, y: 100 }, label: '$\\frac{1}{4}$', shape: 'circle', fill: '#dbeafe', stroke: '#2563eb' },
        sub: { position: { x: 220, y: 100 }, label: '$e_1$', shape: 'circle', fill: '#d1fae5', stroke: '#059669' },
        greek: { position: { x: 360, y: 100 }, label: '$\\alpha + \\beta$', shape: 'circle', fill: '#fef3c7', stroke: '#f59e0b' },
        complex: { position: { x: 540, y: 100 }, label: '$\\frac{1-p}{p} \\cdot v$', shape: 'rectangle', fill: '#ede9fe', stroke: '#7c3aed' },
      },
      edges: [],
    });

    // Demo 2: Economics diagram with KaTeX fractions
    const txt = (x, y, label, anchor, size = 12) => ({
      position: { x, y: -y },
      label,
      shape: 'rectangle',
      fill: 'none',
      stroke: 'none',
      anchor,
      fontSize: size,
      innerSep: 1,
    });

    const u1 = (x) => {
      if (x < 0.25) return -x * x;
      if (x < 1.25) return 1 - (1.25 - x) ** 2 - x * x;
      return 1 - x * x;
    };

    render(document.getElementById('demo2'), {
      scale: 200,
      originX: 100,
      originY: 90,
      draw: [
        { type: 'path', points: [{x:0,y:-0.3},{x:0,y:0.7}], arrow: '<->' },
        { type: 'path', points: [{x:-0.1,y:0},{x:1.30,y:0}], arrow: '<->' },
        { type: 'node', id: 'ylabel', ...txt(-0.4, 0.38, '$u_1(e_1,e_2|\\Delta)$', 'west') },
        { type: 'node', id: 'xlabel', ...txt(1.32, 0, '$e_1$', 'west') },
        { type: 'plot', expr: u1, domain: [0,1.3], samples: 200, handler: 'smooth', stroke: 'blue', scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 },
        { type: 'node', id: 'u1end', ...txt(1.32, -0.69, '$u_1$', 'west') },
        { type: 'path', points: [{x:0.25,y:0.1},{x:0.25,y:-0.3}], dotted: true },
        { type: 'path', points: [{x:1.25,y:0.55},{x:1.25,y:0.1}], dotted: true },
        { type: 'path', points: [{x:0.625,y:0},{x:0.625,y:-0.21875}], dotted: true },
        { type: 'node', id: 'lbl1', ...txt(0.25, -0.1, '$\\frac{1}{4}$', 'north') },
        { type: 'node', id: 'lbl2', ...txt(0.625, 0, '$\\frac{5}{8}$', 'north') },
        { type: 'node', id: 'lbl3', ...txt(1.25, 0, '$\\frac{5}{4}$', 'north') },
        { type: 'path', points: [{x:0,y:0},{x:0.25,y:0}], stroke: 'red', thick: true },
        { type: 'node', id: 'caption', ...txt(0.6, -0.7, '$\\Delta=0,\\, c(e)=e^2,\\, v_1=v_2=1,\\, e_2=\\frac{1}{4}$', 'north', 10) },
      ],
    });

    // Demo 3: Mixed text and math
    render(document.getElementById('demo3'), {
      states: {
        a: { position: { x: 100, y: 75 }, label: 'Payoff: $\\frac{1-p}{p}$', shape: 'rectangle', fill: '#f3f4f6', stroke: '#374151' },
        b: { position: { x: 350, y: 75 }, label: 'Cost: $c(e) = e^2$', shape: 'rectangle', fill: '#f3f4f6', stroke: '#374151' },
      },
      edges: [],
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

```bash
open http://localhost:8080/examples-v2/katex-demo.html
```

Expected: Proper stacked fractions, subscripts, Greek letters rendered via KaTeX.

- [ ] **Step 3: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add examples-v2/katex-demo.html
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add KaTeX math rendering demo with fractions and subscripts"
```

---

## Verification Checklist

After all 4 tasks:

- [ ] `node --test` — all tests pass
- [ ] `$\frac{1}{4}$` renders as stacked fraction in browser (with KaTeX loaded)
- [ ] `$e_1$` renders with proper subscript
- [ ] `$\alpha + \beta$` renders Greek letters
- [ ] Mixed text + math (`Payoff: $\frac{1}{2}$`) renders correctly
- [ ] Without KaTeX loaded, labels fall back to plain text with `$` stripped
- [ ] Node auto-sizing works with math labels (nodes fit their KaTeX content)
- [ ] Edge labels support math
- [ ] Path inline labels support math
- [ ] Existing non-math labels render identically (no regressions)
- [ ] Color inheritance works (labelColor applies to math)
- [ ] Economics demo shows proper `$\frac{1}{4}$`, `$\frac{5}{8}$`, `$\frac{5}{4}$`

## What This Does NOT Cover

- **Display math** (`$$...$$`) — only inline math (`$...$`) is supported. Display mode (centered, larger) is a future enhancement.
- **Custom KaTeX macros** — `\newcommand` definitions. KaTeX supports them via options but we don't expose that.
- **Server-side rendering** — KaTeX can render in Node.js too, but our `<foreignObject>` approach requires a browser. For Node.js, we'd need KaTeX's SVG output mode.
- **Math in multipart labels** — Array labels with per-part math. Currently only single-label rendering is math-aware.
