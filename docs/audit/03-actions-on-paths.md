# Audit Report 3: Actions on Paths

**TikZ Principle (§11.3):** A path is inert until an action is applied: **draw** (stroke), **fill** (fill interior), **shade** (gradient fill), **clip** (define clipping region), and combinations (`filldraw`, `shadedraw`). Colors for stroking and filling can differ. TikZ allows the same path to be acted on in multiple ways simultaneously.

---

## What We Have

### Draw (stroke) — edges
All edges are rendered as stroked SVG `<path>` elements with `fill: 'none'`. The stroke color (`style.stroke`), stroke width (`style.strokeWidth`), and dash pattern (`style.dashed`) are fully configurable.

### Fill + Draw — nodes
All node shapes are filled and stroked simultaneously (TikZ's `\filldraw`). `fill` and `stroke` are independent properties, so different colors for interior and border are supported natively.

### Draw + Fill — shapes
Each shape's `backgroundPath()` returns a path string that the emitter renders with both fill and stroke. The three hand-rolled shapes (`circle`, `ellipse`, `rectangle`) use native SVG primitives (`<circle>`, `<ellipse>`, `<rect>`) which carry both fill and stroke. All other shapes use `<path>` with both attributes set.

### Arrow tip fill modes — a genuine draw/fill distinction
The arrow tip system (`core/arrow-tips.js`) implements a three-way `fillMode` per tip:
- `'filled'` — fill only, no stroke (solid tips: `Stealth`, `Latex`, `Kite`, `Square`, `Circle`)
- `'stroke'` — stroke only, no fill (open barbs: `Straight Barb`, `To`, `Hooks`, `Arc Barb`, etc.)
- `'both'` — fill and stroke (double-rendered tips)

This is a precise implementation of TikZ's distinction between filled and open arrow tips. The `open` parameter on any tip switches its mode from `'filled'` to `'stroke'`, matching TikZ's `[open]` tip modifier.

### Opacity
`style.opacity` maps to SVG `opacity` on edges and nodes. Partial transparency is fully supported.

### Dashed stroke
`style.dashed: true` produces `stroke-dasharray: '6 4'`. A custom dash pattern string is also accepted directly.

### Shadow (drop shadow)
`style.shadow` triggers an SVG `feDropShadow` filter with configurable `dx`, `dy`, `blur`, and `color`. Multiple distinct shadow definitions are deduplicated into a shared `<defs>` block.

### Accepting state (double border)
`style.accepting` renders a second, inset shape border. A second call to `createShapeElement()` with an `inset` offset implements this correctly for all 14 shapes via `outerSep` arithmetic.

### Callout fill/stroke
`legacy-callouts.js` implements independent fill and stroke for callout bodies (`fill`, `stroke`, `strokeWidth`). The pointer (speech bubble tail) is drawn as part of the same path, sharing the callout's fill — matching TikZ's callout shape behavior.

---

## What Is Missing

### Shade / gradient fill
TikZ's `\shade` and `\shadedraw` apply gradient fills (linear or radial). SVG natively supports `<linearGradient>` / `<radialGradient>` in `<defs>`, but the library has no gradient fill support. The `shadow` filter provides visual depth but is not a gradient.

### Clip
TikZ's `\clip` restricts subsequent drawing to a clipping region. SVG's `<clipPath>` provides this, but the library exposes no clipping mechanism. No `clip` option on nodes or edges.

### Fill without visible stroke
While `strokeWidth: 0` or `stroke: 'none'` achieves the fill-only effect, there is no semantic `fill: true, draw: false` flag. TikZ's `\fill` command implies no stroke implicitly.

### Color mixing (`red!50!blue`, `blue!20`)
TikZ's color mixing is absent. All colors must be valid CSS color strings. This is a common source of friction when porting TikZ code.

### Pattern fills
TikZ supports fills with patterns (cross-hatch, dots, etc.) via `\usetikzlibrary{patterns}`. No equivalent in the JS library.

### Path-level actions for general drawing
TikZ applies actions to arbitrary user paths (`\draw (0,0) circle (1cm);`). The library only applies draw/fill actions to the fixed node/edge/shape model — users cannot describe arbitrary paths to draw.

---

## Assessment

| Feature | Status |
|---|---|
| Draw (stroke) — edges | ✅ Full |
| Fill + Draw — nodes | ✅ Full |
| Independent fill/stroke colors | ✅ Full |
| Arrow tip fill modes (filled/stroke/both) | ✅ Full, TikZ-faithful |
| Open arrow tips (`[open]` modifier) | ✅ Full |
| Opacity | ✅ Full |
| Dashed stroke (custom patterns) | ✅ Full |
| Drop shadow | ✅ Full (SVG filter) |
| Double border (accepting states) | ✅ Full |
| Callout fill/stroke | ✅ Full (legacy module) |
| Shade / gradient fill | ❌ Missing |
| Clip | ❌ Missing |
| Color mixing (`red!50!blue`) | ❌ Missing |
| Pattern fills | ❌ Missing |
| General `\draw`/`\fill` path commands | ❌ Out of scope |

**Overall:** Draw/fill actions are well-covered for all elements the library renders. The arrow tip fill-mode system is particularly faithful to TikZ's open/closed tip semantics. Shade and clip are the most significant missing general-purpose features.
