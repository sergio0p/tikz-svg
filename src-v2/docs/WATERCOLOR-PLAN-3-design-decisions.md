# Watercolor — Larger Design Items (Item-3 bucket): Implementation & Decision Plan

Architect's plan. **Do not implement from this doc** — several items are scope calls
that need a user decision first. All line numbers verified against the tree on
2026-06-28 (`src-v2/`).

Key files read:
- `src-v2/svg/emitter.js` — emit pipeline, decoration hooks, bbox, grain, PRNG
- `src-v2/decorations/watercolor.js` — `deformPolygon`/`sweepRibbon`/`watercolorLayers`/`watercolorRibbon`
- `src-v2/decorations/index.js` — `morphPath` (legacy random-steps), `shapeToSVGPath`
- `src-v2/core/random.js` — `SeededRandom` (mulberry32, `rand`, `gauss`); **no hash**
- `src-v2/style/style.js` / `registry.js` — cascade, `resolvePlotStyle`, builtin `wavy`
- `src-v2/index.js` — global-scale application; `seed` plumbing
- `src-v2/docs/WATERCOLOR.md` — design record (§5, §6, §8.4, §9, §10)

---

## 0. Grouping (verdict per item)

| # | Item | Verdict | Why |
|---|------|---------|-----|
| 1 | **Per-element child PRNG** | **BUILD NOW** | Gates src-v3 "frames don't boil"; fixes the dead `decoration.seed`; pure edit-stability win; cheap. Watercolor-only first, library-wide opt-in. |
| 5 | Degenerate/extreme params → silently invisible | **BUILD NOW** | Tiny, safety-only, no aesthetic decision, no byte-change to valid configs. |
| 6d | Vocabulary unification (`amplitude` vs `spread`) | **DOCUMENT-ONLY** | Renaming breaks configs/builtin `wavy`; document the two namespaces instead. |
| 6e | Delete the two retired audition demos | **BUILD NOW (trivial)** | WATERCOLOR.md §8.5 already retired them; pure cleanup. |
| 3 | Scale-aware brush | **DEFER (decision-gated)** | Needs a semantic call on whether brush detail is canvas-fixed or world-fixed; emitter already has `globalScaleX/Y`. |
| 4 | Layer point-count explosion | **DEFER (build when first bites)** | Defaults (rounds 5) are safe; only extreme user overrides explode. Add a guard + opt-in smoothing later. |
| 2 | Multipart + plots washing | **DOCUMENT + warn (not full build)** | Motivating fill is already reachable via `config.paths`; full wiring is real work with low payoff. |
| 6a | Closed-loop annulus stroke wash (filldraw node outlines) | **DEFER** | WATERCOLOR.md §10's explicitly-deferred item; new geometry; niche. |
| 6b | Grain per-node repeat/discontinuity | **DOCUMENT-ONLY (accept v1)** | Already documented as a known subtlety; page-continuous grain is a larger rework with marginal benefit. |
| 6c | Bleed-aware auto-padding | **BUILD NOW (small)** | Real correctness bug (bleed clipped at figure extremes); computable from spread/rounds; low risk. |

---

## 1. Recommended build-now sequence

1. **Item 5 — validation/clamping at the emitter boundary** (foundational safety; do
   first so later changes can't reintroduce silent-invisible failures).
2. **Item 1 — per-element child PRNG** (the centerpiece; gates src-v3). Land *after*
   item 5 so degenerate configs don't mask PRNG regressions.
3. **Item 6c — bleed-aware auto-padding** (independent; small).
4. **Item 6e — delete retired audition demos** (cleanup; any time).
5. **Item 6d — document vocabulary split**; **Item 6b — document grain subtlety**;
   **Item 2 — document multipart/plots as unsupported + add warning** (doc batch).

Deferred (own future sessions, decision-gated): **Item 3** (scale-aware brush),
**Item 4** (point-count guard), **Item 6a** (annulus).

---

## 2. Decisions the user must make (before any code)

- **D1 (Item 1, the big one): per-element PRNG now or defer to src-v3?**
  Recommendation: **now**. It is a prerequisite for src-v3 Layers 2/3 (WATERCOLOR.md
  §5, lines 165–179), it resurrects the dead `decoration.seed` override, and it is
  decoupled from animation work. Deferring saves nothing and leaves edit-instability
  in v2.
- **D2 (Item 1 scope): watercolor-only or library-wide (also legacy random-steps)?**
  Recommendation: **watercolor-only behavior change; library-wide *mechanism***. Build
  the child-PRNG factory generically (so `morphPath`/random-steps *can* use it), but
  only switch watercolor call sites to per-element by default. Random-steps keeps the
  shared stream unless a per-element `seed`/`key` is given — avoids churning the many
  existing automata diagrams that use `wavy`.
- **D3 (Item 1 keying): what is the stable `elementKey` for edges and draw paths?**
  Nodes are easy (the node id). Edges/paths often have **no id** and live in arrays, so
  index is the only handle but is unstable under reorder/insert. Decision: **prefer an
  explicit `decoration.seed` or an `id`/`key` field; fall back to a derived key
  (`from→to#parallelIndex` for edges) and finally to array index, documented as the
  weakest tier.** User must accept that id-less reordered paths will re-roll.
- **D4 (Item 2): support washing for multipart shapes and plots, or document as
  unsupported + warn?** Recommendation: **document + warn** (the consumer-surplus fill
  works today via a closed `config.paths` entry, WATERCOLOR.md §6).
- **D5 (Item 3): should brush tunables scale with `config.scale`?** Sub-decision:
  *which* tunables (segmentLength? width? both? spread is already scale-invariant).
  Recommendation: **defer; when built, scale `segmentLength` and `width` by
  `max(globalScaleX, globalScaleY)`, leave `spread` alone, behind an opt-out.**
- **D6 (Item 4): adaptive cap vs rounds clamp vs smoothed C/Q output?**
  Recommendation: **defer; cheapest effective guard is a hard rounds clamp + a
  point-budget cap on base sampling.** Smoothed path output is a separate quality
  project.

---

# ITEM 1 — PER-ELEMENT CHILD PRNG (centerpiece)

## 1.1 Problem, precisely

Today a single `new SeededRandom(seed ?? 42)` is created once at `emitter.js:1513` and
threaded **sequentially** into every emit call: `emitNode` (1536, 1663), `emitEdgePath`
(1549, 1631), `emitDrawPath` (1571, 1653). A watercolor wash's draw count is
**geometry-dependent** — `deformPolygon` (`watercolor.js:48-74`) does
`prng.gauss()` once per edge per round, and the edge count **doubles every round**
(`out.push(a)` + midpoint per edge, lines 54/70), times `layers`. So adding, removing,
reordering, **or merely resizing** any one decorated element changes how many draws it
consumes and **re-rolls every wash emitted after it**. The figure "boils."

`decoration.seed` is **dead**: every wash branch is gated on `&& prng` and always
forwards it (`emitEdgePath:466-468`, `createShapeElement:1036/1053-1054`,
`emitDrawPath:673/682-688`), and `watercolorLayers` resolves
`options.prng || new SeededRandom(seed)` (`watercolor.js:191`) — `options.prng` is
always truthy, so `seed` is never consulted. Same shadowing in `morphPath`
(`index.js:37`).

A fixed config still renders **byte-identical on reload** (one seed, deterministic
stream) — so this change affects **edit-stability and future animation only**, not
reload determinism. WATERCOLOR.md §5 (lines 165–179) already promised
`new SeededRandom(hash(seed, elementKey))` per element.

## 1.2 Design

### (a) Hash/avalanche in `core/random.js`

Add a pure derived-seed function next to `SeededRandom`. mulberry32 is the existing
idiom; mirror it for the string fold:

```js
// Derive a stable child seed from a base seed + a string element key.
// FNV-1a fold of the key, mixed with the base seed, then a mulberry32-style
// avalanche so adjacent keys ("q0","q1") diverge fully.
export function hashSeed(seed, key) {
  let h = 2166136261 ^ (seed | 0);
  const s = String(key);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // final avalanche
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return h >>> 0;
}
```

Optional ergonomic helper: `SeededRandom.fromKey(seed, key)` →
`new SeededRandom(hashSeed(seed, key))`. (Note `SeededRandom` maps state 0→1 at
`random.js:8`, so a 0 hash is safe.)

### (b) Stable `elementKey` scheme (the crux — D3)

A child PRNG is only useful if its key survives edits. Tiering (best→worst):

| Element | Key (in priority order) |
|---|---|
| Node | `node:${id}` — ids are user-authored and stable. |
| Edge | `edge:${edge.id}` if present → else `edge:${from}->${to}#${k}` where `k` disambiguates parallel edges between the same pair → else `edge:#${index}`. |
| Draw path | `path:${pathModel.id}` if present → else `path:#${index}`. |
| Plot (only if Item 2 ever built) | `plot:${id}` → `plot:#${index}`. |

Plus an explicit override that wins over all of the above:
`decoration.seed` (number) → child seed = `hashSeed(seed, String(decoration.seed))`
(or use it directly). This finally makes the documented-but-dead `seed` key live.

The parallel-edge counter `k` must be computed deterministically from the resolved edge
list (a `Map<"from->to", count>` built once in `emitSVG` before the edge loop), so it
is stable as long as the *set* of parallel edges between a pair is stable.

### (c) Threading

Construct the child at each call site in `emitSVG`; keep emit-function signatures
(`prng` arg) unchanged so the diff is contained. Replace the single `prng` with a
factory closure:

```js
const baseSeed = seed ?? 42;
const childPrng = (key) => new SeededRandom(hashSeed(baseSeed, key));
```

Then at the six call sites:
- `emitNode(item.id, node, childPrng(\`node:${item.id}\`))` (1536, 1663)
- `emitEdgePath(edge, childPrng(edgeKey(edge, i)))` (1549, 1631)
- `emitDrawPath(pathModel, …, childPrng(pathKey(pathModel, i)))` (1571, 1653)

Where the watercolor branch wants the override, resolve inside the helper:
if `style.decoration?.seed != null`, key on that instead of the structural key.

**Within-element streams.** A node can emit several decorated sub-elements from one
child PRNG (fill wash at `createShapeElement:1053`, then the accepting inner shape at
`emitNode:907`; a `\filldraw` draw path emits fill wash then ribbon wash,
`emitDrawPath:682-688`). These stay sequential **within the element's own stream** —
acceptable: resizing a node re-rolls *that node* wholesale but moves nothing else. Do
**not** over-engineer per-sub-element sub-streams in v1.

### (d) Scope (D2): watercolor-only behavior, library-wide mechanism

Build `hashSeed` generically. Switch only the **watercolor** call sites to per-element
by default. Legacy random-steps (`morphPath`, `index.js:25-63`) keeps the shared stream
**unless** a per-element `seed` is supplied — this avoids re-rolling the many existing
`wavy` automata edges (registry.js:6-16) and keeps their snapshots stable. Document
that random-steps can opt in via `decoration.seed`.

## 1.3 Tests

- `core/random` unit: `hashSeed` is deterministic; distinct keys → distinct seeds;
  same key+seed → identical `SeededRandom` stream; key "" and seed 0 don't degenerate.
- **Edit-stability integration** (the point): render a 3-node + 2-edge figure with
  washes; capture each `g.watercolor`'s `d` set keyed by node/edge id; **resize one
  node**; assert every *other* element's `d` set is byte-identical, and the resized
  node's changed. (This test does not exist today and is the proof of the feature.)
- **Reorder-stability**: swap two id'd edges in `config.edges`; assert each edge's wash
  (matched by id) is unchanged.
- `decoration.seed` override: two elements with the same geometry but different
  `decoration.seed` produce different washes; same `seed` → identical.
- **Reload determinism preserved**: existing test
  `decorations-watercolor-render.test.js:61` ("deterministic for a fixed seed",
  `deepStrictEqual` of two renders) must still pass.

## 1.4 Risk

- **Output bytes change for every existing decorated config** (different draw order).
  The contract requirement is *reload determinism*, which is preserved — but any test
  asserting **exact** decorated coordinates breaks. Audit shows the watercolor render
  tests are overwhelmingly **structural** (layer counts, fill colors, opacity ranges)
  and **tolerance-based** (e.g. `Math.abs(dw - dc) <= 12` at line 84); the determinism
  test compares two *post-change* renders, so it survives. **Migration cost is low but
  nonzero — re-run all 824 tests and update any exact-`d` snapshot.**
- src-v3 is a fork; this change is v2-only. Port the same scheme into src-v3 when its
  Layer 2 controller lands (out of scope here, but note it so the two don't diverge).
- Parallel-edge keying is the fragile part — get the `k` counter deterministic or
  parallel edges re-roll each other.

---

# ITEM 5 — DEGENERATE / EXTREME PARAMS (build now, do first)

## 5.1 Failure modes (all silent today)

- `layers: 0` → `watercolorLayers` loop (`watercolor.js:218`) runs zero times → empty
  group → invisible, no error.
- `opacity: 0` → translucent layers paint nothing.
- 1-point / 2-point path → `basePts.length < 3` early return (`watercolor.js:213`)
  yields a degenerate single-segment "wash"; `watercolorRibbon` spine `< 2` returns
  `{layers: []}` (`watercolor.js:256`) → empty group.
- Negative/zero `grain.frequency` → invalid `baseFrequency` on `feTurbulence`
  (`buildGrainFilter:405-408`) → invalid SVG filter.
- Negative `spread`/`width`/`rounds`/`segmentLength` → NaN or absurd geometry.

The morphPath precedent already degrades gracefully: `< 3` points returns the original
crisp path (`index.js:44`).

## 5.2 Plan: clamp at the emitter boundary

Add one normalizer used by all three watercolor branches (a single
`normalizeWatercolor(decoration)` near `resolveGrain`, `emitter.js:379`):

- `layers = clamp(round(layers), 1, 200)`
- `rounds = clamp(round(rounds), 0, ROUNDS_MAX)` (ROUNDS_MAX ties to Item 4)
- `opacity = clamp(opacity, 0, 1)`; if effective coverage is 0, **degrade to crisp**
  (emit the normal `<rect>/<circle>/<path>`), mirroring `morphPath`'s `< 3` fallback.
- `spread = max(0, spread)`, `segmentLength = max(1, segmentLength)`,
  `width = max(0, width)`.
- `resolveGrain` (`emitter.js:379-387`): clamp `frequency` to `> 0` (e.g.
  `max(1e-4, frequency)`), `strength` to `[0, 1]`; if `frequency <= 0`, drop grain.

When a wash would be empty/invisible, prefer **degrade-to-crisp** over emitting an
empty `<g>`, so the element never silently disappears.

## 5.3 Tests
`layers:0`, `opacity:0`, 1-point path, `frequency:-1`, `spread:-5` each render
*something* (crisp fallback or clamped wash), never an empty group or invalid filter
attribute. Valid configs must be **byte-identical to today** (clamps are no-ops in
range) — assert via the existing determinism fixtures.

## 5.4 Risk
Low. Only changes behavior on out-of-range input. The one judgment call: empty-wash →
crisp vs → nothing; recommend crisp (visible, matches morphPath).

---

# ITEM 6c — BLEED-AWARE AUTO-PADDING (build now, small)

## 6c.1 Problem
Bleed layers carry `data-bleed` and are **excluded** from the bbox
(`expandBBoxFromElement:173`, `:184`; recursion `:213-217`); the viewBox is measured
from the **nominal** outline (WATERCOLOR.md §6, lines 189–194). Correct for *adjacent-
figure stability*, but a wash at the **figure's extreme edge** bleeds past the viewBox
and gets clipped. Only a manual `config.padding` compensates (`computeViewBox:1397`).

## 6c.2 Plan
Compute a **minimum bleed padding** from the wash parameters and fold it into the
default padding when any wash is present. Worst-case lateral bleed of a Hobbs deform is
bounded by the cumulative midpoint displacement; a practical, slightly conservative
estimate per wash:

```
bleedPad ≈ spread_outer * segmentLength * f(rounds)
```

where `spread_outer = spread * (0.6 + 0.8)` (the outer-layer factor,
`watercolor.js:221`) and `f(rounds)` is the geometric-sum bound of the decaying
displacement series (a small constant ~1.5–2 since variance decays geometrically). Track
the max over all emitted washes (a module-level accumulator set in `watercolorGroup`,
or recompute from the resolved decorations in `emitSVG`), then in `computeViewBox`
(`emitter.js:1397`) use `pad = configPadding ?? max(40, ceil(bleedPad))`. Explicit
`config.padding` still wins.

Alternative (simpler, less precise): a flat `WATERCOLOR_BLEED_PAD` bumped into the
default whenever any `g.watercolor[data-bleed]` exists. Recommend the parameter-derived
estimate; fall back to flat if it proves finicky.

## 6c.3 Tests
A single washed shape at origin with large `spread`: assert viewBox grows enough that
no `data-bleed` point lies outside it (parse the bleed `d`s, compare to viewBox).
Adjacent-figure stability test (existing intent of §6) must still hold: two identical
washes side by side don't jitter in nominal size.

## 6c.4 Risk
Low–medium. Over-padding wastes whitespace; under-estimating still clips. Bias slightly
conservative. Must not regress the `data-use-as-bbox` path (`computeViewBox:1371-1381`).

---

# ITEM 6e — DELETE RETIRED AUDITION DEMOS (build now, trivial)

`examples-v2/watercolor-fillstroke-audition.html` and
`examples-v2/watercolor-wetblend-audition.html`. WATERCOLOR.md §8.5 (lines 329–350)
already retired them (the blind-audition protocol is the wrong tool for a feature with
no TikZ ground truth). Keep `watercolor-showcase.html` and `watercolor-brush.html`.
Grep first for any in-repo links/`README` references before deleting.

---

# ITEM 2 — MULTIPART + PLOTS WASHING (document + warn; not a full build)

## 2.1 Reality
- **Multipart split shapes**: `emitNode`'s multipart branch (`emitter.js:843-894`)
  paints part `<rect>`s through a clipPath and strokes `backgroundPath` — it **never
  reads `style.decoration`**, so it silently drops *both* watercolor and random-steps.
- **Plots**: `emitPlot` (`emitter.js:598-647`) has no decoration code and receives no
  `prng` (call sites `1564`, `1647`). `resolvePlotStyle` (`style.js:188-217`) has **no
  `decoration` key** in its base object, so even a passed-through decoration wouldn't
  resolve.

## 2.2 Recommendation: document unsupported + emit a warning (D4)
The motivating use (consumer-surplus fill under a demand curve) is **already reachable
today** via a closed `config.paths` entry, which *does* wash (`emitDrawPath:682`,
WATERCOLOR.md §6 lines 185–188). So the payoff of full wiring is low and the work is
real (per-part washes that respect the clip; plot-path provenance for `weight(t)`).

Plan: in `emitNode` multipart branch and in `emitPlot`, if
`style.decoration?.type === 'watercolor'`, `console.warn` once
("watercolor decoration is not supported on multipart shapes / plots; use a
`config.paths` region for a filled wash") and render crisp. Add a short "Unsupported
surfaces" subsection to WATERCOLOR.md.

## 2.3 If the user instead chooses to BUILD it (sketch)
- **Plots**: add `decoration: null` to `resolvePlotStyle` base (`style.js:189-207`);
  pass `childPrng('plot:'+key)` into `emitPlot` (signature + call sites `1564`,`1647`);
  for a *filled* plot (`style.fill !== 'none'`) wash the path via `watercolorLayers`,
  for a stroked plot via `watercolorRibbon`, reusing `watercolorGroup`. The
  `weight(t)` hard-edge (hug the curve, bleed the axis) needs provenance the plot model
  must carry — non-trivial; this is why §6 prefers the `config.paths` route.
- **Multipart**: wash each part region inside the existing clipPath
  (`emitter.js:873`) — each part `<rect>` becomes a clipped fill wash keyed
  `node:${id}#part${i}`. Splits/outline stay crisp. Moderate effort.

## 2.4 Risk
Document path: ~zero. Build path: medium (plot provenance, clip interaction).

---

# ITEM 3 — SCALE-AWARE BRUSH (defer; decision-gated D5)

## 3.1 Problem
`config.scale`/`scaleX`/`scaleY` multiply **coordinates** in the pipeline
(`index.js:118-119`, applied to nodes `296-302`, paths `644-653`) **before** emit, so
`deformPolygon` runs in post-scale space. But the tunables are **absolute px**:
`segmentLength = 20` and ribbon `width = 12` (`watercolor.js:167`, `:91`). Under
`scale: 2`, edges are 2× longer but `segmentLength` stays 20 → ~2× more subdivisions →
finer relative texture; `width 12` stays 12 → relatively thinner brush. `spread`/
`magnitude` are a **fraction of edge length** (`watercolor.js:66`), so they are already
scale-invariant — only `segmentLength` and `width` break self-similarity.

The emitter **already has** `globalScaleX`/`globalScaleY` in scope
(`emitSVG` destructure, `emitter.js:1506-1507`), so threading a scale factor down is
mechanically easy.

## 3.2 The decision (why deferred)
It is a **semantic** choice, not a bug: should brush detail be **canvas-fixed** (a
20px sampling regardless of zoom — current behavior, good for "the paper grain is a
property of the page") or **world-fixed** (self-similar roughness across scales, good
for "the brush is a property of the drawing")? Both are defensible. No code until the
user picks.

## 3.3 Sketch if chosen (world-fixed)
Compute `s = max(globalScaleX, globalScaleY)` in `emitSVG`; pass it into the watercolor
branches; multiply `segmentLength *= s` and `width *= s` before calling
`watercolorLayers`/`watercolorRibbon` (leave `spread` untouched). Gate behind an
opt-out (`decoration.scaleBrush: false`) so existing figures don't shift. Tests: render
the same shape at scale 1 and 2 with `scaleBrush` on; assert subdivision count (and
thus point count) scales ~linearly so relative roughness matches.

## 3.4 Risk
Medium: changes output for any scaled+washed figure unless opt-in; interacts with Item 4
(scaling `segmentLength` up reduces point count — good — but down explodes it).

---

# ITEM 4 — LAYER POINT-COUNT EXPLOSION (defer; build when it bites; D6)

## 4.1 Problem
`deformPolygon` doubles point count per round with **no cap** (`watercolor.js:48-74`):
a closed polygon of N base points → ~`N·2^rounds` per layer, ×`layers`. The doc's own
figures: rounds=20 ≈ 5k pts / 68 KB; rounds=500 ≈ 147k pts / 2.4 MB **per wash**. The
default `rounds: 5` (`watercolor.js:185`) is fine; this only bites on extreme user
overrides — but the lib currently lets them DoS the DOM.

## 4.2 Plan (cheapest effective, build later)
1. **Rounds clamp** (shared with Item 5): `ROUNDS_MAX ≈ 8` by default. Beyond ~7 rounds
   the geometric variance decay (WATERCOLOR.md §3) means added rounds are visually
   invisible anyway, so this is nearly lossless.
2. **Base-sampling point budget**: cap `basePts.length · 2^rounds ≤ BUDGET` (e.g.
   30k); if exceeded, raise `segmentLength` (coarser base) until it fits. Coarser base
   + same rounds preserves the lobe character better than truncating rounds.
3. **(Optional, separate quality project) smoothed C/Q output**: emit the deformed
   polygon as a Catmull-Rom→Bézier path instead of dense `L` polylines, so fewer points
   give equal smoothness. Bigger change to `pointsToPath` usage; do only if DOM weight
   is a real problem after (1)+(2).

## 4.3 Tests
Assert generated point count stays ≤ budget for pathological inputs (rounds=500);
assert default-param output is **byte-identical** to today (clamp/budget are no-ops at
defaults).

## 4.4 Risk
Low if clamp/budget chosen so defaults are untouched. The C/Q rewrite (3) is higher
risk (visual change) — keep it separate and opt-in.

---

# ITEM 6a — CLOSED-LOOP ANNULUS STROKE WASH (defer)

WATERCOLOR.md §10 (lines 407–410) explicitly defers this: a `\filldraw` **shape
outline** as a wash needs an inner+outer offset annulus with even-odd fill;
`sweepRibbon` (`watercolor.js:90-118`) is **open-spine only** and won't close cleanly
around a loop. The *draw-path* filldraw (a cycled polyline) already works via
`emitDrawPath` (`682-690`). Real fix behind Item-2's crisp-stroke stopgap, but niche.

**Sketch if chosen**: new `sweepAnnulus(closedPolygon, width)` → offset the loop
inward and outward by `width/2` (normal offset with miter handling at corners), emit as
one path with `fill-rule: evenodd`, feed to `watercolorLayers({points, closed:true})`
twice or as a single even-odd polygon. Corner self-intersection on concave shapes is the
hard part. Defer until a concrete consumer needs washed *node* outlines.

---

# ITEM 6b — GRAIN PER-NODE REPEAT / DISCONTINUITY (document-only)

Each node `<g>` carries its own `translate` (`emitNode:820`), and `feTurbulence`
(`buildGrainFilter:405`) samples in the **filtered element's user space**, so every
translated node repeats the *same* noise patch, while edges/paths in absolute coords
stay continuous. WATERCOLOR.md build-order item 11 (lines 430–432) already records this
as an accepted v1 subtlety. **Recommend accept + document.**

Page-continuous options if ever revisited: (i) one global grain `<rect>` over the whole
viewBox, masked to the union of wash alphas (loses per-wash clip simplicity); or (ii) a
per-node `feTurbulence seed` offset derived from the node's translate so patches differ
(hides repetition without true continuity). Both are reworks with marginal payoff — not
now.

---

# ITEM 6d — VOCABULARY UNIFICATION (document-only)

Two namespaces exist: legacy random-steps uses **`amplitude`** (absolute px) — see the
builtin `wavy` style `registry.js:6-16` and `morphPath` (`index.js:31`); watercolor
uses **`spread`/`magnitude`** (fraction of edge length, `watercolor.js:37`,`:168`).
They mean genuinely different things (absolute vs relative), and they live under the
same `decoration` key. Renaming would **break every existing config and the builtin
`wavy`**. Recommend: **do not unify the keys; document the split** in WATERCOLOR.md
(one table: which decoration type reads which knob, and the units). If a future unified
"hand-drawn" decoration is built, give it one clearly-named knob then — don't retrofit.

---

## Appendix — call-site cheat sheet (for the implementer)

| Concern | Location |
|---|---|
| Shared PRNG creation | `emitter.js:1513` |
| Emit call sites (drawOrder) | `emitter.js:1536, 1549, 1571` |
| Emit call sites (layer compat) | `emitter.js:1631, 1653, 1663` |
| Watercolor branch — edge | `emitter.js:466-470` |
| Watercolor branch — shape fill | `emitter.js:1036-1064` |
| Watercolor branch — draw path | `emitter.js:673-692` |
| `watercolorGroup` helper | `emitter.js:352-363` |
| Grain resolve/build/apply | `emitter.js:379-387 / 401-422 / 433+` |
| bbox `data-bleed` skip | `emitter.js:173, 184, 213-217` |
| `computeViewBox` padding | `emitter.js:1364-1404` (pad at `1397`) |
| Multipart branch (drops decoration) | `emitter.js:843-894` |
| `emitPlot` (no decoration/prng) | `emitter.js:598-647` |
| `deformPolygon` doubling | `watercolor.js:48-74` |
| `watercolorLayers` prng/seed | `watercolor.js:179-232` (rng `191`) |
| `subdivideEdges` / `sweepRibbon` | `watercolor.js:133-150 / 90-118` |
| `SeededRandom` (no hash) | `core/random.js:5-39` |
| `morphPath` (legacy) prng/seed | `index.js:25-63` (rng `37`) |
| `resolvePlotStyle` (no decoration) | `style.js:188-217` |
| builtin `wavy` (amplitude) | `registry.js:6-16` |
| global scale application | `index.js:118-119, 296-302, 644-653`; emitter destructure `1506-1507` |
</content>
</invoke>
