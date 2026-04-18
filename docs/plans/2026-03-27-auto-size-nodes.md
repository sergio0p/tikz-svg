**Status: COMPLETED** — Text-driven node sizing implemented in pipeline Phase 3.

# Auto-Sizing Node Backgrounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make nodes automatically size their background shape to fit text content plus inner sep — matching TikZ's core node sizing algorithm — so that filled nodes properly cover underlying paths.

**Architecture:** Add a `estimateTextDimensions()` helper that computes text width and height from the label string, fontSize, and textWidth (for wrapped text). In Phase 3 of the pipeline, when no explicit dimensions are given (no `radius`, `halfWidth`, etc.), compute dimensions from text + innerSep. The formula matches PGF's `pgfmoduleshapes.code.tex` lines 938–972: `halfWidth = max(textWidth/2 + innerSep, minimumWidth/2)`. This replaces the current behavior where unspecified dimensions fall back to `DEFAULTS.nodeRadius`.

**Tech Stack:** ES modules, character-width estimation (0.6 × fontSize), existing pipeline. Tests: `node --test` + jsdom.

**Stop-at-any-step guarantee:** Each task ships a complete, tested feature.

**PGF source reference:**

PGF rectangle shape `\northeast` anchor (pgfmoduleshapes.code.tex lines 938–972):
```
x = max(textboxWidth + 2*innerXSep, minimumWidth) / 2 + outerXSep
y = max(textboxHeight + textboxDepth + 2*innerYSep, minimumHeight) / 2 + outerYSep
```

The key insight: **text drives shape size**, not the other way around. The shape wraps the text.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-v2/core/text-measure.js` | **Create** | `estimateTextDimensions()`: compute text width/height from label + fontSize + textWidth |
| `src-v2/index.js` | **Modify** | Phase 3: use text dimensions when no explicit size is given |
| `test/auto-size-nodes.test.js` | **Create** | Tests for text measurement and auto-sizing behavior |

---

### Task 1: Text Dimension Estimation

**What it does:** Creates a helper that estimates the pixel dimensions of a label string given fontSize and optional textWidth (for wrapped text). Uses character-width heuristic (0.6 × fontSize for width, 1.2 × fontSize for height per line). Also handles `\\\\` explicit line breaks and textWidth wrapping.

**Files:**
- Create: `src-v2/core/text-measure.js`
- Create: `test/auto-size-nodes.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/auto-size-nodes.test.js`:

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { estimateTextDimensions } from '../src-v2/core/text-measure.js';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  document = dom.window.document;
});

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

describe('estimateTextDimensions', () => {
  it('estimates single-line text', () => {
    const dim = estimateTextDimensions('Hello', 14);
    // 5 chars × 0.6 × 14 = 42 wide, 1 line × 14 × 1.2 = 16.8 tall
    assert.ok(dim.width > 30 && dim.width < 60, `width ${dim.width}`);
    assert.ok(dim.height > 10 && dim.height < 25, `height ${dim.height}`);
  });

  it('estimates empty string as zero dimensions', () => {
    const dim = estimateTextDimensions('', 14);
    assert.strictEqual(dim.width, 0);
    assert.strictEqual(dim.height, 0);
  });

  it('handles explicit line breaks', () => {
    const dim = estimateTextDimensions('A\\\\B\\\\C', 14);
    // 3 lines, each 1 char wide → tallest dimension is height
    assert.ok(dim.height > 40, `height ${dim.height} should reflect 3 lines`);
    assert.ok(dim.width < 20, `width ${dim.width} should be narrow`);
  });

  it('handles textWidth wrapping', () => {
    const dim = estimateTextDimensions('This is a long label that wraps', 14, 80);
    // textWidth limits the width
    assert.ok(dim.width <= 80, `width ${dim.width} should be <= textWidth 80`);
    assert.ok(dim.height > 14 * 1.2, 'should be multi-line');
  });

  it('uses textWidth as width when set', () => {
    const dim = estimateTextDimensions('Short', 14, 200);
    // Even short text uses textWidth as the box width
    assert.strictEqual(dim.width, 200);
  });

  it('handles null/undefined label', () => {
    const dim = estimateTextDimensions(null, 14);
    assert.strictEqual(dim.width, 0);
    assert.strictEqual(dim.height, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/auto-size-nodes.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement text dimension estimation**

Create `src-v2/core/text-measure.js`:

```js
/**
 * Text dimension estimation for auto-sizing nodes.
 *
 * TikZ uses TeX's typesetting engine to measure exact text dimensions.
 * We use a character-width heuristic: 0.6 × fontSize per character.
 * This is sufficient for layout — exact glyph metrics require KaTeX (future).
 *
 * Source: pgfmoduleshapes.code.tex lines 938–972
 *   x = max(\wd\pgfnodeparttextbox + 2*innerSep, minimumWidth)
 */

/**
 * Estimate the pixel dimensions of a text label.
 *
 * @param {string|null} label - text content (supports '\\\\' line breaks)
 * @param {number} fontSize - font size in px
 * @param {number} [textWidth=0] - if > 0, wrap text at this width
 * @returns {{ width: number, height: number }}
 */
export function estimateTextDimensions(label, fontSize, textWidth = 0) {
  if (label == null || label === '') {
    return { width: 0, height: 0 };
  }

  const str = String(label);
  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize * 1.2;

  // Split on explicit line breaks
  const explicitLines = str.split('\\\\');

  if (textWidth > 0) {
    // With textWidth: wrap lines and use textWidth as the box width
    const maxChars = Math.max(1, Math.floor(textWidth / charWidth));
    let totalLines = 0;
    for (const line of explicitLines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        totalLines += 1;
        continue;
      }
      totalLines += Math.max(1, Math.ceil(trimmed.length / maxChars));
    }
    return {
      width: textWidth,
      height: totalLines * lineHeight,
    };
  }

  // Without textWidth: measure natural width of each line
  let maxWidth = 0;
  for (const line of explicitLines) {
    const w = line.trim().length * charWidth;
    if (w > maxWidth) maxWidth = w;
  }

  return {
    width: maxWidth,
    height: explicitLines.length * lineHeight,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/auto-size-nodes.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add src-v2/core/text-measure.js test/auto-size-nodes.test.js
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: add text dimension estimation for auto-sizing nodes"
```

---

### Task 2: Auto-Size Nodes from Text Content

**What it does:** When a node has no explicit size (`radius`, `halfWidth`, `halfHeight`, `rx`, `ry` are all unset), compute dimensions from text content + innerSep. This matches TikZ's core behavior: the shape wraps the text. When explicit dimensions ARE given, they still work as before (backward compatible).

The algorithm (matching PGF):
```
textDim = estimateTextDimensions(label, fontSize, textWidth)
halfWidth  = max(textDim.width/2 + innerSep, minimumWidth/2)
halfHeight = max(textDim.height/2 + innerSep, minimumHeight/2)
```

For circles: `radius = max(halfWidth, halfHeight)`.

**Files:**
- Modify: `src-v2/index.js`
- Modify: `test/auto-size-nodes.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/auto-size-nodes.test.js`:

```js
import { render } from '../src-v2/index.js';

describe('auto-size nodes from text', () => {
  it('rectangle auto-sizes to fit long text', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'A longer label here',
          shape: 'rectangle',
          fill: 'white',
        },
      },
      edges: [],
    });
    const rect = svg.querySelector('#node-a rect');
    const w = parseFloat(rect.getAttribute('width'));
    // 19 chars × 0.6 × 14 ≈ 160, plus innerSep → should be > 100
    assert.ok(w > 100, `rect width ${w} should auto-size to text`);
  });

  it('rectangle auto-sizes to fit short text', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'Hi',
          shape: 'rectangle',
          fill: 'white',
        },
      },
      edges: [],
    });
    const rect = svg.querySelector('#node-a rect');
    const w = parseFloat(rect.getAttribute('width'));
    // 2 chars × 0.6 × 14 ≈ 17, plus innerSep(3)*2 ≈ 23 → halfWidth ≈ 11.5, width ≈ 23
    assert.ok(w > 15 && w < 60, `rect width ${w} should be compact`);
  });

  it('circle auto-sizes to fit text', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'Long circle text',
          fill: 'white',
        },
      },
      edges: [],
    });
    const circle = svg.querySelector('#node-a circle');
    const r = parseFloat(circle.getAttribute('r'));
    // Should be bigger than default 20 to fit text
    assert.ok(r > 25, `circle radius ${r} should auto-size`);
  });

  it('explicit radius overrides auto-sizing', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'Long text that would need big shape',
          radius: 15,
          fill: 'white',
        },
      },
      edges: [],
    });
    const circle = svg.querySelector('#node-a circle');
    const r = parseFloat(circle.getAttribute('r'));
    // Should respect explicit radius (+ innerSep + outerSep), not auto-size
    // 15 + 3(innerSep) + 0.75(outerSep) = 18.75, visual = 18.75 - 0.75 = 18
    assert.ok(r < 25, `circle radius ${r} should respect explicit radius`);
  });

  it('auto-sized node with fill covers paths underneath', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        lbl: {
          position: { x: 100, y: 100 },
          label: '¼',
          shape: 'rectangle',
          fill: 'white',
          stroke: 'none',
          fontSize: 'scriptsize',
        },
      },
      edges: [],
      paths: [
        { points: [{ x: 100, y: 50 }, { x: 100, y: 150 }], dotted: true },
      ],
    });
    const rect = svg.querySelector('#node-lbl rect');
    assert.ok(rect, 'should have a background rect');
    assert.strictEqual(rect.getAttribute('fill'), 'white');
    const w = parseFloat(rect.getAttribute('width'));
    assert.ok(w > 5, `rect width ${w} should cover text`);
  });

  it('minimumWidth still works as floor with auto-sizing', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'X',
          shape: 'rectangle',
          minimumWidth: 80,
          fill: 'white',
        },
      },
      edges: [],
    });
    const rect = svg.querySelector('#node-a rect');
    const w = parseFloat(rect.getAttribute('width'));
    assert.ok(w >= 78, `rect width ${w} should respect minimumWidth 80`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/auto-size-nodes.test.js`
Expected: FAIL — auto-sizing not implemented (nodes use DEFAULTS.nodeRadius).

- [ ] **Step 3: Implement auto-sizing in Phase 3**

Add import at top of `src-v2/index.js`:

```js
import { estimateTextDimensions } from './core/text-measure.js';
```

In Phase 3, replace the switch statement and minimum-dimensions block with:

```js
    // Auto-size from text content when no explicit dimensions given
    const label = states[id].label ?? id;
    const fontSize = style.fontSize ?? DEFAULTS.fontSize;
    const textWidth = style.textWidth ?? 0;
    const hasExplicitSize = style.halfWidth != null || style.halfHeight != null
      || style.rx != null || style.ry != null || style.radius != null;

    if (hasExplicitSize) {
      // Explicit dimensions: use them (existing behavior)
      switch (shapeName) {
        case 'rectangle':
        case 'rectangle split':
          geomConfig.halfWidth = style.halfWidth ?? style.radius ?? DEFAULTS.nodeRadius;
          geomConfig.halfHeight = style.halfHeight ?? style.radius ?? DEFAULTS.nodeRadius;
          break;
        case 'ellipse':
        case 'ellipse split':
          geomConfig.rx = style.rx ?? style.radius ?? DEFAULTS.nodeRadius;
          geomConfig.ry = style.ry ?? style.radius ?? DEFAULTS.nodeRadius;
          break;
        case 'diamond':
        case 'kite':
        case 'isosceles triangle':
        case 'trapezium':
          geomConfig.halfWidth = style.halfWidth ?? style.radius ?? DEFAULTS.nodeRadius;
          geomConfig.halfHeight = style.halfHeight ?? style.radius ?? DEFAULTS.nodeRadius;
          break;
        case 'circle':
        case 'circle split':
        case 'semicircle':
        case 'regular polygon':
        case 'circular sector':
        default:
          geomConfig.radius = style.radius ?? DEFAULTS.nodeRadius;
          break;
      }
    } else {
      // Auto-size from text content (TikZ default behavior)
      const textDim = estimateTextDimensions(
        Array.isArray(label) ? label.join(' ') : label,
        fontSize,
        textWidth
      );
      const autoHalfW = textDim.width / 2;
      const autoHalfH = textDim.height / 2;

      switch (shapeName) {
        case 'rectangle':
        case 'rectangle split':
        case 'diamond':
        case 'kite':
        case 'isosceles triangle':
        case 'trapezium':
          geomConfig.halfWidth = autoHalfW;
          geomConfig.halfHeight = autoHalfH;
          break;
        case 'ellipse':
        case 'ellipse split':
          geomConfig.rx = autoHalfW;
          geomConfig.ry = autoHalfH;
          break;
        case 'circle':
        case 'circle split':
        case 'semicircle':
        case 'regular polygon':
        case 'circular sector':
        default:
          geomConfig.radius = Math.max(autoHalfW, autoHalfH);
          break;
      }
    }

    // Apply minimum dimensions and innerSep
    const innerSep = style.innerSep ?? DEFAULTS.innerSep;
    const minHalfW = (style.minimumWidth ?? 0) / 2;
    const minHalfH = (style.minimumHeight ?? 0) / 2;

    if (geomConfig.halfWidth != null) {
      geomConfig.halfWidth = Math.max(geomConfig.halfWidth + innerSep, minHalfW);
      geomConfig.halfHeight = Math.max(geomConfig.halfHeight + innerSep, minHalfH);
    } else if (geomConfig.rx != null) {
      geomConfig.rx = Math.max(geomConfig.rx + innerSep, minHalfW);
      geomConfig.ry = Math.max(geomConfig.ry + innerSep, minHalfH);
    } else if (geomConfig.radius != null) {
      const minR = Math.max(minHalfW, minHalfH);
      geomConfig.radius = Math.max(geomConfig.radius + innerSep, minR);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/auto-size-nodes.test.js`
Expected: All 12 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS. Existing tests that specify explicit `radius` or dimensions should be unaffected.

- [ ] **Step 6: Commit**

```bash
git -C ~/Dropbox/Scripts/tikz-svg add src-v2/core/text-measure.js src-v2/index.js test/auto-size-nodes.test.js
git -C ~/Dropbox/Scripts/tikz-svg commit -m "feat: auto-size node shapes from text content (TikZ-faithful)"
```

---

## Verification Checklist

After both tasks:

- [ ] `node --test` — all tests pass
- [ ] Nodes with explicit `radius`/`halfWidth`/`halfHeight`/`rx`/`ry` work as before (backward compatible)
- [ ] Nodes without explicit dimensions auto-size to fit their label text
- [ ] `fill: 'white'` + auto-sizing creates opaque backgrounds that cover paths
- [ ] `minimumWidth`/`minimumHeight` still enforce floor dimensions
- [ ] `innerSep` adds padding around text
- [ ] `textWidth` wrapping is accounted for in dimension estimation
- [ ] Existing automata demos render correctly (explicit radius specified)

## What This Does NOT Cover

- **Exact text measurement** — we use 0.6 × fontSize character-width heuristic. KaTeX integration (TODO) would give pixel-accurate glyph metrics.
- **TikZ draw-path inline nodes** — In TikZ, `\draw (a)--(b) node[midway]{text}` creates a node with automatic white fill. Our inline path labels (`config.paths[].nodes`) are bare `<text>` elements without backgrounds. A future task could convert them to proper nodes.
- **Layer system** — PGF has `background`, `main`, and `foreground` layers. Our 3-layer system (`edge-layer`, `label-layer`, `node-layer`) is functionally similar but not user-configurable.

---

## Context for Future Implementer

### The TikZ node sizing algorithm

PGF rectangle shape (pgfmoduleshapes.code.tex lines 938–972):

1. Measure the text box: `textWidth = \wd\pgfnodeparttextbox`, `textHeight = \ht + \dp`.
2. Add inner sep on both sides: `totalWidth = textWidth + 2 * innerXSep`.
3. Enforce minimum: `totalWidth = max(totalWidth, minimumWidth)`.
4. Compute half-width: `halfWidth = totalWidth / 2`.
5. Add outer sep: `anchorHalfWidth = halfWidth + outerXSep`.

Same for height. Our implementation mirrors this exactly, substituting character-width estimation for TeX's text box measurement.

### Backward compatibility

The key guard is `hasExplicitSize`: if the user specifies ANY dimension property (`radius`, `halfWidth`, `halfHeight`, `rx`, `ry`), the old code path runs unchanged. Auto-sizing only activates when ALL dimension properties are absent. This means every existing config that specifies `radius: 20` (like automata states) continues to work identically.

### Layers

We have 3 SVG `<g>` layers in paint order:
1. `edge-layer` — edges, plots, free-form paths (drawn first = behind)
2. `label-layer` — edge labels, path inline labels
3. `node-layer` — nodes (drawn last = on top)

This means nodes with `fill: 'white'` naturally cover edges and paths underneath. No Z-ordering changes needed.
