---
name: tikz-svg
description: Use when creating SVG graphics for lecture pages — economics graphs, automata, diagrams, callouts — using the tikz-svg JS library. Triggers on render(), renderAutomaton(), or any mention of tikz-svg.
---

# tikz-svg Library (v2)

Library: `/Users/sergiop/Dropbox/Scripts/tikz-svg/`
Entry: `src-v2/index.js` exports `render()` and `renderAutomaton()`.

## Mental Model

1. **Describe, don't draw.** Pass a config object — nodes, edges, paths, plots — and the library renders SVG.
2. **config.draw controls paint order.** First entry = behind. Use it for economics graphs. Skip it for automata (default layering works).
3. **Two y conventions.** Nodes/paths: y-down (SVG). Plots: y-up (math, auto-flipped). For econ: negate y on nodes (`y: -P`), return P directly in plot `expr`.
4. **Style cascade.** DEFAULTS → stateStyle/edgeStyle → group → named style → per-element. Set `stateStyle` once, override per-node.
5. **KaTeX math.** `$...$` in any label renders as math. Requires KaTeX JS loaded before `render()`.

## Before Writing Code

**Read the relevant Manual section** in `docs/Manual/`:

| Task | Read |
|------|------|
| First time setup, boilerplate | `01-getting-started.md` |
| Shapes, sizing, positioning | `02-nodes-and-positioning.md` |
| Connecting nodes, bends, loops | `03-edges-and-labels.md` |
| Axes, tick marks, guide lines | `04-paths-and-arrows.md` |
| Curves, bar charts, marks | `05-plots-and-functions.md` |
| Paint order, layers | `06-composing-diagrams.md` |
| Named styles, groups, cascade | `07-styles-and-groups.md` |
| KaTeX math, wavy decorations | `08-math-and-decorations.md` |
| Scale, origin, coordinate system | `09-transforms-and-scale.md` |
| All properties, shapes, tips | `appendix-reference.md` |

## Common Mistakes

- **Blank graph, no error:** Missing mathjs importmap shim. See setup in `01-getting-started.md`.
- **`<` in KaTeX breaks HTML:** Use `\lt` instead of `<` in math labels.
- **Labels overlapping edges:** Adjust `labelDistance`, `labelSide`, or `labelPos`.
- **Plot not visible:** Check `domain` range and `samples` count. Linear plots need only `samples: 2`.
- **Everything at origin:** Position uses y-down. For econ graphs, negate P: `y: -P`.

## Quick Setup

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mathjs@15.1.1/lib/browser/math.js"></script>
<script type="importmap">
{ "imports": { "mathjs": "./tikz-svg/examples-v2/mathjs-shim.js" } }
</script>
```

```js
import { render } from './tikz-svg/src-v2/index.js';
```

Requires HTTP server — `python3 -m http.server 8080`.
