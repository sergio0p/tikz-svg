# Path Actions: TikZ §15 Alignment for src-v2

*Created 2026-04-17. Derived from reading pgfmanual §15 "Actions on Paths" (pp. 172–189). Covers the first six items of the implications list — low-effort style-cascade additions plus one structural fix (bounding-box control).*

**Status (2026-04-18):** items 1–5 implemented and tested in src-v2. Item 6 (`use as bounding box`) still outstanding.

---

## Goal

Bring src-v2's path styling cascade closer to TikZ's. All items are additive — no existing behavior changes unless the new key is set. The one structural item (#6) also resolves the "viewport stability" blocker from `Animation/MUSTADDRESS.md` (item 5).

## Scope

| # | Feature | TikZ key(s) | Effort | Status |
|---|---------|-------------|--------|--------|
| 1 | Named line-width styles | `ultra thin` … `ultra thick` | S | ✅ landed |
| 2 | Named dash styles | `solid`, `dotted`, `dashed`, `dash dot`, … (13) | S | ✅ landed |
| 3 | Line cap / line join / miter limit | `line cap`, `line join`, `miter limit` | S | ✅ landed |
| 4 | `color` shorthand | `color=NAME` | XS | ✅ landed |
| 5 | Fill rule | `nonzero rule` (default) / `even odd rule` | XS | ✅ landed |
| 6 | `use as bounding box` | `use as bounding box` | M | pending |

---

## PGF Reference

| File (`References/`) | Key mechanism |
|------|---------------|
| `tikz.code.tex` | Style definitions: `ultra thin`..`ultra thick` (line widths), `solid`..`loosely dash dot dot` (dash patterns), `color`/`draw`/`fill` cascade |
| `pgfcorepathusage.code.tex` | `use as bounding box`: install path's bbox as the picture bbox, ignore all subsequent paths for sizing |
| `pgfmanual.pdf §15.3.1` | Named widths: 0.1 / 0.2 / 0.4 / 0.6 / 0.8 / 1.2 / 1.6 pt |
| `pgfmanual.pdf §15.3.2` | Named dash patterns, phase, `dash expand off` |
| `pgfmanual.pdf §15.5` | `nonzero rule` vs `even odd rule` |
| `pgfmanual.pdf §15.8` | `use as bounding box`, `trim left`/`trim right` |

Copy these files into `References/` if not already there, per the TikZ-reference-first principle.

---

## Current State (src-v2)

- Dash handling lives in three places: node backgrounds, edges (`svg/emitter.js:245-247`), labels/plots (`:420-423`). `style.dashed` accepts `true` (maps to `"6 4"`) or a raw string; `style.dotted` accepts `true` (maps to `"2 3"` on plots only).
- `strokeWidth` is a raw number in `DEFAULTS` and style objects — no symbolic names.
- `stroke-linejoin` is hardcoded to `'round'` for decorated-edge paths (`:355`); no other element configures caps/joins.
- No `miter-limit`, no `fill-rule`, no shared `color` key.
- Bounding box is computed by `expandBBoxFromElement` in `svg/emitter.js` as the union of every rendered element.

---

## Item-by-item design

### 1. Named line-width styles

**Names → pt values** (from §15.3.1):

| Name | pt |
|------|-----|
| `ultra thin` | 0.1 |
| `very thin` | 0.2 |
| `thin` | 0.4 |
| `semithick` | 0.6 |
| `thick` | 0.8 |
| `very thick` | 1.2 |
| `ultra thick` | 1.6 |

**API:** accept the names wherever `strokeWidth` is accepted, on `stateStyle`, `edgeStyle`, `plotStyle`, `pathStyle`, and per-element overrides:

```js
{ strokeWidth: 'thick' }   // same as strokeWidth: 0.8
{ strokeWidth: 1.5 }        // numeric still works
```

**Files:**
- `src-v2/core/constants.js` — add `LINE_WIDTHS = { 'ultra thin': 0.1, ... }`.
- `src-v2/style/style.js` — resolver helper `resolveLineWidth(v)` returns number or passes through.
- Call sites in `style.js` that default `strokeWidth` should call the helper; emitter is unchanged since it already receives a number.

**Tests:** `test/line-width-styles.test.js` — each name resolves to the right pt value; numeric and unknown strings pass through; cascade (config default → per-element) works.

- [x] Add `LINE_WIDTHS` constant
- [x] Add `resolveLineWidth()` helper
- [x] Apply helper in node/edge/plot/path style resolvers
- [x] Tests (`test/line-width-styles.test.js`, 14 cases)

---

### 2. Named dash styles

**Names → `stroke-dasharray`** (§15.3.2). Patterns below are scaled to a 0.4pt reference line width, matching TikZ conventions:

| Name | dasharray |
|------|-----------|
| `solid` | `none` (unset attribute) |
| `dotted` | `{lw} {2lw}` (TikZ: on 0.05mm off 1.5pt → `"0.4 3"`) |
| `densely dotted` | `"0.4 1.5"` |
| `loosely dotted` | `"0.4 6"` |
| `dashed` | `"3 3"` |
| `densely dashed` | `"3 1.5"` |
| `loosely dashed` | `"3 6"` |
| `dash dot` | `"3 2 0.4 2"` |
| `densely dash dot` | `"3 1 0.4 1"` |
| `loosely dash dot` | `"3 4 0.4 4"` |
| `dash dot dot` | `"3 1.5 0.4 1.5 0.4 1.5"` |
| `densely dash dot dot` | `"3 1 0.4 1 0.4 1"` |
| `loosely dash dot dot` | `"3 3 0.4 3 0.4 3"` |

*Final values will be derived from TikZ's `tikz.code.tex` definitions; the table above is the shape — verify pt-for-pt against `References/tikz.code.tex` during implementation.*

**API decision:** replace the current `dashed` + `dotted` pair with a single `dash: <name> | <array> | null` field, keeping `dashed: true` and `dotted: true` as legacy aliases.

```js
{ dash: 'dashed' }
{ dash: 'loosely dotted' }
{ dash: [6, 4] }        // explicit
{ dashed: true }        // legacy: → dash: 'dashed'
```

**Files:**
- `src-v2/core/constants.js` — `DASH_PATTERNS` table.
- `src-v2/style/style.js` — `resolveDash(v)`: returns `null | string`. Handles name lookup, numeric-array joining, legacy `dashed`/`dotted` booleans.
- `src-v2/svg/emitter.js` — the three `style.dashed`/`style.dotted` sites become a single `const dash = resolveDash(style.dash ?? style.dashed ?? style.dotted)` and set `stroke-dasharray` from that.

**Tests:** `test/dash-styles.test.js` — each name emits the right dasharray; arrays emit joined with spaces; `null`/`undefined`/`'solid'` emit no attribute; legacy booleans still work.

- [x] `DASH_PATTERNS` table (verified against `tikz.code.tex`, `\pgflinewidth = 0.4pt`)
- [x] `resolveDash()` helper (+ `resolveStrokeDash()` combining new + legacy keys)
- [x] Consolidate the three emitter call sites (edge, plot, draw-path)
- [x] Legacy compatibility (`dashed: true` → "6 4", `dotted: true` → "2 3" preserved)
- [x] Named-style tests (`test/dash-styles.test.js`, 13 cases)

---

### 3. Line cap / line join / miter limit

SVG attributes: `stroke-linecap`, `stroke-linejoin`, `stroke-miterlimit`.

**API:**

```js
{ lineCap: 'butt' | 'round' | 'square' }        // TikZ: butt | rect | round → SVG: butt | square | round
{ lineJoin: 'miter' | 'round' | 'bevel' }
{ miterLimit: 10 }
```

TikZ's `rect` = SVG's `square`. Our resolver translates.

**Defaults** (matches SVG):
- `lineCap` unset → browser default `butt`
- `lineJoin` unset → browser default `miter`
- `miterLimit` unset → browser default `4`

Emitter writes the SVG attribute only if the style sets a value (avoid attribute noise).

**Files:**
- `src-v2/style/style.js` — pass through in all four style resolvers.
- `src-v2/svg/emitter.js` — where `stroke-width` is set, also set cap/join/miter-limit if present. Remove the hardcoded `stroke-linejoin: 'round'` on decorated paths (`:355`) and let the style control it, defaulting to `round` in `pathStyle` so decorations stay clean.

**Tests:** `test/stroke-caps-joins.test.js` — each key appears on the element when set; omitted when not; TikZ `rect` → SVG `square` translation works.

- [x] Add to style resolvers (pass-through; plot base defaults `lineJoin: 'round'`)
- [x] Emitter writes attributes when present (`resolveStrokeAttrs()`)
- [x] Remove hardcoded linejoin in plot emitter, preserve behavior via `plotStyle` default
- [x] TikZ→SVG cap-name translation (`rect` → `square`)
- [x] Tests (`test/stroke-caps-joins.test.js`, 10 cases)

---

### 4. `color` shorthand

TikZ `color=NAME` sets fill, stroke, and text color together. Other keys (`draw`, `fill`) override.

**API:**

```js
{ color: '#268bd2' }
// same as { stroke: '#268bd2', fill: '#268bd2', textColor: '#268bd2' }
// but { color: '#268bd2', fill: 'none' } sets stroke+text only
```

**Files:**
- `src-v2/style/style.js` — at the top of each style resolver, if `style.color` is set, apply it as the *default* for `stroke`/`fill`/`textColor` *before* the user's explicit values override.

**Precedence:** explicit `fill`/`stroke`/`textColor` in the same style object always wins over `color`. `color` only fills holes.

**Tests:** `test/color-shorthand.test.js` — `color` fills all three; per-field overrides win; unset fields unaffected.

- [x] Add `color` application in node/edge/plot/path resolvers (`spreadColor()` helper)
- [x] Tests (`test/color-shorthand.test.js`, 12 cases)

*Implementation note:* spread is limited to fields that make visual sense per element
type — nodes get stroke+fill+labelColor; edges/plots/paths get stroke only (their
base fill is `none`, so `color` alone does not turn a stroked plot into a filled one).
Explicit `fill` or `stroke` in the same layer still wins.

---

### 5. Fill rule (even-odd vs nonzero)

SVG: `fill-rule="evenodd"`; default `nonzero`.

**API:**

```js
{ fillRule: 'nonzero' | 'evenodd' }
```

**Use case:** rings, donuts, self-overlapping closed paths. Needed when a path visits an interior hole.

**Files:**
- `src-v2/style/style.js` — pass through; no default (means "don't emit attribute").
- `src-v2/svg/emitter.js` — write `fill-rule` on any fillable element when `style.fillRule` is set. Applies to node backgrounds, closed `paths`, and filled plots.

**Tests:** `test/fill-rule.test.js` — attribute absent by default; `evenodd` emits on nodes, paths, plots.

- [x] Add to resolvers (pass-through)
- [x] Emitter writes attribute on fillable elements (`resolveStrokeAttrs()`)
- [x] Tests (`test/fill-rule.test.js`, 6 cases)

---

### 6. `use as bounding box` — viewport control

**Problem** (from `Animation/MUSTADDRESS.md` #5): the viewBox is the union of every rendered element. For animations that show frames progressively, early frames appear "zoomed out" because the viewBox already accounts for later frames. There's no user API to lock the viewport.

**TikZ's solution (§15.8):** mark one path or node with `use as bounding box`. That path's bbox becomes the picture's bbox; all subsequent paths are ignored for sizing (but still drawn).

**API (two complementary forms):**

```js
// Form A: mark a specific element (parallels TikZ exactly)
{ type: 'path', id: 'viewport', useAsBoundingBox: true, points: [...] }

// Form B: explicit rectangle at the config level (escape hatch)
render(svg, { viewBox: [x, y, width, height], ... })
```

Form A is the canonical TikZ mechanism. Form B is convenient when no natural bounding element exists.

**Semantics:**
- If any element has `useAsBoundingBox: true`, the viewBox is computed from that element's bbox (union of all such elements if >1) **instead of** the union of all elements.
- If `config.viewBox` is set, it wins over both forms — raw override.
- The element marked `useAsBoundingBox` is still rendered unless `draw: false` and `fill: false` are also set (parallels TikZ, where `\path[use as bounding box]` without `draw`/`fill` is invisible).

**Files:**
- `src-v2/svg/emitter.js` — refactor `computeViewBox()`:
  1. First pass: collect elements marked `useAsBoundingBox`. If non-empty, compute bbox from them only.
  2. Else: current behavior (union of everything).
  3. Override: if `config.viewBox` is set at emit time, use it verbatim.
- `src-v2/index.js` — propagate the `useAsBoundingBox` flag through Phase 2.5 (no transform needed) and into the draw-item list.
- Export `computeViewBox()` so Layer 2 animation controllers can call it for `:view` animation keyframes.

**Tests:** `test/bounding-box.test.js`
- One element marked → viewBox equals its bbox.
- Multiple marked → union of marked elements.
- None marked → current behavior.
- `config.viewBox` wins.
- Marked element is still drawn.
- Invisible-marked element (`stroke: 'none', fill: 'none'`) still contributes bbox.

- [ ] Thread `useAsBoundingBox` through node/edge/path/plot item types
- [ ] Refactor `computeViewBox()` with two-pass logic
- [ ] Export `computeViewBox()` from `svg/emitter.js`
- [ ] Honor `config.viewBox` as raw override
- [ ] Tests
- [ ] Update `Animation/MUSTADDRESS.md` to mark viewport issue resolved (cross-reference this item)

---

## Out of scope (deferred)

These appeared in the §15 implications list but aren't in this plan:

- `double=color` lines (item 7 in the summary)
- `clip` / `<clipPath>` (item 8)
- `preaction` / `postaction` (item 9)
- `path picture` (item 10)
- Fill patterns and gradients (item 11)
- `dash expand off`, `trim left/right`, tip-only `tips` key

Items 7–10 belong in their own plan once #1–#6 land. Patterns/gradients are polish.

---

## Sequencing

All six items are additive; no API break. Suggested order:

1. Items 4 and 5 first — smallest surface area, validates the plan-workflow.
2. Items 1, 2, 3 together as a "line-style cascade cleanup" PR.
3. Item 6 last — the only structural change, cross-references animation work.

Each item shippable independently with tests.

## Estimated effort

- Items 1, 2, 3, 4, 5: ~½ day each including tests (3 days total if done serially; less in parallel).
- Item 6: 1 day (emitter refactor + tests + doc update).

## Verification

For each item, a blind-audition demo in `examples-v2/` comparing our output to a native TikZ reference (compile with `xelatex`, visually diff). Especially important for item 2 (dash patterns are visually sensitive) and item 6 (bounding-box edge cases are easy to get wrong).
