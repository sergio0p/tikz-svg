# Watercolor — Design Notes

**Status:** Core module built and unit-tested. **Two integration instances live:**
(1) shape **fill wash** and (2) **stroke ribbon wash** for edges and draw paths
(incl. `\filldraw` = fill wash + stroke ribbon), all through `render()` via
`decoration: { type: 'watercolor' }` (817 tests pass). Pending: `\filldraw` *shape*
outlines (closed-loop annulus), shared `feTurbulence` grain filter. All design
decisions settled (see §8).
**Decision date:** 2026-06-11 (design session); recovered and recorded 2026-06-28;
decisions closed 2026-06-28.
**Goal:** A TikZ-style watercolor *decoration* in `src-v2` that paints strokes and
fills as algorithmically-generated washes — mergeable into the main library, not a
one-off for any single project.

This document preserves a design conversation that was nearly lost. It records the
references studied, the algorithm chosen, the architecture mapped onto the existing
`src-v2` modules, the concrete function contracts agreed on, and the decisions that
were left open when the session ended.

---

## 1. Direction (settled)

**Algorithmic, not stamps.** The effect is *generated* from path geometry at render
time, not composited from imported watercolor brush/stamp images.

**Render once, deterministic, stays put.** A wash is computed from a seeded PRNG, so
the *same seed produces a byte-identical painting on every load*. It does not
re-randomize on its own; you change the appearance only by changing the seed.
Generation is cheap enough (~12 layers + a filter, see §6) to run at render time
without storing output and without burdening page load.

**Both stroke and fill.** Fills *bleed past the nominal boundary by default* — the
bleed is the defining watercolor behavior, not a bug to clip away.

---

## 2. Prior art studied

Four existing approaches were examined before choosing a direction.

| Source | What it is | Verdict |
|---|---|---|
| **Concepts app** ([vector watercolor](https://concepts.app/en/tutorials/introducing-vector-watercolor/)) | Keeps strokes as editable vectors; "watercolor-ness" is a render-time effect computed over vector data, re-blending live where strokes meet. | Inspiration / proof it's possible. Proprietary. |
| **Curtis et al., "Computer-Generated Watercolor"** (SIGGRAPH 1997) | Physically-based shallow-water fluid simulation: pigment advection, deposition, backruns, edge darkening. Ancestor of Rebelle, Adobe Fresco live brushes. | Rejected — raster, computationally heavy. |
| **Tyler Hobbs's generative watercolor** | Recursive midpoint polygon deformation, then stack many jittered low-opacity copies. | **Chosen core algorithm** (see §3). |
| **Matthew Baldwin / Concepts brush design** ([article](https://concepts.app/en/stories/digital-brush-design-splash-matthew-baldwin/)) | Spine-vs-skin: precise vector spine + stamped nibs + tileable paper grain + pressure curves. | Chosen for *geometry/pipeline* ideas, merged with Hobbs. |

### Chosen synthesis: "Hobbs as renderer, Baldwin as geometry"

Take a vector path as the **spine**; sweep it into a **ribbon polygon** (width and
opacity as functions of arc length — this is where Baldwin's pressure curve lives);
feed that ribbon into **Hobbs's deformation** to produce the wash. This yields a
watercolor *stroke* (Hobbs alone only makes static blobs) with a precise vector
spine and organic layered edges. It is essentially a from-scratch reconstruction of
what Concepts does under the hood.

A cheaper fallback, **"Hobbs as the nib factory, Baldwin as the pipeline,"** was
noted but not chosen for v1: generate a small family of deformed blobs once, bake
them as symbols, and stamp them along the path. Lighter at render time; risks visible
periodicity if spacing/jitter are tuned badly.

---

## 3. The Hobbs algorithm

1. Start from a base polygon (for fills, the shape outline; for strokes, the swept
   ribbon).
2. **Recursive midpoint deformation:** for each edge, displace its midpoint by a
   *Gaussian* offset whose magnitude is **scaled by the edge length**, then recurse
   on the two child edges. The length-scaling is what makes the recursion
   self-similar and stable — variance decays geometrically with no explicit schedule.
   ~7 rounds builds a "base" shape; each rendered layer deforms a few more rounds.
3. **Layer stacking:** render 30–100 deformed copies at very low opacity (~4%). The
   accumulation of jittered translucent layers produces the soft pigment gradients
   and feathered shoreline edges of a real wash.
4. **Pigment concentration:** give inner layers *fewer* deformation rounds and outer
   layers *more*, so pigment stays dense along the spine/center and feathers at the
   edge. Edge darkening emerges naturally from this.

Contrast with the existing `applyRandomSteps`: random steps displaces *existing*
vertices *once*; Hobbs displaces *edge midpoints recursively* with length-scaled
magnitude. Hobbs is a recursive generalization of the same idea.

---

## 4. How it maps onto `src-v2` (verified against the code)

The existing decoration pipeline is a near-perfect fit.

- **`decorations/index.js` → `morphPath()`** runs parse → sample → decorate → emit.
  That shape transfers directly to watercolor.
- **`decorations/path-utils.js` → `samplePath()`** already flattens Béziers to a
  polyline — the "flatten the path" step, already written. But watercolor wants to
  sample **coarsely** (~30–60px), *not* the random-steps default (~10px): Hobbs's
  recursion generates the fine detail, and it makes bigger, better lobes from bigger
  initial edges. A dense base just yields uniform fuzz. So `segmentLength` becomes an
  aesthetically meaningful parameter, not just a fidelity knob.
- **`decorations/random-steps.js` → `applyRandomSteps()`** — its tangent/normal frame
  computation is reusable for both the deformation and the stroke ribbon sweep.
- **`decorations/index.js` → `shapeToSVGPath()`** already converts node borders to
  path data (circle, ellipse, rectangle today). This makes **watercolor fills of
  nodes nearly free** once the other shapes emit path data.
- **`core/random.js` → `SeededRandom`** (mulberry32, `rand()` → [−1, 1)). Needs a
  `gauss()` method added — see §5.

**The arity break.** The current decoration contract is string-in/string-out
(`morphPath` takes one path, returns one path). Watercolor takes one path and returns
a **group**: N jittered low-opacity layers plus (optionally) a shared paper-grain
filter def. This is a *new kind* of decoration whose structured output the SVG emitter
must learn to nest into a `<g>` and whose `<defs>` it must register. This makes
watercolor the **first real consumer of roadmap item 16** (defs/filter/clip/gradient
hook: "SVG primitives available, no user-facing hook"). Build item 16 properly and let
watercolor sit on top of it, rather than wiring filters in as a one-off.

---

## 5. Function contracts (agreed)

Keep the decorations module pure (points/string in, structured data out — no DOM):

```js
// One recursion pass × rounds; pure points-in/points-out.
deformPolygon(points, { rounds, magnitude, prng, weight })

// → { nominal, layers: [{ d, opacity }] }
watercolorLayers(pathData, options)
```

- `weight` is a **function of arc-length fraction** `t ∈ [0,1]` returning an amplitude
  multiplier. This solves the **directional-bleed provenance problem**: by the time a
  decoration runs, `morphPath` only sees a path string — segment identity (which
  vertices came from the demand curve vs. the axis closure) is gone. But **arc length
  survives flattening and subdivision** (each child edge inherits its parent's
  parameter interval). The caller *does* know provenance, so it passes
  `weight(t)`; `weight(t) = 0` over a region gives a hard "wash up to the line" edge
  with **no clip path needed** — cheaper and more printable than clipping. A clip
  remains available for the strict case.

### `gauss()` on `SeededRandom` (Box–Muller)

Add to `core/random.js` as a core primitive (other decorations — pending snake/coil,
future hand-drawn styles — may want it). Box–Muller over Marsaglia polar
specifically because it consumes **exactly two uniforms per pair**, keeping the PRNG
stream position predictable (Marsaglia's rejection loop consumes a data-dependent
count, which makes test fixtures and cross-element seeding brittle).

```js
gauss() {
  if (this._spare !== undefined) { const v = this._spare; this._spare = undefined; return v; }
  let u = (this.rand() + 1) / 2;   // [0, 1)
  u = 1 - u;                       // (0, 1] — avoids log(0)
  const v = (this.rand() + 1) / 2;
  const r = Math.sqrt(-2 * Math.log(u));
  this._spare = r * Math.sin(2 * Math.PI * v);
  return r * Math.cos(2 * Math.PI * v);
}
```

The `1 - u` flip matters: `rand()` returns `[-1, 1)` (half-open, zero included), so
`u` can be exactly 0; without the flip there is a 1-in-2³² `log(0) → -Infinity` that
poisons a layer's geometry — rare in dev, observable in production across thousands
of washes.

### Per-element child PRNGs

Watercolor is a *much* heavier PRNG consumer than random steps (one 40-layer × 4-round
wash on a doubling polygon burns tens of thousands of draws). If all decorations share
one document-level PRNG, toggling a single wash reseeds every downstream decoration —
the whole figure changes appearance. So **each decorated element gets its own child
PRNG** derived deterministically from `config.seed` + a stable element identity:

```js
new SeededRandom(hash(seed, elementKey))   // elementKey = node id, edge index, …
```

This gives per-element stability (edit one wash, nothing else moves) and is exactly
the property the `src-v3` animation layer needs so frames don't "boil." It touches how
the emitter / style layer constructs the `prng` it passes down.

---

## 6. Bleed, bounding box, draw order

- **Bleed is directional and per-edge, not uniform.** Real watercolor has high
  variation on some boundaries and sharp edges on others. Concretely: washing
  consumer surplus under a demand curve, hug the *curve* tightly (`weight ≈ 0` there)
  while bleeding freely along the axis closures where precision is meaningless.
- **Bounding box is computed from `nominal` geometry, not the deformed layers.**
  Otherwise every wash inflates the viewBox by its spread and adjacent figures jitter
  in size with the PRNG. This makes pending **roadmap item 7** (`use as bounding box`)
  effectively a prerequisite — or the watercolor module needs a private version of the
  same idea (exclude decoration overflow from extent calc, with a `padding` escape
  hatch when the user *wants* the bleed fully visible).
- **Draw order:** a bleeding wash overlaps neighbors (labels, other regions, the curve
  stroke). Default convention: washes on a `back` layer, nominal strokes drawn over
  them — the existing `layers`/`draw` machinery handles this; make it an explicit
  documented convention. Where two washes overlap, **multiply blend** on the shared
  group gives glazed-overlap darkening for free.

### Stroke specifics

The one genuinely new geometry utility: a **ribbon sweep** — offset the sampled
polyline along its normals by a half-width profile `w(t)`, walk out one side and back
the other, close into a polygon, then feed it to the same fill pipeline. The same
per-side bleed knob applies (a stroke that bleeds below but not above mimics how real
washes settle on tilted paper).

### Closed-path detail

`samplePath` duplicates the first point at the end of a closed path. The deformer must
**drop the duplicate before subdividing and re-close after**, or the seam accumulates
displacement twice and produces a visible notch.

---

## 7. API surface (recommended — confirm before wiring)

Reuse the **existing** `decoration` style key (same hook as `random steps`), adding a
`watercolor` type. It flows through the cascade (`DEFAULTS → group → named style →
per-element`) with **no resolver change** (§8.4), and fill vs. stroke is chosen by the
element, not by a flag (§8.3):

```js
// On a node / shape  → fill wash (+ stroke wash if it also has a stroke)
stateStyle: { fill: 'blue!20', decoration: { type: 'watercolor' } }   // all defaults

// Override any of the five tunables (these are the live defaults):
//   layers: 10, segmentLength: 20, spread: 0.30, opacity: 0.15, rounds: 5
stateStyle: { fill: 'blue!20', decoration: {
  type: 'watercolor', layers: 12, spread: 0.22, opacity: 0.12 } }

// On an edge / draw path → stroke ribbon wash, pigment = style.stroke
{ from: 'a', to: 'b', style: { decoration: { type: 'watercolor', width: 12 } } }
```

**Live as of 2026-06-28 (fill wash):** the bare `{ type: 'watercolor' }` paints with the
five defaults above; every key overrides individually, because the emitter spreads the
whole `decoration` object into `watercolorLayers()` (emitter.js:904). Defaults were
chosen on the showcase and live in one place — the `watercolorLayers()` signature.
Param names match `watercolorLayers()` (`layers`, `segmentLength`, `spread`, `opacity`,
`rounds`, `concentrate`, `seed`); pending keys `width`/`widthProfile` (ribbon) and
`grain` (shared filter) land with the stroke wash. `weight(t)` (arc-length bleed
profile) is passed through for hard-edge / directional-bleed control.

> Open for confirmation: keep this on `decoration: { type: 'watercolor' }`, or expose a
> shorter surface (e.g. `fill: 'watercolor blue!20'`)? Recommended: `decoration`, for
> consistency with the existing decoration plumbing.

---

## 8. Decisions — all settled (2026-06-28)

### 8.1 Rendering budget — SETTLED

**~12–15 layers + one shared `feTurbulence` grain def.** Keeps output pure SVG (no
canvas; canvas rasterization is ruled out, it breaks the emitter model) while staying
light enough to satisfy the "render once, fast, don't burden page load" requirement.
The grain filter is defined once in `<defs>` and referenced by every wash. The
~40-layer pure-paths variant was rejected as too DOM-heavy.

### 8.2 Overlap compositing — SETTLED: plain translucent stacking (overlaps darken)

Overlapping washes **darken**, like real glazing — this is the *correct* watercolor
behavior, not a defect to engineer away. It is also **free**: it is the same mechanism
that makes one wash's ~14 stacked low-opacity layers build into a body. Each layer of
each wash is emitted as its own translucent `<path>` (`fill = pigment`,
`opacity = layerOpacity`); where two washes cross, normal source-over compositing
accumulates coverage and the overlap reads darker. A `\filldraw` thus gets an authentic
darker rim where the fill wash meets its outline ribbon wash — for free.

Two alternatives were considered and **rejected for v1**:

- **Single-`<path>` union (no darkening).** Combine all overlapping layer-`k` outlines
  into one `<path>` at one opacity (`fill-rule:nonzero`) so the overlap is painted once
  → single coverage, *no* darkening. This was briefly mislabeled "water blend"; it is
  the *least* watercolor-like option (flat, poster-like). Dropped.
- **`mix-blend-mode: multiply`.** Darkens overlaps more strongly and combines different
  colors subtractively. Deferred as an **opt-in** (`blend: 'multiply'`) for multi-color
  art — it differs from plain stacking only when *different-colored* washes overlap, and
  the common tikz-svg case (a fill and its own same-colored outline) is identical under
  both. Not the v1 default.

Implementation upshot: **no union geometry, no blend-mode** in v1 — just emit each
layer as an independent translucent `<path>`. Strictly simpler than the union approach
previously sketched.

### 8.3 Fill vs. stroke — DISSOLVED: both, element-driven

This was never a real fork. tikz-svg sometimes fills and sometimes strokes; watercolor
must serve **both**, chosen by **what the element is**, exactly mirroring TikZ verbs:

| TikZ verb | tikz-svg element | Wash |
|---|---|---|
| `\fill`     | shape with a fill; region between plots | **fill wash** — interior washed, nominal outline is the base polygon |
| `\draw`     | edge; open draw path                    | **stroke ribbon wash** — spine swept to a ribbon, then washed |
| `\filldraw` | shape with both fill and stroke         | **both** — fill wash under a stroke ribbon wash of the outline |

Pigment color is derived per element: fill wash uses `style.fill`, stroke wash uses
`style.stroke`. No global "target" flag.

### 8.4 Integration surface — READ (findings)

The three prerequisite files are read; integration points confirmed:

- **Style cascade** (`src-v2/style/style.js`, `registry.js`): `decoration` is a
  first-class style key (defaults `null` at lines 112/166/253; registry entry at
  registry.js:7). A `decoration: {...}` object already flows through the cascade
  untouched to the emitter — no resolver change needed to carry watercolor params.
- **Emitter decoration hooks** (`src-v2/svg/emitter.js`): edges at lines 336–337
  (`path = morphPath(path, …)`), shapes at 876–893 (`createShapeElement` →
  `shapeToSVGPath` → `morphPath`). Both assume **string→string** (one path in, one
  path out). Watercolor returns `{nominal, layers[]}` — a **group**, not a string — so
  these hooks need a `decoration.type === 'watercolor'` branch that emits a `<g>` of
  sibling `<path>` layers instead of mutating a single `d`. (The "arity problem.")
- **`<defs>`** built in `buildDefs(arrowDefs, shadowFilters)` (260–321), appended once
  at 1350–1351. The shared grain `<filter>` is added here (extend `buildDefs`, gated on
  any element actually using watercolor).
- **viewBox / extent** (`computeViewBox` 1193; `expandBBoxFromElement` 169): the
  walker **parses every `<path>`'s `d` coordinates** to grow the bbox. Bleed layers
  would therefore inflate the viewBox. Fix: render layer paths flagged `data-bleed`
  and have `expandBBoxFromElement` **return early on `data-bleed`** (both for a bleed
  element passed directly *and* when scanning node-group children in the transform
  branch); the **undeformed `nominal` path** (emitted invisibly, no `data-bleed`) is
  what the walker measures. This is the *local* nominal-bounds rule — distinct from the
  existing **global** `data-use-as-bbox` override (roadmap item 7, lines 1200–1209),
  which makes one shape define the whole picture and is the wrong tool here.

### 8.5 Demos — blind audition retired for this feature

The blind-audition protocol (`DEMO.md`) is the **wrong tool** here and is not used:

- It is built to test *fidelity to a TikZ ground truth*; watercolor has no TikZ
  reference.
- Decisions 8.2 / 8.3 are **design-preference / element-driven**, now settled by fiat
  above — there is nothing left to A/B.
- The retired auditions also failed methodologically: fill-vs-stroke showed *different
  images* (a disc vs a ring) — apples and oranges, not method-A-vs-method-B on a fixed
  target — and wet-blend "had zero randomization" because the macro shape is fixed by
  design (a circle is the same circle every reload; only sub-pixel edge texture
  re-seeds, which reads as nothing moving).

The right vehicle is a **showcase demo**, not an audition: render real diagrams with
watercolor on, and make the seeded variation **visibly** demonstrable — a *re-roll
seed* button and/or several seeds shown side by side — so randomness is on the macro
silhouette where the eye can see it, not buried in edge noise.

The retired files (`examples-v2/watercolor-wetblend-audition.html`,
`examples-v2/watercolor-fillstroke-audition.html`) can be deleted or kept only as
scratch references.

### 8.6 Wash styling parity — what the shared post-step applies, and what it deliberately does not

A washed edge / draw path routes through `applyWashAttributes(group, …)`
(`src-v2/svg/emitter.js`), which reapplies the per-element treatment the crisp
branches give their `<path>`, so washed and crisp output stay consistent:

- **opacity** — set group-level so it dims every bleed layer *and* the arrow tip
  together (mirrors `attrs.opacity = style.opacity` on the crisp path).
- **className** — added to the wash `<g>` (edges only; the crisp draw path hardcodes
  `class="draw-path"` and adds no `style.className`, so the wrapper matches that).
- **id** — on the wash `<g>` (edge) or the single `g.draw-path` wrapper (draw path),
  giving `refs.byId` one clean hook. For a `\filldraw` wash this fixes the prior bug
  where the id landed only on the stroke group.
- **useAsBoundingBox** — tags the wrapper, so `computeViewBox` unions every nominal
  outline *and* the spine's marker disc while excluding `data-bleed`.
- **arrow tips** — an invisible `path[data-wash-spine]` (the original, pre-deformation
  `d`) reuses the crisp `<marker>` defs via `marker-start`/`marker-end`. The tip lands
  at the spine endpoint, angled along the centerline tangent — exactly where a crisp
  tip would. Appended last so it paints over the translucent ribbon.

**Intentionally NOT ported to a wash** (decisions, not omissions — they keep the wash
faithful to the watercolor model rather than half-porting stroke semantics that have no
visual meaning on a wet fill):

- `stroke-dasharray` / `dotted` / `dashed` (`resolveStrokeDash`): a wash has no stroked
  outline to dash.
- `stroke-linecap` / `-linejoin` / `-miterlimit` (`resolveStrokeAttrs`): no stroke.
- `fill-rule`: the deformed layer fills rely on the default nonzero rule; not surfaced.
- `stroke` / `stroke-width`: pigment is a fill, not a stroke.

Shape-fill washes (`createShapeElement`) skip the shared step entirely: the node wrapper
`<g class="node" id="node-…">` already owns id/className, and nodes apply no
opacity/arrows/`useAsBoundingBox`, so it would be a no-op.

---

## 9. Build order

1. ✅ Add `gauss()` to `core/random.js` (+ tests asserting deterministic stream).
2. ✅ `deformPolygon()`, `sweepRibbon()`, `watercolorLayers()` in
   `decorations/watercolor.js` (pure, DOM-free; `{nominal, layers}` contract).
   Tests in `test/decorations-watercolor.test.js` (15). Re-exported from
   `decorations/index.js`.
3. ✅ Read the integration surface (§8.4).
4. ✅ **Shape fill wash wired** into the shape decoration hook
   (`createShapeElement`): when `decoration.type === 'watercolor'` and the element has a
   fill, emit a `<g class="watercolor">` of `data-bleed` translucent layer `<path>`s
   (overlaps darken by stacking, §8.2) + one invisible `nominal` path for bbox. Covers
   curved shapes (circle/ellipse via `shapeToSVGPath`) and polygonal shapes (via
   `backgroundPath`). No fill → falls back to crisp rendering.
5. ✅ **bbox:** `expandBBoxFromElement` returns early on `data-bleed` and recurses into
   a nested `.watercolor` group under a transformed node (§8.4) — bleed never inflates
   the viewBox; the nominal path carries the bounds. Existing (non-watercolor) bbox
   behavior is byte-identical (new branches gate on `data-bleed` / `.watercolor`).
6. ✅ **`subdivideEdges`** added to `watercolor.js`: straight edges are split to
   `segmentLength` before deformation so roughness is shape-independent (a rectangle no
   longer wobbles far more than a circle).
7. ✅ **Showcase demo** (`examples-v2/watercolor-showcase.html`) — circle/ellipse/
   rectangle/diamond, crisp-vs-washed, live param sliders + visible seed re-roll.
   Also **`examples-v2/watercolor-brush.html`** — a stroke-only demo: the word
   "Claude" painted as six parametric letterform spines (arcs + lines) fed to
   `render()` as `config.paths` with `decoration:{type:'watercolor'}`, plus a gallery
   of brush-stroke uses (width ramp, width profiles, pigments, overlap-darkening,
   underline swash, wave, checkmark, spiral). Brush width / wetness / layers / opacity
   sliders + seed re-roll. NB: a `u`'s bottom arc must sweep through 90° (`sin=+1`,
   y-down → bulges into a cup); 180°→360° passes 270° and bulges up into an "n".
   Also carries a **"Paper grain" toggle** (default on) that post-processes the
   rendered SVG: appends a `feTurbulence` fractalNoise → `feColorMatrix` → `feComposite`
   (clip to `SourceAlpha`) → `feMerge` filter and sets it on each `g.watercolor`. This
   is the §8.1 granulation — seed-tied for determinism — prototyped demo-side; the
   production emitter (`buildDefs`) still does NOT emit it. Same recipe the retired
   `watercolor-{wetblend,fillstroke}-audition.html` demos use (those still exist on
   disk; the grain is why they looked "more realistic" than the grain-less showcase).
8. ✅ **Stroke ribbon wash** wired. `watercolorRibbon(pathData, opts)` in
   `watercolor.js`: sample spine → `subdivideEdges` (densify straight runs so the
   brush taper renders along them) → `sweepRibbon` → `watercolorLayers(null, {points,
   closed:true})`; nominal = undeformed ribbon outline (spine ± width/2) so bbox
   covers the brush width but not the bleed. New `width`/`widthProfile` options atop
   the five fill tunables. Emitter: shared `watercolorGroup(wash, pigment, id)` helper
   (used by fill + edge + draw); `emitEdgePath` branches to a ribbon when
   `decoration.type==='watercolor'` (pigment = `style.stroke`); `emitDrawPath` is
   **element-driven** — fill→fill wash, stroke→ribbon, both→two stacked groups
   (`\filldraw`: the stroke ribbon over the fill wash gives the authentic dark rim for
   free). Both `emitDrawPath` call sites thread the shared `prng`. Tests: 5 ribbon
   unit tests + 6 render-integration (edge, draw-path, filldraw two-group, bbox).
   Showcase grew a "Stroke ribbon" section + brush-width slider.
9. ✅ **Draw paths** (`config.paths`) — filled regions and stroked paths both wash
   (done together with step 8; `config.paths` carries `points`/`cycle`/`fill`/
   `stroke`/`decoration`).
10. ⬜ **`\filldraw` SHAPE outlines** — a closed shape's *stroke* as a wash. Needs a
   closed-loop annulus (inner+outer offset, even-odd fill); `sweepRibbon` is for open
   spines and doesn't close cleanly. Deferred — distinct from the filldraw *draw path*
   (a cycled polyline), which already works via step 8.
11. ✅ **Paper-grain `feTurbulence` filter** wired into the production emitter
   (`emitter.js`), opt-in and gated on use. API: `decoration: { type:'watercolor',
   grain: true }` (defaults `{ frequency: 0.55, strength: 0.20 }`) or
   `grain: { frequency, strength }` to tune. Grain is **off by default**
   (absent/falsy → no granulation). Implementation: `resolveGrain(decoration)`
   normalises the option; `watercolorGroup` stamps a transient `data-grain` tag on
   any group that wants grain; an `applyGrainFilters(svgEl, defs, seed)` post-pass
   (run before `computeViewBox` in both render branches) **deduplicates filters by
   `(frequency, strength)`** — the common case emits exactly one shared `<filter>`
   = one continuous sheet of paper under every wash; a wash with custom params gets
   its own. The filter is `feTurbulence fractalNoise → feColorMatrix` (alpha row
   `0 0 0 -strength strength` → faint black speckle) `→ feComposite in SourceAlpha`
   (clips grain to the painted area) `→ feMerge` (wash + speckle). `feTurbulence`'s
   `seed` is tied to `config.seed`, so grain is deterministic and — being pure SVG —
   sidesteps the PRNG order-dependence entirely. Same recipe as the validated
   "Paper grain" demo toggle (step 7), now built via DOM nodes (no `innerHTML`).
   Tests: `test/decorations-watercolor-render.test.js` (7 grain cases: off-by-default,
   `grain:true`, custom params, seed determinism, dedup, distinct-params, bbox-invariant).
   *Known v1 subtlety:* for node washes (each node `<g>` carries its own transform)
   the noise is sampled in node-local space, so the "continuous paper" coherence
   holds within a wash and across same-space draw paths, but not across separately
   transformed nodes — acceptable, can revisit if it reads wrong.

---

## Provenance

Recovered from the Claude.ai conversation **"Programmatic watercolor brush
implementation"** (`d276c3c0-ecf7-4ce7-9e18-aed03c31e51a`), created 2026-06-11. The
session ended mid-design ("I have to leave now"); the open items in §8 are where to
resume.
