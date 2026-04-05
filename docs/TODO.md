# tikz-svg: Open TODOs

**Consolidated 2026-04-05** from audit reports, plans, and SKILL-GAPS.md.

---

## Pending Migration

### LECWeb src/ → src-v2/ import path switch
Switch the two live pages from `src/` to `src-v2/`:
```bash
sed -i '' 's|/tikz-svg/src/automata/automata.js|/tikz-svg/src-v2/automata/automata.js|g' \
  LECWeb/510/arbitrage.html \
  LECWeb/510/financial-markets.html
```
**Risk:** Low — `src-v2` API is a superset. Needs visual validation of 7 automata diagrams.
**Plan:** `docs/plans/2026-03-24-app-migration-plan.md`

### Pixel-level TikZ comparison
Compile `example6-turing.tex` natively and compare against our rendering. Not yet attempted.

---

## Missing TikZ Features (from audit, still unimplemented)

### Coordinate System
- **Polar coordinates** `(angle:radius)` — math exists in `vecFromAngle`, no user syntax
- **`++`/`+` relative path coords** — `Path` tracks `_lastMove` internally, not exposed
- **Unit conversion** (pt/mm/cm) — all coords are SVG user units
- **`calc` expressions** `($(A)!0.5!(B)$)` — no equivalent
- **Intersection coordinates** — absent

### Path Features
- **Smooth curves** (`..`, Catmull-Rom, tension) — all curves are explicit Bézier
- **Multi-waypoint edges** — each edge connects exactly two nodes
- **Arc as edge type** — `Path.arc()` exists for shapes, not as an edge type

### Actions on Paths
- **Shade / gradient fill** — SVG supports it, no user-facing hook
- **Clip** — SVG `<clipPath>` available, not exposed
- **Color mixing** (`red!50!blue`, `blue!20`) — common in TikZ, absent here
- **Pattern fills** — absent

### Trees
- **Tree layout algorithm** — no `child` keyword, no automatic layout
- **Recommended:** Reingold–Tilford for parse trees, proof trees

### Graphs
- **DOT-notation compact syntax** — all edges must be listed individually
- **Automatic layout algorithms** (Sugiyama, force-based) — absent
- **Edge chains** (`a -> b -> c`) — absent

### Transforms
- **Full scope-based coordinate transforms** — `config.scale` and `config.transformCanvas` exist but no nested `[rotate=45]` scopes
- **Non-linear transformation framework** — absent

---

## Documentation Debt

### Stale audit files
`docs/audit/00-summary.md` through `09-*.md` are dated 2026-03-24. Many "missing" items are now implemented (named styles, config.paths, auto-sizing, text wrapping, circle/ellipse split, scale/transformCanvas, config.groups). These are historical snapshots — do not treat as current status.

### README.md
Only documents `renderAutomaton()`. Missing: `render()` API, `config.draw`, `config.paths`, `config.plots`, `config.styles`, `config.groups`, `config.layers`, 20 shapes, KaTeX, decorations.

### SKILL-GAPS.md
Arrow tip section says only `stealth` and `none` exist — 18 tips have been implemented since. Needs update or deletion.

### Root TODO.md
Shape count (16→20), test count (447→588), stale path `docs/superpowers/specs/` → `docs/specs/`. Should be replaced by this file.

---

## Completed Plans (for reference)

All plans in `docs/plans/` are completed:

| Plan | Feature | Date |
|------|---------|------|
| node-based-label-positioning | Label nodes with anchor selection | 2026-03-23 |
| infrastructure-structural-refactor | Named styles, groups, transforms | 2026-03-24 |
| decorations-module | Random steps, wavy, rounded corners | 2026-03-25 |
| plotting-module | Function plotting with math.js | 2026-03-25 |
| auto-size-nodes | Text-driven node sizing | 2026-03-27 |
| draw-order | config.draw ordered rendering | 2026-03-27 |
| free-form-paths | config.paths polylines + arrows | 2026-03-27 |
| katex-math | KaTeX in labels via foreignObject | 2026-03-27 |
| named-layers | PGF-style z-order layers | 2026-03-27 |
| node-properties | minimumWidth, textWidth, align, rotate, etc. | 2026-03-27 |
| plot-render-integration | config.plots in render() | 2026-03-27 |
| shapesplan | 10 geometric + multipart shapes | 2026-03-23 |
| enhanced-multipart-status | TeX library for circle/ellipse split | 2026-03-23 |
| app-migration-plan | **PENDING** — src→src-v2 switch | 2026-03-24 |
