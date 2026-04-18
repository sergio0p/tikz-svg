# Must Address — Animation Project

## Resolved (2026-04-14)

1. **Positioning tests** — Fixed import `src/` → `src-v2/`. 15 tests passing.
2. **Positioning demos** — Created blind audition demo with 5 TikZ comparisons + runtime randomization.
3. **Relative positioning broken with scale** — Fixed. `nodeDistance` is now divided by `scale` before resolving, matching TikZ behavior.
4. **viewBox clipping** — Fixed. The `translate()` regex in `expandBBoxFromElement` now handles scientific notation (e.g. `-3.55e-15`), and stroke width is included in bbox computation.

## Open

### 5) Viewport stability for animation

The viewBox is computed once at the end of `emitSVG()`. Layer 1's design renders all elements upfront (later frames get `visibility: hidden`), so the viewBox is the **union of all frames**. This works for simple show/hide animations.

**Remaining concerns:**
- Early frames may look "zoomed out" because the viewBox accounts for elements that don't appear until later
- **Camera verbs** (`zoom`, `pan`, `focus`) from the vocabulary spec need to manipulate viewBox dynamically — no API for that yet
- `computeViewBox()` is internal to the emitter; not exported for reuse

**Possible fix:** A `viewBox` config option to let users lock the viewport, plus an exported `recomputeViewBox()` for the controller to call during camera transitions.

### 6) Animation Layers 2 & 3

| Layer | Status | What it does |
|-------|--------|-------------|
| 1 (DONE) | `src-v3/svg/emitter.js` | Adds `id`, `frame`, `className` to draw items. Returns `byId` map + `frameCount`. |
| 2 (NOT STARTED) | Standalone controller | Frame navigation (arrows/scroll/API) + CSS/SVG transitions for each verb |
| 3 (NOT STARTED) | Authoring agent | Reads instruction files in animation vocabulary, generates render + controller configs |

### 7) src-v3 must absorb src-v2 fixes

The viewBox fixes (scientific notation regex, stroke-width bbox, scale-aware nodeDistance) were applied to `src-v2/`. Since `src-v3/` is a copy with only the emitter differing, these fixes need to be propagated to `src-v3/` before Layer 2 work begins.
