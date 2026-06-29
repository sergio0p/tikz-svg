# Plan — Item 2: Targeted, Lower-Risk Watercolor Bug Fixes (src-v2)

Repo: `/Users/sergiop/Dropbox/Scripts/tikz-svg`
Scope: five discrete, individually-landable bug fixes in the src-v2 watercolor
decoration. Each section is self-contained. **Do not implement here — this is the plan.**

All line numbers verified against current source on `main`.

> ⚠️ **STALE AFTER PLAN 1.** The structural refactor (`WATERCOLOR-PLAN-1-structural-refactor.md`)
> has since landed. It changed `watercolorGroup` to **3-arg** `(wash, pigment, grain)`, wrapped
> the `emitDrawPath` watercolor branch in a `<g class="draw-path">`, added the shared
> `applyWashAttributes` post-step + a `data-wash-spine` invariant, and shifted most line numbers
> below. **Read `WATERCOLOR-PLAN-2-HANDOFF.md` first** — it remaps every affected fix, snippet,
> and anchor. The *intent* of all five fixes is unchanged; only the call shapes and locations moved.

---

## Source facts confirmed (read before trusting any kink)

- `watercolorGroup(wash, pigment, id, grain)` — `src-v2/svg/emitter.js:352-363`. Emits
  `<g class="watercolor">` with one **nominal** path (`fill:none, stroke:none`, no
  `data-bleed`) + N **bleed** layer paths (`fill:pigment, fill-opacity, data-bleed='1'`).
  Tags the group `data-grain` when grain is set.
- `applyGrainFilters(svgEl, defs, seed)` — `emitter.js:433-449`. Per-call fresh
  `byParams` Map; `id = wc-grain-${byParams.size}` (**:442**); **unconditionally**
  `g.setAttribute('filter', url(#id))` (**:446**) — clobbers any prior filter.
- Shadow wiring: `style._shadowFilterId` set in `collectShadowFilters`
  (`src-v2/style/style.js:284-300`, id `shadow-${seen.size}` at **:295**); applied in
  `emitNode` at **:891-893** (multipart outline) and **:898-899** (single fill) via
  `shapeEl.setAttribute('filter', url(#shadow))`.
- `emitDrawPath` watercolor branch — `emitter.js:673-692`. `hasFill = style.fill &&
  style.fill !== 'none'` (**:677**); `const stroke = style.stroke ?? '#000'` (**:678**,
  dead `??`); fill wash gated on `hasFill` (**:681**); ribbon gated on `stroke !== 'none'`
  (**:686**).
- `resolvePathStyle` — `style.js:244-274`. `base.stroke = DEFAULTS.pathColor`
  (`#000000`); `base.fill='none'`; `pathColorFields = ['stroke']` (**:256**) → used by
  BOTH `spreadColor` (color shorthand) and `normalizeColors` (**:272**). `fill` is
  normalized by **neither**.
- `createShapeElement` watercolor branch — `emitter.js:1048-1057`. Paints fill wash only;
  `return`s at :1056; never emits the resolved `stroke` (:1030). For `fill:'none'` it
  falls through (`:1058`) to the crisp `switch` (`:1069+`) which **does** stroke — so the
  accepting inner ring (`:907`, `fillOverride:'none'`) already renders crisp + stroked.
- **bbox walker** `expandBBoxFromElement` / inner `measureChild` — `emitter.js:169-264`.
  Skips `data-bleed` (**:173, :184**). For a transformed node `<g>`, `measureChild`
  measures `circle/ellipse/rect/foreignObject/path` and **recurses ONLY into
  `<g class="watercolor">`** (**:213-217**). A plain `<g>` wrapper is NOT recursed →
  its contents vanish from the bbox.
- `createShapeElement` callers: `emitter.js:897` (single), `:907` (accepting inner). Both
  set the shadow filter on the returned element.
- Path model carries the resolved style verbatim: `index.js:642,704-712` →
  `pathModel.style` → destructured in `emitDrawPath` (`:668`). Any flag added to the
  resolved style reaches `emitDrawPath`.

### Test landscape (what constrains us)
- `test/decorations-watercolor-render.test.js`:
  - L36-44: first `.node-layer g.watercolor` must have exactly **10 bleed** + **1
    non-bleed nominal** (`fill==='none'`). The node uses `fill:'#cc4444'` **and the
    default visible stroke** — so any border fix that adds a *second non-bleed path under
    the same group* breaks this.
  - L57-58: `.node-layer circle` count must be 0 (no native `<circle>`).
  - L71-86: washed viewBox width within 12px of crisp (border/stroke must not balloon).
  - L201-297: grain on/off; **off must be byte-identical** (no filter attr, no leftover
    `data-grain`); dedup by params; seed from `config.seed`. **No test hardcodes a grain
    id string** — ids are read dynamically (L221-223, L271).
- `test/decorations-watercolor.test.js`: pure geometry module — untouched by all 5 fixes.
- `test/color-shorthand.test.js` L96-110 (**paths**): `color` → `stroke` only; **fill is
  not asserted** (plots L78-94 DO assert `fill` stays `none`). Nodes (L17-60) intentionally
  spread color→fill.
- `test/draw-paths.test.js` L111-113: `resolvePathStyle` defaults `stroke '#000000' /
  width 1.5 / fill 'none'` (field asserts, not deep-equal — extra props OK). Crisp
  `emitDrawPath` tests pass explicit `style` objects (no decoration) → crisp branch only.
- `grep` confirms **no** test hardcodes `shadow-N` or `wc-grain-N` literals.

---

## Recommended landing order (low-risk → high-risk)

1. **Fix #4** — path `fill` color normalization (1-line, style.js)
2. **Fix #2** — fill-only path black ribbon (style.js flag + emitDrawPath gate)
3. **Fix #5** — grain filter id collision across renders (id salt)
4. **Fix #3** — watercolor node border stopgap (watercolorGroup `outline` param)
5. **Fix #1** — paper-grain overwrites drop-shadow (compose single filter)

Fixes #4, #2, #3 are fully independent of the item-1 structural refactor. Fix #5 should
land **before/with** #1 (the composed shadow+grain filter reuses the same salt). Fix #1
(and to a lesser extent #3) are **cleaner after item-1** — see per-fix coordination notes.

---

## Fix #4 — Path `fill` pigment not color-normalized (MINOR)

**File/function:** `src-v2/style/style.js` → `resolvePathStyle` (`:244-274`).

**Cause:** `pathColorFields = ['stroke']` (`:256`) omits `fill`, so
`fill:'red!50!blue'` (TikZ mix) and TikZ-only color names reach the DOM verbatim and
render black/invalid. Affects **both** crisp path fills and watercolor fill-wash pigment
(both route through `resolvePathStyle`).

**Exact change (decoupled-list — recommended):** keep the color-shorthand spread on
`['stroke']` (so `color=` on a path still sets stroke only, matching the path/plot
convention — see `color-shorthand.test.js` L78-110), but normalize both fields:

```js
const pathColorFields = ['stroke'];              // spreadColor: color → stroke only
const pathNormalizeFields = ['stroke', 'fill'];  // resolveColor: normalize both
// ...spreadColor calls keep using pathColorFields...
normalizeColors(merged, pathNormalizeFields);    // was: normalizeColors(merged, pathColorFields)
```

**Why decoupled, not the single-list suggestion:** adding `fill` to the one shared
`pathColorFields` (as the kink note proposes, "like nodeColorFields") also routes `fill`
through `spreadColor`, so `paths:[{color:'red'}]` would *fill* the path red. That changes
path semantics (TikZ `color=` is the draw color), and would make `hasFill` true in
`emitDrawPath` → a spurious fill wash. `color-shorthand.test.js` paths block (L96-110)
checks stroke only so it wouldn't fail, but the behavior change is undesirable and would
interact badly with fix #2. The decoupled list fixes the bug with zero semantic drift.

**Regression risk:** very low. `normalizeColors` is a no-op on already-valid hex
(`#66aa44` → `resolveColor` returns it unchanged). The only behavior change is that
previously-broken mixed/named fills now resolve correctly (crisp + watercolor).

**Test to add** (`test/decorations-watercolor-render.test.js`, new `describe`):
- `render` a path `{points:[...], cycle:true, fill:'red!50!blue', decoration:{type:'watercolor',layers:6}}`;
  assert every `.edge-layer g.watercolor path[data-bleed]` `fill` is the resolved
  mixed hex (`resolveColor('red!50!blue')`), not the literal string.
- Crisp regression: `render` the same path **without** decoration; assert
  `path.draw-path` `fill` equals the resolved hex (proves crisp fills fixed too).
- Add to `test/color-shorthand.test.js` paths block: `paths:[{color:'#268bd2'}]` →
  assert `s.fill === 'none'` (locks in that `color` does NOT spread to fill — guards the
  decoupled choice against regression).

**Verification:** jsdom (DOM attr assertions) — no visual step needed.

**Item-1 coordination:** none. Pure style resolution; orthogonal to the emit refactor.

---

## Fix #2 — Fill-only watercolor `\draw` paints an unwanted black ribbon (MINOR / footgun)

**Files/functions:** `src-v2/style/style.js` → `resolvePathStyle` (add flag); `src-v2/svg/emitter.js`
→ `emitDrawPath` watercolor branch (`:677-692`).

**Cause:** `resolvePathStyle` always injects `stroke = DEFAULTS.pathColor` (`#000000`).
`emitDrawPath` gates the ribbon wash on `stroke !== 'none'` (`:686`) — never false for a
fill-only path — so a fill-only watercolor path gets a ~width/2 black ribbon over its fill.
Fill itself uses the correct explicit-presence test (`hasFill`, `:677`); stroke has no
equivalent "was it requested" signal.

**Exact change — part A (style.js, capture intent across full cascade):** the spread
results already fold in `color=` shorthand (spreadColor sets `.stroke` from `.color`), so a
single presence check across the three spread layers captures stroke, pathStyle, group,
named-style, and color shorthand:

```js
const pathStyleS    = spreadColor(registry.expand(config.pathStyle || {}), pathColorFields);
const groupStyleS   = spreadColor(resolveGroupStyle(config.groups, 'paths', pathIndex, registry), pathColorFields);
const expandedProps = spreadColor(registry.expand(pathProps), pathColorFields);
const merged = { ...base, ...pathStyleS, ...groupStyleS, ...expandedProps };
merged._strokeRequested =
  pathStyleS.stroke !== undefined ||
  groupStyleS.stroke !== undefined ||
  expandedProps.stroke !== undefined;
```
(Reuse the existing locals; only add the `_strokeRequested` line. Keep variable names as in
current source — shown renamed here only for clarity.)

**Exact change — part B (emitDrawPath, gate the ribbon + drop dead `??`):**
```js
const hasFill = style.fill && style.fill !== 'none';
const stroke = style.stroke;                 // was: style.stroke ?? '#000'  (dead + wrong literal)
const grain = resolveGrain(style.decoration);
let last = null;
if (hasFill) { /* fill wash — unchanged */ }
// Ribbon only when a stroke was actually requested, OR there is no fill (bare line).
if (stroke !== 'none' && (style._strokeRequested || !hasFill)) {
  const wash = watercolorRibbon(d, { ...style.decoration, prng });
  last = watercolorGroup(wash, stroke, undefined, grain);
  edgeLayer.appendChild(last);
}
```

Rule rationale: a bare line (`points` only, no fill, no explicit stroke) is the common
`\draw` case and must still wash with the default stroke (`!hasFill` keeps it). A
fill-only path (`fill` set, no stroke requested) suppresses the ribbon (the fix). A
filldraw (fill + stroke) gets both.

**Regression risk:** low.
- `decorations-watercolor-render.test.js` L156-198 paths all set an **explicit** stroke →
  `_strokeRequested` true → ribbon unchanged.
- L169-182 filldraw: fill + explicit stroke → both groups, 2 pigments → unchanged.
- L258-288 grain dedup: paths are **fill-only** (`fill` + `cycle`, no stroke). Today they
  emit fill wash + black ribbon (2 grained groups each); after the fix only the fill wash.
  Those tests count `feTurbulence` filters / `refs.size` (not group count) → **still
  pass** (1 filter / 1 ref for same params; 2 for distinct). No test asserts a fill-only
  path's ribbon exists.
- Adding `_strokeRequested` to the resolved style is an extra property; `draw-paths.test.js`
  L111-113 uses field asserts, not deep-equal → unaffected. Crisp branch (`:694-723`)
  untouched → crisp path behavior unchanged (as required).

**Test to add** (`test/decorations-watercolor-render.test.js`):
- Fill-only path `{points, cycle:true, fill:'#66aa44', decoration:{type:'watercolor',layers:8}}`:
  assert exactly **one** `.edge-layer g.watercolor`; assert no bleed path has the default
  black pigment (`#000000`); pigment set is exactly `{'#66aa44'}`.
- Explicit `stroke:'none'` + fill: assert still one group, no ribbon.
- Bare line `{points, decoration:{type:'watercolor'}}` (no fill, no stroke): assert one
  ribbon group, pigment = default `#000000` (default-stroke line still washes).
- Filldraw regression: re-assert the existing two-group expectation.

**Verification:** jsdom (group count + pigment assertions capture the "no black ribbon"
outcome). Optional headless-Chrome spot check on `examples-v2/watercolor-fillstroke-audition.html`.

**Item-1 coordination:** the `_strokeRequested` flag lives in style resolution and is
stable. If item-1 routes the 3 branches through a shared post-step, the **gate condition**
should migrate into that shared step (same boolean). No conflict; the flag is the durable
piece.

---

## Fix #5 — Grain (and shadow) filter id collide across `render()` calls in one document (MINOR)

**File/function:** `src-v2/svg/emitter.js` → `applyGrainFilters` (`:433-449`); optionally
`src-v2/style/style.js` → `collectShadowFilters` (`:295`).

**Cause:** `id = wc-grain-${byParams.size}` with a fresh per-call Map mints `wc-grain-0`
for every `render()`. Two renders into the **same document** (different `svgEl`s) both emit
`wc-grain-0` → duplicate id; the 2nd SVG's `url(#wc-grain-0)` resolves to the **1st**
SVG's filter (document-order first match) → wrong grain when params differ. Re-rendering
the **same** `svgEl` is safe (defs are cleared+rebuilt). The identical latent pattern
exists for `shadow-${seen.size}`.

**Exact change (recommended — render-unique salt, deterministic-enough, dedup preserved):**
add a module-level monotonic counter and namespace the per-render index:
```js
let _grainSalt = 0;                              // module scope
// inside applyGrainFilters, after the early return:
const salt = _grainSalt++;
// ...
id = `wc-grain-${salt}-${byParams.size}`;        // was: `wc-grain-${byParams.size}`
```
Within one render, `byParams.size` still dedups identical params to one shared filter
(one continuous paper); across renders, `salt` differs → no cross-SVG collision. Ids are
not asserted by any test, so the counter is safe; the turbulence **seed** (the only
asserted determinism, L247-256) is independent of the id and unchanged.

**Shadow ids — scope decision (OPEN, see below):** the same bug exists at
`style.js:295`. **Recommended:** fix consistently — give `collectShadowFilters` a parallel
module-level salt (`shadow-${_shadowSalt++}-${seen.size}`) in the **same** PR or an
immediately-following discrete commit, since label-editor and any multi-diagram page can
hit the cross-document collision too. It can be scoped out if we want to keep this PR
watercolor-only; flag for the user.

**Regression risk:** very low. No test pins id strings; refs are read dynamically. Single-
SVG re-render still gets a fresh unique id (counter increments) with refs updated in the
same pass.

**Test to add** (`test/decorations-watercolor-render.test.js`):
- Render two grained washes with **different** params into **two SVGs appended to the same
  `document.body`**; assert the two wash groups' `filter` attrs are **distinct** url ids,
  and that `document.querySelectorAll('filter')` has no duplicate `id`.
- (If shadow fixed) analogous test: two SVGs each with a shadow node → distinct
  `shadow-*` ids in the shared document.

**Verification:** jsdom (id-uniqueness assertions over the shared document).

**Item-1 coordination:** if item-1 centralizes filter emission, the salt utility should
live in that shared module. Land #5 first so #1's composed filter ids inherit the salt.

---

## Fix #3 — Watercolor shape NODE drops its border (MAJOR) — STOPGAP

**Files/functions:** `src-v2/svg/emitter.js` → `watercolorGroup` (`:352-363`, add optional
`outline` param) and `createShapeElement` watercolor branch (`:1048-1057`).

**Cause:** the watercolor fill branch paints the fill wash and `return`s at :1056, never
emitting the resolved `stroke` (`:1030`). A filldraw node loses its outline; with the
default white fill it is near-invisible. (`emitDrawPath` paints both fill + ribbon for the
same semantics — node vs path diverge.)

**Why not a separate sibling/wrapper outline path:** the obvious "append a second
`<path>` outline" breaks tests/bbox:
- Putting a 2nd non-bleed `<path>` **inside** the wash group → `render`-test L42-44
  ("exactly one nominal path") fails (the default-stroke test node would trigger it).
- A wrapping `<g>` around `[wash, outline]`: a plain `<g>` is **not recursed** by the bbox
  walker (`measureChild`, :213) → node drops out of the viewBox (L71-86 fails); a
  `g.watercolor` wrapper becomes the first match for `.node-layer g.watercolor` and then
  carries **two** non-bleed paths → L42-44 fails.

**Chosen stopgap — stroke the existing nominal path:** `watercolorGroup` already emits the
nominal outline (currently `fill:none, stroke:none`, carrying the bbox). Make it the border
when the node has a visible stroke. Zero new elements, zero structural change, bbox source
unchanged.

```js
// watercolorGroup(wash, pigment, id, grain, outline)
function watercolorGroup(wash, pigment, id, grain, outline) {
  const g = createSVGElement('g', { class: 'watercolor' });
  const nominalAttrs = outline
    ? { d: wash.nominal, fill: 'none', stroke: outline.stroke,
        'stroke-width': outline.strokeWidth, ...(outline.attrs || {}) }
    : { d: wash.nominal, fill: 'none', stroke: 'none' };   // default = byte-identical
  g.appendChild(createSVGElement('path', nominalAttrs));
  // ...bleed layers, id, data-grain unchanged...
}
```

```js
// createShapeElement watercolor fill branch (:1052-1056):
if (fill && fill !== 'none') {
  const wash = watercolorLayers(pathStr, { ...style.decoration, prng: opts.prng, closed: true });
  const hasStroke = stroke && stroke !== 'none';
  const outline = hasStroke
    ? { stroke, strokeWidth, attrs: extra }   // extra = resolveStrokeAttrs(style), :1033
    : null;
  return watercolorGroup(wash, fill, undefined, resolveGrain(style.decoration), outline);
}
// fill:'none' → unchanged: already falls through to crisp stroked switch (:1058,:1069+)
```

**Test-safety walk-through:**
- L42-44: still exactly **one** non-bleed path (the nominal) with `fill==='none'`
  (test asserts fill, not stroke) → passes even though nominal now strokes.
- L57-58: nominal is a `<path>`, no `<circle>` → passes.
- L71-86: bbox source is the same nominal; `halfStroke` (`:143-146`) now adds ~0.75px
  (default width 1.5) — the **crisp** comparison node also strokes, so washed tracks crisp
  *more* closely, well within the 12px tolerance.
- grain: `data-grain` stays on this one group; `applyGrainFilters` matches it; the stroked
  nominal is inside the painted area so grain compositing is unaffected.
- accepting inner ring (`:907`, `fillOverride:'none'`): unchanged — `fill:'none'` still
  routes to the crisp stroked switch, so the double border is preserved.

**Known limitation (documented, not a regression):** the nominal is the *subdivided
polygon* outline (faceted at coarse `segmentLength`), so the stopgap border is faintly
faceted rather than a smooth curve, and it is opaque (crisp), not a wash. The full closed-
loop **annulus stroke wash** (smooth, translucent rim) is explicitly the separate **item-3
plan**; this stopgap only stops borders from vanishing.

**Regression risk:** low-medium. Behavior change: every watercolor fill node with a visible
stroke (incl. the default black stroke — nodes always carry one) now shows a border. That
is the intended fix and no existing assertion forbids it (verified above). Pigment/opacity/
determinism tests touch only `data-bleed` paths → unaffected.

**Test to add** (`test/decorations-watercolor-render.test.js`):
- Default-stroke watercolor fill node: assert the wash group's non-bleed nominal path now
  has `stroke === DEFAULTS.nodeStroke` and a numeric `stroke-width`, `fill === 'none'`,
  and there is still exactly **one** non-bleed path.
- Explicit `stroke:'#123456'`: nominal `stroke === '#123456'`.
- `stroke:'none'` + fill: nominal `stroke === 'none'` (no border); still one wash group.
- viewBox guard: washed-with-border viewBox width within 12px of crisp (re-run L71-86 shape
  to prove no balloon).

**Verification:** jsdom for the DOM assertions; **headless Chrome** for the visual
"border no longer vanishes" check on a **default white-fill** node (the near-invisible
case): `npx http-server <repo> -p 8080 -c-1`, then
`chrome --headless=new --screenshot=out.png --window-size=400,400
http://localhost:8080/examples-v2/watercolor-showcase.html` (or a minimal harness) and
eyeball the rim. Compare against the pre-fix screenshot.

**Item-1 coordination:** standalone-safe. After item-1's shared post-step, the
"attach border" decision is cleaner expressed there, but the `watercolorGroup` `outline`
param is the durable mechanism and would still be used. Low conflict — touches the shared
helper, so land #3 and item-1's helper edits with awareness of each other.

---

## Fix #1 — Paper-grain overwrites a node's drop-shadow filter (MAJOR)

**File/function:** `src-v2/svg/emitter.js` → `applyGrainFilters` (`:433-449`) + new
`buildGrainShadowFilter` helper; call sites `:1600` and `:1680` (pass `shadowFilters`).

**Cause:** a shadowed watercolor fill node gets `filter=url(#shadow-N)` on the wash group
in `emitNode` (`:898-899`); `applyGrainFilters` then **unconditionally** overwrites it with
`url(#wc-grain-*)` (`:446`). The SVG `filter` **attribute holds a single reference** — you
cannot list two `url()`s — so the shadow is lost. Grain wins; shadow disappears.

### Decision: compose a single chained filter (recommended) vs nest two `<g>`s

**Recommended = compose (option a).** Build one `<filter>` that runs the grain primitives
then a `feDropShadow` of the result, and point the wash group's single `filter` at it.

Justification vs nesting (option b):
- **bbox walker:** compose keeps the wash a single `<g class="watercolor">` — the walker's
  `measureChild` already handles it (`:213-217`). Nesting introduces an outer `<g>` that is
  **not** `g.watercolor`, which the walker does **not** recurse into (`:213`), collapsing
  the node's bbox unless we hack the wrapper's class or extend the walker (fragile,
  multipart/KaTeX label groups also live under the node `<g>` and would be affected by a
  blanket walker change). Compose avoids touching the fragile walker entirely.
- **grain dedup:** compose extends the existing param key to `(freq, strength, shadowId)`;
  same-grain+same-shadow share one filter, distinct shadow → distinct filter (correct —
  each shadow geometry needs its own). Grained-no-shadow keep the plain grain filter, so
  the existing dedup test (L258-273, no shadow) is unchanged.
- compose composites correctly: grain darkens the interior but does not change the
  silhouette alpha, so the drop-shadow cast from the grained result matches the shape.

`feDropShadow` accepts an `in` attribute, so chaining after the grain merge is clean:
```js
function buildGrainShadowFilter(id, frequency, strength, seed, shadow) {
  const filter = createSVGElement('filter',
    { id, x: '-50%', y: '-50%', width: '200%', height: '200%' }); // shadow's generous region
  // ...same feTurbulence → feColorMatrix → feComposite(in2=SourceAlpha) as buildGrainFilter,
  //    but the feMerge result is named "grained"...
  merge.setAttribute('result', 'grained');
  filter.appendChild(createSVGElement('feDropShadow', {
    in: 'grained', dx: shadow.dx, dy: shadow.dy, stdDeviation: shadow.blur,
    'flood-color': shadow.color, 'flood-opacity': 1,
  }));
  return filter;
}
```
`applyGrainFilters` gains a `shadowFilters` param (already in scope at both call sites —
the emitter's render fn destructures `shadowFilters = []` at ~`:1495`):
```js
function applyGrainFilters(svgEl, defs, seed, shadowFilters = []) {
  const groups = svgEl.querySelectorAll('g.watercolor[data-grain]');
  if (groups.length === 0) return;
  const shadowById = new Map(shadowFilters.map(s => [s.id, s]));
  const salt = _grainSalt++;                          // from Fix #5
  const byKey = new Map();
  for (const g of groups) {
    const [frequency, strength] = g.getAttribute('data-grain').split(' ').map(Number);
    const existing = g.getAttribute('filter');        // shadow set by emitNode, or null
    const shadowId = existing && existing.match(/url\(#(shadow-[^)]+)\)/)?.[1];
    const shadow = shadowId ? shadowById.get(shadowId) : null;
    const key = shadow ? `${frequency}|${strength}|${shadowId}` : `${frequency}|${strength}`;
    let id = byKey.get(key);
    if (!id) {
      id = shadow ? `wc-grain-shadow-${salt}-${byKey.size}` : `wc-grain-${salt}-${byKey.size}`;
      defs.appendChild(shadow
        ? buildGrainShadowFilter(id, frequency, strength, seed, shadow)
        : buildGrainFilter(id, frequency, strength, seed));
      byKey.set(key, id);
    }
    g.setAttribute('filter', `url(#${id})`);           // single ref — both effects now
    g.removeAttribute('data-grain');
  }
}
```
Call sites: `applyGrainFilters(svgEl, defs, seed ?? 42, shadowFilters)` at `:1600` and `:1680`.

**Regression risk:** medium (visual). Grain-off path is **byte-identical** (early return,
unchanged). Grain-on-no-shadow path is unchanged except for the salted id (Fix #5). Only
the grain+shadow combination changes — and it currently has **no test** and is visibly
broken. The composed filter region uses the shadow's `-50%/200%` (superset of grain's
`-12%/124%`) so the speckle is not clipped.

**Test to add** (`test/decorations-watercolor-render.test.js`):
- jsdom (structure): node with `shadow:true` + `decoration:{watercolor, grain:true}`.
  Assert the wash group's `filter` references a single id whose `<filter>` contains **both**
  a `feTurbulence` **and** a `feDropShadow` (proves no clobber; both effects present).
  Assert the bare `shadow-*` filter is no longer referenced by that group.
- dedup: two same-(grain,shadow) nodes share one composed filter; two same-grain but
  **different shadow** params → two composed filters.
- byte-identical guards: re-run existing "grain off" (L202-210) and "grain on, no shadow"
  (L212-234) — must still pass unchanged (modulo salted id, which is read dynamically).
- viewBox: shadow+grain node viewBox equals the no-filter node viewBox (filters geometry-
  invisible).

**Verification:** jsdom for filter structure; **headless Chrome** for the actual
shadow+grain **compositing** (jsdom cannot render filters). Minimal harness page with a
shadowed grained watercolor node:
`chrome --headless=new --screenshot=out.png http://localhost:8080/<harness>.html` — confirm
a visible drop shadow AND paper grain coexist.

**Item-1 coordination (IMPORTANT):** fix #1 is **cleanest after item-1**. Item-1 routes the
3 early-return branches (edge/draw/shape) through a shared post-step; that step is the
natural home for "apply shadow + grain as one composed filter," removing the post-hoc
`emitNode`→`applyGrainFilters` two-pass dance entirely. If item-1 has **not** landed,
implement the composed-filter version above (self-contained, no structural change). If
item-1 lands first, fold this composition into the shared post-step instead of patching
`applyGrainFilters`. Either way, do **not** adopt the nesting approach (option b) — it
fights the bbox walker. Flag the potential edit overlap: both item-1 and this fix touch
filter application around `emitNode`/`applyGrainFilters`.

---

## Open decisions for the user

1. **Shadow+grain composition strategy (Fix #1).** Recommended: **compose a single chained
   `<filter>`** (turbulence → merge → `feDropShadow`), keeping the wash a single element and
   leaving the bbox walker untouched. Alternative: **nest** an outer shadow `<g>` over the
   inner grain `<g>` — conceptually clean but requires a bbox-walker workaround (the walker
   only recurses into `g.watercolor`), so it is more fragile and better deferred to the
   item-1 shared post-step. Confirm compose.

2. **Grain-id salt scope (Fix #5).** Recommended: fix **both** grain (`wc-grain-*`) and
   shadow (`shadow-*`) ids with the same module-level salt for cross-document uniqueness,
   since multi-diagram pages / the label editor can hit the shadow collision too.
   Alternative: scope this PR to **grain only** and file shadow as a follow-up. Confirm
   whether to include the shadow id fix now.
