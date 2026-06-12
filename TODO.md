# tikz-svg — TODO

**Last refreshed:** 2026-06-11.
**Canonical task list:** [`docs/TODO.md`](docs/TODO.md). This file tracks high-level status and open feature work. Per-spec details and the full historical archive live in `docs/`.

---

## Current State

- **Production library:** `src-v2/` — 23 shapes, 18 base + 9 alias arrow tips, plotting, paths, layers, KaTeX, named styles, groups, transforms, decorations (random steps + rounded corners). 765 tests / 207 suites passing.
- **Single-file bundle:** `npm run build` → `dist/tikz-svg.min.js` (~108 KB ESM, mathjs external). `npm run sync:lecweb` builds and pushes src-v2 + bundle into the LECWeb vendored copy. Deployment plan: `docs/plans/2026-06-11-deployment-and-bbox-roadmap.md`.
- **Animation sandbox:** `src-v3/` — fork of `src-v2` with Layer 1 metadata (`frame`, `className`, `idPrefix` namespacing). Not imported by production. See `docs/plans/2026-04-10-animation-layer-design.md`.
- **Deprecated:** `deprecated/automata-wrapper/` (old `renderAutomaton()`), `deprecated/src-v1/` (original prototype).

---

## Open Work — Library

### TikZ §15 path actions
- [x] Item 1: named line widths
- [x] Item 2: named dash patterns
- [x] Item 3: line cap / line join / miter limit
- [x] Item 4: `color` shorthand
- [x] Item 5: fill rule (nonzero / evenodd)
- [~] **Item 6: `use as bounding box`** — config-level viewport control done 2026-06-11 (`config.viewBox` / `width` / `height` override auto-bounds). The per-path `useAsBoundingBox` flag remains. Plans: `2026-04-17-path-actions-plan.md` §6, `2026-06-11-deployment-and-bbox-roadmap.md` §4.

### Decorations
- [x] Random steps (`pgflibrarydecorations.pathmorphing.code.tex` lines 86–101)
- [x] Rounded corners
- [ ] **Zigzag, snake, coil** (`pgflibrarydecorations.pathmorphing.code.tex`)
- [ ] Ticks / dimensioning decorations (`pgflibrarydecorations.markings.code.tex`)

### Animation Layer 2 (controller)
- [ ] Frame navigation (arrows / scroll / API)
- [ ] CSS / SMIL / WAAPI translation of action verbs
- [ ] Phase sequencing (`in` / `during` / `out`) with easing
- [ ] Camera verbs (zoom, pan, focus → viewBox manipulation)
- [ ] Integration with existing `scroll-animations.js` in lecture pages
- [ ] Plan: `docs/plans/2026-04-10-animation-layer-design.md` §"Layer 2"

### Animation Layer 3 (authoring agent)
- [ ] Markdown-instruction → render-config compiler
- [ ] Natural-language element references resolver
- [ ] Vocabulary: 30+ verbs, 7 categories (see `Animation/2026-03-31-animation-vocabulary-design.md`)

### src-v3 maintenance
- [x] 2026-06-11 fixes applied to v3 alongside v2: `config.viewBox`/`width`/`height`, math-free re-render skip, KaTeX measurement cache, in-library mathjs-shim.
- [ ] Backport older src-v2 fixes:
  - viewBox scientific-notation regex (commit `d37b742`)
  - stroke-width inclusion in bbox (`expandBBoxFromElement`, see BUGREPORT.md)
  - scale-aware `nodeDistance` adjustment (commit `76166aa`)
  - position-rounding optimization

### Missing TikZ surface (from audit, still unimplemented)

#### Coordinate system
- [ ] Polar coordinates `(angle:radius)` user syntax (math exists in `vecFromAngle`)
- [ ] `++` / `+` relative path coords exposed
- [ ] Unit conversion (`pt` / `mm` / `cm`)
- [ ] `calc` expressions `($(A)!0.5!(B)$)`
- [ ] Intersection coordinates

#### Path features
- [ ] Smooth curves (`..`, Catmull-Rom, tension) — currently all curves are explicit Bézier
- [ ] Multi-waypoint edges — each edge connects exactly two nodes
- [ ] Arc as edge type (Path.arc exists for shapes, not edges)

#### Path actions (beyond §15)
- [ ] Shade / gradient fill
- [ ] Clip (`<clipPath>` available, not exposed)
- [ ] Pattern fills

#### Trees & graphs
- [ ] Tree layout algorithm (Reingold–Tilford)
- [ ] Edge chains (`a -> b -> c`)
- [ ] Automatic graph layouts (Sugiyama, force-based)

#### Transforms
- [ ] Nested scope-based coordinate transforms (`[rotate=45]` blocks)

---

## Open Bugs

See `BUGREPORT.md` and `labelDistance-bug.md` for full repros.

| Bug | File | Severity | Notes |
|-----|------|----------|-------|
| Empty-string label falls through to node ID | `src-v2/svg/emitter.js` (label resolution) | Medium | Workaround: `label: ' '`. Fix: check `'label' in config` not truthiness. |
| `expandBBoxFromElement` ignores stroke width → right-edge clipping | `src-v2/svg/emitter.js:86-89` | Low | Add `strokeWidth/2` per side for circle/ellipse/rect/path children. |
| `labelDistance` asymmetric between left/right sides | `src-v2/geometry/labels.js:203` | Medium | Guard `if (distance > 0)` should be `!== 0`; verify sign logic. |
| ViewBox recomputed after async KaTeX render | `src-v2/svg/emitter.js` | ~~Medium~~ Fixed 2026-06-11 | `config.viewBox` opts out of auto-sizing; math-free configs no longer re-render on fonts.ready. |
| Relative positioning + `scale` blows up viewBox | `src-v2/positioning/positioning.js` | Medium | `nodeDistance` not scale-aware; needs `nodeDistanceScaled` or scale-multiplied default. |

---

## Pending Migrations

### LECWeb live-page imports
The original migration was `src/` → `src-v2/`. Since `src/` was removed, any page still pointing at `src/automata/automata.js` is already broken. Search and update:

```bash
grep -rl "tikz-svg/src/" ~/Dropbox/Teaching/Projects/LECWeb/ \
  | xargs sed -i '' 's|tikz-svg/src/|tikz-svg/deprecated/automata-wrapper/|g'
```

(Or migrate to `src-v2/index.js` + `render()` directly — preferred for new pages.)

### Pixel-level TikZ comparison
Compile `tex/example6-turing.tex` natively and compare against our rendering. Not yet attempted.

---

## Documentation Debt

- `SKILL-GAPS.md` is partially obsolete — its arrow-tip claim ("only stealth and none exist") was true for `src/`, false for `src-v2/`. The skill it audits (`LECWeb/.claude/skills/tikz-svg/SKILL.md`) lives outside this repo. Either update the LECWeb skill against current `src-v2` API or retire this file.
- `docs/audit/00-summary.md` through `09-*.md` are 2026-03-24 snapshots. Many "missing" items now exist. Treat as historical, not current status.
- `CHANGELOG-2026-04-09.md` is a one-day note, not a maintained changelog. Consider rolling it into commit history and removing.
- `CONFIGTODO.md` is a thinking note about `setDefaults()` — fold into roadmap or close.

---

## Resources

- **Plans (`docs/plans/`)**: 17 plan files spanning 2026-03-23 → 2026-04-10. All but `2026-04-10-animation-layer-design.md` are completed.
- **Specs (`docs/specs/`)**: anchor-based label positioning, visual QA lessons, cloud shape design.
- **Guides (`docs/guides/`)**: `tikz-to-src-v3-animation-howto.md` — end-to-end TikZ-animation porting pipeline.
- **PGF reference**: `docs/References/` (TeX Live 2025 sources). Always check before fixing visual issues.

---

## Conventions

- ES modules, `mathjs` is the only runtime dependency (UMD bundle + `src-v2/core/mathjs-shim.js`; `examples-v2/mathjs-shim.js` is a back-compat re-export).
- SVG DOM via `document.createElementNS`.
- TikZ angles: `0°` = east, CCW positive. SVG: y-down. Conversion happens in `core/math.js`.
- Style cascade: `DEFAULTS → stateStyle/edgeStyle/plotStyle/pathStyle → group → named style → per-element`.
- TikZ-reference-first: always check PGF source under `docs/References/` before fixing visual issues.
- Tests run with `node --test test/*.test.js`.
