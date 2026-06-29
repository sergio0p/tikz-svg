# Handoff — Plan 1 (structural refactor) → Plan 2 (targeted bug fixes)

**Status:** Plan 1 (`WATERCOLOR-PLAN-1-structural-refactor.md`) is **implemented and landed**
(uncommitted on `main`). Full suite green (838 tests). This file records exactly what changed
so Plan 2's *Source facts* and code snippets can be trusted again — **several of Plan 2's
line numbers and two API shapes it quotes are now stale.**

Read this before implementing any Plan 2 fix. None of Plan 1's changes *block* Plan 2; every
Plan-2 fix is still valid in intent. What changed is **where** the code lives and **two call
signatures**. Plan 2 anticipated this in its per-fix "Item-1 coordination" notes — this is the
concrete remap.

---

## 1. Two API/structure changes that invalidate Plan 2 snippets

### (a) `watercolorGroup` lost its `id` parameter — now **3-arg**
- **Was** (Plan 2 assumes): `watercolorGroup(wash, pigment, id, grain)`
- **Now** (`emitter.js:351`): `watercolorGroup(wash, pigment, grain)`

The `id` is now applied by the shared post-step `applyWashAttributes` (see §2), not inside
`watercolorGroup`. Anywhere Plan 2 writes a 4-arg call, **drop the `id` slot**:

| Plan 2 location | Plan 2 wrote | Use instead |
|---|---|---|
| Fix #2 part B (`emitter.js:170`) | `watercolorGroup(wash, stroke, undefined, grain)` | `watercolorGroup(wash, stroke, grain)` |
| Fix #3 helper (`emitter.js:289`) | `watercolorGroup(wash, pigment, id, grain, outline)` | `watercolorGroup(wash, pigment, grain, outline)` |
| Fix #3 call (`emitter.js:308`) | `watercolorGroup(wash, fill, undefined, resolveGrain(...), outline)` | `watercolorGroup(wash, fill, resolveGrain(...), outline)` |

Fix #3's `outline` is now the **4th** positional arg, not the 5th. Its `nominalAttrs`
branch logic is otherwise unchanged and still correct.

### (b) `emitDrawPath` watercolor branch now wraps washes in a `<g class="draw-path">`
- **Was** (Plan 2 *Source facts* `:673-692`): flat — each wash appended directly to
  `edgeLayer`; `let last = null; … edgeLayer.appendChild(last)`.
- **Now** (`emitter.js:727`, watercolor branch ~`736-766`): washes append to a single
  `parent = createSVGElement('g', { class: 'draw-path' })`; the wrapper (not the last leaf
  wash) is appended to `edgeLayer` and carries id/opacity/`data-use-as-bbox`/arrow-spine via
  `applyWashAttributes`.

**Impact on Fix #2 (fill-only black ribbon):** the fix is still exactly right, but **part B
attaches to the wrapper**, not `edgeLayer`. The current code is:
```js
const stroke = style.stroke ?? '#000';          // emitter.js:741 — the dead/wrong ?? Plan 2 flags is STILL here
...
if (stroke !== 'none') {                          // emitter.js:749 — the over-eager gate Plan 2 fixes is STILL here
  const wash = watercolorRibbon(d, { ...style.decoration, prng });
  parent.appendChild(watercolorGroup(wash, stroke, grain));   // note: parent, not edgeLayer; 3-arg group
}
```
Apply Fix #2 as: change `:741` to `const stroke = style.stroke;` and tighten the `:749` gate to
`if (stroke !== 'none' && (style._strokeRequested || !hasFill))`, keeping `parent.appendChild`.
The `_strokeRequested` flag in `resolvePathStyle` (Fix #2 part A) is unchanged and still the
durable piece.

> `refs.byId[pathModel.id]` now resolves to the wrapper `<g class="draw-path">` (was the last
> leaf wash `<g class="watercolor">`). Both are `<g>`; no consumer depends on which.

---

## 2. New shared post-step: `applyWashAttributes` (`emitter.js:387`)

The three early-return branches (edge / draw-path / shape-fill) now route through one helper
that applies, to a wash `<g>`: `opacity`, `className`, `id`, `data-use-as-bbox`, and an
**invisible arrow-carrying spine** (`path[data-wash-spine]`, `fill:none stroke:none`, reusing
the crisp `<marker>` defs via `marker-start`/`marker-end`).

What it deliberately does **not** port is documented in **WATERCOLOR.md §8.6** (dash/dotted,
linecap/linejoin/miterlimit, fill-rule, stroke/stroke-width). Read §8.6 before adding anything
to a wash in Plan 2 — it's the canonical list of "wash has no stroked outline, so these don't
apply."

**Shape-fill is intentionally bare:** `createShapeElement`'s watercolor branch
(`emitter.js:1132-1139`) returns `watercolorGroup(wash, fill, resolveGrain(...))` with **no**
`applyWashAttributes` (the node `<g>` wrapper already owns id/className; nodes have no
arrows/opacity/bbox flag). **This is exactly where Fix #3's `outline` plugs in** — add the 4th
arg to that call; nothing else in the branch moved semantically.

### New invariant for Plan 2 tests
- **Edges and draw-paths** now contain an invisible `path[data-wash-spine]` (the arrow
  carrier). **Shape-fill nodes do NOT** (no spine added). So:
  - Fix #3's test-safety reasoning ("exactly **one** non-bleed nominal path" in the node wash
    group) **still holds** — nodes have nominal + N bleed, no spine. Your stroked-nominal
    stopgap keeps it at one non-bleed path. ✓
  - Any Plan-2 edge/draw-path assertion that counts paths or filters by "non-bleed" must also
    exclude `[data-wash-spine]` (see how `decorations-watercolor-render.test.js` §8a and
    `decorations-watercolor-styling.test.js:57-66` do it).

---

## 3. Fix-by-fix status against the post-Plan-1 tree

| Fix | Affected by Plan 1? | Action |
|---|---|---|
| **#4** path `fill` color-normalize | No (pure `style.js`) | Apply verbatim. Orthogonal. |
| **#2** fill-only black ribbon | **Yes** — wrapper + 3-arg group | Part A unchanged; part B attaches to `parent`, drop the `id` arg, target `:741`/`:749` (see §1b). |
| **#5** grain/shadow id salt | No (logic unchanged) | Apply verbatim to `applyGrainFilters` (now `emitter.js:482`) and `collectShadowFilters` (`style.js:295`, unmoved). |
| **#3** node border stopgap | **Yes** — 3-arg `watercolorGroup` + `outline` is 4th arg | Apply with the arg shift in §1a. Branch is now `emitter.js:1132-1139`. Test-safety reasoning intact (§2). |
| **#1** grain overwrites shadow | Partly | Plan 1 did **not** absorb filter emission into the shared step — `applyGrainFilters` (`:482`) and the `emitNode`→grain two-pass are **untouched**. So take Plan 2's *"if item-1 has not landed, implement the composed-filter version"* path: it lands self-contained on `applyGrainFilters` as written. Do **not** try to fold it into `applyWashAttributes` — that helper does no filter work. |

> **Heads-up for #1 + the new edge spine (real, minor):** Plan 1's review found that for a
> directed **edge**, the spine sits *inside* the same `g.watercolor` that carries `data-grain`,
> so when grain is on, the grain filter also speckles the crisp arrow tip. Draw-paths don't
> have this (spine on the ungrained `g.draw-path` wrapper, grain on the inner leaf). If Fix #1
> reworks grain/filter structure, fixing this edge asymmetry at the same time is natural —
> otherwise it's a separate minor follow-up. Flagged to the user; **not yet fixed** in Plan 1.

---

## 4. Current line anchors (post-Plan-1, replace Plan 2's "Source facts confirmed")

```
emitter.js
  117  buildMarkerExtentMap
  169  expandBBoxFromElement            (bbox walker; skips data-bleed; recurses g.watercolor)
  351  watercolorGroup(wash, pigment, grain)        ← 3-arg now
  387  applyWashAttributes(group, opts)             ← NEW shared post-step
  428  resolveGrain
  450  buildGrainFilter
  482  applyGrainFilters(svgEl, defs, seed)         ← unchanged logic (Fix #1/#5 target)
  511  emitEdgePath           (watercolor branch ~517-531)
  727  emitDrawPath           (watercolor branch ~736-766; g.draw-path wrapper)
  741    const stroke = style.stroke ?? '#000'      ← Fix #2 part B target
  749    if (stroke !== 'none') { ribbon }          ← Fix #2 gate target
 1106  createShapeElement     (watercolor branch ~1132-1139; returns 3-arg watercolorGroup)
 1447  computeViewBox         ([data-use-as-bbox] union)

style.js
  244  resolvePathStyle       (Fix #4 + Fix #2 part A: pathColorFields :256, normalizeColors :272)
  284  collectShadowFilters   (Fix #5 shadow-id salt; id at :295)
```

Note: Plan 2's *Test landscape* line numbers in `decorations-watercolor-render.test.js` shifted
too — §8a (edge nominal-count) was updated by Plan 1 to exclude `[data-wash-spine]`. Re-grep
before quoting test line numbers; the *constraints* it describes (10 bleed + 1 nominal for the
node test, viewBox within 12px, grain-off byte-identical) are unchanged.
