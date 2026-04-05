# Paths and Arrows

## What Paths Are For

`config.paths` is TikZ's `\draw` equivalent — freeform lines between arbitrary points, with arrows, dashes, and inline labels. Use paths for axes, guide lines, tick marks, and geometric constructions.

## Drawing a Line

```js
paths: [
  { points: [{x: 0, y: 0}, {x: 100, y: 0}] }
]
```

This draws a straight line from (0,0) to (100,0). Add more points for a polyline:

```js
{ points: [{x:0,y:0}, {x:50,y:-30}, {x:100,y:0}] }
```

## Adding Arrows

```js
{ points: [{x:0,y:0}, {x:100,y:0}], arrow: '->' }     // arrow at end
{ points: [{x:0,y:0}, {x:100,y:0}], arrow: '<->' }    // both ends
{ points: [{x:0,y:0}, {x:100,y:0}], arrow: '<-' }     // arrow at start
```

Arrow tips come from the same registry as edges — `stealth` by default. Set `arrowSize` to scale.

## Closing a Path

`cycle: true` connects the last point back to the first — useful for filled regions:

```js
{ points: [{x:0,y:0}, {x:60,y:-30}, {x:0,y:-30}],
  cycle: true, fill: 'rgba(38,139,210,0.3)', stroke: 'none' }
```

## Styling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `stroke` | string | `'#000000'` | Line color |
| `strokeWidth` | number | 1.5 | Line width |
| `thick` | boolean | false | Sets strokeWidth to 2.4 |
| `dashed` | bool/string | false | `true` = `'6 4'`, or custom dasharray |
| `dotted` | boolean | false | `true` = `'2 3'` |
| `fill` | string | `'none'` | Interior fill (use with `cycle`) |
| `opacity` | number | 1 | Overall opacity |

## Inline Labels on Paths

Place text at any position along the path:

```js
{ points: [{x:0,y:0}, {x:100,y:0}],
  arrow: '->',
  nodes: [
    { at: 1, label: '$Q$', anchor: 'west' },     // at the end
    { at: 0.5, label: 'midpoint', anchor: 'south' },
  ]
}
```

`at` is a fraction: 0 = start, 0.5 = middle, 1 = end. `anchor` controls which side of the label sits at the path point.

## Drawing Axes (Common Pattern)

```js
draw: [
  // Y-axis
  { type: 'path', points: [{x:0,y:0.1},{x:0,y:-1.5}], arrow: '->',
    stroke: '#586e75', strokeWidth: 2 },
  // X-axis
  { type: 'path', points: [{x:-0.1,y:0},{x:1.5,y:0}], arrow: '->',
    stroke: '#586e75', strokeWidth: 2 },
  // Axis labels
  { type: 'node', id: 'P', position: {x:-0.15,y:-1.5}, label: '$P$',
    anchor: 'east', fill: 'none', stroke: 'none' },
  { type: 'node', id: 'Q', position: {x:1.5,y:0.1}, label: '$Q$',
    anchor: 'west', fill: 'none', stroke: 'none' },
]
```

Note coordinates are in scaled math units (with `scale: 200`, the point `{x:1.5,y:0}` maps to 300px from the origin). Y is negated for economics convention (P up).

## Tick Marks

Short perpendicular lines:

```js
// Horizontal tick at y = -20
{ type: 'path', points: [{x:-1.5,y:-20},{x:1.5,y:-20}], stroke: '#586e75' }

// Vertical tick at x = 60
{ type: 'path', points: [{x:60,y:-1.5},{x:60,y:1.5}], stroke: '#586e75' }
```

## Dotted Guide Lines

```js
{ type: 'path', points: [{x:0,y:-40},{x:40,y:-40}],
  dotted: true, stroke: '#586e75' }
```

## Global Path Defaults

Set `pathStyle` to share properties across all paths:

```js
pathStyle: { stroke: '#586e75', strokeWidth: 1.5 }
```

## Next

[Chapter 5: Plots and Functions](05-plots-and-functions.md) — drawing mathematical curves.
