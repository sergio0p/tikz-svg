# Appendix: Reference Tables

## All Shapes (20)

### Geometric

| Shape | Key properties | Notes |
|-------|---------------|-------|
| `circle` | `radius` | Default shape |
| `rectangle` | `halfWidth`, `halfHeight`, `roundedCorners` | |
| `ellipse` | `rx`, `ry` | |
| `diamond` | `radius` or `halfWidth`/`halfHeight` | Rotated rectangle |
| `star` | `radius`, `starPoints` (default 5) | |
| `regular polygon` | `radius`, `sides` (default 5) | |
| `trapezium` | `halfWidth`, `halfHeight`, `upperWidth`, `lowerWidth` | |
| `semicircle` | `radius` | |
| `isosceles triangle` | `halfWidth`, `halfHeight` | |
| `kite` | `halfWidth`, `halfHeight`, `upperVertex`, `lowerVertex` | |
| `dart` | `halfWidth`, `halfHeight` | |
| `circular sector` | `radius`, `sectorAngle` | |
| `cylinder` | `halfWidth`, `halfHeight`, `aspect` | 3D appearance |

### Multipart

| Shape | Key properties | Notes |
|-------|---------------|-------|
| `rectangle split` | `label: ['A','B','C']`, `partFills`, `partAlign`, `drawSplits` | N-part divided rectangle |
| `circle split` | `label: ['A','B']`, `partFills`, `drawSplits` | N-part divided circle |
| `ellipse split` | `label: ['A','B']`, `partFills`, `drawSplits` | N-part divided ellipse |

### Symbols

| Shape | Key properties | Notes |
|-------|---------------|-------|
| `cloud` | `cloudPuffs` (default 10), `cloudPuffArc` (default 135) | TikZ-faithful puff geometry |

### Callouts

| Shape | Key properties | Notes |
|-------|---------------|-------|
| `rectangle callout` | `calloutPointer`, `calloutPointerWidth` | Speech bubble |
| `ellipse callout` | `calloutPointer`, `calloutPointerArc` | Speech bubble |
| `cloud callout` | `calloutPointer`, `calloutPointerSegments`, `calloutPointerStartSize`, `calloutPointerEndSize` | Thought bubble |

All callouts provide a `'pointer'` anchor at the tip. `calloutPointer` takes `{x,y}` or a node ID string. `calloutPointerShorten` shortens the pointer toward the shape center.

---

## Node Properties

### Size and Shape

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `shape` | string | `'circle'` | Shape name |
| `radius` | number | 20 | Circle/polygon radius |
| `halfWidth` | number | auto | Rectangle/ellipse half-width |
| `halfHeight` | number | auto | Rectangle/ellipse half-height |
| `rx`, `ry` | number | auto | Ellipse radii |
| `minimumWidth` | number | 0 | Floor width |
| `minimumHeight` | number | 0 | Floor height |
| `innerSep` | number | 3 | Text-to-border padding |
| `outerSep` | number | auto | Border-to-edge gap (0.5 x strokeWidth) |
| `roundedCorners` | number | 0 | Corner radius |

### Fill and Stroke

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `fill` | string | `'#FFFFFF'` | Background color |
| `stroke` | string | `'#000000'` | Border color |
| `strokeWidth` | number | 1.5 | Border width |
| `opacity` | number | 1 | Overall opacity |
| `dashed` | bool/string | false | `true` = `'6 4'`, or custom dasharray |
| `shadow` | bool/object | false | `true` or `{dx, dy, blur, color}` |

### Text

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | string | node ID | Display text. `$...$` = KaTeX |
| `fontSize` | number/string | 14 | Pixels or named size |
| `fontFamily` | string | `'serif'` | CSS font |
| `labelColor` | string | `'#000000'` | Text color |
| `textWidth` | number | 0 | Wrap width (0 = no wrap) |
| `align` | string | `'center'` | `'left'`/`'center'`/`'right'` |

Named font sizes: `'tiny'`(7), `'scriptsize'`(8), `'small'`(10), `'normalsize'`(12), `'large'`(14), `'Large'`(17), `'huge'`(24)

### Position

| Property | Type | Description |
|----------|------|-------------|
| `position` | `{x,y}`, `[x,y]`, or `{dir: 'id'}` | Absolute or relative |
| `anchor` | string | Anchor at position |
| `xshift` | number | Post-position x offset |
| `yshift` | number | Post-position y offset |
| `rotate` | number | Rotation (degrees) |
| `nodeScale` | number | Local scale factor |
| `at` | `{plot, point, above?}` | Position at plot sample point |

### Automata

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `initial` | bool/string | false | Initial arrow direction |
| `accepting` | boolean | false | Double-circle border |
| `acceptingInset` | number | 3 | Gap between double borders |

---

## Edge Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `from` | string | — | Source node ID |
| `to` | string | — | Target node ID |
| `label` | string | — | Edge label |
| `bend` | string/number | — | `'left'`/`'right'` or angle |
| `loop` | string | — | `'above'`/`'below'`/`'left'`/`'right'` |
| `out` | number | — | Departure angle (0=east, CCW) |
| `in` | number | — | Arrival angle |
| `looseness` | number | 1 | Control-point multiplier |
| `arrow` | string | `'stealth'` | `'->'`/`'<->'`/`'<-'`/`'none'` |
| `arrowSize` | number | 8 | Arrow tip size |
| `stroke` | string | `'#000000'` | Line color |
| `strokeWidth` | number | 1.5 | Line width |
| `dashed` | bool/string | false | Dash pattern |
| `opacity` | number | 1 | |
| `shortenStart` | number | 0 | Trim from start |
| `shortenEnd` | number | 0 | Trim from end |
| `labelPos` | number | 0.5 | 0=start, 1=end |
| `labelSide` | string | `'auto'` | `'auto'`/`'left'`/`'right'` |
| `labelDistance` | number | 0 | Label offset from edge |
| `sloped` | boolean | false | Rotate label with edge tangent |

---

## Path Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `points` | `[{x,y}...]` | — | Vertices |
| `cycle` | boolean | false | Close path |
| `fill` | string | `'none'` | Interior fill |
| `stroke` | string | `'#000000'` | Line color |
| `strokeWidth` | number | 1.5 | Line width |
| `thick` | boolean | false | strokeWidth = 2.4 |
| `dashed` | bool/string | false | Dash pattern |
| `dotted` | boolean | false | `'2 3'` pattern |
| `opacity` | number | 1 | |
| `arrow` | string | — | Arrow direction |
| `arrowSize` | number | 8 | Tip size |
| `nodes` | array | — | `[{at, label, anchor}]` inline labels |

---

## Plot Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `expr` | function/string | — | `x => ...` or math.js string |
| `coordinates` | `[{x,y}...]` | — | Explicit data points |
| `domain` | [min, max] | [-5, 5] | x-range |
| `samples` | number | 25 | Sample count |
| `samplesAt` | number[] | — | Explicit x-values |
| `variable` | string | `'x'` | Variable name |
| `yExpr` | function/string | — | Parametric y |
| `yRange` | [min, max] | — | Clip y |
| `handler` | string | `'lineto'` | Connection method |
| `tension` | number | 0.5 | Smooth curve tension |
| `stroke` | string | `'#2563eb'` | Line color |
| `strokeWidth` | number | 2 | |
| `fill` | string | `'none'` | Under-curve fill |
| `dashed` | bool/string | false | Use `'2 3'` for dotted |
| `opacity` | number | 1 | |
| `mark` | string | — | Mark symbol |
| `markSize` | number | 3 | Mark radius |
| `markRepeat` | number | — | Every Nth point |
| `markPhase` | number | — | Start offset |
| `markIndices` | number[] | — | Specific indices |
| `scaleX/Y` | number | 1 | Plot-local scale |
| `offsetX/Y` | number | 0 | Plot-local offset |
| `barWidth` | number | 10 | Bar chart width |
| `barShift` | number | 0 | Bar offset |
| `baseline` | number | 0 | Comb/bar baseline |

---

## Plot Handlers

| Handler | Alias | Description |
|---------|-------|-------------|
| `'lineto'` | `'sharp plot'` | Straight segments |
| `'curveto'` | `'smooth'` | Tension-based Bezier |
| `'closedcurve'` | `'smooth cycle'` | Closed smooth |
| `'polygon'` | `'sharp cycle'` | Closed polygon |
| `'constlineto'` | `'const plot'` | Step (mark left) |
| `'constlinetoright'` | `'const plot mark right'` | Step (mark right) |
| `'constlinetomid'` | `'const plot mark mid'` | Step (mark mid) |
| `'jumpmarkleft'` | — | Disconnected steps (left) |
| `'jumpmarkright'` | — | Disconnected steps (right) |
| `'jumpmarkmid'` | — | Disconnected steps (mid) |
| `'xcomb'` | — | Horizontal lines from baseline |
| `'ycomb'` | — | Vertical lines from baseline |
| `'ybar'` | — | Vertical bars |
| `'xbar'` | — | Horizontal bars |

---

## Mark Types

`'*'`, `'o'`, `'+'`, `'x'`, `'|'`, `'-'`, `'square'`, `'square*'`, `'triangle'`, `'triangle*'`, `'diamond'`, `'diamond*'`, `'pentagon'`, `'pentagon*'`, `'asterisk'`, `'star'`

---

## Arrow Tips

`'stealth'`, `'latex'`, `'to'`, `'bar'`, `'bracket'`, `'parenthesis'`, `'kite'`, `'square'`, `'circle'`, `'triangle'`, `'rectangle'`, `'ellipse'`, `'diamond'`, `'straight barb'`, `'hooks'`, `'arc barb'`, `'tee barb'`, `'implies'`, `'classical tikz rightarrow'`, `'computer modern rightarrow'`, `'round cap'`, `'butt cap'`, `'triangle cap'`, `'fast triangle'`, `'fast round'`, `'rays'`

---

## Anchors

**Standard (all shapes):** `center`, `north`, `south`, `east`, `west`, `north east`, `north west`, `south east`, `south west`

**Numeric:** Any angle in degrees (0=east, counterclockwise)

**Callout-specific:** `pointer` (at the tip of the speech bubble)

---

## Defaults

| Constant | Value |
|----------|-------|
| nodeRadius | 20 |
| fontSize | 14 |
| fontFamily | `'serif'` |
| innerSep | 3 |
| nodeFill | `'#FFFFFF'` |
| nodeStroke | `'#000000'` |
| nodeStrokeWidth | 1.5 |
| edgeColor | `'#000000'` |
| edgeStrokeWidth | 1.5 |
| arrowSize | 8 |
| bendAngle | 30 |
| plotColor | `'#2563eb'` |
| plotStrokeWidth | 2 |
| pathColor | `'#000000'` |
| pathStrokeWidth | 1.5 |
| nodeDistance | 90 |
| onGrid | true |

---

## render() Config Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `states` | Object | `{}` | Node ID to config map |
| `edges` | Array | `[]` | Edge specs |
| `plots` | Array | `[]` | Plot specs |
| `paths` | Array | `[]` | Path specs |
| `draw` | Array | — | Mixed-order render list |
| `stateStyle` | Object | `{}` | Default node style |
| `edgeStyle` | Object | `{}` | Default edge style |
| `plotStyle` | Object | `{}` | Default plot style |
| `pathStyle` | Object | `{}` | Default path style |
| `styles` | Object | `{}` | Named style registry |
| `groups` | Array | — | Group styling |
| `scale` | number | 1 | Uniform scale |
| `scaleX/Y` | number | — | Per-axis scale |
| `originX/Y` | number | 0 | Origin offset |
| `nodeDistance` | number | 90 | Relative positioning spacing |
| `onGrid` | boolean | true | Center-to-center positioning |
| `seed` | number | — | RNG seed for decorations |
| `padding` | number | 40 | ViewBox padding around content (px) |
| `layers` | Array | — | Layer z-order |
| `transformCanvas` | Object | — | Post-render SVG transform |
