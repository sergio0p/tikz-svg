# TikZ-SVG: Remaining Tasks

## Status: Demos generated, QA needed

---

## QA: Use demos to improve the library

Open each generated demo in a browser and compare against the original TikZ output (screenshots at tikz.dev/library-automata). Look for:

1. **Positioning issues** — are nodes placed correctly relative to each other?
2. **Edge routing** — do bends curve the right way? Do self-loops appear in the right position?
3. **Labels** — are edge labels positioned well and readable?
4. **Arrows** — do stealth arrowheads render properly?
5. **Styling** — do fills, strokes, shadows match the TikZ originals?

Fix any issues found in the library source code (`src/` directory).

### Demos to QA

| Demo | TikZ Source | Notes |
|------|-------------|-------|
| `examples/tikz-diamond.html` | `example5-orange-shadow.tex` | Gold standard |
| `examples/example4-blue-styled.html` | `example4-blue-styled.tex` | Blue DFA with loops |
| `examples/example5-orange-shadow.html` | `example5-orange-shadow.tex` | Nearly identical to tikz-diamond |
| `examples/example6-turing.html` | `example6-turing.tex` | 5-state Turing machine with bends; `bend angle=45` in TikZ vs default 30° in library |

---

## Architecture reference

```
src/
  core/math.js          — vector math, Bézier, angles
  core/constants.js     — DIRECTIONS table, DEFAULTS
  core/resolve-point.js — universal coordinate resolver
  shapes/shape.js       — shape registry (registerShape/getShape)
  shapes/circle.js      — circle shape (self-registering)
  shapes/rectangle.js   — rectangle shape
  shapes/ellipse.js     — ellipse shape
  positioning/positioning.js — topological sort + direction table positioning
  geometry/edges.js     — straight, bent, loop edge paths
  geometry/arrows.js    — stealth arrow marker defs
  geometry/labels.js    — edge label positioning
  style/style.js        — resolveNodeStyle, resolveEdgeStyle, collectShadowFilters
  svg/emitter.js        — SVG DOM construction
  index.js              — 6-phase render pipeline
  automata/automata.js  — renderAutomaton() convenience wrapper
```

### Key conventions
- ES modules, no external deps
- SVG DOM via `document.createElementNS`
- TikZ angles: 0°=east, CCW positive; SVG: y-down
- Style cascade: DEFAULTS → stateStyle → per-node overrides
- All 56 tests pass: `npm test` (uses `node --test`)

---

## The subagent

`.claude/agents/tikz-to-svg.md` — converts TikZ automata source to `renderAutomaton()` calls. Invoke from Claude Code with:
```
Use the tikz-to-svg agent to convert examples/tikz-sources/example4-blue-styled.tex
```
