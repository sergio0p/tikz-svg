# Getting Started

## What is tikz-svg?

A JavaScript library that renders TikZ-style graphics as SVG in the browser. You describe diagrams declaratively — nodes, edges, curves, labels — and the library handles layout, arrows, anchors, and math rendering.

## Minimal Example

```html
<svg id="my-diagram"></svg>

<!-- Dependencies -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mathjs@15.1.1/lib/browser/math.js"></script>
<script type="importmap">
{ "imports": { "mathjs": "./tikz-svg/examples-v2/mathjs-shim.js" } }
</script>

<script type="module">
  import { render } from './tikz-svg/src-v2/index.js';

  render(document.getElementById('my-diagram'), {
    scale: 200,
    originX: 100, originY: 90,
    draw: [
      // Y-axis
      { type: 'path', points: [{x:0,y:-0.1},{x:0,y:1.5}], arrow: '->' },
      // X-axis
      { type: 'path', points: [{x:-0.1,y:0},{x:1.5,y:0}], arrow: '->' },
      // A downward-sloping line
      { type: 'plot', expr: x => 1.2 - 0.8*x, domain: [0,1.4],
        handler: 'smooth', stroke: '#dc322f', strokeWidth: 3 },
      // Labels
      { type: 'node', id: 'P', position: {x:-0.15,y:1.5}, label: '$P$',
        anchor: 'east', fill: 'none', stroke: 'none' },
      { type: 'node', id: 'Q', position: {x:1.5,y:-0.1}, label: '$Q$',
        anchor: 'north', fill: 'none', stroke: 'none' },
    ],
  });
</script>
```

This draws axes with arrows, a demand curve, and math labels — about 15 lines of config.

## The Two APIs

| Function | Use for | Key difference |
|----------|---------|----------------|
| `render(svg, config)` | Graphs, diagrams, any drawing | Paint-order via `config.draw` |
| `renderAutomaton(svg, config)` | State machines, automata | Uses `states` + `edges`, adds `shortenEnd: 1` |

Both are imported from the same module. `renderAutomaton` is a thin wrapper around `render` with automata defaults.

## How render() Works

You pass a config object. The library runs a 6-phase pipeline:

1. **Parse** — read your config
2. **Position** — resolve relative placements (`{ right: 'q0' }`) via topological sort
3. **Node geometry** — compute shapes, sizes, anchors
4. **Edge geometry** — compute paths, bends, loops, arrow shortening
5. **Styles** — cascade defaults → global → group → named → per-element
6. **Emit SVG** — generate DOM elements, render KaTeX math

Calling `render()` again on the same SVG clears and re-renders — useful for live updates.

**Returns:** `{ nodes, edges, labels, plots }` — live DOM references for animation.

## Coordinate System

Two conventions coexist:

| Element | Y direction | Why |
|---------|------------|-----|
| Node `position`, path `points` | **y-down** (SVG native) | Direct SVG pixel mapping |
| Plot `expr` return value | **y-up** (math) | Library auto-flips for you |

For economics graphs where P increases upward, negate y on nodes/paths:
```js
position: { x: Q, y: -P }     // manual negate for nodes
expr: Q => 60 - Q/2            // plots auto-flip, no negate needed
```

## scale and origin

`scale` converts your math coordinates to SVG pixels. `originX`/`originY` shifts the origin.

```js
render(svg, {
  scale: 200,       // 1 unit = 200px
  originX: 100,     // origin 100px from left
  originY: 90,      // origin 90px from top
  draw: [...]
});
```

With `scale: 200`, a point at `{x: 1, y: 0.5}` maps to SVG pixel `(100 + 200, 90 + 100)` = `(300, 190)`.

## Serving Locally

The library uses ES modules. Browsers block module imports from `file://` URLs. Use any local server:

```bash
python3 -m http.server 8080
# then open http://localhost:8080/your-page.html
```

## Next

[Chapter 2: Nodes and Positioning](02-nodes-and-positioning.md) — shapes, anchors, relative placement.
