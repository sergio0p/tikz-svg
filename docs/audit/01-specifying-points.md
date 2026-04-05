# Audit Report 1: Special Syntax for Specifying Points

**TikZ Principle (§11.1):** TikZ provides a unified syntax for coordinates: Cartesian `(x,y)`, polar `(angle:radius)`, unitless PGF `(x,y)` (1 unit = 1cm by default), relative `++(dx,dy)` (moves current point), `+(dx,dy)` (relative, does not advance current point), and anchor references `(nodename.anchor)`.

---

## What We Have

### Absolute coordinates — `{ x, y }` objects
`resolvePoint()` (`core/resolve-point.js`) accepts `{ x, y }` objects as absolute SVG coordinates, returned as-is. This is the JS equivalent of TikZ's `(x,y)`. The `Path` class also accepts absolute point arguments in all its methods.

### Node name and anchor references — `'nodeName'` and `'nodeName.anchor'`
`resolvePoint(point, { nodeRegistry })` accepts strings like `'q0'` (resolves to node center) and `'q0.south'` (resolves to that named anchor). This mirrors TikZ's `(nodename)` and `(nodename.anchor)` precisely, and is used by the edge pipeline when attaching edges and labels to nodes.

**Supported anchors on all shapes:** `center`, `north`, `south`, `east`, `west`, `north east`, `north west`, `south east`, `south west`. Additionally, numeric angle strings (`'45'`, `'135'`) resolve via `borderPoint(geom, vecFromAngle(angle))` — the JS equivalent of TikZ's numeric anchor notation.

### Polar-equivalent — `vecFromAngle(degrees)`
`core/math.js` exports `vecFromAngle(degrees)`, which uses TikZ angle convention: 0°=east, CCW positive, SVG y-down corrected. This function underlies loop presets, border point calculations, and numeric anchor resolution. While there is no `(angle:radius)` coordinate notation for users, the math support is there internally. Every shape's `borderPoint` accepts arbitrary direction vectors (not just named anchors), which is the functional equivalent.

### Relative positioning — `{ right: 'q0', distance: 80 }`
The position spec (`positioning.js`) accepts direction keys (`right`, `above`, `below left`, etc.) with a reference node name. This captures TikZ's `node[right=of q0]` placement. Two modes:
- **On-grid** (`onGrid: true`): center-to-center offset — matches `node distance` in TikZ.
- **Off-grid** (`onGrid: false`): anchor-to-anchor spacing — matches TikZ's default `right=of` behavior.

Topological sort (Kahn's algorithm) resolves dependency order automatically.

### DOM element selector in Callouts
The legacy callout module (`legacy-callouts.js`) extends point resolution to DOM selectors (`'#my-dot'`) — it finds the element, reads its SVG `getBBox()`, and uses the center. It also supports domain-specific coordinate systems (`{ Q, P }` with a user-supplied `coordSystem: { toX, toY }` mapping). This is a creative extension beyond TikZ's model.

### `Transform.apply({ x, y })` — transformed point evaluation
`core/transform.js` provides `Transform.apply(point)` for applying the current affine matrix to any point. This is the programmatic equivalent of TikZ's coordinate transformation — given a transform, you can compute where any point lands in the transformed coordinate system.

---

## What Is Missing or Different

### Polar coordinate syntax `(angle:radius)`
TikZ's polar syntax has no direct user-facing equivalent. There is no `resolvePoint({ angle: 30, radius: 50 })`. The math for computing the resulting `{ x, y }` is trivially available via `vecFromAngle` + scaling, but it is not exposed as a coordinate format.

### Relative path building (`++`, `+`)
TikZ's `++(dx,dy)` and `+(dx,dy)` are path-level constructs that advance a "current point." The `Path` class tracks `_lastMove` internally but does not expose relative coordinates to callers of `render()`.

### Unit system (pt, mm, cm)
All coordinates are in SVG user units (pixels). No unit conversion layer exists. This is appropriate for a browser-based library but breaks direct numerical porting from TikZ sources.

### `calc` library expressions
TikZ's `\usetikzlibrary{calc}` allows `($(A)!0.5!(B)$)` (midpoint) and `($(A) + (1,0)$)` (offset). No equivalent in the JS API.

### Intersection coordinates
TikZ's `intersection cs:` (computing where two paths cross) is absent.

---

## Assessment

| Feature | Status |
|---|---|
| Absolute `{ x, y }` | ✅ Full |
| Node center reference `'nodeName'` | ✅ Full |
| Anchor reference `'nodeName.anchor'` | ✅ Full |
| Numeric angle anchors | ✅ Full (via `vecFromAngle`) |
| Relative directional placement | ✅ Full (spirit captured) |
| TikZ angle convention (0°=east, CCW) | ✅ Full in `math.js` |
| DOM element reference (callouts) | ✅ Full (legacy module) |
| Domain-specific coord systems (callouts) | ✅ Full (legacy module) |
| Affine transform on points | ✅ Full (`Transform.apply`) |
| Polar coordinates `(angle:radius)` | ❌ No user-facing syntax |
| `++` / `+` relative path coordinates | ❌ Internal only |
| Unit conversion (pt/mm/cm) | ❌ Missing |
| `calc` expressions | ❌ Missing |
| Intersection coordinates | ❌ Missing |

**Overall:** Strong coverage of the practically needed coordinate types. Polar and calc are the most relevant missing features for general TikZ diagram porting.
