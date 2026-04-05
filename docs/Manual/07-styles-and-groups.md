# Styles and Groups

## The Style Cascade

Every node and edge property goes through a cascade — later entries override earlier ones:

```
DEFAULTS → stateStyle/edgeStyle → group style → named style → per-element
```

This means you set broad defaults once and override only where needed.

## stateStyle and edgeStyle

Global defaults for all nodes and all edges:

```js
render(svg, {
  stateStyle: {
    shape: 'rectangle',
    fill: 'none', stroke: 'none',
    innerSep: 1, labelColor: '#586e75',
    fontFamily: "'Times New Roman', serif",
  },
  edgeStyle: {
    stroke: '#333', strokeWidth: 2, arrow: 'stealth',
  },
  // nodes and edges inherit these defaults
});
```

Individual nodes/edges only need to specify what differs:

```js
{ type: 'node', id: 'special', position: {x:50,y:50},
  label: 'Bold', fill: '#fdf6e3', stroke: '#586e75' }
// inherits fontFamily, innerSep, labelColor from stateStyle
// overrides fill and stroke
```

## Named Styles

Define reusable style bundles in `config.styles`:

```js
render(svg, {
  styles: {
    'axis-label': {
      shape: 'rectangle', fill: 'none', stroke: 'none',
      anchor: 'east', fontSize: 18, labelColor: '#586e75',
    },
    'curve-label': {
      shape: 'rectangle', fill: 'none', stroke: 'none',
      fontSize: 14,
    },
    'red-edge': {
      stroke: '#dc322f', strokeWidth: 3,
    },
  },
  draw: [
    { type: 'node', id: 'P', style: 'axis-label', position: {x:-3,y:-69}, label: '$P$' },
    { type: 'node', id: 'D', style: 'curve-label', position: {x:105,y:-10}, label: '$D$',
      labelColor: '#dc322f' },  // per-element override on top of named style
    { type: 'edge', from: 'A', to: 'B', style: 'red-edge' },
  ],
});
```

Per-element properties always win over the named style.

**Built-in named style:** `'wavy'` — applies random-step decoration with rounded corners.

## Groups

Apply shared styles to subsets of nodes or edges:

```js
groups: [
  { nodes: ['axP', 'axQ'], style: { fontSize: 18 } },
  { nodes: ['v20', 'v30', 'v40'], style: { fontSize: 12 } },
  { edges: ['e1', 'e2'], style: { dashed: true } },
]
```

Groups are processed in order — later groups override earlier ones for the same element. Groups override `stateStyle`/`edgeStyle` but are overridden by named styles and per-element properties.

You can also reference a named style in a group:

```js
groups: [
  { nodes: ['v20', 'v30'], style: 'curve-label' },
]
```

## plotStyle and pathStyle

Same pattern for plots and paths:

```js
plotStyle: { stroke: '#2563eb', strokeWidth: 2, handler: 'smooth' },
pathStyle: { stroke: '#586e75', strokeWidth: 1.5 },
```

## Full Cascade Example

```js
render(svg, {
  // Level 1: library DEFAULTS (nodeRadius: 20, fontSize: 14, etc.)

  // Level 2: global style
  stateStyle: { fill: '#fdf6e3', stroke: '#586e75' },

  // Level 3: named styles
  styles: {
    'big': { fontSize: 20 },
  },

  // Level 4: groups
  groups: [
    { nodes: ['A', 'B'], style: { strokeWidth: 3 } },
  ],

  states: {
    // Level 5: per-element
    A: { position: {x:0,y:0}, style: 'big', label: 'A' },
    // A gets: fill=#fdf6e3, stroke=#586e75, strokeWidth=3, fontSize=20
    B: { position: {x:100,y:0}, style: 'big', label: 'B', fill: '#fff' },
    // B gets: fill=#fff (overrides stateStyle), stroke=#586e75, strokeWidth=3, fontSize=20
  },
});
```

## Next

[Chapter 8: Math and Decorations](08-math-and-decorations.md) — KaTeX rendering and wavy lines.
