# Nodes and Positioning

## A Node is a Shape with a Label

Every node has a shape, a position, and optional text. The simplest node:

```js
states: {
  q0: { position: { x: 100, y: 100 } }
}
```

This draws a circle at (100, 100) with the label "q0" (the node's ID becomes its default label).

## Changing the Shape

Set `shape` to any of the 20 built-in shapes:

```js
states: {
  box:  { position: { x: 0, y: 0 }, shape: 'rectangle', label: 'Hello' },
  tri:  { position: { x: 100, y: 0 }, shape: 'isosceles triangle' },
  dia:  { position: { x: 200, y: 0 }, shape: 'diamond' },
}
```

**Geometric shapes:** `circle`, `rectangle`, `ellipse`, `diamond`, `star`, `regular polygon`, `trapezium`, `semicircle`, `isosceles triangle`, `kite`, `dart`, `circular sector`, `cylinder`

**Multipart:** `rectangle split`, `circle split`, `ellipse split`

**Symbols:** `cloud`

**Callouts:** `rectangle callout`, `ellipse callout`, `cloud callout`

## Sizing Nodes

Nodes auto-size to fit their label text. You can also set explicit dimensions:

```js
// Circle — set radius
{ shape: 'circle', radius: 30 }

// Rectangle — set halfWidth and halfHeight
{ shape: 'rectangle', halfWidth: 50, halfHeight: 20 }

// Ellipse — set rx and ry
{ shape: 'ellipse', rx: 40, ry: 25 }

// Any shape — set minimum floor
{ shape: 'diamond', minimumWidth: 60, minimumHeight: 40 }
```

`innerSep` controls padding between text and border (default: 3px). `outerSep` controls the gap between the border and where edges attach (default: half the stroke width).

## Relative Positioning

Place nodes relative to each other — no absolute coordinates needed:

```js
states: {
  A: { position: { x: 0, y: 0 } },           // anchor node
  B: { position: { right: 'A' } },            // right of A
  C: { position: { 'below right': 'A' } },    // diagonal
  D: { position: { below: 'B', distance: 120 } },  // custom distance
}
```

**8 directions:** `right`, `left`, `above`, `below`, `above right`, `above left`, `below right`, `below left`

The default spacing is `nodeDistance: 90` (set on the config root). Diagonal directions use a 0.707 factor for proper 45-degree placement.

**On-grid vs off-grid:** `onGrid: true` (default) measures center-to-center. `onGrid: false` measures anchor-to-anchor (edge of one shape to edge of the next).

Chains work automatically — the library topologically sorts dependencies:

```js
states: {
  q0: { position: { x: 0, y: 0 } },
  q1: { position: { right: 'q0' } },
  q2: { position: { right: 'q1' } },    // depends on q1, which depends on q0
  q3: { position: { below: 'q2' } },
}
```

## Anchors

Every shape has named anchor points. When you set `anchor` on a node, that anchor point is placed at the position (instead of the center):

```js
// Place so the east anchor sits at (100, 50)
{ position: { x: 100, y: 50 }, anchor: 'east', label: '$P$' }
```

This is how you align axis labels — the text body extends away from the anchor point.

**Standard anchors:** `center`, `north`, `south`, `east`, `west`, `north east`, `north west`, `south east`, `south west`

**Numeric anchors:** Any angle in degrees (0=east, counterclockwise) — e.g., `anchor: '45'`

## Invisible Label Nodes

For text labels on graphs (axis labels, curve names, annotations), use invisible nodes:

```js
{ type: 'node', id: 'axP', position: {x: -3, y: -69},
  label: '$P$', anchor: 'east',
  fill: 'none', stroke: 'none' }
```

This is so common that you'll typically set it as the default via `stateStyle`:

```js
stateStyle: {
  shape: 'rectangle', fill: 'none', stroke: 'none',
  innerSep: 1, labelColor: '#586e75',
  fontFamily: "'Times New Roman', serif",
}
```

Now every node is an invisible label by default — override `fill`/`stroke` only where you need a visible shape.

## Text Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | string | node ID | Display text. `$...$` renders as KaTeX math |
| `fontSize` | number or string | 14 | Pixels, or named: `'tiny'`(7), `'small'`(10), `'large'`(14), `'Large'`(17), `'huge'`(24) |
| `fontFamily` | string | `'serif'` | CSS font-family |
| `labelColor` | string | `'#000000'` | Text color |
| `textWidth` | number | 0 | Max width before wrapping (0 = no wrap) |
| `align` | string | `'center'` | `'left'`, `'center'`, `'right'` (with textWidth) |

Use `\\` in labels for explicit line breaks: `label: 'Line 1\\Line 2'`.

## Fill, Stroke, and Effects

```js
{
  fill: '#fdf6e3',              // background color
  stroke: '#586e75',            // border color
  strokeWidth: 2,               // border width
  opacity: 0.8,                 // overall opacity
  dashed: true,                 // or custom: '4 2'
  shadow: true,                 // drop shadow (or { dx:4, dy:4, blur:6 })
  roundedCorners: 5,            // rounded rectangle corners
}
```

## Transforms

```js
{
  xshift: 10,                   // offset after positioning
  yshift: -5,
  rotate: 45,                   // degrees
  nodeScale: 1.5,               // local scale
}
```

## Next

[Chapter 3: Edges and Labels](03-edges-and-labels.md) — connecting nodes with lines, bends, and labels.
