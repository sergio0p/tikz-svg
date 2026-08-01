# Watercolor Plan 2 — follow-ups & known issues

Recorded after the Plan 2 targeted-bugfix landing (the five fixes + the adversarial
review pass). The five fixes are implemented, tested, and green (856 tests). This file
tracks what the review surfaced that was **deliberately left out of scope**, plus the
findings that were **considered and dismissed** so they aren't re-investigated.

Status legend: 🟡 open follow-up · ✅ resolved during Plan 2 · ⚪ dismissed (not a bug).

---

## 🟡 1. Plot `fill` is not color-normalized (same defect Fix #4 closed for paths)

**Severity:** minor · **Category:** correctness · **Confidence:** high (reproduced) ·
**Scope:** out of scope for Plan 2; **pre-existing**, not a regression from any of the five fixes.

`resolvePlotStyle` uses a single field list `plotColorFields = ['stroke']` for **both**
the `color=` shorthand spread **and** the final `normalizeColors` call, so a plot's
`fill` field is never run through `resolveColor`. `emitPlot` then writes that raw value
straight onto the SVG attribute.

- `src-v2/style/style.js` — `resolvePlotStyle` (~194–219): `plotColorFields=['stroke']`
  feeds both `spreadColor(...)` and `normalizeColors(merged, plotColorFields)`.
- `src-v2/svg/emitter.js:738` — `fill: style.fill ?? 'none'` (raw, unparsed).

**Symptoms (only when an explicit named/mix plot fill is set):**
- `fill: 'green'` → renders CSS green `#008000` instead of TikZ green `#00ff00`
  (`NAMED_COLORS.green` is `#00ff00`).
- `fill: 'red!50!blue'` → emits the literal token `red!50!blue`, which the browser
  cannot parse and silently drops (no fill painted).

**Why it rarely bites:** `DEFAULTS.plotFill` is `'none'` (`constants.js:75`), so the gap
only surfaces when a user explicitly sets a named or TikZ-mix plot fill. Filled-region
plot handlers (`closedcurve`, `ybar`, `barchart`) are the realistic triggers.

**Inconsistency it creates:** nodes normalize `fill` (`nodeColorFields` includes
`'fill'`, `style.js:131`) and — after Fix #4 — paths do too
(`pathNormalizeFields=['stroke','fill']`). Plots are now the lone resolver that doesn't.

**Suggested fix (mirrors Fix #4 exactly):**
```js
// in resolvePlotStyle
const plotColorFields = ['stroke'];            // color= still spreads to stroke only
const plotNormalizeFields = ['stroke', 'fill']; // but normalize both pigments
// ...
normalizeColors(merged, plotNormalizeFields);
```
Add a guard test (parallel to `color-shorthand.test.js` for paths): a plot with
`color:'#xxxxxx'` leaves `fill` untouched, while a plot with `fill:'red!50!blue'`
resolves to `#800080` and `fill:'green'` to `#00ff00`.

---

## 🟡 2. Grain speckles a directed edge's arrow tip (spine/grain asymmetry)

**Severity:** minor · **Category:** edge-case · **Source:** Plan 1 review, carried in
`WATERCOLOR-PLAN-2-HANDOFF.md` §3.

For a **directed edge**, the invisible arrow-carrying spine sits *inside* the same
`<g class="watercolor">` that also carries `data-grain`. So when grain is enabled, the
paper-grain filter is applied to the group as a whole and also granulates the crisp
arrow tip — the marker picks up speckle it shouldn't.

Draw-paths do **not** have this problem: their spine lives on the ungrained
`<g class="draw-path">` wrapper while grain rides the inner leaf wash, so the two are
cleanly separated.

- Edge case lives in `emitter.js` — `emitEdgePath` watercolor branch (the spine is
  added to the same group that gets `data-grain`).

**Suggested fix (when the edge structure is next reworked):** mirror the draw-path
shape — wrap the edge washes in a parent `<g>`, put the arrow spine on the *parent*, and
keep `data-grain` on the inner leaf wash so the grain filter never reaches the marker.
This is natural to fold into any future change that touches grain/filter structure;
otherwise it's a standalone minor follow-up. **Not yet fixed.**

---

## ✅ Resolved during Plan 2 (recorded for completeness)

- **Arrow on a fill-only watercolor `\draw` → orphan arrowhead.** Fix #2's ribbon gate
  ignored arrows, so a `{fill, arrow:'->', no stroke}` path dropped its ribbon but kept
  the marker → a floating tip. Now an arrow implies a stroked line (matches the crisp
  branch and TikZ `\draw[->]`): the gate fires on an arrow, and the marker spine is tied
  to whether a ribbon actually exists, so the contradictory `stroke:'none' + arrow` case
  shows no orphan tip either. `emitter.js:816–848`. Covered by a render regression test.
- **Untested ribbon-trigger cells.** The `color=` shorthand and named-style stroke cells
  of Fix #2's truth table now have direct render coverage
  (`test/decorations-watercolor-render.test.js`, Fix #2 block).

---

## ⚪ Considered and dismissed (do not re-raise)

- **Fix #5 — "module-`let` salt is per-module-instance."** Factually true as a JS
  observation, but the precondition that would make two filters collide does not exist in
  the codebase: `collectShadowFilters`/`applyGrainFilters` each run once per `render()`,
  the salt is monotonic and never reset, within-render dedup is preserved, and the three
  id prefixes can't collide. Not a substantive bug.
- **Fix #3 — "the wash overpaints the stroked border."** The stroked nominal is appended
  before the bleed layers, so source-over paints the wash over the border. This is the
  plan's **explicit intent**: the stopgap border is a faint edge meant to read *through*
  the translucent wash, not a crisp outline on top. The smooth translucent rim wash is
  separate (item-3) work. Not a deviation; not a bug.

---

*Sources: the Plan 2 plan + handoff (`WATERCOLOR-PLAN-2-targeted-bugfixes.md`,
`WATERCOLOR-PLAN-2-HANDOFF.md`) and the adversarial review (6 reviewers + per-finding
verification).*
