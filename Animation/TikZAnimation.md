# TikZ Animation System — Notes for tikz-svg

*Digest of `pgfmanual.pdf` §26 "Animations" (pages 381–416), captured 2026-04-17. Focused on what we can reuse or mimic in our Layer 2 controller and Layer 3 authoring vocabulary.*

---

## Key takeaways

### 1. Atomic unit: the five-part tuple `(object, attribute, id, time, value)`

A timeline is identified by `(object, attr, id)`; `id` lets multiple independent timelines attach to the same attribute (e.g., two `:shift`s that compose). An `entry` key commits one tuple. This is more structured than our `<frame> element verb` and decouples timeline identity from keyframes. Our verbs (`fades`, `moves`) are really sugar over attribute-timelines.

### 2. Time model is continuous, not discrete

- Absolute units: `2s`, `500ms`, `1min`, `01:08` (= 68s)
- Relative: `1s later` — offset from the previous `time` key
- `fork` — sub-process scope resetting local time to 0 with an offset; enables "sub-animations"
- `remember` / `resume` — save the current absolute time into a macro, then jump back to it
- `sync` — execute options in a TeX scope but keep the resulting time visible outside

Our "frame" is really a **named moment** in a continuous timeline, and `<2, in:500>` compiles to "timeline from [frame-2-start − 500ms] to [frame-2-start] on some attribute." Suggests: keep frames at Layer 3 as sugar, compile to timelines at Layer 2.

### 3. Attribute list is small and SVG-aligned (§26.4)

`:fill`, `:draw`, `:text`, `:opacity`, `:fill opacity`, `:draw opacity`, `:line width`, `:dash`, `:dash phase`, `:dash pattern`, `:path`, `:visible`, `:stage` (off-stage by default), `:shift`, `:position`, `:translate`, `:xshift`, `:yshift`, `:scale`, `:xscale`, `:yscale`, `:rotate`, `:xskew`, `:yskew`, `:xslant`, `:yslant`, `:view`.

Note: `:color` is sugar for `{:draw, :fill, :text}`. `:position` is absolute; `:shift` is relative. Our verb list maps one-to-few onto these.

### 4. Conflict-resolution rules (§26.2.5)

When several timelines target the same attribute:

1. If no timeline is active at the current time, the last-encountered `base` wins (falls back to the surrounding style if no `base`).
2. Among active timelines, the one that started **last** wins.
3. If several started at the same time, the one that comes **later in code** wins.

Canvas transforms (`:shift`, `:scale`, `:rotate`, `:xshift`, `:yshift`, etc.) are exempt — **they always accumulate**. Our controller needs this split.

### 5. `base` value — fallback when timeline is inactive

We don't currently have this; our Layer 1 only has `visibility: hidden` for frames < first. For "red until frame 2, then fades to blue" we need `base`. Syntax in TikZ: `base = "orange"` as a key, or `"red" base` after a value.

### 6. Events as first-class triggers

- `begin on = { click }` or `{ mouse over }`, `{ mouse down/up/move/out }`, `{ focus in/out }`, `{ key=Right }`
- `begin on = { begin, of = anim-name }` — chain to another timeline's start
- `begin on = { end, of next = anim-name }` — chain to another's end
- `begin on = { repeat = 2, of = anim-name }` — fire after N repeats
- Plus `delay = t` after the event
- `restart = true | false | never | when not active` — behavior if event fires again
- `end on = {...}` — symmetric early-termination

Our controller currently only has arrow-key nav; events are nearly free via SVG/CSS and unlock click-to-reveal, scroll triggers, and chained animations.

### 7. `:path` morphing requires identical path structure

All keyframe paths must share the same command sequence; only coordinates may differ. A rectangle cannot morph to a circle via `:path` — both must be expressed with the same Bézier topology (TikZ example shows a circle written as four `controls` segments to match a rectangle).

Implication: our `draws`/`undraws` verb should be a `:dash` / stroke-dashoffset animation, not a `:path` morph.

### 8. Arrow tips on animated paths

Use `animate/arrows` (an animation-only key), **not** the normal `arrows` key. Internally, TikZ renders animated-path arrow tips as SVG `<marker>` elements that rotate along the morphing path; static paths can't share this pipeline. Similarly, `shorten <` and `shorten >` must be passed to the animation, not the static path.

### 9. Timing curves (§26.5.4)

- `exit control = {t}{v}` and `entry control = {t}{v}` — cubic Bézier control points in normalized (time, value) on [0,1]²
- Shorthands: `ease in = f`, `ease out = f`, `ease = f` (both sides)
- `stay` — hold first value then jump at end of interval (step-end)
- `jump` — jump immediately then hold (step-start)

Maps 1:1 to CSS `cubic-bezier(...)` timing functions. We can expose the same syntax.

### 10. Repeats

- `repeats` (empty) → forever
- `repeats = N` → N times (non-integer allowed, e.g. `1.75`)
- `repeats = for 4s` → stops after time budget
- Optional second word `accumulating` — iteration N+1 starts from iteration N's end-state. Useful for steady motion (shift 1cm each second = 5cm over 5s, not reset each time).

### 11. `:view` — camera primitive

Animates a rectangle-to-rectangle canvas transform (shifts + scales the canvas so rect A matches rect B). Requires the `views` library to set up a base view with `meet` or `slice`. This is exactly our "camera zooms/pans/focuses" verb family.

Answers our open "viewport stability" question: provide a `view` attribute + `:view` timeline rather than an ad-hoc `recomputeViewBox()`.

### 12. `forever` / `freeze`

After the last keyframe, `forever` (alias `freeze`) holds the final value rather than reverting. Relevant default choice for our "element persists after its animation" semantics.

### 13. Snapshots (§26.6)

`make snapshot of = 2s` renders the static state at t=2s into the output. This is both:
- the PDF fallback (PDF doesn't support SMIL)
- the model for our "print version of an animation"

Restrictions: `current value` forbidden inside snapshotted timelines; `begin on`, `end on`, `begin`, `end` are silently ignored (snapshots ignore interactive triggers); accumulating repeats are not supported.

Our Layer 1 output is essentially a snapshot-at-frame-N emitter — the concepts align.

### 14. Acknowledged TikZ limitations (that also apply to us)

- Lines between moving nodes don't auto-follow endpoints — must introduce "virtual nodes" and animate the line separately.
- Bounding-box computation tracks only `:shift`s, not `:rotate`, `:scale`, `:skew`, nor multiple simultaneous shifts.
- `current value` (interpolate from "whatever the value is right now"): only usable as the first keyframe, only in 2-keyframe timelines, forbidden in snapshots.

### 15. Coordinate systems for animation (§26.4.3–26.4.4)

`:shift` / `:scale` / `:rotate` operate in the **animation coordinate system**, which defaults to the local coordinate system of the animated object. `origin = {c}` shifts this origin; `transform = {rotate=90,scale=2}` applies an arbitrary pre-transform. The **inverse** of this transform is what TikZ actually uses internally, so ill-conditioned transforms are numerically unstable.

`:position` is different: absolute coordinates in the picture's coordinate system, not the node's local frame. Use `:position` for "move from A to B" semantics, `:shift` for "nudge relative to here."

`along = { path }` lets `:shift` or `:position` follow a path; add `sloped` to rotate the object to point along the tangent, or `upright` to keep orientation fixed. `in 2s` after the path says the value `"1"` corresponds to t=2s.

---

## Concrete adjustments for our design

1. **Swap the internal model** from "frames with phases" to "timelines over continuous time, with frames as named time-points." Vocabulary stays the same; the controller compiles to timelines. Easier to map to SVG SMIL / WAAPI.
2. **Add `id` to timelines** so two independent `:shift` animations can compose on one element.
3. **Add `base`** — fallback value when no timeline is active.
4. **Add `:view`** as the camera primitive; our `zooms`/`pans`/`focuses` verbs become sugar over `:view` timelines.
5. **Split transforms from attributes in conflict rules** — transforms accumulate, attributes use last-wins.
6. **Adopt TikZ's easing syntax** (`ease in`, `ease out`, `exit control`, `entry control`) — it's CSS-compatible.
7. **Constrain `:path` morphs to identical structure**, and document this. Our `draws`/`undraws` should be `:dash` animations, not `:path` animations.
8. **Events beyond arrow keys** — `begin on = click`, `begin on = { end of = anim }`, etc. Cheap to add, big expressive win.
9. **Provide `origin` and `transform`** for the animation coordinate system, so "rotate around a point" has a canonical solution.
10. **`accumulating` repeats** for steady-motion loops.

---

## What we should NOT copy from TikZ

- TeX-macro-based scoping (`remember`/`resume`/`fork`) — we have real JS variables; this is a TeX workaround for a lack of variables.
- The `sync` hack for keeping time-state across a scope — same reason.
- The colon-prefix attribute syntax — it makes sense in TikZ's key-value parser; in our JS/Markdown world, `{ attribute: 'fill' }` or `node.fill = { ... }` is cleaner.
- `current value` with its three-way restrictions — we can likely do better in a reactive model, or skip it entirely.

---

## Open questions this reading didn't answer

- How does SVG SMIL handle multiple active animations on the same attribute? (TikZ's conflict rules must compile down to SMIL's `additive`/`accumulate` attributes — worth verifying.)
- Does SVG SMIL support the equivalent of `fork` / `begin on = begin of = X`? (Yes via `begin="X.begin"`, but worth testing across browsers — Safari has quirks.)
- WAAPI vs SMIL vs CSS transitions — which is the best target for our Layer 2? TikZ picks SMIL; SMIL is deprecated in some specs but still works. A WAAPI target would give us `AnimationTimeline` objects and scrub control for free.
