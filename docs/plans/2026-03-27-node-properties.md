# Missing TikZ Node Properties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 11 missing TikZ node properties: `minimumWidth`, `minimumHeight`, `textWidth`, `align`, `anchor`, `xshift`, `yshift`, `rotate`, per-node `scale`, `innerSep` on shapes, and named font sizes.

**Architecture:** Properties flow through the existing style cascade (`resolveNodeStyle`) into the geometry phase (Phase 3) where they affect shape dimensions, and the emit phase (Phase 6) where they affect the `<g>` transform and `<text>` rendering. Text wrapping uses SVG `<tspan>` elements with word-break computation. Anchor-based positioning adjusts the node's center so the named anchor lands at the specified position. xshift/yshift are applied as post-positioning offsets.

**Tech Stack:** ES modules, existing style cascade, existing shape geometry, SVG `<tspan>` for text wrap. Tests: `node --test` + jsdom.

**Stop-at-any-step guarantee:** Each task ships a complete, tested feature.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-v2/core/constants.js` | **Modify** | Add defaults for new properties |
| `src-v2/style/style.js` | **Modify** | Add new properties to `resolveNodeStyle` base, add `FONT_SIZE_MAP` |
| `src-v2/index.js` | **Modify** | Phase 3: apply minimumWidth/Height, innerSep to geom sizing. Phase 2 post: apply xshift/yshift/anchor |
| `src-v2/svg/emitter.js` | **Modify** | Apply rotate/scale to node `<g>` transform. Text wrapping with `<tspan>`. Anchor-aware text positioning within `textWidth`. |
| `test/node-properties.test.js` | **Create** | Tests for all new properties |
| `examples-v2/node-properties-demo.html` | **Create** | Visual demo |

---

### Task 1: Named Font Sizes and innerSep on Nodes

**What it does:** Adds a `FONT_SIZE_MAP` for TikZ named sizes (`\tiny`, `\scriptsize`, `\small`, etc.) and wires `innerSep` into node style resolution so it affects node dimensions (not just edge labels).

**TikZ equivalents:**
- `font=\small` → `fontSize: 'small'` (resolves to 10)
- `inner sep=5pt` → `innerSep: 5` (adds padding inside node boundary)

**Files:**
- Modify: `src-v2/core/constants.js`
- Modify: `src-v2/style/style.js`
- Create: `test/node-properties.test.js`

- [ ] **Step 1: Write failing tests**

Create `test/node-properties.test.js`:

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { resolveNodeStyle } from '../src-v2/style/style.js';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  document = dom.window.document;
});

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

describe('named font sizes', () => {
  it('resolves "small" to 10', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, fontSize: 'small' } },
    });
    assert.strictEqual(style.fontSize, 10);
  });

  it('resolves "tiny" to 7', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, fontSize: 'tiny' } },
    });
    assert.strictEqual(style.fontSize, 7);
  });

  it('resolves "scriptsize" to 8', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, fontSize: 'scriptsize' } },
    });
    assert.strictEqual(style.fontSize, 8);
  });

  it('passes through numeric fontSize unchanged', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, fontSize: 16 } },
    });
    assert.strictEqual(style.fontSize, 16);
  });
});

describe('innerSep on nodes', () => {
  it('includes innerSep in resolved style', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, innerSep: 5 } },
    });
    assert.strictEqual(style.innerSep, 5);
  });

  it('defaults innerSep to DEFAULTS.innerSep', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 } } },
    });
    assert.strictEqual(style.innerSep, 3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/node-properties.test.js`
Expected: FAIL — named font sizes not resolved, innerSep not in base.

- [ ] **Step 3: Add FONT_SIZE_MAP and update resolveNodeStyle**

Add to `src-v2/style/style.js` before `resolveNodeStyle`:

```js
/** TikZ named font sizes → pixel equivalents (at 10pt base, ~1.4x for screen). */
const FONT_SIZE_MAP = {
  tiny: 7,
  scriptsize: 8,
  footnotesize: 9,
  small: 10,
  normalsize: 12,
  large: 14,
  Large: 17,
  LARGE: 20,
  huge: 24,
  Huge: 28,
};
```

In `resolveNodeStyle`, add `innerSep` to the base object:

```js
    innerSep: DEFAULTS.innerSep,
```

At the end of `resolveNodeStyle`, before the return, add font size resolution:

```js
  // Resolve named font sizes
  if (typeof merged.fontSize === 'string') {
    merged.fontSize = FONT_SIZE_MAP[merged.fontSize] ?? DEFAULTS.fontSize;
  }
```

But since `resolveNodeStyle` currently returns a spread, we need to capture the result first. Change the return to:

```js
  const merged = { ...base, ...stateStyle, ...groupStyle, ...expandedProps };
  // Resolve named font sizes
  if (typeof merged.fontSize === 'string') {
    merged.fontSize = FONT_SIZE_MAP[merged.fontSize] ?? DEFAULTS.fontSize;
  }
  return merged;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/node-properties.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/style/style.js test/node-properties.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add named font sizes and innerSep to node style resolution"
```

---

### Task 2: minimumWidth, minimumHeight, and innerSep Geometry

**What it does:** Wires `minimumWidth`, `minimumHeight`, and `innerSep` into Phase 3 (node geometry) so they affect shape dimensions. In TikZ, inner sep adds padding inside the shape boundary around text, and minimum width/height set floor dimensions. The effective dimensions are: `max(minimumWidth/2, textEstimate + innerSep)`.

**TikZ equivalents:**
- `minimum width=2cm` → `minimumWidth: 80` (in px)
- `minimum height=1cm` → `minimumHeight: 40`
- `inner sep=5pt` → `innerSep: 5` (enlarges shape to pad text)

**Files:**
- Modify: `src-v2/core/constants.js`
- Modify: `src-v2/index.js` (Phase 3)
- Modify: `src-v2/style/style.js`
- Modify: `test/node-properties.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/node-properties.test.js`:

```js
import { render } from '../src-v2/index.js';

describe('minimumWidth and minimumHeight', () => {
  it('enforces minimumWidth on rectangle', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'x', shape: 'rectangle', minimumWidth: 80, minimumHeight: 40 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const rect = node.querySelector('rect');
    // width should be at least 80 (minimum) — rect width = 2 * halfWidth
    const w = parseFloat(rect.getAttribute('width'));
    assert.ok(w >= 80, `rect width ${w} should be >= 80`);
    const h = parseFloat(rect.getAttribute('height'));
    assert.ok(h >= 40, `rect height ${h} should be >= 40`);
  });

  it('enforces minimumWidth on circle (becomes minimum diameter)', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'x', minimumWidth: 60 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const circle = node.querySelector('circle');
    const r = parseFloat(circle.getAttribute('r'));
    // radius should be at least 30 (half of minimumWidth 60) minus outerSep
    assert.ok(r >= 28, `circle radius ${r} should be >= 28`);
  });

  it('innerSep enlarges rectangle beyond text', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'Hi', shape: 'rectangle', innerSep: 15, radius: 10 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const rect = node.querySelector('rect');
    const w = parseFloat(rect.getAttribute('width'));
    // With innerSep=15, halfWidth should be at least radius(10) + 15 = 25, so width >= 50
    assert.ok(w >= 48, `rect width ${w} should reflect innerSep`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/node-properties.test.js`
Expected: FAIL — `minimumWidth` not handled in Phase 3.

- [ ] **Step 3: Add defaults to constants.js**

Add to `DEFAULTS` in `src-v2/core/constants.js`:

```js
  // Node dimension controls
  minimumWidth: 0,
  minimumHeight: 0,
  textWidth: 0,
```

- [ ] **Step 4: Add properties to resolveNodeStyle base**

In `resolveNodeStyle` in `src-v2/style/style.js`, add to the base object:

```js
    minimumWidth: DEFAULTS.minimumWidth,
    minimumHeight: DEFAULTS.minimumHeight,
    textWidth: DEFAULTS.textWidth,
    align: 'center',
    anchor: null,
    xshift: 0,
    yshift: 0,
    rotate: 0,
    nodeScale: 1,
```

- [ ] **Step 5: Wire minimumWidth/Height and innerSep into Phase 3**

In `src-v2/index.js`, in the Phase 3 geometry block, after the switch statement that sets `geomConfig` dimensions and before `const geom = shape.savedGeometry(geomConfig)`, add:

```js
    // Apply minimum dimensions and innerSep (TikZ inner sep enlarges shape to pad text)
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

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test test/node-properties.test.js`
Expected: All 9 tests PASS.

- [ ] **Step 7: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/core/constants.js src-v2/style/style.js src-v2/index.js test/node-properties.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add minimumWidth, minimumHeight, innerSep geometry to nodes"
```

---

### Task 3: xshift, yshift, and anchor positioning

**What it does:** Adds `xshift`/`yshift` as post-positioning offsets (applied after position resolution) and `anchor` which shifts the node center so the named anchor lands at the specified position. For example, `anchor: 'north west'` means the node's north-west corner sits at the position, not the center.

**TikZ equivalents:**
- `xshift=10pt` → `xshift: 10`
- `yshift=-5pt` → `yshift: -5`
- `anchor=north west` → `anchor: 'north west'`

**Files:**
- Modify: `src-v2/index.js` (after Phase 2.6, before Phase 3)
- Modify: `test/node-properties.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/node-properties.test.js`:

```js
describe('xshift and yshift', () => {
  it('shifts node position by xshift/yshift', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'A', xshift: 20, yshift: -10 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const transform = node.getAttribute('transform');
    // Position should be (120, 90)
    assert.ok(transform.includes('120'), 'x should be shifted +20');
    assert.ok(transform.includes('90'), 'y should be shifted -10');
  });
});

describe('anchor positioning', () => {
  it('anchor=north west places NW corner at position', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'A',
          shape: 'rectangle',
          radius: 20,
          anchor: 'north west',
        },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const transform = node.getAttribute('transform');
    // NW anchor is at (-halfWidth, -halfHeight) from center.
    // To put NW at (100,100), center must be at (100+hw, 100+hh).
    // hw ≈ 20 + innerSep(3) + outerSep(0.75), hh similar
    // Center x should be > 100
    const match = transform.match(/translate\(([\d.]+),?\s*([\d.]+)\)/);
    assert.ok(match, 'should have translate');
    const cx = parseFloat(match[1]);
    const cy = parseFloat(match[2]);
    assert.ok(cx > 100, `center x ${cx} should be > 100 (shifted right)`);
    assert.ok(cy > 100, `center y ${cy} should be > 100 (shifted down)`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/node-properties.test.js`
Expected: FAIL — xshift/yshift not applied.

- [ ] **Step 3: Implement xshift/yshift and anchor in the pipeline**

In `src-v2/index.js`, after Phase 3 (compute node geometry) — after the `nodeRegistry[id] = { center, shape, geom, style }` line — add a new block that applies shifts and anchor:

```js
  // ── PHASE 3.5: APPLY xshift, yshift, AND anchor ────────────────────
  // xshift/yshift: post-positioning offsets (TikZ xshift=, yshift=)
  // anchor: shift center so named anchor lands at the resolved position
  for (const id of stateIds) {
    const entry = nodeRegistry[id];
    const style = entry.style;
    let { x, y } = entry.center;

    // Apply anchor: shift center so the named anchor is at the original position
    if (style.anchor) {
      const anchorName = style.anchor;
      try {
        // Get anchor point relative to center at origin
        const anchorPt = entry.shape.anchor(anchorName, {
          ...entry.geom,
          center: { x: 0, y: 0 },
        });
        // Shift center so anchor lands at original position
        x -= anchorPt.x;
        y -= anchorPt.y;
      } catch {
        // Unknown anchor — silently ignore
      }
    }

    // Apply xshift/yshift
    x += (style.xshift ?? 0);
    y += (style.yshift ?? 0);

    entry.center = { x, y };
    // Also update geom center for correct rendering
    entry.geom = entry.shape.savedGeometry({
      ...entry.geom,
      center: { x, y },
      outerSep: entry.geom.outerSep,
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/node-properties.test.js`
Expected: All 11 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/index.js test/node-properties.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add xshift, yshift, anchor positioning to nodes"
```

---

### Task 4: rotate and per-node scale

**What it does:** Adds `rotate` (degrees) and `nodeScale` (multiplier) to node emission. These are applied as SVG transform attributes on the node's `<g>` element, after the translate.

**TikZ equivalents:**
- `rotate=30` → `rotate: 30`
- `scale=1.5` → `nodeScale: 1.5`

**Files:**
- Modify: `src-v2/svg/emitter.js`
- Modify: `test/node-properties.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/node-properties.test.js`:

```js
describe('rotate and per-node scale', () => {
  it('applies rotation to node group', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'R', rotate: 45 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const transform = node.getAttribute('transform');
    assert.ok(transform.includes('rotate(45)'), 'should include rotation');
  });

  it('applies per-node scale to node group', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'S', nodeScale: 1.5 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const transform = node.getAttribute('transform');
    assert.ok(transform.includes('scale(1.5)'), 'should include scale');
  });

  it('combines translate + rotate + scale', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 50, y: 50 }, label: 'X', rotate: 30, nodeScale: 2 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const transform = node.getAttribute('transform');
    assert.ok(transform.includes('translate'), 'should have translate');
    assert.ok(transform.includes('rotate'), 'should have rotate');
    assert.ok(transform.includes('scale'), 'should have scale');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/node-properties.test.js`
Expected: FAIL — no rotate/scale in transform.

- [ ] **Step 3: Update emitNode to apply rotate and scale**

In `src-v2/svg/emitter.js`, in the `emitNode` function, replace the transform string construction:

Replace:
```js
  const g = createSVGElement('g', {
    class: 'node',
    id: `node-${id}`,
    transform: `translate(${center.x}, ${center.y})`,
  });
```

With:
```js
  // Build transform: translate, then rotate, then scale (applied right-to-left)
  let transformStr = `translate(${center.x}, ${center.y})`;
  if (style.rotate) {
    transformStr += ` rotate(${style.rotate})`;
  }
  if (style.nodeScale && style.nodeScale !== 1) {
    transformStr += ` scale(${style.nodeScale})`;
  }

  const g = createSVGElement('g', {
    class: 'node',
    id: `node-${id}`,
    transform: transformStr,
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/node-properties.test.js`
Expected: All 14 tests PASS.

- [ ] **Step 5: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/svg/emitter.js test/node-properties.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add rotate and per-node scale to node rendering"
```

---

### Task 5: textWidth and text wrapping with align

**What it does:** Adds `textWidth` for multi-line text wrapping and `align` for text alignment within the wrapped block. Uses SVG `<tspan>` elements for line breaks. Supports explicit `\\` breaks in label strings. When `textWidth` is set, the shape automatically sizes to fit (respecting `minimumWidth`/`minimumHeight`).

**TikZ equivalents:**
- `text width=3cm` → `textWidth: 120` (px)
- `align=center` → `align: 'center'`
- `align=left` → `align: 'left'`
- `{First line \\ Second line}` → `label: 'First line \\\\ Second line'`

**Files:**
- Modify: `src-v2/svg/emitter.js`
- Modify: `test/node-properties.test.js`

- [ ] **Step 1: Write failing tests**

Append to `test/node-properties.test.js`:

```js
describe('textWidth and text wrapping', () => {
  it('wraps text into tspan elements when textWidth is set', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'This is a long label that should wrap',
          shape: 'rectangle',
          textWidth: 80,
        },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const tspans = node.querySelectorAll('tspan');
    assert.ok(tspans.length > 1, `should have multiple tspans, got ${tspans.length}`);
  });

  it('respects explicit \\\\ line breaks', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'Line 1\\\\Line 2\\\\Line 3',
          shape: 'rectangle',
          textWidth: 200,
        },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const tspans = node.querySelectorAll('tspan');
    assert.strictEqual(tspans.length, 3);
    assert.strictEqual(tspans[0].textContent, 'Line 1');
    assert.strictEqual(tspans[1].textContent, 'Line 2');
    assert.strictEqual(tspans[2].textContent, 'Line 3');
  });

  it('aligns text left when align=left', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'Short\\\\Longer text',
          shape: 'rectangle',
          textWidth: 120,
          align: 'left',
        },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const text = node.querySelector('text');
    assert.strictEqual(text.getAttribute('text-anchor'), 'start');
  });

  it('aligns text right when align=right', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'A\\\\B',
          shape: 'rectangle',
          textWidth: 120,
          align: 'right',
        },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const text = node.querySelector('text');
    assert.strictEqual(text.getAttribute('text-anchor'), 'end');
  });

  it('without textWidth renders single line as before', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'Simple' },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const tspans = node.querySelectorAll('tspan');
    assert.strictEqual(tspans.length, 0, 'no tspans without textWidth');
    const text = node.querySelector('text');
    assert.strictEqual(text.textContent, 'Simple');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/node-properties.test.js`
Expected: FAIL — no tspan wrapping.

- [ ] **Step 3: Add text wrapping helper**

Add to `src-v2/svg/emitter.js`, before `emitNode`:

```js
/**
 * Break a label string into lines for SVG rendering.
 * Handles explicit '\\\\' breaks and word-wrap at textWidth.
 *
 * @param {string} label
 * @param {number} textWidth - max width in px (0 = no wrapping)
 * @param {number} fontSize
 * @returns {string[]} lines
 */
function wrapText(label, textWidth, fontSize) {
  // Split on explicit \\\\ breaks first
  const explicitLines = String(label).split('\\\\');

  if (!textWidth || textWidth <= 0) {
    return explicitLines;
  }

  // Estimate char width (rough: 0.6 × fontSize for proportional fonts)
  const charWidth = fontSize * 0.6;
  const maxChars = Math.max(1, Math.floor(textWidth / charWidth));

  const result = [];
  for (const line of explicitLines) {
    const trimmed = line.trim();
    if (trimmed.length <= maxChars) {
      result.push(trimmed);
      continue;
    }

    // Word-wrap
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      if (current.length === 0) {
        current = word;
      } else if ((current + ' ' + word).length <= maxChars) {
        current += ' ' + word;
      } else {
        result.push(current);
        current = word;
      }
    }
    if (current.length > 0) {
      result.push(current);
    }
  }

  return result;
}
```

- [ ] **Step 4: Update emitNode to use text wrapping**

In `emitNode`, replace the single-label text emission block:

Replace:
```js
  } else if (label != null && label !== '') {
    // Single label centered at origin
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
  } else if (label != null && label !== '') {
    const fontSize = style.fontSize ?? DEFAULTS.fontSize;
    const textWidth = style.textWidth ?? 0;
    const lines = wrapText(label, textWidth, fontSize);

    if (lines.length > 1 || textWidth > 0) {
      // Multi-line: use <tspan> elements
      const align = style.align ?? 'center';
      const textAnchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
      const xOffset = align === 'left' ? -(textWidth / 2) : align === 'right' ? (textWidth / 2) : 0;

      const text = createSVGElement('text', {
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
        text.appendChild(tspan);
      }

      g.appendChild(text);
    } else {
      // Single line — original behavior
      const text = createSVGElement('text', {
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        'font-size': fontSize,
        'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
        fill: style.labelColor ?? '#000000',
      });
      text.textContent = String(label);
      g.appendChild(text);
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/node-properties.test.js`
Expected: All 19 tests PASS.

- [ ] **Step 6: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/svg/emitter.js test/node-properties.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add textWidth wrapping with align and explicit line breaks"
```

---

### Task 6: Visual Demo

**What it does:** Creates a demo showcasing all new node properties.

**Files:**
- Create: `examples-v2/node-properties-demo.html`

- [ ] **Step 1: Create demo page**

Create `examples-v2/node-properties-demo.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>tikz-svg: Node Properties Demo</title>
  <style>
    body { font-family: system-ui; padding: 2rem; background: #f8f8f8; max-width: 900px; margin: 0 auto; }
    .demo { margin: 2rem 0; background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    svg { border: 1px solid #eee; display: block; margin: 0.5rem 0; }
    h2 { color: #333; margin-top: 0; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Node Properties Demo</h1>

  <div class="demo">
    <h2>Text wrapping + align</h2>
    <svg id="demo1" width="700" height="200"></svg>
  </div>

  <div class="demo">
    <h2>minimumWidth, minimumHeight</h2>
    <svg id="demo2" width="700" height="150"></svg>
  </div>

  <div class="demo">
    <h2>anchor positioning</h2>
    <svg id="demo3" width="400" height="200"></svg>
  </div>

  <div class="demo">
    <h2>rotate + scale + xshift/yshift</h2>
    <svg id="demo4" width="500" height="250"></svg>
  </div>

  <div class="demo">
    <h2>Named font sizes</h2>
    <svg id="demo5" width="700" height="120"></svg>
  </div>

  <script type="module">
    import { render } from '../src-v2/index.js';

    // Demo 1: Text wrapping
    render(document.getElementById('demo1'), {
      states: {
        left: {
          position: { x: 100, y: 100 },
          label: 'This text wraps at 100px width with left alignment',
          shape: 'rectangle',
          textWidth: 100,
          align: 'left',
          fill: '#dbeafe',
          stroke: '#2563eb',
        },
        center: {
          position: { x: 300, y: 100 },
          label: 'Centered\\\\multi-line\\\\label',
          shape: 'rectangle',
          textWidth: 100,
          align: 'center',
          fill: '#fef3c7',
          stroke: '#f59e0b',
        },
        right: {
          position: { x: 530, y: 100 },
          label: 'Right-aligned wrapping text example here',
          shape: 'rectangle',
          textWidth: 120,
          align: 'right',
          fill: '#d1fae5',
          stroke: '#059669',
        },
      },
      edges: [],
    });

    // Demo 2: Minimum dimensions
    render(document.getElementById('demo2'), {
      states: {
        small: {
          position: { x: 80, y: 75 },
          label: 'A',
          shape: 'rectangle',
          minimumWidth: 80,
          minimumHeight: 50,
          fill: '#ede9fe',
          stroke: '#7c3aed',
        },
        tall: {
          position: { x: 220, y: 75 },
          label: 'B',
          shape: 'rectangle',
          minimumWidth: 40,
          minimumHeight: 80,
          fill: '#fce7f3',
          stroke: '#ec4899',
        },
        circle: {
          position: { x: 340, y: 75 },
          label: 'C',
          minimumWidth: 60,
          fill: '#dbeafe',
          stroke: '#2563eb',
        },
      },
      edges: [],
    });

    // Demo 3: Anchor positioning (cross-hair at 200,100 — node NW corner should be there)
    render(document.getElementById('demo3'), {
      states: {
        box: {
          position: { x: 200, y: 100 },
          label: 'anchor=north west',
          shape: 'rectangle',
          anchor: 'north west',
          fill: '#fef3c7',
          stroke: '#f59e0b',
          radius: 15,
          fontSize: 10,
        },
      },
      edges: [],
      paths: [
        // Crosshair at (200,100)
        { points: [{ x: 190, y: 100 }, { x: 210, y: 100 }], stroke: 'red' },
        { points: [{ x: 200, y: 90 }, { x: 200, y: 110 }], stroke: 'red' },
      ],
    });

    // Demo 4: Rotate + scale + shift
    render(document.getElementById('demo4'), {
      states: {
        normal: {
          position: { x: 80, y: 125 },
          label: 'normal',
          shape: 'rectangle',
          fill: '#e5e7eb',
          stroke: '#374151',
        },
        rotated: {
          position: { x: 220, y: 125 },
          label: 'rotate=30',
          shape: 'rectangle',
          rotate: 30,
          fill: '#dbeafe',
          stroke: '#2563eb',
        },
        scaled: {
          position: { x: 370, y: 125 },
          label: 'scale=1.5',
          shape: 'rectangle',
          nodeScale: 1.5,
          fill: '#d1fae5',
          stroke: '#059669',
        },
      },
      edges: [],
    });

    // Demo 5: Named font sizes
    render(document.getElementById('demo5'), {
      states: {
        t: { position: { x: 50, y: 60 }, label: 'tiny', fontSize: 'tiny', shape: 'rectangle', fill: '#f3f4f6', stroke: '#9ca3af' },
        s: { position: { x: 140, y: 60 }, label: 'scriptsize', fontSize: 'scriptsize', shape: 'rectangle', fill: '#f3f4f6', stroke: '#9ca3af' },
        sm: { position: { x: 260, y: 60 }, label: 'small', fontSize: 'small', shape: 'rectangle', fill: '#f3f4f6', stroke: '#9ca3af' },
        n: { position: { x: 370, y: 60 }, label: 'normalsize', fontSize: 'normalsize', shape: 'rectangle', fill: '#f3f4f6', stroke: '#9ca3af' },
        l: { position: { x: 500, y: 60 }, label: 'large', fontSize: 'large', shape: 'rectangle', fill: '#f3f4f6', stroke: '#9ca3af' },
        L: { position: { x: 620, y: 60 }, label: 'Large', fontSize: 'Large', shape: 'rectangle', fill: '#f3f4f6', stroke: '#9ca3af' },
      },
      edges: [],
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

```bash
npx http-server /Users/sergiop/Dropbox/Scripts/tikz-svg -p 8080 -c-1
open http://localhost:8080/examples-v2/node-properties-demo.html
```

- [ ] **Step 3: Run full test suite**

Run: `node --test`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add examples-v2/node-properties-demo.html
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add node properties demo with text wrap, anchor, rotate, scale"
```

---

## Verification Checklist

After all 6 tasks:

- [ ] `node --test` — all tests pass
- [ ] Named font sizes resolve: `tiny`=7, `scriptsize`=8, `small`=10, `normalsize`=12, `large`=14, `Large`=17
- [ ] `innerSep` enlarges node shapes (not just edge labels)
- [ ] `minimumWidth`/`minimumHeight` enforce floor dimensions
- [ ] `textWidth` produces `<tspan>` wrapped lines
- [ ] `align` controls text alignment within `textWidth` (left/center/right)
- [ ] `\\\\` in labels creates explicit line breaks
- [ ] `xshift`/`yshift` offset node positions
- [ ] `anchor` shifts center so named anchor lands at position
- [ ] `rotate` applies SVG rotation to node group
- [ ] `nodeScale` applies SVG scale to node group
- [ ] All existing tests pass (no regressions)

## What This Does NOT Cover

- **Text measurement** — wrapping uses a character-width estimate (0.6 × fontSize), not actual glyph metrics. KaTeX integration (TODO) would give accurate sizing.
- **Auto-sizing from text content** — TikZ auto-sizes nodes to fit their text using inner sep + text dimensions. We approximate this with radius/halfWidth + innerSep but don't measure actual text.
- **Per-node scale affecting edges** — per-node `scale` only affects the visual rendering of the node, not edge connection points. TikZ's `scale` also affects child coordinates.

---

## Context for Future Implementer

### How anchor works

In TikZ, `anchor=north west` means "position the node so that its north-west corner is at the specified position." Our implementation:

1. After Phase 3 computes the node geometry (which gives anchor positions relative to center), look up the named anchor's offset from center.
2. Shift the center by the negative of that offset, so the anchor lands at the original position.
3. Recompute savedGeometry with the new center.

### How textWidth wrapping works

1. The `wrapText()` helper splits on `\\\\` first (explicit breaks).
2. For each resulting line, if it exceeds `textWidth / (fontSize * 0.6)` characters, word-wrap at word boundaries.
3. Returns an array of strings, one per line.
4. The emitter creates `<tspan>` elements with `dy` offsets for vertical spacing.
5. `align` maps to SVG `text-anchor`: left→start, center→middle, right→end.

### Font size mapping

The `FONT_SIZE_MAP` uses pixel values calibrated for screen rendering at roughly 1.4× the LaTeX point sizes. This gives visually similar proportions without exact typographic accuracy.
