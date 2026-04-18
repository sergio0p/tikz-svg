# tikz-svg Library Changes — 2026-04-09

## 1. renderAutomaton switched to v2 pipeline
**Commit:** `d61e7f9`
**File:** `src/automata/automata.js`

**Problem:** `renderAutomaton()` imported `render` from `src/index.js` (v1 pipeline), which does not auto-size rectangle/ellipse nodes to fit label text. Nodes defaulted to `radius: 20` regardless of content, causing text clipping.

**Fix:** Changed import from `../index.js` (v1) to `../../src-v2/index.js` (v2). The v2 pipeline measures text dimensions via `estimateTextDimensions()` and grows nodes with `Math.max(explicitSize, textSize + innerSep)`.

**Impact:** All `renderAutomaton()` calls now benefit from v2 features: auto-sizing, `rectangle split` shape, `xshift`/`yshift`, `scaleX`/`scaleY`, plots, and KaTeX label rendering.

---

## 2. xshift/yshift applied during positioning (not after)
**Commit:** `3c6eb46`
**Files:** `src-v2/positioning/positioning.js`, `src-v2/index.js`

**Problem:** `xshift`/`yshift` were applied in Phase 3.5 of the render pipeline, after all node positions were resolved in Phase 2. This meant a node `D: { position: { right: 'C' } }` would use C's pre-shift center, not C's final shifted position. D and C would appear misaligned vertically when C had a `yshift`.

**Fix:**
- `positioning.js`: After resolving each node's position (in topological order), immediately apply that node's `xshift`/`yshift`. Downstream nodes that reference it via relative positioning now see the shifted position.
- `index.js`: Removed the xshift/yshift lines from Phase 3.5 to prevent double-application (the style cascade copies the same values from the node config).

**TikZ behavior:** In TikZ, `xshift`/`yshift` are coordinate transforms that affect all subsequent relative placements. This fix matches that behavior.

**Coordinate convention:** `xshift` positive = right, `yshift` positive = down (SVG y-down convention, not TikZ y-up). This is unchanged — documented in the tikz-svg skill.

**Test impact:** 0 new failures (29 pre-existing failures unchanged).
