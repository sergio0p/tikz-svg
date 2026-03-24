# Audit Report 2: Special Syntax for Path Specifications

**TikZ Principle (§11.2):** A path is a series of straight or curved lines. TikZ uses METAPOST-inspired syntax: `--` for straight segments, `..` for smooth Catmull-Rom curves, `to` with `[bend/out/in/looseness]` options, `arc`, `circle`, `rectangle`, `ellipse`, and `cycle` to close. Paths are composable sequences of typed operations that can be accumulated and then acted on.

---

## What We Have

### `Path` class — a first-class path builder (`core/path.js`)
Modeled after PGF's "soft path" concept. Stores segments as a typed list (`M`, `L`, `C`, `Z`) and serializes to SVG `d` strings via `toSVGPath()`. This is a genuine user-accessible API for shape authors and internal pipeline code alike.

**Supported construction operations:**

| Method | SVG equivalent | TikZ equivalent |
|---|---|---|
| `moveTo(x, y)` | `M x y` | Start of path |
| `lineTo(x, y)` | `L x y` | `--` straight segment |
| `curveTo(cp1x,cp1y,cp2x,cp2y,x,y)` | `C ...` | Bezier curve |
| `close()` | `Z` | `cycle` |
| `rect(x,y,w,h)` | `M L L L Z` | `rectangle` path op |
| `circle(cx,cy,r)` | 4-curve Bezier | `circle` path op |
| `ellipse(cx,cy,rx,ry)` | KAPPA-approx Bezier | `ellipse` path op |
| `arc(cx,cy,r,startDeg,endDeg)` | segmented Bezier arcs | `arc` path op |

**The `arc()` method** handles TikZ's angle convention: 0°=east, CCW positive (SVG y-down corrected). Arcs longer than 90° are split into segments of ≤90° for Bezier accuracy, matching PGF's approach.

**`roundCorners(radius)`** — post-processing pass that replaces sharp polygon corners with cubic Bezier curves. This faithfully implements TikZ's `rounded corners` style option. Used internally by the `rectangle-split` shape and accessible to any `Path` user.

**`transform(transformObj)`** — applies an affine `Transform` to all path points (M, L, C endpoints and control points), returning a new transformed `Path`. This enables shape transformations without coordinate system changes — analogous to TikZ's coordinate transformations applied to a path.

**`bbox()`** — computes a bounding box from all path points. Used by the viewBox calculation in `emitter.js`.

**`append(otherPath)`** — composites two paths, enabling compound shape construction.

### Edge path types (`geometry/edges.js`)
The edge geometry system implements three path types that cover the full range of TikZ edge specifications:

- **Straight** (`--` equivalent): `computeStraightEdge()` — connects border points.
- **Bent / Quadratic Bezier** (`to [bend left/right=N]`): `computeBentEdge()` — departure/arrival angles rotated from baseline, tangent rays intersect at single control point. Faithful to TikZ's `bend left/right` semantics.
- **Cubic Bezier with explicit angles** (`to [out=A, in=B, looseness=L]`): explicit angles with looseness scaling — mirrors TikZ's `in`/`out`/`looseness` edge options, including the 0.3928 factor from PGF.
- **Self-loop** (`loop`): TikZ-faithful presets (`above`: out=105/in=75, etc.), looseness=8 default, min-distance clamping. Source: `tikzlibrarytopaths.code.tex` lines 364–375.

### Path shortening (`shorten < / shorten >`)
`shortenEdge()` trims path endpoints along the tangent for all three edge types. Auto-shortening (from arrow tip `tipEnd − lineEnd`) and user `shortenEnd`/`shortenStart` are additive, matching TikZ's `shorten >=1pt` semantics exactly. Source: `pgfcorearrows.code.tex` lines 788–820.

### Shape background paths
All 14 shapes implement `backgroundPath(geom)` returning an SVG path string. These use `Path`-style constructs internally, enabling arbitrary shape outlines. `polygonBorderPoint()` in `shape.js` provides a shared ray-polygon intersection helper used by all polygon-based shapes (`diamond`, `kite`, `dart`, `trapezium`, `isosceles triangle`, `star`, `regular polygon`).

---

## What Is Missing or Different

### No user-facing path DSL
The `Path` class is available to library developers (shape authors) but is not exposed in the `render()` / `renderAutomaton()` API. Users cannot write general `\draw` / `\path` commands. There is no way to say "draw an arc from point A to point B" outside the node/edge model.

### No smooth curves (`..`, Catmull-Rom, tension)
TikZ's `..` operator with `\tikzset{smooth}`, tension, or Catmull-Rom interpolation through multiple waypoints is absent. All curves are explicit Bezier with user-controlled control points.

### No multiple waypoints on an edge
TikZ allows paths through more than two nodes: `(A) -- (B) -- (C)`. Each edge in the JS model connects exactly two nodes.

### No `arc` as an edge type
While `Path.arc()` exists and is used by shapes, there is no edge type that follows an arc between two node borders.

---

## Assessment

| Feature | Status |
|---|---|
| `Path` class with M/L/C/Z operations | ✅ Full |
| `rect`, `circle`, `ellipse` path ops | ✅ Full |
| `arc` path op (angle-correct) | ✅ Full (internal + shapes) |
| `roundCorners` (`rounded corners` style) | ✅ Full |
| `cycle` / close | ✅ Full |
| `transform(T)` on paths | ✅ Full |
| `bbox()` query | ✅ Full |
| `append()` compound paths | ✅ Full |
| Straight edge | ✅ Full |
| Bent edge (`bend left/right`) | ✅ Full, source-verified |
| Explicit `out`/`in`/`looseness` | ✅ Full |
| Self-loops with TikZ presets | ✅ Full, source-verified |
| Path shortening (`shorten <`/`>`) | ✅ Full, source-verified |
| `polygonBorderPoint` shared helper | ✅ Full |
| User-facing general path DSL | ❌ By design (declarative model) |
| Smooth curves (`..`, tension) | ❌ Missing |
| Multi-waypoint edges | ❌ Missing |

**Overall:** The path infrastructure is comprehensive and faithfully implements the relevant TikZ mechanisms. The `Path` class is a capable building block. The absence of a user-facing path DSL is intentional — the library is declarative — but this is a meaningful gap for general-purpose TikZ diagram support.
