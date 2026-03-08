# Plan: Integrate callouts.js into tikz-svg

## Goal

Bring the legacy `callouts.js` (rectangle and ellipse callouts with pointers) into the tikz-svg shape registry so they work with the render pipeline, while keeping backward compatibility with existing HTML pages.

## Legacy file

`src/legacy-callouts.js` — copy of `/Teaching/101/LECWeb/js/callouts.js`. The original must not be modified. Existing HTML pages load it as an IIFE via `<script>` and call `window.rectangleCallout()` / `window.ellipseCallout()`.

---

## Step 1: Extract shared math into core/math.js

callouts.js duplicates several utilities already in `core/math.js`:

| callouts.js function | tikz-svg equivalent | Action |
|----------------------|---------------------|--------|
| `shortenPointer(tip, center, amount)` | — | Add to `core/math.js` as `vecShortenToward(point, target, amount)` |
| `ellipsePoint(cx, cy, rx, ry, angleDeg)` | — | Add to `core/math.js` |
| `angleToPoint(cx, cy, px, py)` | `angleBetween(from, to)` | Already exists (different convention — callouts uses raw `atan2`, tikz-svg negates y). Add a `svgAngleToPoint(from, to)` variant or document the convention difference |
| `resolvePoint()` | `core/resolve-point.js` | Extend (see Step 2) |

No functions are removed. Only additions.

**Tests**: Add unit tests for new math functions.

---

## Step 2: Extend resolve-point.js

callouts.js `resolvePoint` supports three formats that tikz-svg doesn't:

1. **CSS selector strings** (`'#my-dot'`) — resolves via `document.querySelector` + `getBBox`
2. **Custom coordinate systems** (`{Q, P}` with `coordSystem.toX/toY`)
3. **`{x, y}` passthrough** — already supported

### Plan

Add to `resolve-point.js`:
- Selector resolution: if string starts with `#` or `.`, treat as CSS selector (only in browser context)
- Custom coord system: if point has neither `x`/`y` nor is a string, check for a `coordTransform` in opts and apply it

This keeps the existing node-name resolution (`'q0'`, `'q0.north'`) working and adds the new formats.

**Tests**: Add tests for selector resolution (jsdom) and coord transforms.

---

## Step 3: Register callout shapes

Create two new shape files following the existing pattern (circle.js, rectangle.js):

### `src/shapes/callout-rectangle.js`

Implements the shape interface:
- `savedGeometry({ center, halfWidth, halfHeight, pointer, pointerWidth, cornerRadius })` — stores dimensions + pointer target
- `anchor(name, geom)` — standard anchors (center, north, south, east, west) plus `pointer` anchor
- `borderPoint(geom, direction)` — delegates to rectangle borderPoint logic (the callout body is rectangular)
- `backgroundPath(geom)` — returns the callout path with integrated pointer (port `buildRectCalloutPath`)
- `anchors()` — includes `'pointer'`

Self-registers as `'callout-rectangle'`.

### `src/shapes/callout-ellipse.js`

Same interface:
- `savedGeometry({ center, rx, ry, pointer, pointerArc })`
- `backgroundPath(geom)` — ports `buildEllipseCalloutPath`
- `borderPoint` — delegates to ellipse border logic

Self-registers as `'callout-ellipse'`.

### Key design decision

The pointer target is stored in `savedGeometry`, not computed at render time. This means the callout's pointer is part of the shape, not an edge. This matches TikZ semantics — in TikZ, the callout pointer is a shape property (`callout pointer arc`, `callout absolute pointer`), not a `\draw` edge.

**Tests**: Unit tests for geometry, anchors, and path generation.

---

## Step 4: Emit callout shapes in the emitter

`svg/emitter.js` `createShapeElement()` has a switch on shape name. Add cases:

```js
case 'callout-rectangle': {
  // Use backgroundPath from geom (already includes pointer)
  return createSVGElement('path', {
    d: shape.backgroundPath(geom),
    fill, stroke, 'stroke-width': strokeWidth,
  });
}
case 'callout-ellipse': { ... }
```

Alternatively, make the emitter generic: if the shape is not one of the hardcoded primitives (`circle`, `rect`, `ellipse`), fall back to `<path d={shape.backgroundPath(geom)}>`. This future-proofs for more shapes.

**Recommended**: Go with the generic fallback. It requires no emitter changes for future shapes.

---

## Step 5: Text measurement

callouts.js measures text by creating a hidden SVG, appending `<text>`, calling `getBBox()`, and removing it. This is needed to auto-size the callout body around its text content.

### Problem

- `getBBox()` doesn't work reliably in jsdom (returns zeros)
- tikz-svg currently avoids live DOM measurement

### Plan

- Add a `measureText(text, opts)` utility in `src/core/text.js`
- In browser: use the real `getBBox` approach (from callouts.js)
- In tests: provide a simple estimator (`charCount * fontSize * 0.6`) as fallback
- The callout config can also accept explicit `width`/`height` to skip measurement entirely (callouts.js already supports this)

**Tests**: Test with explicit dimensions. Browser-only tests for auto-measurement.

---

## Step 6: High-level API — `renderCallout()`

Create `src/callouts/callouts.js` (parallel to `src/automata/automata.js`):

```js
export function renderCallout(svgEl, config) { ... }
```

Supports both calling conventions from legacy:
- **Explicit**: `renderCallout(svgEl, { center, pointer, text, shape: 'rectangle', ... })`
- **Polar**: `renderCallout(svgEl, { target, angle, distance, text, ... })`

Internally constructs a single-node config and delegates to `render()`.

Also export standalone functions that return SVG `<g>` elements (for appending to existing SVGs, matching legacy usage):

```js
export function rectangleCallout(center, target, text, options) { ... }
export function ellipseCallout(center, target, text, options) { ... }
```

These wrap the shape geometry + emitter without the full pipeline. This preserves the legacy API surface.

---

## Step 7: Legacy compatibility shim

Create `dist/callouts-compat.js` — a build-free IIFE wrapper that:

1. Imports the ES module callout functions
2. Attaches them to `window.rectangleCallout` and `window.ellipseCallout`
3. Maintains the exact same function signatures as the legacy version

Existing HTML pages switch from:
```html
<script src="js/callouts.js"></script>
```
to:
```html
<script type="module" src="tikz-svg/dist/callouts-compat.js"></script>
```

Or: keep the legacy file unchanged and migrate pages one at a time. No rush.

---

## Step 8: Demo and QA

1. Create `examples/callout-rectangle.html` — rectangle callout pointing at a dot
2. Create `examples/callout-ellipse.html` — ellipse callout
3. Create `examples/callout-polar.html` — polar (angle/distance) calling convention
4. Visually compare against the legacy callouts in existing teaching pages
5. Update `examples/index.html`

---

## Execution order and dependencies

```
Step 1 (math) ──┐
Step 2 (resolve) ├── independent, can be parallel
Step 5 (text)  ──┘
       │
Step 3 (shapes) ── depends on 1, 2, 5
       │
Step 4 (emitter) ── depends on 3
       │
Step 6 (API) ── depends on 3, 4
       │
Step 7 (compat) ── depends on 6
       │
Step 8 (demos) ── depends on 6
```

Steps 1, 2, 5 can run in parallel. Steps 3-8 are sequential.

---

## Risks

| Risk | Mitigation |
|------|------------|
| `getBBox` unreliable in jsdom | Explicit width/height bypass; estimator fallback |
| Pointer geometry edge cases (pointer behind shape, zero-length) | Port legacy's tested edge-case handling; add unit tests |
| Breaking legacy pages | Don't touch original file; compat shim is opt-in migration |
| Emitter hardcodes shape names | Fix in Step 4 with generic path fallback |
| Callout text is multi-line (tspan) | Emitter currently only does single-line labels; extend for callout nodes |

---

## Out of scope (for now)

- `cloud callout` shape (TikZ has this; callouts.js doesn't)
- Callout pointer as an edge (TikZ supports `callout relative pointer` which acts more like an edge)
- Economics coordinate system (`{Q, P}`) — this is domain-specific; can be implemented as a user-provided `coordTransform` but not built into the core
