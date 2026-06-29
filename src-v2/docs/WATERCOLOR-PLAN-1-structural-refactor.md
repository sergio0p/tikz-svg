# Plan 1 — Structural Refactor: route watercolor washes through a shared post-step

**Bucket:** ITEM 1 (highest leverage). Make the three watercolor early-return
branches in `src-v2/svg/emitter.js` receive the same per-element treatment the
crisp paths get — arrows, className, opacity, id, `useAsBoundingBox` — instead of
each branch silently skipping it.

All line numbers below were read from the live source (`src-v2/svg/emitter.js`,
`src-v2/decorations/watercolor.js`, `src-v2/index.js`, `src-v2/style/style.js`).

---

## 0. What I verified first (so the plan rests on facts, not the brief)

- **Edges are directed by default.** `resolveEdgeStyle` base sets `arrow:'stealth'`
  (`src-v2/style/style.js:154`); `index.js:519` then sets `style.arrowId` to a real
  marker id. So **every** watercolor edge with default style currently drops a real
  arrowhead at `emitEdgePath` (`emitter.js:466-470` returns before the `marker-end`
  code at `:485-487`). This is not a corner case — it is the common case.
- **Draw-path start arrows already carry `orient:'auto-start-reverse'`**
  (`index.js:681`). So a `marker-start` overlaid on an invisible spine points
  outward correctly with zero extra work — we reuse the exact same `<marker>` defs.
- **Shape-fill washes need *nothing* from the shared step.** The crisp shape
  element (`createShapeElement`, `:1070-1129`) never sets id/className/opacity — those
  live on the node wrapper `<g class="node" id="node-…">` built by `emitNode`
  (`:828-836`), and **nodes never apply `style.opacity` at all** (grep: opacity is
  applied only at `:496` edges, `:615` plots, `:707` draw paths — never nodes). Nodes
  have no arrows and no `useAsBoundingBox`. Therefore the `createShapeElement`
  watercolor branch (`:1048-1058`) is already correct; routing it through the shared
  step would be a pure no-op. **We will not gold-plate it** (see §5).
- **No in-repo consumer treats edge refs as `<path>`.** `refs.edges` / `refs.byId`
  are populated at `:1551-1552` (ordered) and `:1633-1634` (legacy) and read by no
  non-deprecated consumer (`deprecated/*` excluded). The external label-editor keys
  off `node-<id>` wrappers, not edge/draw-path refs. So returning a `<g>` for an edge
  (already the case today) and a wrapper `<g>` for a draw path is safe.
- **bbox walker already handles the wash shape.** `expandBBoxFromElement`
  (`:169-264`) early-returns on `data-bleed` (`:173`/`:184`), and for a
  transform-less container recurses into children (`:259-263`), measuring the
  non-bleed nominal path and propagating `markerExtents` down. So a spine path we add
  inside a wash group is measured, and its `marker-end`/`marker-start` disc is counted
  by `expandMarkerDisc` — exactly what we want for arrow-aware bounds.
- **PRNG order must be preserved.** Single shared `new SeededRandom(seed ?? 42)` at
  `:1513`; draw-path watercolor draws fill-wash first then stroke-ribbon
  (`:681-690`). Any restructure must keep that call order so deformed `d` strings stay
  byte-identical (determinism tests at watercolor-render `:61-69`, `:134-142`).

---

## 1. New shared helper: `applyWashAttributes(group, o)`

**File:** `src-v2/svg/emitter.js`, inserted immediately after `watercolorGroup`
(i.e. after current `:363`), in the same "Watercolor" section.

**Signature & behaviour:**

```js
/**
 * Apply to a watercolor wash <g> (a single leaf group, or a parent wrapping
 * several) the same per-element treatment the crisp branches apply after they
 * build their <path>: opacity, className, id, useAsBoundingBox, and overlaid
 * arrow tips. Mirrors emitEdgePath/emitDrawPath crisp code so washed and crisp
 * output stay consistent.
 *
 * Intentionally NOT applied to a wash (documented, not implemented — see §6):
 *   - stroke-dasharray / dotted / dashed  (a wash has no stroked outline)
 *   - stroke-linecap / -linejoin / -miterlimit (resolveStrokeAttrs) (no stroke)
 *   - fill-rule (the deformed layer fills use the default nonzero rule)
 *   - stroke / stroke-width (pigment is a fill, not a stroke)
 *
 * @param {SVGGElement} group
 * @param {Object} o
 * @param {string}  [o.spine]          - original (pre-deformation) path 'd' for markers
 * @param {string}  [o.markerStartId]
 * @param {string}  [o.markerEndId]
 * @param {number}  [o.opacity]
 * @param {string}  [o.className]
 * @param {string}  [o.id]
 * @param {boolean} [o.useAsBoundingBox]
 * @returns {SVGGElement} group
 */
function applyWashAttributes(group, o = {}) {
  // Opacity: group-level so it cascades to every bleed layer AND the markers,
  // matching `attrs.opacity = style.opacity` in the crisp branches (:496/:707).
  if (o.opacity != null && o.opacity < 1) group.setAttribute('opacity', o.opacity);

  if (o.className) group.classList.add(o.className);
  if (o.id) group.setAttribute('id', o.id);

  // useAsBoundingBox: tag the group; computeViewBox's [data-use-as-bbox] query
  // (:1371) selects it, and expandBBoxFromElement recurses past data-bleed to
  // the nominal outline + spine marker disc.
  if (o.useAsBoundingBox) group.setAttribute('data-use-as-bbox', '1');

  // Arrow tips: an invisible spine reusing the crisp <marker> defs. orient=auto
  // (and auto-start-reverse for starts, set in index.js:681) places the tip at
  // the spine endpoint angled along the centerline tangent — exactly where a
  // crisp tip would land (the spine is the same shortened path the crisp branch
  // would stroke). data-wash-spine marks it so structural tests can exclude it.
  if (o.spine && (o.markerStartId || o.markerEndId)) {
    const a = { d: o.spine, fill: 'none', stroke: 'none', 'data-wash-spine': '1' };
    if (o.markerStartId) a['marker-start'] = `url(#${o.markerStartId})`;
    if (o.markerEndId)   a['marker-end']   = `url(#${o.markerEndId})`;
    group.appendChild(createSVGElement('path', a));   // appended last → tip paints on top
  }
  return group;
}
```

**Why a spine, not a filled arrow:** reusing the existing `<marker>` defs (built
unconditionally in `buildDefs`, `:276-307`) keeps color, size, tip geometry and
orientation identical to the crisp edge for free, and stays faithful to library
idioms. The marker is drawn at the spine vertex regardless of `stroke:none` in all
target browsers; this is the one thing to confirm in headless-Chrome (§8).

**Ordering inside the group:** nominal path, then bleed layers (both from
`watercolorGroup`), then the spine appended last — so the crisp arrowhead paints
on top of the translucent ribbon.

---

## 2. `watercolorGroup` — drop the now-redundant `id` param

**File/loc:** `emitter.js:352-363`.

Id now flows through `applyWashAttributes` (edges) or onto the wrapper (draw
paths), so the `id` parameter on `watercolorGroup` becomes dead. Remove it for
clarity; keep `grain` tagging exactly as is (grain stays a `watercolorGroup`
concern so grain-off output is untouched).

New signature: `watercolorGroup(wash, pigment, grain)`; delete the
`if (id) g.setAttribute('id', id)` line (`:360`). Update the JSDoc `@param`.

This touches all three call sites (§3, §4, §5) — all are being edited anyway.

> **Low-stakes alternative** if minimizing diff is preferred: keep the `id` param,
> pass `undefined` from every call site. I recommend removal; it is cleaner and the
> ripple is contained.

---

## 3. `emitEdgePath` — route edges through the shared step

**File/loc:** `emitter.js:460-513`. Replace the early-return block `:466-470` with:

```js
if (style.decoration && style.decoration.type === 'watercolor' && prng) {
  const pigment = style.stroke ?? DEFAULTS.edgeColor;
  const wash = watercolorRibbon(path, { ...style.decoration, prng });
  const group = watercolorGroup(wash, pigment, resolveGrain(style.decoration));
  return applyWashAttributes(group, {
    spine: path,                 // edge.path is already arrow-shortened in the geometry phase
    markerEndId: style.arrowId,  // edges only ever carry an end arrow (single arrowId)
    opacity: style.opacity,      // :496-498 parity
    className: style.className,   // :504-506 parity
    id: edge.id,                 // :508-510 parity
  });
}
```

Notes:
- `path` here is `edge.path` (the watercolor branch skips `morphPath`, so `path`
  is the untouched spine). It is the same shortened spine the crisp branch would
  stroke, so the `marker-end` lands at the correct shortened endpoint/angle.
- Return type is still a `<g>` (unchanged from today). The JSDoc at `:457-459` says
  `@returns {SVGPathElement}` but already lies for the watercolor case — **update the
  JSDoc to `{SVGPathElement|SVGGElement}`** and add one line noting the watercolor
  case returns a `<g class="watercolor">` whose stable hooks are `id` (set here) and
  the inner `data-wash-spine` path (carries the edge `d` + markers). No embedded
  spine-as-`refs` shim is needed because no consumer reads edge refs as paths (§0);
  the `data-wash-spine` path doubles as the path-oriented hook if one ever does.

---

## 4. `emitDrawPath` — wrap washes + route through the shared step

**File/loc:** `emitter.js:667-724`. Replace the watercolor branch `:673-692` with a
wrapper-based construction; leave the crisp `else` (`:693-723`) untouched.

```js
let pathEl;
if (style.decoration && style.decoration.type === 'watercolor' && prng) {
  // Wrap fill wash + stroke ribbon in ONE id-bearing parent so id/opacity/
  // className/useAsBoundingBox/arrows attach uniformly to multi-group output.
  const parent = createSVGElement('g', { class: 'draw-path' });
  const hasFill = style.fill && style.fill !== 'none';
  const stroke = style.stroke ?? '#000';
  const grain = resolveGrain(style.decoration);

  // PRESERVE ORDER: fill wash first, stroke ribbon second (PRNG determinism).
  if (hasFill) {
    const wash = watercolorLayers(d, { ...style.decoration, prng, closed: true });
    parent.appendChild(watercolorGroup(wash, style.fill, grain));
  }
  if (stroke !== 'none') {
    const wash = watercolorRibbon(d, { ...style.decoration, prng });
    parent.appendChild(watercolorGroup(wash, stroke, grain));
  }

  applyWashAttributes(parent, {
    spine: (arrowStartId || arrowEndId) ? d : undefined, // markers iff arrows (crisp attaches regardless of stroke)
    markerStartId: arrowStartId,
    markerEndId: arrowEndId,
    opacity: style.opacity,            // :707-709 parity
    id: pathModel.id,                  // fixes id-only-on-stroke-group bug (:721)
    useAsBoundingBox: pathModel.useAsBoundingBox,  // fixes dropped bbox flag (:722)
  });
  // NOTE: crisp draw path hardcodes class:'draw-path' and does NOT add
  // style.className (:699); parity = the 'draw-path' class only. Intentional.

  edgeLayer.appendChild(parent);
  pathEl = parent;
} else {
  /* …unchanged crisp branch :694-723… */
}
```

Consequences (all benign, verified):
- DOM gains one level for washed draw paths: `edge-layer > g.draw-path > g.watercolor`.
  All existing selectors are descendant-combinator (`:160`, `:175`) or class-on-path
  (`:166` matches a `<path>`, not the `g.draw-path` wrapper) → unaffected.
- `refs.byId[pathModel.id]` now resolves to the wrapper `<g>` (was the last leaf
  wash). Both are `<g>`; no consumer depends on which (§0).
- `useAsBoundingBox`: tagging the **wrapper** (not a single nominal) means the
  walker unions every nominal + the spine marker disc → bounds cover brush width +
  arrow tips, exclude bleed. This is why I tag the wrapper rather than the nominal
  path the brief suggested: it is the only element that sees both nominals *and* the
  markers. (Brief's nominal-only tagging would omit the arrow extent.)

---

## 5. `createShapeElement` — minimal change, by design

**File/loc:** `emitter.js:1048-1058`. **Only** change: adapt to the new
`watercolorGroup(wash, pigment, grain)` signature (drop the `undefined` id arg at
`:1056`). **No** `applyWashAttributes` call — per §0 the node wrapper already owns
id/className and nodes apply neither opacity nor arrows nor `useAsBoundingBox`.
Adding the shared step here would be a no-op and is deliberately omitted (anti
gold-plating). State this explicitly in the commit message and a one-line code
comment so a future reader doesn't "fix" the asymmetry.

---

## 6. Features intentionally NOT applied to a wash (document, do not implement)

In the `applyWashAttributes` JSDoc (§1) and `src-v2/docs/WATERCOLOR.md` (§8.x where
the wash group is described), record:
- `stroke-dasharray` / `dotted` / `dashed` (`resolveStrokeDash`, style.js:38-43):
  a wash has no stroked outline to dash.
- `stroke-linecap` / `-linejoin` / `-miterlimit` (`resolveStrokeAttrs`, style.js:50-65):
  no stroke.
- `fill-rule`: the deformed layer fills rely on default nonzero; not surfaced.
- `stroke` / `stroke-width`: pigment is a fill, not a stroke.

These are decisions, not omissions — they keep the wash faithful to the watercolor
model rather than half-porting stroke semantics that have no visual meaning on a wet
fill.

---

## 7. Ordering / interaction with the grain post-pass & bbox rule

- **Emit time** (`emitEdgePath`/`emitDrawPath`/`createShapeElement`): build wash via
  `watercolorGroup` (tags `data-grain` when grain on), then `applyWashAttributes`
  (adds spine/markers/id/className/opacity/`data-use-as-bbox`). The spine is added
  *before* the grain pass runs.
- **`applyGrainFilters`** (`:433-449`, called at `:1600` ordered / `:1680` legacy)
  queries `g.watercolor[data-grain]` and sets `filter=`. It is unaffected by the
  wrapper (it targets the leaf `g.watercolor`) and by the spine (an invisible child).
  Grain-off path emits no filter and adds nothing → **grain output stays
  byte-identical when off** (the spine is only added when arrows exist, an orthogonal
  condition; arrowless washes are byte-identical except for the new wrapper level on
  draw paths, which is a structural-refactor change, not a grain change).
- **`computeViewBox`** (`:1364`): `[data-use-as-bbox]` (`:1371`) now also matches the
  draw-path wrapper; the recursive walk reaches nominal + spine, skips bleed. The
  default walk (`:1386-1390`) iterates layer children → the wrapper/leaf → recursion.
  `buildMarkerExtentMap` (`:117`) already indexes the reused markers, so the spine's
  marker disc is counted via `expandMarkerDisc` (`:151-160`).

---

## 8. Tests

Run with `node --test`. jsdom validates DOM/attributes only; visuals go to
headless-Chrome (§9).

### 8a. Modify existing — `test/decorations-watercolor-render.test.js`
- **Lines 116-118 (edge "exactly one nominal path"):** `edgeConfig` (`:96-103`) has
  no `arrow` key, so it inherits default `arrow:'stealth'` → it now gets a spine
  path. Update the nominal filter to also exclude the spine:
  `[...g.querySelectorAll('path')].filter(p => !p.hasAttribute('data-bleed') && !p.hasAttribute('data-wash-spine'))`,
  keeping `nominal.length === 1`. (Add a sibling assert: exactly one
  `path[data-wash-spine]`.) No other assertion in that file changes — `:131`
  (`stroke="#aa3322"` count 0) holds because the spine is `stroke:none`.

### 8b. New file — `test/decorations-watercolor-styling.test.js`
Mirror the existing file's jsdom bootstrap (`:1-15`). Assert:

**Edges**
1. *Arrowhead overlaid*: washed directed edge → the `.edge-layer g.watercolor` has
   exactly one `path[data-wash-spine]` with `marker-end="url(#…)"`, `fill="none"`,
   `stroke="none"`, and its `d` equals the edge spine.
2. *No arrow when undirected*: same edge with `arrow:'none'` → zero
   `path[data-wash-spine]`.
3. *id parity*: `edge` with `id:'e1'` → `g.watercolor#e1` (single hook).
4. *className parity*: `className:'hot'` → `g.watercolor.hot`.
5. *opacity parity*: `opacity:0.4` → wash `g` has `opacity="0.4"`; crisp control with
   same opacity also has it (consistency, not equality of structure).
6. *bbox includes arrow*: viewBox width of a washed directed edge ≥ viewBox width of
   the same edge with `arrow:'none'` by ≈ marker radius (arrow extent counted).

**Draw paths**
7. *Wrapper + id*: washed path with `id:'p1'`, `arrow:'<->'` →
   `.edge-layer g.draw-path#p1`; inside it a `path[data-wash-spine]` with both
   `marker-start` and `marker-end`.
8. *filldraw single id over both washes*: `cycle:true, fill, stroke, id:'fd'` →
   exactly one `g.draw-path#fd` containing two `g.watercolor` (one per pigment) — the
   id-on-fill-group bug is gone.
9. *opacity on wrapper*: `opacity:0.5` → `g.draw-path[opacity="0.5"]`.
10. *useAsBoundingBox*: washed path with `useAsBoundingBox:true` →
    `g.draw-path[data-use-as-bbox]`, and the computed viewBox tracks the crisp
    `useAsBoundingBox` path within ≈ brush half-width (reuse the `vbWidth` helper /
    tolerance pattern of `:184-198`).
11. *No spine without arrows*: arrowless washed path → zero `path[data-wash-spine]`.

**Shapes (regression / no-op confirmation)**
12. Washed node fill: `g.watercolor` still carries **no** `id`/`className`/`opacity`;
    the node wrapper `g.node#node-q0` still carries id + className. Confirms §5.

**Determinism / grain unchanged**
13. Re-render a directed washed edge twice with fixed seed → identical
    `path[data-wash-spine]` `d` and identical `path[data-bleed]` `d` list.
14. Grain-off: arrowless washed node → no `defs filter feTurbulence`, no `filter`
    attr, no `data-grain` (already covered at `:201-210`; add the same assertion for a
    directed washed edge to lock "spine doesn't trigger grain").

### 8c. `test/draw-paths.test.js` — no change expected
Its `emitDrawPath`/`render` cases (`:169-256`) are all crisp and query `.draw-path`
as a `<path>`; the crisp branch is untouched. Run to confirm green.

---

## 9. Verification sequence

1. `node --test` — full suite must stay green (target 824 + the new file).
   Specifically re-run `test/decorations-watercolor-render.test.js`,
   `test/decorations-watercolor-styling.test.js`, `test/draw-paths.test.js`,
   `test/draw-order.test.js`, `test/scale-zoom.test.js` (the last queries
   `.edge-layer path, .draw-layer path` at `:139-140` — confirm crisp still matches).
2. Headless-Chrome visual (jsdom can't render markers/filters). Serve the repo and
   screenshot a page exercising: directed watercolor edge, `\draw[<->]` watercolor
   path, filldraw watercolor path, and a `useAsBoundingBox` watercolor path.
   ```
   npx http-server /Users/sergiop/Dropbox/Scripts/tikz-svg -p 8080 -c-1 &
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless=new --disable-gpu --force-device-scale-factor=2 \
     --screenshot=/private/tmp/.../scratchpad/wc-arrows.png \
     --window-size=1000,800 "http://127.0.0.1:8080/examples-v2/<demo>.html"
   ```
   Confirm: (a) crisp arrowhead sits at the ribbon tip, correct angle, correct
   color; (b) `stroke:none` spine still renders the marker (the one real risk — if a
   renderer drops it, fallback: give the spine `stroke:transparent` + the real
   `stroke-width`); (c) opacity dims ribbon+tip together; (d) `useAsBoundingBox` crop
   matches the crisp version; (e) grain still reads as one continuous sheet.
3. Determinism: render twice, diff `outerHTML` of the edge/draw layers → identical.

---

## 10. Sequenced task list for the implementer
1. Add `applyWashAttributes` (§1) + trim `watercolorGroup` id param (§2).
2. Rewire `emitEdgePath` (§3).
3. Rewire `emitDrawPath` (§4).
4. Adapt `createShapeElement` call site only (§5).
5. Update `emitEdgePath` JSDoc return type + WATERCOLOR.md "not applied" note (§6).
6. Update existing edge nominal-count test (§8a).
7. Add `test/decorations-watercolor-styling.test.js` (§8b).
8. `node --test`; fix; then headless-Chrome pass (§9).

---

## 11. Risks & OPEN DECISIONS for the user

**Risk — marker on `stroke:none` spine.** Standards say markers render regardless of
stroke and Chromium/Firefox/WebKit do, but this is the one behavior jsdom can't
prove. Mitigated by the §9 visual check; documented fallback is a transparent
stroke. Low but non-zero.

**OPEN DECISION 1 — draw-path id strategy.** I chose a single id-bearing wrapper
`<g class="draw-path">` over suffixing ids (`p1-fill` / `p1-stroke`). Wrapper gives
one clean `refs.byId` hook and one place for opacity/bbox/markers; suffixing keeps a
flatter DOM but yields two ids ambiguous for `refs.byId`. Confirm wrapper is
acceptable (it adds one nesting level to washed draw paths).

**OPEN DECISION 2 — edge return-type contract.** I keep returning the wash `<g>` and
just fix the JSDoc + lean on the `data-wash-spine` inner path as the path hook (no
separate embedded-spine shim, since no consumer reads edge refs as paths). If you
foresee an external consumer iterating `refs.edges` expecting `<path>.getAttribute('d')`,
say so and I'll add a stable spine-as-primary hook instead.

**OPEN DECISION 3 — `watercolorGroup` id param.** Remove (recommended) vs keep-and-
pass-undefined. Confirm removal is fine.
