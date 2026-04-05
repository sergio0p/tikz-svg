# Plots and Functions

## Plotting a Curve

```js
plots: [
  { expr: x => 1.2 - 0.8*x, domain: [0, 1.4], handler: 'smooth',
    stroke: '#dc322f', strokeWidth: 3 }
]
```

The library samples the function across the domain and connects the points. The `expr` function receives x and returns y in **math coordinates** (y-up). The library auto-flips y for SVG.

## JS Functions vs Math.js Strings

Two ways to define expressions:

```js
// JS arrow function (recommended for simple expressions)
expr: x => Math.sin(x)

// math.js string (supports full math syntax)
expr: 'sin(x) * exp(-x/5)'
```

JS functions are faster. Math.js strings support more notation (`sin`, `cos`, `exp`, `log`, `sqrt`, `pi`, `e`, `abs`, etc.) and are useful when expressions come from user input.

## Domain and Sampling

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `domain` | [min, max] | [-5, 5] | x-range to sample |
| `samples` | number | 25 | Number of sample points |
| `samplesAt` | number[] | — | Explicit x-values (overrides domain/samples) |
| `yRange` | [min, max] | — | Clip y outside this range |

For smooth curves, use more samples:
```js
{ expr: x => Math.sin(x), domain: [0, 6.28], samples: 100, handler: 'smooth' }
```

For straight lines, 2 samples suffice:
```js
{ expr: x => 60 - x/2, domain: [0, 120], samples: 2, handler: 'lineto' }
```

## Plot Handlers

Handlers control how sample points are connected:

| Handler | Alias | Use for |
|---------|-------|---------|
| `'lineto'` | `'sharp plot'` | Straight segments between points |
| `'curveto'` | `'smooth'` | Smooth Bezier curve through points |
| `'closedcurve'` | `'smooth cycle'` | Closed smooth curve |
| `'constlineto'` | `'const plot'` | Step function (mark at left) |
| `'constlinetoright'` | `'const plot mark right'` | Step (mark at right) |
| `'ycomb'` | — | Vertical lines from baseline |
| `'ybar'` | — | Vertical bar chart |

## Parametric Curves

For curves where both x and y depend on a parameter:

```js
{ expr: t => 2*Math.cos(t), yExpr: t => 2*Math.sin(t),
  domain: [0, 6.28], samples: 100, handler: 'smooth',
  variable: 't' }
```

## Marks on Plots

Place symbols at sample points:

```js
{ expr: x => x*x, domain: [0, 3], samples: 7,
  mark: '*', markSize: 4, stroke: '#268bd2' }
```

**Mark types:** `'*'`, `'o'`, `'+'`, `'x'`, `'|'`, `'-'`, `'square'`, `'square*'`, `'triangle'`, `'triangle*'`, `'diamond'`, `'diamond*'`, `'pentagon'`, `'pentagon*'`, `'asterisk'`, `'star'`

Control which points get marks:
```js
markRepeat: 3      // every 3rd point
markPhase: 2       // starting from 2nd point
markIndices: [0, 5, 10]  // specific indices
```

## Plot-Level Scale and Offset

Each plot can have its own scale and offset, applied before the global `config.scale`:

```js
{ expr: x => Math.sin(x), domain: [0, 6.28],
  scaleX: 1, scaleY: 50,     // stretch y by 50x
  offsetX: 0, offsetY: 0,
  handler: 'smooth' }
```

## Styling

```js
{
  stroke: '#dc322f',      // line color
  strokeWidth: 3,         // line thickness
  fill: 'none',           // fill under curve (use with closedcurve)
  dashed: '4 2',          // dash pattern (no 'dotted' on plots — use dashed: '2 3')
  opacity: 0.8,
}
```

## Placing Labels on Curves

Use a node with `at` to position it at a specific sample point of a plot:

```js
draw: [
  { type: 'plot', expr: Q => 60 - Q/2, domain: [0, 120],
    handler: 'lineto', stroke: '#dc322f' },
  { type: 'node', id: 'D', position: { at: { plot: 0, point: 24 } },
    label: '$D$', fill: 'none', stroke: 'none' },
]
```

`plot: 0` means the first plot in the draw array (0-indexed among plots). `point: 24` means the 25th sample point. Add `above: 10` or `below: 10` for offset.

## Bar Charts

```js
{ coordinates: [{x:1,y:30}, {x:2,y:45}, {x:3,y:25}],
  handler: 'ybar', barWidth: 15,
  fill: '#268bd2', stroke: 'none' }
```

Use `coordinates` instead of `expr` for explicit data points. `barShift` offsets grouped bars.

## Global Plot Defaults

```js
plotStyle: { stroke: '#2563eb', strokeWidth: 2, handler: 'smooth' }
```

## Next

[Chapter 6: Composing Diagrams](06-composing-diagrams.md) — config.draw, paint order, and layers.
