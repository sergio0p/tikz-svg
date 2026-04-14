# Must Address Issues

## 1) Positioning tests in src-v2

**Tests exist but are broken.** There's a file `test/positioning.test.js` with 14 tests (5 for `parsePositionSpec`, 9 for `resolvePositions`) covering directions, chaining, cycle detection, and distance overrides. However, the import points to the now-deleted `src/` directory:

```js
import { resolvePositions, parsePositionSpec } from '../src/positioning/positioning.js';
```

Since `src/` files show as deleted in git status, these tests will fail at import time. They need to point to `../src-v2/positioning/positioning.js`. The test coverage itself is decent — it covers the core cases — but it's dead code right now.

## 2) Demos using the positioning library

**Only `renderAutomaton` demos use relative positioning.** Five demos exercise it: `turing-compare.html`, `example6-turing.html`, `tikz-diamond.html`, `example5-orange-shadow.html`, `example4-blue-styled.html` — all via `renderAutomaton()` with patterns like `'above right': 'q0'`.

**No `render()` demo uses relative positioning.** The general demos (`economics-demo.html`, `draw-paths-demo.html`, `node-properties-demo.html`) all use absolute `{x, y}` coordinates. This means the positioning system has never been visually verified through the `render()` + `config.draw` path in any demo.

## 3) Relative positioning broken (BUGREPORT.md)

The bug report confirms it. The issue: when using relative positioning in `config.draw` nodes, the default `nodeDistance: 90` (pixels) doesn't account for the `scale` factor. With `scale: 65`, the 90px offset translates to ~1.4 scaled units — which is enormous. The auto-computed viewBox expands to fit these far-flung nodes, causing the whole diagram to "shrink dramatically."

This is a **scale-awareness problem**, not a positioning algorithm bug. The positioning math is correct in isolation — it just operates in pixel space while the rest of the pipeline uses scaled coordinates. The suggested fixes in the bug report are:

1. Make `nodeDistance` scale-aware
2. Add a `viewBox` config option to let users lock it
3. Prevent viewBox recalculation after async KaTeX rendering (a secondary issue)

There's also a KaTeX async complication: KaTeX label rendering happens after `render()` returns and can overwrite the viewBox, requiring a `setTimeout(500)` workaround.

## 4) Animation project location and status

The animation project lives across several locations:

| Location | Contents |
|----------|----------|
| `src-v3/` | Full copy of src-v2 + animation metadata in emitter |
| `test-v3.html` | Working test of frame properties |
| `Animation/` | Vocabulary spec, cheatsheet, pipeline doc, e510 algorithms |
| `docs/plans/2026-04-10-animation-layer-design.md` | Three-layer architecture |
| `docs/guides/tikz-to-src-v3-animation-howto.md` | Practical conversion guide |

**Architecture:** Three independent layers:
- **Layer 1 (DONE):** `src-v3/svg/emitter.js` adds `id`, `frame`, `className` to draw items. Returns `byId` map + `frameCount`. Frame syntax is Beamer-compatible (`'1-'`, `'2-4'`).
- **Layer 2 (NOT STARTED):** Standalone controller for frame navigation + CSS/SVG transitions.
- **Layer 3 (NOT STARTED):** Authoring agent that reads instruction files and generates configs.

The `src-v3/` directory is otherwise identical to `src-v2/` — only the emitter differs.

## 5) Viewport changing when adding elements

**This is a real concern for animation.** The viewBox is computed exactly **once** at the end of `emitSVG()`, by scanning all rendered SVG elements. It is never recomputed automatically.

**The problem for animation:**
- If you render frame 1 (only some elements visible), the viewBox fits frame 1's elements
- When frame 2 elements appear (via visibility toggle), they may extend beyond the viewBox and be **clipped**
- Conversely, if you render ALL elements upfront (all frames), the viewBox encompasses everything — but then frames with fewer elements will have excessive whitespace

**The good news:** The Layer 1 design already mitigates this partially — all elements are rendered in the initial `render()` call (just with `visibility: hidden` on later frames). So the viewBox WILL encompass all frames' elements. But this means:

1. **The viewBox will be the union of all frames** — early frames may look "zoomed out" because they account for elements that don't appear until later
2. **Camera verbs (`zoom`, `pan`, `focus`)** from the vocabulary spec will need to manipulate viewBox dynamically — and there's no API for that yet
3. The `computeViewBox()` function is internal to the emitter; it's not exported for reuse

**Practical impact:** For simple show/hide animations, the current approach works (render everything, toggle visibility). For camera moves or diagrams that grow significantly across frames, you'll need either a `recomputeViewBox()` API or a fixed viewBox config option — which circles back to the same fix suggested in the bug report (issue 3).

## Summary of connections

Issues 3 and 5 are directly related — both stem from the viewBox being computed once from rendered geometry with no user override. A `viewBox` config option would solve both the scale-aware positioning problem (lock the viewport) and the animation viewport stability problem (prevent frame-to-frame viewport jumps). The broken test imports (issue 1) and missing `render()` demos (issue 2) are independent but should be fixed to validate any positioning changes.
