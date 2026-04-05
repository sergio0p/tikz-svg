# tikz-svg Library: TikZ Design Principles Audit

**Date:** 2026-03-24
**Library version:** src-v2 (sandbox)
**Manual reference:** TikZ & PGF Manual v3.1.10, Chapter 11 (§11.1–§11.9), pp. 124–127

This summary covers all nine TikZ design principles from Chapter 11 as they apply to the tikz-svg JavaScript library. Individual reports are in files `01-` through `09-`. Scope: the full library including the render pipeline, shape system, arrow tips, transform infrastructure, path builder, label geometry, and legacy callout module.

---

## Quick Reference: Compliance by Principle

| # | Principle | Status | Score |
|---|---|---|---|
| 1 | Special syntax for specifying points | Strong — missing polar, calc | 🟢🟡 |
| 2 | Special syntax for path specifications | Strong — `Path` class + full edge types | 🟢🟡 |
| 3 | Actions on paths | Good — missing shade, clip, color mixing | 🟢🟡 |
| 4 | Key–value syntax for graphic parameters | Excellent — best-aligned principle | 🟢 |
| 5 | Special syntax for nodes | Excellent — 14 shapes, full PGF contract | 🟢 |
| 6 | Special syntax for trees | Not implemented | 🔴 |
| 7 | Special syntax for graphs | Strong data model, missing layout/syntax | 🟢🟡 |
| 8 | Grouping of graphic parameters | Partial — two levels, no nesting | 🟡 |
| 9 | Coordinate transformation system | Infrastructure excellent, pipeline disconnected | 🟡 |

---

## Principle-by-Principle Summary

### 1. Special Syntax for Specifying Points
The library supports absolute `{ x, y }` objects, node name references (`'nodeName'`), anchor references (`'nodeName.anchor'`), and directional relative positioning (`{ right: 'q0' }`). `core/math.js`'s `vecFromAngle()` uses TikZ's angle convention throughout. The legacy callout module adds DOM element selectors and domain-specific coordinate systems. **Missing:** polar `(angle:radius)`, `++`/`+` relative coords in paths, `calc` expressions, unit conversion (pt/mm/cm).

### 2. Special Syntax for Path Specifications
The `Path` class (`core/path.js`) is a genuine METAPOST-inspired path builder with `M/L/C/Z`, `arc`, `ellipse`, `rect`, `roundCorners`, `transform`, and `bbox`. Edge geometry covers the full TikZ `to` option set: straight, bent (quadratic Bezier), explicit out/in/looseness (cubic Bezier), and self-loops with TikZ-faithful presets (source-verified against `tikzlibrarytopaths.code.tex`). `polygonBorderPoint` provides ray-convex-polygon intersection for all polygon shapes. **Missing:** smooth `..` curves, multi-waypoint edges, user-facing path DSL.

### 3. Actions on Paths
Draw (stroke) for edges and fill+draw for nodes are fully implemented. The arrow tip system implements a three-way `fillMode` (filled/stroke/both) precisely matching TikZ's open vs. closed tip semantics. Opacity, dashed stroke, drop shadow, and double-border (accepting states) are all supported. Callout fill/stroke is independent of the main pipeline. **Missing:** shade/gradient fill, clip, color mixing (`red!50`), pattern fills.

### 4. Key–Value Syntax for Graphic Parameters
The strongest alignment. JS objects are the natural equivalent of TikZ's `[key=value]` lists. The three-level cascade (`DEFAULTS → stateStyle/edgeStyle → per-element`) precisely mirrors `pgfkeys`' inheritance chain. Arrow tips, shapes, and callouts each have their own parameter systems with defaults and user overrides. 15+ node parameters and 12+ edge parameters are supported. **Missing:** named style definitions, per-shape-type hooks, parameterized styles.

### 5. Special Syntax for Nodes
The most feature-complete area. 14 shapes cover all of `pgflibraryshapes.geometric`, `pgflibraryshapes.multipart` primitives, and the three base shapes. The `createShape` factory mirrors PGF's `\pgfdeclareshape` mechanism. `outerSep` is PGF-faithful (0.5 × lineWidth default from `pgfmoduleshapes.code.tex`). Edge labels are full rectangle nodes with TikZ anchor selection (source-verified against `tikz.code.tex`). 18+ arrow tips from `pgflibraryarrows.meta` with auto-shortening from `pgfcorearrows.code.tex`. Callout shapes (`rectangleCallout`, `ellipseCallout`) implement TikZ's `shapes.callouts` library. **Missing:** automatic text-driven sizing, inline nodes along paths, circle/ellipse split, text wrapping.

### 6. Special Syntax for Trees
Not implemented. No tree layout algorithm, no `child` keyword, no automatic level/sibling distance computation. Manual encoding of small trees is possible via relative positioning but does not scale. **Recommended future work:** Reingold–Tilford algorithm.

### 7. Special Syntax for Graphs
The `states` + `edges` data model captures graph structure fully. Graph integrity validation exceeds TikZ's behavior. Topological-sort layout handles relative position chains. Full edge geometry and 18+ tips are available. **Missing:** DOT-notation compact syntax, automatic graph layout algorithms (Sugiyama, force-based, circular), edge chains, subgraph grouping.

### 8. Grouping of Graphic Parameters
Two-level cascade (`stateStyle`/`edgeStyle` + per-element) captures the picture-scope concept. `DEFAULTS` is the base scope. `TransformStack` provides a push/pop scope mechanism for transforms. Callout module has its own isolated defaults scope. **Missing:** nested scopes for element subsets, `TransformStack` not wired to the render pipeline, clipping scopes.

### 9. Coordinate Transformation System
The `Transform` class is a complete affine transform system with all PGF operations (translate, scale, rotate, slantX, slantY, concat, invert). `TransformStack` provides scope-based save/restore. `Path.transform(T)` applies coordinate transforms to paths. TikZ's angle convention (0°=east, CCW, y-down corrected) is enforced throughout `math.js`. **Gap:** None of this is accessible from `render()`. The pipeline uses canvas transforms (`translate()` SVG attributes) rather than coordinate transforms, which is TikZ's cautioned approach. Wiring the transform stack to the pipeline is the highest-priority infrastructure improvement.

---

## Cross-Cutting Strengths

1. **PGF source-verified implementations.** Loop geometry, outerSep, auto-shortening, anchor selection, and arrow tip geometry all trace back to specific lines in PGF source files. This is TikZ-first development executed correctly.

2. **Separation of concerns across 6 phases.** Parse → position → node geometry → edge geometry → styles → emit SVG. Each phase is independently testable.

3. **The `createShape` factory.** Eliminates boilerplate, enforces the shape contract, handles cross-cutting concerns (outerSep, numeric anchors, center anchor). Adding a new shape requires only the mathematical specification, not plumbing.

4. **Arrow tip registry.** Clean plugin architecture. Tips are first-class objects with full parametrization and auto-shortening geometry built in.

5. **Node-based labels.** Edge labels are not bare text — they are rectangle nodes with TikZ's anchor selection algorithm. This is a significantly more faithful implementation than most TikZ-to-SVG tools provide.

6. **Callout module.** The only shape library (TikZ's `shapes.callouts`) brought to near-complete implementation, with domain-specific coordinate systems as an extension.

---

## Cross-Cutting Gaps

1. **No user-facing coordinate transform API.** `Transform` + `TransformStack` exist but are not accessible from `render()`. Scope-based transforms (`[rotate=45]`, `[scale=2]`) are a fundamental TikZ capability that is entirely absent from the user API.

2. **No general path drawing.** `\draw (0,0) circle (1);`, `\draw (A) -- (B) -- (C);` — arbitrary path commands are not supported. The library is declarative (nodes + edges), not imperative (path commands). This is a deliberate architectural choice but significantly limits general TikZ porting.

3. **No named styles.** The lack of a style registry means complex diagrams require repeating style properties on every element rather than defining a named bundle once.

4. **No nested scopes.** The two-level cascade is sufficient for homogeneous diagrams but inadequate for diagrams with visually distinct sub-regions.

5. **No trees.** TikZ's tree syntax is entirely absent.

6. **Heuristic text sizing.** All text dimension estimates use `length × fontSize × 0.6`. Correct text sizing requires browser layout access (`getBBox()`) which adds DOM dependency and asynchrony — but the current heuristic will produce visible misalignment for labels with unusual characters or fonts.

---

## Priority Recommendations

| Priority | Item | Rationale |
|---|---|---|
| High | Wire `TransformStack` to render pipeline | Unlocks scope transforms; infrastructure already exists |
| High | Named style definitions | High user impact; straightforward to implement as a style registry |
| Medium | Nested scopes in render config | Enables diagrams with distinct visual regions |
| Medium | Polar coordinate support | Common in TikZ diagrams; trivial math already in `vecFromAngle` |
| Medium | Circle split / ellipse split in src-v2 | Already in `src/`, needs porting |
| Medium | Tree layout algorithm | Reingold–Tilford; enables parse trees, proof trees |
| Low | `calc` expressions | Needed for precise porting of complex TikZ; high implementation cost |
| Low | Shade / gradient fill | Cosmetic; SVG infra exists but no user-facing hook |
| Low | Clip | Rarely needed; significant complexity |
