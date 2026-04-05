# Edges and Labels

## Connecting Two Nodes

An edge draws a line between two named nodes:

```js
edges: [
  { from: 'q0', to: 'q1', label: 'a' },
]
```

The line automatically starts and ends at the correct border points of each shape — you don't specify pixel coordinates.

## Straight, Bent, and Curved

**Straight** (default):
```js
{ from: 'A', to: 'B' }
```

**Bent** — curve left or right by an angle:
```js
{ from: 'A', to: 'B', bend: 'left' }       // 30-degree bend
{ from: 'A', to: 'B', bend: 'right' }
{ from: 'A', to: 'B', bend: 45 }            // custom angle
```

**Explicit angles** — full control over departure and arrival:
```js
{ from: 'A', to: 'B', out: 60, in: 120, looseness: 1.2 }
```

`out` is the departure angle (0=east, counterclockwise), `in` is the arrival angle. `looseness` multiplies the control-point distance (default 1).

## Self-Loops

When a node connects to itself:

```js
{ from: 'q1', to: 'q1', label: '0', loop: 'above' }
```

**Directions:** `'above'`, `'below'`, `'left'`, `'right'`

Each direction has TikZ-faithful preset angles (e.g., `loop above` uses out=105, in=75) and looseness=8.

## Arrow Tips

Edges have arrows by default (`'stealth'` tip). Control them with the `arrow` property:

```js
{ from: 'A', to: 'B', arrow: '->' }        // arrow at end (default)
{ from: 'A', to: 'B', arrow: '<->' }       // both ends
{ from: 'A', to: 'B', arrow: '<-' }        // arrow at start
{ from: 'A', to: 'B', arrow: 'none' }      // no arrow
```

Change the tip style globally or per-edge:

```js
edgeStyle: { arrow: 'latex' }              // all edges use latex tips
// or per-edge:
{ from: 'A', to: 'B', arrow: 'to' }       // this edge only
```

**Available tips:** `stealth`, `latex`, `to`, `bar`, `bracket`, `parenthesis`, `kite`, `square`, `circle`, `triangle`, `straight barb`, `hooks`, `arc barb`, `tee barb`, `implies`, and more. Use `arrowSize` (default 8) to scale them.

Arrow tips auto-shorten the path so the line ends cleanly at the tip, not behind it.

## Edge Labels

Labels sit beside the edge at a computed position:

```js
{ from: 'A', to: 'B', label: '$p$' }
```

Edge labels are full rectangle nodes with TikZ-faithful anchor selection — the library picks which side of the label node sits at the edge, so the text body extends away from the line.

### Controlling label position

| Property | Type | Default | Effect |
|----------|------|---------|--------|
| `labelPos` | number | 0.5 | Position along edge: 0=start, 0.5=midpoint, 1=end |
| `labelSide` | string | `'auto'` | `'auto'` (outside of curve), `'left'`, `'right'` |
| `labelDistance` | number | 0 | Perpendicular offset from edge (pixels) |
| `sloped` | boolean | false | Rotate label to follow edge tangent |

```js
{ from: 'A', to: 'B', label: '$\\frac{1}{2}$',
  labelPos: 0.3, labelSide: 'left', labelDistance: 5 }
```

## Edge Styling

```js
{
  from: 'A', to: 'B',
  stroke: '#dc322f',       // line color
  strokeWidth: 2,           // line thickness
  dashed: true,             // or custom: '4 2'
  opacity: 0.5,
  shortenStart: 3,          // trim from start
  shortenEnd: 3,            // trim from end
}
```

`shortenStart`/`shortenEnd` are additive with auto-shortening from arrow tips.

## Global Edge Defaults

Set `edgeStyle` to avoid repeating properties:

```js
edgeStyle: {
  stroke: '#333',
  strokeWidth: 2,
  arrow: 'stealth',
}
```

Individual edges override only what they need.

## Complete Automaton Example

```js
import { renderAutomaton } from './tikz-svg/src-v2/index.js';

renderAutomaton(svg, {
  nodeDistance: 80, onGrid: true,
  stateStyle: { radius: 22, fill: '#f97316', stroke: 'none',
                labelColor: '#fff', fontSize: 16 },
  edgeStyle: { stroke: '#333', strokeWidth: 2, arrow: 'stealth' },
  states: {
    q0: { initial: true, label: '$q_0$' },
    q1: { position: { right: 'q0' }, label: '$q_1$' },
    q2: { position: { right: 'q1' }, label: '$q_2$', accepting: true },
  },
  edges: [
    { from: 'q0', to: 'q1', label: 'a' },
    { from: 'q1', to: 'q2', label: 'b' },
    { from: 'q0', to: 'q0', label: 'b', loop: 'above' },
    { from: 'q2', to: 'q1', label: 'a', bend: 'left' },
  ],
});
```

**Automata-specific properties:**
- `initial: true` — draws an incoming arrow (or `'left'`/`'right'`/`'above'`/`'below'`)
- `accepting: true` — draws a double-circle border

## Next

[Chapter 4: Paths and Arrows](04-paths-and-arrows.md) — freeform drawing with `config.paths`.
