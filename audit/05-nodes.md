# Audit Report 5: Special Syntax for Nodes

**TikZ Principle (§11.5):** Nodes are named, positioned boxes with text content and a shape. They can be attached to paths or placed independently. Shapes define `inner sep`, `outer sep`, anchors, and border points. Predefined shapes include `circle`, `rectangle`, `ellipse`; custom shapes can be defined via PGF's shape declaration mechanism. Nodes are the fundamental drawing primitive for graphs, diagrams, and labels.

---

## What We Have

### Nodes as first-class objects
Every entry in `config.states` is a named node with position, shape, style, and label. This directly maps to TikZ's `\node [options] (name) at (pos) {label};`.

### 14 registered shapes

| Shape | Source | Technique |
|---|---|---|
| `circle` | hand-rolled | native `<circle>` |
| `rectangle` | hand-rolled | native `<rect>` |
| `ellipse` | hand-rolled | native `<ellipse>` |
| `diamond` | `createShape` factory | `polygonBorderPoint` |
| `star` | `createShape` factory | `polygonBorderPoint` |
| `regular polygon` | `createShape` factory | `polygonBorderPoint` |
| `trapezium` | `createShape` factory | `polygonBorderPoint` |
| `isosceles triangle` | `createShape` factory | `polygonBorderPoint` |
| `kite` | `createShape` factory | `polygonBorderPoint` |
| `dart` | `createShape` factory | `polygonBorderPoint` |
| `semicircle` | `createShape` factory | arc geometry |
| `circular sector` | `createShape` factory | arc geometry |
| `cylinder` | `createShape` factory | arc + rect geometry |
| `rectangle split` | `createShape` factory | multi-part |

These cover all shapes from `pgflibraryshapes.geometric.code.tex` (10 geometric), `pgflibraryshapes.multipart.code.tex` (rectangle split), plus the three primitives.

### Shape contract: full PGF-faithful interface
Every shape implements:
- **`savedGeometry(config)`** — computes and caches dimensions; receives merged style + center + outerSep
- **`anchor(name, geom)`** — returns absolute `{ x, y }` for named anchors; handles numeric angles via `vecFromAngle`
- **`borderPoint(geom, direction)`** — returns border intersection in a given SVG direction vector
- **`backgroundPath(geom)`** — returns SVG path string using visual dimensions (outerSep already subtracted)
- **`anchors()`** — lists all supported anchor names

This contract directly mirrors PGF's shape declaration interface (`\pgfdeclareshape`).

### `createShape` factory — extensible shape system
`createShape(name, spec)` allows new shapes to be defined and registered with minimal boilerplate. The factory handles `outerSep` storage, `center` anchor, numeric angle anchors, and self-registration automatically. This is the JS equivalent of PGF's `\pgfdeclareshape` macro.

### `polygonBorderPoint` — shared ray-polygon intersection
`shape.js` exports `polygonBorderPoint(origin, dir, vertices)` — a ray-convex-polygon intersection helper used by all polygon-based shapes. This implements the correct PGF border point algorithm for any convex polygon.

### `outerSep` — TikZ-faithful implementation
`outerSep` defaults to `0.5 × strokeWidth`, matching PGF's `pgfmoduleshapes.code.tex` line 891. Anchors enlarge the bounding box by `outerSep`; the visual `backgroundPath` uses smaller visual dimensions. Edges attach to anchors (enlarged), so they stop `outerSep` away from the visible border — exactly as in TikZ.

### `innerSep` — label padding
`innerSep` defaults to 3px and is applied in label node geometry (`geometry/labels.js`). It controls the padding between the label text and the label node border.

### Node-based labels (`geometry/labels.js`)
Edge labels are full rectangle-shape nodes with:
- Parametric position along edge (`pos` = 0..1, default 0.5 = `midway`)
- TikZ anchor selection from tangent direction (replicates `tikz.code.tex` lines 4484–4534)
- `swap` / `auto` side selection
- Perpendicular distance offset
- `sloped` rotation (text rotates with edge tangent, reads left-to-right)
- `innerSep` padding

This is a significantly more faithful implementation than simple text placement — labels are proper nodes.

### 18+ arrow tips with auto-shortening
The arrow tip registry (`core/arrow-tips.js`) provides 18 distinct tips plus 9 aliases from `pgflibraryarrows.meta.code.tex`:
- Geometric (filled): `Stealth`, `Latex`, `Kite`, `Square`, `Circle`
- Barbs (stroked): `Straight Barb`, `Hooks`, `Arc Barb`, `Tee Barb`, `To`, `Bar`, `Bracket`, `Classical TikZ Rightarrow`, `Computer Modern Rightarrow`, `Implies`
- Caps: `Round Cap`, `Butt Cap`, `Triangle Cap`, `Fast Triangle`, `Fast Round`
- Special: `Rays`

Each tip carries `lineEnd` and `tipEnd` for automatic path shortening (matching `pgfcorearrows.code.tex`). The `open` parameter switches filled tips to stroke-only.

### Callout shapes (`legacy-callouts.js`)
The legacy module provides `rectangleCallout` and `ellipseCallout` functions — shapes from TikZ's `shapes.callouts` library. These generate full SVG groups with:
- Callout body (rectangle with rounded corners, or ellipse)
- Speech-bubble pointer geometry (two-sided pointer or arc pointer)
- Multi-line text with configurable font, size, line height
- Pointer target via `{ x, y }`, DOM selector, or domain coordinates

---

## What Is Missing

### Automatic text-driven sizing
In TikZ, node size adapts to content — text determines the minimum size. The JS library uses explicit dimensions and estimates text size with a character-count heuristic (`text.length × fontSize × 0.6`). There is no access to actual rendered text bounds from the browser layout engine.

### Inline nodes along paths
TikZ: `\draw (1,1) node {text} -- (2,2);` — placing a node at the current path position. The JS library only supports standalone nodes and edge labels; no inline node along a user-defined path.

### Invisible coordinate nodes
TikZ's `\coordinate (name) at (pos);` — invisible reference points. All JS nodes render a visible shape. A workaround is `fill: 'none', stroke: 'none', radius: 0`.

### `text width` (text wrapping)
Nodes can wrap text to a specified width in TikZ. No equivalent.

### Circle split, ellipse split (multipart)
These multipart shapes (from `pgflibraryshapes.multipart`) are not yet implemented in src-v2 (though they exist in `src/`).

---

## Assessment

| Feature | Status |
|---|---|
| Named nodes with position, shape, label | ✅ Full |
| 14 shapes (geometric + multipart primitives) | ✅ Full |
| `createShape` factory (extensible) | ✅ Full |
| `polygonBorderPoint` helper | ✅ Full |
| `outerSep` / `innerSep` (PGF-faithful) | ✅ Full, source-verified |
| Named anchors + numeric angle anchors | ✅ Full |
| Edge labels as rectangle nodes | ✅ Full |
| TikZ anchor selection for labels | ✅ Full, source-verified |
| Sloped labels | ✅ Full |
| 18+ arrow tips with open/filled modes | ✅ Full |
| Auto path shortening from tip geometry | ✅ Full, source-verified |
| Callout shapes (rect + ellipse) | ✅ Full (legacy module) |
| Automatic text-driven sizing | ❌ Heuristic only |
| Inline nodes along paths | ❌ Missing |
| Invisible coordinate nodes | ❌ Missing (workaround exists) |
| Text wrapping | ❌ Missing |
| Circle split, ellipse split | ❌ Not in src-v2 |

**Overall:** Nodes are the strongest area of the library. The shape system faithfully implements PGF's shape contract. The `createShape` factory makes the system extensible. Arrow tips and label nodes are well beyond what a naive implementation would provide.
