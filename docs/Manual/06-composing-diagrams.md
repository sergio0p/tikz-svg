# Composing Diagrams

## Why config.draw Exists

With separate `states`, `edges`, `paths`, and `plots` arrays, the library draws them in a fixed layer order: paths first, then edges, then nodes on top. You can't put a filled region behind an axis or a label in front of a curve.

`config.draw` solves this. It's a single ordered array where **first entry = drawn first = behind everything**. You control the exact paint order.

## Using config.draw

```js
render(svg, {
  scale: 200, originX: 100, originY: 90,
  draw: [
    // 1. Filled triangle (behind everything)
    { type: 'path', points: [{x:0,y:0},{x:0.6,y:-0.3},{x:0,y:-0.6}],
      cycle: true, fill: 'rgba(38,139,210,0.3)', stroke: 'none' },

    // 2. Axes (on top of fill)
    { type: 'path', points: [{x:0,y:0.1},{x:0,y:-0.8}], arrow: '->' },
    { type: 'path', points: [{x:-0.05,y:0},{x:1,y:0}], arrow: '->' },

    // 3. Demand curve (on top of axes)
    { type: 'plot', expr: x => 0.6 - x, domain: [0,0.8],
      handler: 'smooth', stroke: '#dc322f', strokeWidth: 3 },

    // 4. Labels (on top of everything)
    { type: 'node', id: 'P', position: {x:-0.08,y:-0.8},
      label: '$P$', anchor: 'east', fill: 'none', stroke: 'none' },
    { type: 'node', id: 'Q', position: {x:1,y:0.05},
      label: '$Q$', anchor: 'west', fill: 'none', stroke: 'none' },
    { type: 'node', id: 'D', position: {x:0.75,y:0.02},
      label: '$D$', fill: 'none', stroke: 'none', labelColor: '#dc322f' },
  ],
});
```

Each entry has a `type` field: `'node'`, `'edge'`, `'path'`, or `'plot'`. The remaining properties match the corresponding chapter (nodes need `id` + `position`, edges need `from`/`to`, etc.).

## Mixing draw with states/edges

You can use `config.draw` alongside `config.states` and `config.edges`. The separate arrays render in their default layers; `config.draw` entries render in their own ordered sequence. For full control, put everything in `config.draw`.

## Layers

For complex diagrams, you may want some items to always be behind or in front regardless of declaration order. Layers provide this:

```js
render(svg, {
  layers: ['background', 'main', 'foreground'],  // back to front
  draw: [
    { type: 'path', ..., layer: 'background' },   // always behind
    { type: 'plot', ... },                          // default: 'main'
    { type: 'node', ..., layer: 'foreground' },    // always on top
  ],
});
```

Within a layer, items render in declaration order. Layers render in the order listed in `config.layers`. Default layer is `'main'`.

## Pattern: Economics Graph

A typical economics diagram uses this structure:

```js
render(svg, {
  scale: 4, originX: 55, originY: 325,

  stateStyle: {
    shape: 'rectangle', fill: 'none', stroke: 'none',
    innerSep: 1, labelColor: '#586e75',
    fontFamily: "'Times New Roman', serif",
  },

  draw: [
    // 1. Filled welfare areas
    // 2. Axes with arrows
    // 3. Curves (plots)
    // 4. Dotted guide lines
    // 5. Tick marks
    // 6. Labels (axis, curve, value)
  ],
});
```

The `stateStyle` makes all nodes invisible label boxes by default. The `draw` array controls exact layering. `scale: 4` means 1 unit = 4px — so a price of 60 maps to 240px.

## Pattern: State Machine

State machines don't need `config.draw` — the default layering (edges behind, nodes in front) is correct:

```js
renderAutomaton(svg, {
  nodeDistance: 80,
  stateStyle: { radius: 22, fill: '#f97316', stroke: 'none', labelColor: '#fff' },
  edgeStyle: { stroke: '#333', strokeWidth: 2 },
  states: { ... },
  edges: [ ... ],
});
```

## Next

[Chapter 7: Styles and Groups](07-styles-and-groups.md) — named styles, groups, and the cascade.
