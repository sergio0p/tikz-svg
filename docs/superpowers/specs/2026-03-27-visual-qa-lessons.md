# Visual QA Lessons: Native TikZ vs tikz-svg Comparison

**Date:** 2026-03-27
**Context:** Side-by-side comparison of `example6-turing.tex` compiled natively vs rendered by tikz-svg.

---

## Bug 1: Bent edge labels on wrong side

**Symptom:** `1,0,R` labels on `bend left` edges placed on the inside of the curve instead of outside.

**Root cause:** Two interrelated sign errors in SVG y-down coordinate handling:
- `perpendicularOffset()` in `math.js` used math-convention CCW rotation `(-y, x)`, which in SVG y-down is actually CW (visual RIGHT, not LEFT).
- `resolveAutoSide()` in `labels.js` used math-convention cross product sign (positive = left), but in SVG y-down, positive cross = visual RIGHT.

**Fix:** Both signs flipped together. Fixing only one would break straight edges.

**Lesson:** SVG y-down bites twice. When porting math formulas to SVG coordinates, every rotation and cross product needs its sign verified in screen-space, not math-space.

---

## Bug 2: Loop labels displaced diagonally

**Symptom:** `1,1,L` label above a `loop above` edge was north-west of the loop instead of directly above.

**Root cause:** Labels were computed on the **shortened** path. TikZ shortening (`shorten >=1pt`) is a **drawing-stage** operation (in `pgfcorepathusage.code.tex`). Labels are placed on the **original** unshortened path.

Our shortening moved the loop endpoint inward, making the cubic Bezier asymmetric. The tangent at `t=0.5` on the asymmetric curve tilted slightly, causing `computeAnchor` to pick `'south east'` instead of `'south'`.

**Fix:** `computeEdgePath()` now stores the original geometry as `.raw`. `computeLabelNode()` uses `.raw` for positioning.

**Verification:** On the unshortened loop, the tangent at `t=0.5` is exactly `(1, 0)` (horizontal), producing anchor `'south'` and placing the label directly above.

**Lesson:** In TikZ, path construction and path usage are separate stages. Shortening, arrow placement, and other visual adjustments happen at usage time. Label positioning happens at construction time. Our pipeline must respect this separation.

---

## Bug 3: Nodes bloated, edges too short

**Symptom:** Edges between nodes were visually cramped compared to native TikZ. Nodes appeared larger than necessary.

**Root cause:** `innerSep` was unconditionally added to the explicit radius:
```js
// Old (wrong): always inflates
geomConfig.radius = Math.max(geomConfig.radius + innerSep, minR);
```

In TikZ, `inner sep` is padding between text and node border. Explicit dimensions (`minimum size`, `radius`) act as a **floor**. The node only grows if `text + innerSep > explicit_size`.

```js
// New (correct): innerSep only grows if text needs it
geomConfig.radius = Math.max(geomConfig.radius, textR + innerSep, minR);
```

**Impact:** With `radius=20` and `innerSep=3`, nodes were rendered at r=23 instead of r=20. This consumed 6px of edge space per edge, making everything cramped.

**Lesson:** `innerSep` is padding, not inflation. TikZ treats explicit dimensions as floors, not bases to add padding onto.

---

## Bug 4: Missing "start" label on initial arrow

**Symptom:** Native TikZ shows "start" text next to the initial arrow. Our version only showed the arrow.

**Root cause:** `emitInitialArrow()` drew the arrow path but never emitted a text label. TikZ's `initial` style includes `initial text=start` by default.

**Fix:** Added text element at the arrow start point, anchored away from the arrow direction.

---

## Bug 5: All non-plot demos broken by mathjs dependency

**Symptom:** 9 demo HTML pages showed blank SVGs after the plotting module was added.

**Root cause:** `src-v2/index.js` unconditionally imports the plotting module, which imports `evaluator.js`, which does `import { compile } from 'mathjs'` (bare specifier). Browsers can't resolve bare specifiers without an importmap. Demos that had the mathjs UMD + importmap shim worked; the other 9 didn't.

**Fix:** Added the mathjs CDN script + importmap shim to all demo HTML files.

**Lesson:** Adding a new dependency to a module that's imported by the main entry point breaks ALL consumers, not just the ones using the new feature. Consider lazy/dynamic imports for optional features, or ensure all HTML entry points include necessary shims.

---

## Meta-lesson: TikZ-reference-first development

Every visual bug was solved by reading PGF source code, not by guessing:

| Bug | PGF source consulted |
|-----|---------------------|
| Label side detection | Cross product sign conventions in SVG vs math coords |
| Loop label displacement | `pgfcorepathusage.code.tex` — shortening is draw-stage |
| Node inflation | `pgfmoduleshapes.code.tex` — innerSep as padding, not inflation |
| Loop geometry | `tikzlibrarytopaths.code.tex` — `loop above` angles, looseness=8 |
| Initial text | `tikzlibraryautomata.code.tex` — `initial text=start` |

**The pattern:** When our output doesn't match TikZ, the answer is always in the PGF `.code.tex` files. Study the mechanism, don't invent ad-hoc fixes.

---

## Proportions matter

The final adjustment was not a library bug at all: `nodeDistance: 90` (from 80) matched TikZ's ratio of `radius / nodeDistance = 22%`. Native TikZ uses `node distance=2cm` (~56.7pt) with state radius ~12.5pt. Our `radius=20 / nodeDistance=80 = 25%` was proportionally too cramped.

**Lesson:** After fixing all library bugs, the remaining visual mismatch may be a demo configuration issue, not a code defect.
