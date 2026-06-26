# Bug Report: KaTeX labels collapse to (0,0) when `fonts.ready` resolves before the math faces load

**Status:** ✅ **Fixed 2026-06-25** in `src-v2/core/katex-renderer.js`. The shipped
fix is *not* the prototype recorded under *Proposed fix* below — see *Resolution*
immediately after this header for what actually landed and why.

**Severity:** Medium (intermittent, visually fatal when it strikes).

**Module:** `src-v2/core/katex-renderer.js`

**Found in:** comb/butterfly payoff figure (`3-Tortoise/Julia/figures/comb_plot_html.jl`)
rendered through `src-v2`, served by the Comb March GUI. Recurs intermittently;
labels `e_A,e_B`, `U_A`, `U_B`, `x₁`, `y₁` all stack at the top-left origin.

---

## Resolution (what shipped, 2026-06-25)

The landed fix is a **FontFaceSet-native, event-driven correction loop**, chosen
over the *Proposed fix* below after a design panel found that proposal (and the
other candidates) reintroduced a permanent-collapse path. The decisive fact: the
prototype's readiness primitive, `document.fonts.check(...)`, returns `true`
**vacuously** when no matching `@font-face` is declared — i.e. exactly during the
CSS-in-flight window this bug is about — so it would mark "ready" at t=0 and pin
fallback metrics. Gating a one-shot commit on *all* declared faces is also unsafe:
one blocked/404'd unused face (Fraktur, Script, Size4) would wedge correction for
the whole page.

What shipped instead:

1. **Delete `_fontsReady`** — the single source of both halves of the bug.
2. **Discover faces by family** (`/^KaTeX/`), not a hardcoded Main/Math pair, so
   all faces (AMS, Size1–4, Caligraphic, …) are covered automatically.
3. **Converge on the recurring `loadingdone` event**: each KaTeX font batch clears
   `_measureCache` and re-fits every registered math diagram. Recurring
   invalidation is the real cure for the sticky/poisoned cache.
4. **Re-armable queue keyed by `svgEl`** — never permanently disarms; repeated
   `render()` calls de-dupe.
5. **Cache-write gate** — a measurement taken while a face is `'loading'` is
   returned but never pinned.
6. **`fonts.ready` retained as a one-shot hint** (guaranteed second paint;
   upgrades a late plain-text fallback) plus a **bounded backstop** (the one
   tunable constant) for the tail case where no font event ever fires.

`index.js` unchanged. Regression test: `test/katex-font-race.test.js` (6 cases via
a jsdom-injected fake FontFaceSet — the production path was previously untested
because jsdom doesn't implement `document.fonts`). The consumer-side
`waitForKatex()` / double-rAF guards in `comb_plot_html.jl` and `comb_supp3.html`
can now be relaxed.

> The sections below (*Proposed fix*, *Suggested path forward*) are the **original,
> superseded** plan, retained for the historical record. They are **not** what was
> implemented.

---

## Summary

Every KaTeX label in a diagram occasionally collapses onto the origin `(0, 0)`
instead of sitting at its intended position. It is a **race**, not a deterministic
failure: on a cold load with the CDN font in flight it triggers; on a warm cache it
usually doesn't. Once it triggers, the bad geometry is **sticky** — a fallback
measurement gets memoized and is never recomputed for the life of the page.

This is the same underlying async-KaTeX hazard already noted in `BUGREPORT.md`
("Attempts to freeze the viewBox after `render()` are overwritten when KaTeX
finishes…") and `TODO.md` ("ViewBox recomputed after async KaTeX render"), but seen
from the **measurement** side rather than the viewBox side.

## Expected behavior

Math labels are measured with the real KaTeX web fonts and positioned at their
computed coordinates, regardless of whether the fonts were cached or fetched
cold. The re-render-on-font-load machinery (README.md §"KaTeX measurements are
memoized … the cache is invalidated on font load") should guarantee this.

## Actual behavior

When the font fetch loses the race, labels render with fallback metrics and
collapse to `(0, 0)`. The collapse persists even after the fonts finish arriving,
because the wrong measurement is already cached and the re-render never fires.

## Root cause

`document.fonts.ready` is **not** a reliable signal that the KaTeX faces exist.
KaTeX's `@font-face` fonts are *lazy* — the browser fetches a face only when a
glyph first needs it — and a CDN `katex.min.css` may still be in flight. So
`fonts.ready` can resolve **before** `KaTeX_Main` / `KaTeX_Math` are actually
available. The current code trusts that event directly:

```js
// src-v2/core/katex-renderer.js
let _fontsReady = false;
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => { _fontsReady = true; _measureCache.clear(); });
}
```

When that early resolve flips `_fontsReady = true`, two things break at once:

1. **The auto re-render is disarmed.** `registerPendingReRender()` early-returns
   when `_fontsReady` is already `true`, so the math config never gets its
   post-font re-render — the one chance to fix the geometry is skipped.

   ```js
   export function registerPendingReRender(svgEl, config, renderFn) {
     if (_fontsReady) return; // ← no-ops because _fontsReady was set prematurely
     _pendingReRenders.push({ svgEl, config, renderFn });
   }
   ```

2. **The bad measurement is pinned.** Any measurement taken in this window returns
   fallback metrics, and the cache write accepts any non-zero result:

   ```js
   // Zero dimensions mean measurement failed (hidden element) — don't cache
   if (dim.width > 0 || dim.height > 0) _measureCache.set(key, dim);
   ```

   The cache is only ever cleared on the (single, already-fired) `fonts.ready`
   event, so the fallback metric is never re-measured. Result: a permanent
   collapse.

In short: a premature "ready" both **caches the wrong answer** and **cancels the
mechanism that would have corrected it**.

## How to reproduce

1. Hard-reload a page with KaTeX math labels and an uncached CDN `katex.min.css`
   (DevTools → disable cache, or throttle the network).
2. Some fraction of loads render every label stacked at the top-left origin.
3. The collapse does not self-heal on subsequent paints within the same page.

The consumer-side `waitForKatex(6000)` guard in `comb_plot_html.jl` widens the
window enough to usually win the race, which is exactly why the bug is *intermittent*
rather than constant — it's a timing patch over the library-level defect.

---

## Proposed fix (prototyped, then reverted)

Two changes in `src-v2/core/katex-renderer.js`. **Both were reverted** so the
library stays clean; this section records the rationale for if/when the fix is
done properly as a tracked library change.

**1 — Don't trust the bare event; prove the faces are loaded.** Replace the direct
`fonts.ready` handler with a routine that, after `fonts.ready`, force-loads the
KaTeX faces via `document.fonts.load('16px ' + face)` and *verifies* them with
`document.fonts.check(...)` (bounded poll, ~8 s cap) before setting `_fontsReady`,
clearing the cache, and flushing the pending re-renders. Required faces:
`KaTeX_Main`, `KaTeX_Math` (the ones the labels actually use). No KaTeX on the page
⇒ nothing to wait for.

*Rationale:* this makes `_fontsReady` mean what the rest of the file already assumes
it means — fonts genuinely usable. It keeps the documented re-render-on-font-load
contract intact and simply removes the premature trigger that defeats it. It does
**not** invent new behavior; it makes the existing behavior correct.

**2 — Gate the cache write on `_fontsReady`.**

```js
if ((dim.width > 0 || dim.height > 0) && _fontsReady) _measureCache.set(key, dim);
```

A pre-font measurement is still *returned* (so the first paint isn't blank) but
never *stored*; the queued re-render re-measures with real fonts and caches the
correct dims.

*Rationale:* this is the belt-and-suspenders half. Even if a measurement slips
through before fonts settle, it can no longer poison the cache permanently.

### Why it was reverted (alignment notes)

- The repo's **documented** fix for the async-KaTeX family of bugs lives at a
  different layer — `config.viewBox` opt-out + skip-re-render-for-math-free in
  `svg/emitter.js` / `index.js` (TODO.md, *Fixed 2026-06-11*). The prototype sits
  in `katex-renderer.js` instead, so it is orthogonal to, not continuous with, the
  maintainers' chosen approach.
- Change **2** adds a condition (`&& _fontsReady`) that README.md's memoization
  description ("memoized per (html, fontSize)") does not mention — an improvement,
  but undocumented behavior.
- The prototype merged the two separate `fonts.ready` handlers into one, which
  makes the existing comment at `katex-renderer.js:109–114` ("this handler is
  registered before the re-render handler below") stale.
- A proper library fix would also update `BUGREPORT.md` / `TODO.md` / `README.md`
  and add a test under `test/`, per the `tikz-svg-builder` skill discipline.

## Suggested path forward

1. Add `document.fonts.load` + `document.fonts.check` gating to the font-ready
   routine (change 1) as a tracked library change.
2. Gate the measure-cache write on verified font readiness (change 2).
3. Add a jsdom test that simulates an early-resolving `fonts.ready` with faces not
   yet `check()`-able, asserting no measurement is cached until verification.
4. Update `README.md` §KaTeX and the `TODO.md` open-bugs table.
5. Once landed, the consumer-side `waitForKatex()` guard in `comb_plot_html.jl`
   can be relaxed or removed.
