# tikz-svg — Open TODOs (canonical)

**Refreshed 2026-05-06.** Consolidates status from audit reports, plans, SKILL-GAPS.md, BUGREPORT.md, and Animation/. The root `TODO.md` defers to this file for detail.

---

## Status

| Subsystem | Library | Tests | Notes |
|-----------|---------|-------|-------|
| Production renderer | `src-v2/` | 756 / 205 suites | Stable. 23 shapes, 18+9 arrow tips, plots, paths, layers, KaTeX, decorations. |
| Animation sandbox | `src-v3/` | shares + `auto-ids-v3` | Fork of v2. Layer 1 metadata done. Not in production. |
| Deprecated | `deprecated/` | — | `automata-wrapper/`, `src-v1/`. |

---

## Pending Library Work

### TikZ §15 path actions

| # | Item | Status |
|---|------|--------|
| 1 | Named line widths (`ultra thin` … `ultra thick`) | ✅ |
| 2 | Named dash patterns (12 patterns) | ✅ |
| 3 | Line cap / line join / miter limit | ✅ |
| 4 | `color` shorthand | ✅ |
| 5 | Fill rule (`nonzero` / `evenodd`) | ✅ |
| 6 | **`use as bounding box`** — viewport control | ⬜ Pending. Cross-refs `Animation/MUSTADDRESS.md` (camera verbs need dynamic viewBox). Plan: `2026-04-17-path-actions-plan.md` §6. |

### Decorations

| Decoration | Status | Source |
|------------|--------|--------|
| Random steps | ✅ | `pgflibrarydecorations.pathmorphing.code.tex:86-101` |
| Rounded corners | ✅ | — |
| Zigzag | ⬜ | `pathmorphing.code.tex` |
| Snake | ⬜ | `pathmorphing.code.tex` |
| Coil | ⬜ | `pathmorphing.code.tex` |
| Markings (ticks, dimensions) | ⬜ | `pgflibrarydecorations.markings.code.tex` |

### Animation Layers 2 & 3

**Layer 2 — runtime controller.** Plan: `docs/plans/2026-04-10-animation-layer-design.md` §"Layer 2 (FUTURE)".

- [ ] Frame navigation: keyboard arrows, scroll triggers, JS API
- [ ] Verb → CSS / SMIL / WAAPI translation
- [ ] Phase sequencing: `in` / `during` / `out` with independent durations and easings
- [ ] Camera verbs: zoom / pan / focus via dynamic viewBox manipulation
- [ ] Integration with `LECWeb/.../scroll-animations.js`
- [ ] `recomputeViewBox()` export so the controller can re-fit between frames
- [ ] Lock viewBox via config (`viewBox: 'fixed' | 'union' | 'per-frame'`)

**Layer 3 — authoring agent.** Plan: same, §"Layer 3 (FUTURE)".

- [ ] Markdown-vocabulary → render-config compiler
- [ ] Natural-language element resolver (e.g. "the green node", "the demand curve")
- [ ] Use vocabulary defined in `Animation/2026-03-31-animation-vocabulary-design.md` (30+ verbs, 7 categories)

### src-v3 hygiene

Backport from src-v2 before Layer 2 work begins:

- [ ] viewBox scientific-notation regex (commit `d37b742`)
- [ ] Stroke-width inclusion in bbox (`expandBBoxFromElement`, see BUGREPORT.md issue 3)
- [ ] Scale-aware `nodeDistance` (commit `76166aa`)
- [ ] Position-rounding optimization
- [ ] KaTeX macros call (intentionally removed; revisit when Layer 2 adds dynamic re-renders)

---

## Missing TikZ Features (audit residue)

Many items below come from `docs/audit/00-summary.md` (2026-03-24). Re-checked 2026-05-06; these remain unimplemented.

### Coordinate system
- [ ] Polar coordinates `(angle:radius)` user syntax (math exists in `vecFromAngle`)
- [ ] `++` / `+` relative path coords exposed (`Path` tracks `_lastMove` internally)
- [ ] Unit conversion (`pt` / `mm` / `cm`) — all coords are SVG user units
- [ ] `calc` expressions `($(A)!0.5!(B)$)`
- [ ] Intersection coordinates

### Path features
- [ ] Smooth curves (`..`, Catmull-Rom, tension) — only explicit Bézier today
- [ ] Multi-waypoint edges (each edge is two-node only)
- [ ] Arc as edge type (`Path.arc()` exists for shapes, not edges)

### Path actions (beyond §15)
- [ ] Shade / gradient fill (SVG primitives available, no user-facing hook)
- [ ] Clip (`<clipPath>` available, not exposed)
- [ ] Pattern fills

### Trees & graphs
- [ ] Tree layout algorithm (Reingold–Tilford recommended for parse / proof trees)
- [ ] DOT-notation compact syntax
- [ ] Edge chains (`a -> b -> c`)
- [ ] Automatic layouts (Sugiyama, force-based)

### Transforms
- [ ] Nested `[rotate=45]` scope-based coordinate transforms
- [ ] Non-linear transformation framework

---

## Open Bugs

| Bug | Severity | Source file | Notes |
|-----|----------|-------------|-------|
| `label: ''` falls through to node ID | Medium | `src-v2/svg/emitter.js` | Workaround: `label: ' '`. Fix: check `'label' in config` instead of truthiness. Also propagates from named styles. |
| ViewBox stroke-width not included → right-edge clipping | Low | `src-v2/svg/emitter.js:86-89` | Add `strokeWidth/2` per side for `<circle>`, `<ellipse>`, `<rect>`, `<path>` children. |
| `labelDistance` asymmetric on left vs right side | Medium | `src-v2/geometry/labels.js:203` | Guard `if (distance > 0)` should be `!== 0`; verify sign logic on both sides. |
| ViewBox recomputed after async KaTeX | Medium | `src-v2/svg/emitter.js` | Need fixed-viewBox opt-out, or stable post-KaTeX freeze. Cross-refs viewport-stability item in Animation/MUSTADDRESS.md. |
| ~~KaTeX labels collapse to (0,0) when `fonts.ready` resolves before faces load~~ | ~~Medium~~ | `src-v2/core/katex-renderer.js` | ✅ Fixed 2026-06-25. Replaced one-shot `fonts.ready` trust with recurring `loadingdone` convergence: discover KaTeX faces by family, re-armable per-`svgEl` queue, cache invalidated + re-fit per font batch, cache-write gated on settled fonts, bounded backstop. Test: `test/katex-font-race.test.js`. Report: `katex-font-collapse-bug.md`. |
| `scale` + relative positioning shrinks diagram | Medium | `src-v2/positioning/positioning.js` | `nodeDistance` not scale-aware. Add `nodeDistanceScaled` or auto-multiply by `scale`. |

---

## Pending Migrations

### LECWeb live-page imports
`src/` is gone. Any LECWeb page still pointing at `tikz-svg/src/automata/automata.js` is broken. Either redirect to `deprecated/automata-wrapper/` (drop-in) or migrate to `src-v2/index.js` + `render()` (preferred for new content).

```bash
grep -rl "tikz-svg/src/" ~/Dropbox/Teaching/Projects/LECWeb/ \
  | xargs sed -i '' 's|tikz-svg/src/|tikz-svg/deprecated/automata-wrapper/|g'
```

### Pixel-level TikZ comparison
Compile `tex/example6-turing.tex` natively, render with `src-v2`, diff. Not yet attempted.

---

## Documentation Debt

- **`docs/audit/`** (00-09): 2026-03-24 snapshots. Many "missing" items shipped since. Mark as historical; do not treat as current status.
- **`SKILL-GAPS.md`** (root): obsolete arrow-tip claim. Audits an external skill at `LECWeb/.claude/skills/tikz-svg/SKILL.md`. Either update the LECWeb skill or retire the file.
- **`CHANGELOG-2026-04-09.md`**: one-day note, not maintained. Fold into commit history and remove.
- **`CONFIGTODO.md`**: short note proposing `setDefaults()`. Decide and close.
- **`labelDistance-bug.md`** + **`BUGREPORT.md`**: keep as bug detail until fixed.

---

## Completed Plans (for reference)

All plans in `docs/plans/` except the most recent are complete.

| Plan | Feature | Date |
|------|---------|------|
| `2026-03-23-node-based-label-positioning.md` | Anchor-based label positioning | ✅ |
| `2026-03-24-app-migration-plan.md` | src/ → src-v2/ migration | ✅ (src/ removed) |
| `2026-03-24-infrastructure-structural-refactor.md` | Named styles, groups, transforms | ✅ |
| `2026-03-25-decorations-module.md` | Random steps + rounded corners + wavy | ✅ |
| `2026-03-25-plotting-module.md` | math.js function plotting | ✅ |
| `2026-03-27-auto-size-nodes.md` | Text-driven node sizing | ✅ |
| `2026-03-27-draw-order.md` | `config.draw` ordered rendering | ✅ |
| `2026-03-27-free-form-paths.md` | `config.paths` polylines + arrows | ✅ |
| `2026-03-27-katex-math.md` | KaTeX in labels via `<foreignObject>` | ✅ |
| `2026-03-27-named-layers.md` | PGF-style z-order layers | ✅ |
| `2026-03-27-node-properties.md` | minimumWidth, textWidth, align, rotate, etc. | ✅ |
| `2026-03-27-plot-render-integration.md` | `config.plots` in `render()` | ✅ |
| `2026-04-05-anchor-audit.md` | Comprehensive anchor sweep | ✅ |
| `2026-04-05-flowchart-shapes.md` | Cloud, document, preparation, parallelogram | ✅ |
| `enhanced-multipart-status.md` | Circle / ellipse split | ✅ |
| `shapesplan.md` | 10 geometric + multipart | ✅ |
| **`2026-04-10-animation-layer-design.md`** | **Layer 1 done in `src-v3/`. Layers 2 & 3 pending.** | 🟡 |
| **`2026-04-17-path-actions-plan.md`** | **Items 1–5 done. Item 6 pending.** | 🟡 |

---

## Conventions (reminder)

- TikZ angles: `0°` = east, CCW positive. SVG: y-down.
- Cascade: `DEFAULTS → stateStyle/edgeStyle/plotStyle/pathStyle → group → named style → per-element`.
- 756 tests pass with `npm test`.
- TikZ-reference-first: PGF source under `docs/References/` is the source of truth for visual semantics.
