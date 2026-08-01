# Plan 1 — Concerns & Flags Raised (for later review)

**Context:** During the Plan 1 watercolor styling-parity refactor I ran an adversarial
review (13 agents: 3 reviewers × verify pass) over `src-v2/svg/emitter.js`. It raised 10
findings — **3 confirmed real, 7 dismissed.** Two of the real ones I fixed; one I deliberately
did **not** fix because it's a design decision for you. This doc records all of it plus a
couple of non-review flags (commit hygiene, unilateral decisions) so you can review when rested.

Everything below is **already committed** (`1122891`); none of it blocks anything. The only
item that wants a decision from you is **§1**.

---

## 1. OPEN — needs your decision: grain speckles a directed edge's arrow tip

**Severity:** minor. **Status:** NOT fixed; flagged.
**Where:** `emitter.js` — `applyWashAttributes` (~:405) + `applyGrainFilters` (:482).

**What happens:** for a **directed edge** with `grain: true`, the invisible arrow-carrying
spine is appended *inside* the same `<g class="watercolor">` that carries `data-grain`.
`applyGrainFilters` then sets the paper-grain `filter` on that group, so the feTurbulence runs
over the crisp arrowhead too — the tip picks up grain speckle.

**Why it's inconsistent:** **draw-paths don't have this.** Their spine sits on the *ungrained*
outer `<g class="draw-path">` wrapper while grain lives on the inner leaf `<g class="watercolor">`.
So today: draw-path arrow tips are clean, edge arrow tips are grained. Same feature, two behaviours.

**Why I didn't just fix it:** the clean fix is to give edges the same wrapper structure
draw-paths use (grain on an inner leaf, spine + id/opacity/className on an outer wrapper). But
that **moves the `id`/`className`/`opacity` off `g.watercolor`**, which is the current public
contract — `refs.byId`, the styling tests (`g.watercolor#e1`), and the bbox/marker tests all
assume those live on `g.watercolor`. So it's a real structural change with test ripple, not a
one-liner. It's a branching decision, so I stopped and am asking rather than picking for you.

**It's also genuinely ambiguous which way is "right":**
- *Grain the tip on both* — the tip is painted in the same watercolor pigment, so graining it
  is arguably more faithful. (Fix = make draw-paths grain their tips too — easier.)
- *Grain neither* — keep crisp tips as deliberate punctuation against the wash. (Fix =
  restructure edges as above — harder, touches the contract.)

**Scope note:** only manifests with `grain: true` AND a directed edge; default grain strength
0.20 leaves the tip visible, so it's subtle.

**My recommendation:** fold this into **Plan 2 Fix #1** (which already reworks grain/shadow
filter emission) rather than doing a standalone edge restructure now — that fix is the natural
home for "decide once how grain composes with everything on a wash group." Flagged in the
Plan 2 handoff already.

> **Decision needed:** fix now (and which direction), or defer to Plan 2 Fix #1?

---

## 2. Already fixed (recorded for the audit trail)

These two were confirmed real and I fixed them before committing. Listed so you can sanity-check
the fixes, not because anything is pending.

### 2a. `useAsBoundingBox` silently no-op'd on a fully-invisible washed draw path (nit)
A watercolor draw path with `fill:'none'` + `stroke:'none'` + no arrows produced an **empty**
`<g class="draw-path">` that still got tagged `data-use-as-bbox`. `computeViewBox` then found no
geometry under the tag and silently fell through to the global walk — so the viewBox tracked
unrelated content instead of honouring the flag.
**Fix:** `emitter.js:759` — only set the bbox flag when the wrapper actually bounds geometry
(`hasFill || stroke !== 'none' || arrowStartId || arrowEndId`). Degenerate input only; not a
regression (pre-refactor dropped `useAsBoundingBox` on washes entirely).

### 2b. Styling test's spine-`d` assertion was near-vacuous (minor)
The test checked the spine's `d` with `/^M/`, which **every** path matches (nominal band + every
bleed layer also start with `M`). A regression that sourced the spine from the deformed ribbon
instead of the straight centerline would still have passed.
**Fix:** `test/decorations-watercolor-styling.test.js:~65` — now asserts the straight shortened
centerline (`/^M [\d.]+ 0 L [\d.]+ 0$/`) and that it differs from the ribbon nominal, locking the
"spine = arrow-shortened centerline" contract that places the tip correctly.

---

## 3. Dismissed findings — surfaced but judged non-issues

The review's verify pass refuted these 7. I list them so you can **re-open any you disagree
with** — a couple are "forward-looking, fine for now" rather than "wrong," and your judgement
may differ from the verifier's.

| # | Finding | Why dismissed | Worth a second look? |
|---|---|---|---|
| 1 | Test §8b.6 (bbox arrow disc) implemented differently than the plan's written wording | The impl proves the same property more directly (drives the bbox walker), documented in a test comment; plan-wording mismatch only | No — equivalent, better |
| 2 | §8b.10 tolerance is a hard 20px, not "≈ brush half-width" prose | Plan's operative instruction was "reuse the :184-198 pattern," which *is* 20px | No |
| 3 | Arrow tips rely on markers painting over a `fill:none/stroke:none` spine | Spec-guaranteed in all browsers; the plan's own named risk (§11) with a documented transparent-stroke fallback; passed headless Chrome | No — but it's *the* runtime assumption, keep in mind if a renderer ever misbehaves |
| 4 | Empty `<g class="draw-path">` wrapper still left in DOM (+ possible floating tip) | Degenerate input; mirrors what the crisp branch already emits; harmless | **Soft** — see note below |
| 5 | Wrapper is a `<g>`, so a `.draw-path { stroke: … }` CSS rule would cascade into wash layers | No such CSS rule exists anywhere; library styles via presentation attributes; class reuse is intentional/documented | **Soft** — see note below |
| 6 | No automated test that markers render on the invisible spine | jsdom can't render markers/filters by construction; covered by the headless-Chrome gate | No |
| 7 | Washed `useAsBoundingBox` is wider than crisp by ~brush half-width; 20px tolerance hides it | Intended design — a wash's painted geometry *is* the ribbon, so bounding the ribbon is correct | No |

**Soft items worth a glance later (not bugs):**
- **(#4)** I guarded the *bbox flag* but still append the empty wrapper itself for that
  degenerate `fill:none + stroke:none` watercolor path. It's harmless DOM litter mirroring the
  crisp branch. If you'd rather not emit anything for a paint-nothing path, that's a small
  follow-up — but it only triggers on self-contradictory input (a watercolor decoration on a
  path that paints nothing).
- **(#5)** Forward-looking only: if you ever add author CSS targeting `.draw-path` or
  `.watercolor` (currently they're JS query hooks, never styling targets), `stroke` is
  inheritable and would bleed into wash layers (they set only `fill`). Worth remembering before
  writing any such rule.

---

## 4. Commit hygiene flag — the untracked 43 MB dump

`Animation/data-fc40aa10-…-batch-0000/` (43 MB of FleetView dumps: conversations.json,
memories.json, etc.) is **untracked and was deliberately excluded** from commit `1122891`.

The `.gitignore` line you added ignores `data-*.zip` (the zip form) but **not** the extracted
`Animation/data-*/` directory — so that dump still shows in `git status` and a `git add -A`
would grab it. **Suggestion:** add `Animation/data-*/` (or `data-*/`) to `.gitignore`. Say the
word and I'll do it.

---

## 5. Decisions I made unilaterally (revisit if you disagree)

1. **Committed to `main` directly** rather than branching first. Rationale: your recent history
   is all linear commits to `main`, and you said "commit" plainly. Trivially reversible if you'd
   have preferred a branch.
2. **Folded the `.gitignore` hygiene line into the watercolor feature commit.** It's thematically
   unrelated (animation dumps, not watercolor) but a one-liner; called out in the commit body for
   transparency. Could be split out if you keep commits strictly single-purpose.

---

## 6. Plan 1 ↔ Plan 2 coordination (pointer, not a concern)

Plan 1 changed `watercolorGroup` to 3-arg and restructured `emitDrawPath` into a `g.draw-path`
wrapper, shifting Plan 2's "Source facts" line numbers and two call signatures. **Already fully
documented** in `WATERCOLOR-PLAN-2-HANDOFF.md` with a stale-warning pointer at the top of
`WATERCOLOR-PLAN-2-targeted-bugfixes.md`. No action — just don't trust Plan 2's raw line numbers
without reading the handoff first.
