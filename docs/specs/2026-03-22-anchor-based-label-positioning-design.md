# Node-Based Edge Label Positioning

## Problem

Edge labels are bare `<text>` elements centered at a perpendicular offset from the edge. This causes two problems:

1. **Visual**: longer labels overlap the edge because centering ignores text extent.
2. **Architectural**: labels are not nodes, so they cannot participate in transforms, anchoring, or any future TikZ feature that treats labels as first-class objects.

In TikZ, every label is a node — a rectangle shape with anchors, inner sep, and outer sep. The `auto` mechanism selects which anchor of the label node sits at the edge point, so the text body extends away from the edge. Transforms (`sloped`, `xshift`, `yshift`, `scale`) apply to the node's `<g>` element.

## Goal

Make edge labels real nodes — rectangle shapes in the existing shape registry, positioned via anchor selection. This solves the immediate label-overlap problem and establishes the architectural foundation for future TikZ features (`label`, `pin`, `fill` on labels, transforms on labels).

## Constraints

- **No edits to `src/`** — live via symlink at `LECWeb/510/tikz-svg → Scripts/tikz-svg`
- **API changes OK** — user-facing config shape stays the same, but internal module APIs can change freely. No backward-compat wrappers.
- **Sandbox in `src-v2/`** — copy of `src/`, all modifications there
- **Demos in `examples-v2/`** — copy of `examples/`, import paths updated

## Affected LECWeb pages

| File | renderAutomaton calls |
|------|----------------------|
| `LECWeb/510/arbitrage.html` | 6 |
| `LECWeb/510/financial-markets.html` | 1 |

Migration script:

```bash
sed -i '' 's|/tikz-svg/src/automata/automata.js|/tikz-svg/src-v2/automata/automata.js|g' \
  LECWeb/510/arbitrage.html LECWeb/510/financial-markets.html
```

Rollback: flip the path back. Both directories coexist indefinitely.

---

## Design

### Overview

```
Current:  edge point → perpendicular offset → bare <text> at (x,y) with text-anchor:middle

Proposed: edge point → anchor selection → label node (rectangle shape) positioned
          so selected anchor sits at edge point → <g> with <rect> + <text>
```

### Step 1: Compute label node geometry

Given a label on an edge:

1. **Estimate text dimensions**:
   ```
   textWidth  = label.length × fontSize × 0.6
   textHeight = fontSize
   ```
   (Same estimator already used in `emitter.js:119` for viewBox computation.)

2. **Add inner sep** (default 3px, configurable via `innerSep`):
   ```
   halfWidth  = (textWidth / 2) + innerSep
   halfHeight = (textHeight / 2) + innerSep
   ```

3. **Create rectangle geometry** using the existing `rectangle.savedGeometry()`:
   ```js
   const geom = rectangle.savedGeometry({
     center: edgePoint,  // temporary — will be shifted in step 3
     halfWidth,
     halfHeight,
   });
   ```

### Step 2: Select anchor from tangent direction

Replicate TikZ's 8-way anchor selection from `tikz.code.tex` lines 4484–4534.

**Coordinate correction**: negate `tangent.y` to convert from SVG y-down to TikZ y-up (consistent with `angleBetween` in `math.js:58`).

```js
const norm = vecNormalize(tangent);
const tx = norm.x;
const ty = -norm.y;  // SVG → TikZ
```

**Left side (default / `auto`):**

| tx | ty | Anchor |
|----|----|--------|
| > 0 | > 0 | south east |
| > 0 | < 0 | south west |
| > 0 | ~ 0 | south |
| < 0 | > 0 | north east |
| < 0 | < 0 | north west |
| < 0 | ~ 0 | north |
| ~ 0 | > 0 | east |
| ~ 0 | < 0 | west |
| ~ 0 | ~ 0 | west (degenerate fallback — matches TikZ fall-through) |

Threshold for "near zero": `0.05` (matches TikZ).

**Right side / `swap`**: mirror every anchor — `south east` ↔ `north west`, `south` ↔ `north`, `east` ↔ `west`.

**`side` parameter mapping:**

| `side` value | Behavior |
|---|---|
| `'left'` | Default anchor table (TikZ `auto`) |
| `'right'` | Mirror table (TikZ `swap`) |
| `'auto'` | Current heuristic picks outer side of curve, then applies corresponding table. Straight edges default to `'left'`. |

### Step 3: Reposition label node center

The selected anchor should sit at the edge point. Shift the node center so this is true:

```js
// anchorOffset = vector from center to the selected anchor
const anchorPos = rectangle.anchor(anchorName, geom);
const offset = { x: anchorPos.x - geom.center.x, y: anchorPos.y - geom.center.y };

// Shift center so anchor lands on edgePoint
const labelCenter = { x: edgePoint.x - offset.x, y: edgePoint.y - offset.y };
```

The existing `distance` parameter still applies — it offsets the `edgePoint` perpendicularly from the curve before anchor-based positioning. Since anchor + inner sep now provide clearance, `distance` defaults to **0** in `src-v2/` (changed from 8 in `src/`). Users can still set `labelDistance` explicitly for additional offset. This is a deliberate visual change: labels sit tighter against edges in `src-v2/` than in `src/`, which is the correct TikZ behavior. LECWeb pages may need minor `labelDistance` adjustments after migration if the tighter placement is undesirable for specific edges.

### Step 4: Apply transforms

The label node's `<g>` element gets a `transform` attribute. Using the existing `Transform` class from `core/transform.js`:

```js
const t = new Transform();
t.translate(labelCenter.x, labelCenter.y);

if (sloped) {
  t.rotate(tangentAngleDeg);  // rotate around label center
}
// Future: xshift, yshift, scale — just chain more transforms
```

For **sloped labels**: when `sloped: true`, force anchor to `'south'` (or `'north'` for swap) before positioning. The rotation aligns text with the edge, so "south" in the rotated frame = "away from edge" in screen space. This matches TikZ behavior.

The existing `slopeAngle()` function (labels.js:73-80) flips the angle to keep text upright (if angle > 90° or < -90°, subtract/add 180°). When the angle flips, the forced anchor also flips: `'south'` becomes `'north'` and vice versa, because "above the edge" in the rotated frame swaps sides.

**Transform ordering**: non-sloped labels use a simple `translate(cx, cy)` string on the `<g>`. Sloped labels use the `Transform` class: `t.translate(cx, cy); t.rotate(angle)` → `toSVG()`. With the Transform class's pre-multiplication semantics, this produces `translate * rotate`: first rotate local coordinates around origin, then translate to label center. This is correct because the `<rect>` and `<text>` use local coordinates centered at origin.

### Step 5: Emit the label node

The emitter produces a `<g>` for each label node, analogous to how `emitNode()` (emitter.js:270) works for state nodes:

```html
<g class="label-node" transform="translate(cx, cy)">
  <!-- Background rect: invisible by default, available for fill -->
  <rect x="-hw" y="-hh" width="2*hw" height="2*hh"
        fill="none" stroke="none" />
  <!-- Text: centered in the rect -->
  <text text-anchor="middle" dominant-baseline="central"
        font-size="14" font-family="serif" fill="#000">label</text>
</g>
```

The `<rect>` has `fill="none"` by default — invisible. But because it exists:
- Setting `labelFill: 'white'` in a future config makes the rect cover the edge underneath
- The rect participates in viewBox/bounding-box calculations
- The rect can receive CSS classes, event handlers, etc.

### Self-loop behavior

At `pos=0.5` on a loop, the tangent is nearly horizontal → `south`/`north` anchor → label sits above/below the loop apex. This works well. At extreme `pos` values near 0 or 1, the tangent is radial and the anchor may produce overlap with the parent node. This matches TikZ. Self-loop labels should keep `pos` near 0.5.

---

## What this enables for the future

Because label nodes are real shape-registry nodes with anchors and transforms:

| Future TikZ feature | How it uses label nodes |
|---|---|
| `node[label=above:$q_0$]` | Same system — position a label node at parent's `north` anchor |
| `pin` | Label node + connecting line from parent anchor |
| `fill=white` on labels | Set `fill` on the `<rect>` — covers edge underneath (drawing order already correct) |
| Transforms: `xshift`, `yshift`, `scale`, `slant` | Chain onto the label `<g>` via `Transform` class |
| Callout pointers | Target a label node's anchor |
| Any shape as label container | Swap rectangle for ellipse, callout, etc. via shape registry |

---

## Files changed (in src-v2/)

### 1. `geometry/labels.js`

**Replace** `computeLabelPosition()` with `computeLabelNode()`:

```js
export function computeLabelNode(edgeGeometry, labelText, opts = {}) → {
  center: { x, y },        // shifted center (anchor at edge point)
  anchor: string,           // selected anchor name
  geom: { halfWidth, halfHeight, center },  // rectangle geometry
  angle: number | null,     // rotation for sloped labels
}
```

**New functions:**
- `computeAnchor(tangent, side)` — 8-way table + swap mirror
- `mirrorAnchor(anchor)` — swap table
- `estimateTextSize(text, fontSize)` — returns `{ width, height }`

`computeLabelPosition()` is removed — no wrapper.

### 2. `svg/emitter.js`

**New function** `emitLabelNode(edge)` — replaces `emitEdgeLabel()`:

- Creates a `<g class="label-node">` with `transform`
- Appends a `<rect>` (invisible by default)
- Appends a `<text>` centered in the rect
- Returns the `<g>` element

**`emitEdgeLabel()`** is removed. `emitLabelNode()` replaces it directly. The empty-label guard (`if (!label) return null`) is preserved in `emitLabelNode()`.

The label layer already renders after the edge layer (emitter.js:470-476), so paint order is correct.

**ViewBox compatibility**: `expandBBoxFromElement()` already handles `<rect>` children inside `<g transform="translate(...)">` (emitter.js:87-95). The label node's `<rect>` will be picked up for bounding-box calculation automatically — no changes needed to viewBox computation.

### 3. `index.js`

Pipeline changes in Phase 4 (edge geometry):

- Call `computeLabelNode()` instead of `computeLabelPosition()`, passing the label text and fontSize
- Thread `innerSep` from config: `edge.innerSep ?? edgeStyle.innerSep ?? DEFAULTS.innerSep`
- Pass the full label node data (center, geom, anchor, angle) through the model to the emitter

### 4. `core/constants.js`

Add to `DEFAULTS`:

```js
innerSep: 3,           // px, label node padding
labelDistance: 0,       // changed from 8 — anchor + innerSep provide clearance
```

### Files unchanged

- `core/math.js`, `core/resolve-point.js`, `core/transform.js`, `core/arrow-tips.js`, `core/path.js`
- `shapes/*` (rectangle already has everything we need)
- `shapes/shape.js` (registry — no changes)
- `positioning/*`, `geometry/edges.js`, `geometry/arrows.js`
- `style/style.js`
- `automata/automata.js` (wrapper — internal imports resolve to `src-v2/` automatically)

---

## Sandbox setup

```bash
cd /Users/sergiop/Dropbox/Scripts/tikz-svg
cp -r src/ src-v2/
cp -r examples/ examples-v2/
# Update import paths in demos
sed -i '' 's|../src/|../src-v2/|g' examples-v2/*.html
```

Internal imports within `src-v2/` are all relative (`'../core/math.js'`), so they resolve correctly without changes.

---

## Testing strategy

1. **Unit tests**: `test/labels-node.test.js`
   - `computeAnchor()`: all 8 directions + swap + degenerate zero-tangent + sloped override
   - `computeLabelNode()`: verify center repositioning for each anchor
   - `estimateTextSize()`: spot-check dimensions
   - `mirrorAnchor()`: all 8 pairs
2. **Emitter tests**: `emitLabelNode()` produces correct `<g>` structure with `<rect>` + `<text>`
3. **Visual QA**: open `examples-v2/` demos in browser, compare against TikZ originals
4. **Regression**: existing 140 tests run against `src/` — unaffected
5. **LECWeb smoke test**: temporarily point one LECWeb page at `src-v2/`, verify rendering

---

## Feasibility

| Aspect | Assessment |
|--------|------------|
| Scope | ~100 lines of new logic across 4 files (no backward-compat wrappers) |
| Risk | Zero to existing code — sandboxed |
| Complexity | Moderate — anchor selection is 30 lines, center repositioning is 5 lines, emitter is 30 lines, pipeline threading is 15 lines |
| Dependencies | Uses existing `rectangle` shape, `Transform` class, `vecNormalize` — all already built and tested |
| SVG compat | `<g>`, `<rect>`, `<text>`, `transform` — universal SVG 1.1 |
| Text measurement | Estimator is imperfect but adequate for typical labels (1-5 chars). `getBBox()` upgrade is a future enhancement, already planned in PLAN-callouts-integration.md Step 5 |
| Migration | One import path change per HTML file (7 lines across 2 LECWeb files) |
| Rollback | Flip import path back to `src/` |
