# Audit Report 9: Coordinate Transformation System

**TikZ Principle (§11.9):** TikZ supports both **coordinate transformations** (PGF-level, preferred) and **canvas transformations** (SVG/driver-level, use with caution). Coordinate transformations affect how coordinates are interpreted — they are applied before coordinates are used, so PGF always knows where nodes and shapes are. Canvas transformations (like SVG `transform=""`) are lower-level and cause PGF to lose track of node positions, leading to incorrect anchor placement and bounding boxes.

TikZ recommends using coordinate transformations in almost all circumstances.

---

## What We Have

### `Transform` class — full affine transform system (`core/transform.js`)
A complete 2D affine transformation class matching SVG's `matrix(a,b,c,d,e,f)` format:

```
┌ a  c  tx ┐
│ b  d  ty │
└ 0  0   1 ┘
```

**Operations:**
- `translate(dx, dy)` — PGF's `\pgftransformshift`
- `scale(sx, sy)` — PGF's `\pgftransformscale`
- `rotate(angleDeg)` — PGF's `\pgftransformrotate` (positive = CCW, matching TikZ convention)
- `slantX(s)` — PGF's `\pgftransformxslant`
- `slantY(s)` — PGF's `\pgftransformyslant`
- `concat(a,b,c,d,tx,ty)` — PGF's `\pgftransformcm` (pre-multiply)
- `apply({ x, y })` — transform a point
- `invert()` — returns the inverse transform
- `clone()`, `get()`, `set()`, `reset()`, `isIdentity()`
- `toSVG()` — outputs `matrix(a,b,c,d,tx,ty)` string for SVG `transform` attribute

### `TransformStack` — scoped transform management
```js
const stack = new TransformStack();
stack.push();                     // save current state (begin scope)
stack.current.rotate(45);         // rotate within scope
const pt = stack.current.apply(p); // apply to point
stack.pop();                      // restore (end scope)
```

Push/pop depth is unlimited. This mirrors PGF's `\pgftransformsaveandresetatcurrentpage` + restore mechanism.

### `Path.transform(T)` — transform-aware path manipulation
`path.transform(transformObj)` applies a `Transform` to all control and endpoint coordinates in a `Path`, returning a new `Path`. This is a **coordinate transform** in TikZ's sense: the path coordinates themselves are remapped, not wrapped in a `transform` attribute.

### TikZ angle convention throughout `core/math.js`
All angle computations use TikZ's convention (0°=east, CCW positive, SVG y-down corrected):
- `vecFromAngle(degrees)` returns `{ x: cos(rad), y: -sin(rad) }` — the negation on y is the key bridge between TikZ and SVG coordinate systems
- `angleBetween(a, b)` — computes the TikZ-convention angle between two SVG points
- `radToDeg`, `degToRad` — explicit converters to keep coordinate systems clear

This is the library's answer to TikZ's "always work in one consistent coordinate system" principle.

### Canvas transforms in `emitter.js` (translate for node groups)
Node groups use `transform="translate(cx, cy)"` SVG canvas transforms for positioning. This is a **canvas transform** in TikZ's sense — the SVG renderer moves the coordinate origin, not the coordinates themselves. The library is aware of this: `expandBBoxFromElement()` in `emitter.js` explicitly parses `translate(...)` attributes back into world coordinates, compensating for the canvas-transform limitation that TikZ warns about.

### Label node rotation via `Transform.toSVG()`
Sloped labels in `emitter.js` compute a combined translate + rotate transform using `Transform`:
```js
const t = new Transform();
t.translate(center.x, center.y);
t.rotate(angle);
transformStr = t.toSVG();  // → "matrix(cos,-sin,sin,cos,tx,ty)"
```
This uses the `Transform` class for a canvas transform (written to a `transform` attribute), which is appropriate here because the label's internal geometry doesn't need further anchor computation after placement.

---

## What Is Missing

### `TransformStack` not wired to the render pipeline
The main `render()` function does not use `TransformStack` at all. There is no user-facing transform API in `render()`. Users cannot say "render this subgraph rotated 90°" or "scale all nodes by 1.5". Transforms are computed internally (node centers, edge points) but cannot be overridden by the caller.

### No user-facing coordinate transform API
TikZ: `\begin{scope}[rotate=45]` applies a coordinate transform to all coordinates within the scope. The JS library has no equivalent. Even though the `Transform` class implements all the necessary math, it is not exposed through the rendering API.

### Canvas transform limitations (acknowledged but present)
`emitter.js` uses `translate()` canvas transforms for all node groups. This is TikZ's cautioned approach. The library compensates via `expandBBoxFromElement()` (which re-parses the translate), but this is a fragile workaround. A true coordinate-transform approach would bake each node's center directly into its child element coordinates (making `transform` unnecessary), keeping the viewBox computation simple and robust.

### No `\pgftransformreset` equivalent
TikZ's ability to reset the current transform to identity inside a scope — absent from the user-facing API.

### No non-linear transformations
PGF's `pgfmodulenonlineartransformations.code.tex` (used for `sloped` label rotation along arcs) is partially reimplemented in `geometry/labels.js` via `slopeAngle()`, but the general non-linear transformation framework is absent.

---

## Assessment

| Feature | Status |
|---|---|
| Full affine `Transform` class | ✅ Full |
| All PGF transform ops (translate, scale, rotate, slant, concat) | ✅ Full |
| `Transform.apply(point)` | ✅ Full |
| `Transform.invert()` | ✅ Full |
| `Transform.toSVG()` | ✅ Full |
| `TransformStack` push/pop | ✅ Full |
| `Path.transform(T)` coordinate transform | ✅ Full |
| TikZ angle convention in `math.js` | ✅ Full |
| Sloped label rotation (partial non-linear) | ✅ Full |
| Canvas transform for node groups (with bbox fix) | ✅ Works (with caveats) |
| `TransformStack` wired to render pipeline | ❌ Not wired |
| User-facing coordinate transform API | ❌ Missing |
| Scope-based coordinate transforms | ❌ Missing |
| Non-linear transformation framework | ❌ Missing |

**Overall:** The coordinate transformation infrastructure is excellent — the `Transform` class and `TransformStack` are well-designed and complete. The gap is entirely in the pipeline: none of this infrastructure is accessible from the public `render()` API. Wiring `TransformStack` into the pipeline (with scope-aware transforms propagated through edge/label geometry) would be the most impactful improvement for general-purpose TikZ compliance.
