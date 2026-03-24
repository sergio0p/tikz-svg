# Enhanced Multipart Shapes — Session Handoff

## The Task
Build two PGF shapes — `circle split enhanced` and `ellipse split enhanced` — supporting up to 4 horizontal chord-divided parts with per-part fills and draw-splits toggle. Standalone `.code.tex` library.

## Files

| File | Status |
|------|--------|
| `tex/pgflibraryshapes.multipart.enhanced.code.tex` | Main library. **Working.** |
| `tex/tikzlibraryshapes.multipart.enhanced.code.tex` | TikZ wrapper. Done. |
| `tex/test-enhanced-multipart.tex` | Test document. Done. |
| `tex/test-debug.tex` | Debug comparison test (original vs ours). Keep for debugging. |

## What Works
- Keys: `circle split parts`, `circle split draw splits`, `circle split part fill` (and ellipse equivalents)
- Per-part fill via clip-to-shape + fill-rectangle (robust)
- Chord position computation (center of inter-part gap)
- **Chord drawing** (correctly uses `\pgfutil@tempdimb`/`\pgf@xc` to avoid `\pgfpointadd` register clobbering)
- Compass anchors (inherited from circle / manual for ellipse)
- Per-part text anchors: `text`, `lower`, `three`, `four` (+ aliases `one`, `two`)
- Savedanchors for centerpoint, loweranchor, threeanchor, fouranchor
- **Radius**: N=2 matches original circle split exactly; N=3,4 grow correctly

## Bugs Fixed (2026-03-23)

### Bug 1: Radius too large
**Root cause**: `computestack` used `max(tallest*2, actual_stacked_height)` for the radius height dimension. The actual stacked height is always larger (it includes inter-part gaps), inflating the radius by ~100%.

**Fix**: Changed to `max(tallest*2, actual_stacked_height/2)`. The half-stacked-height is the correct value — it represents the farthest distance from center to content edge, which is what the normalization needs.

For N=2: `tallest*2 == stacked/2`, so the max is a no-op → matches the original exactly.
For N>2: `stacked/2` wins, growing the circle to contain all chord positions.

### Bug 2: Ellipse yradius halved
**Root cause**: The ellipse `\savedanchor\radii` computed `b = sqrt(2) * ya/2`, but the original ellipse split uses `b = sqrt(2) * ya` (no halving). The ya value from `computestack` already has the same meaning as the original's per-part dimension.

**Fix**: Changed `\pgf@y=.5\pgf@ya` + `\pgf@y=1.414213\pgf@y` to just `\pgf@y=1.414213\pgf@ya`. For N=2 this now matches the original ellipse split exactly.

### Bug 3: Chord lines invisible (register clobbering)
**Root cause**: `\pgfpointadd{A}{B}` internally sets `\pgf@xa = \pgf@x` and `\pgf@ya = \pgf@y` from argument A, destroying the chord half-width and y-position stored in those registers.

**Fix**: Store chord half-width in `\pgfutil@tempdimb` (circle) or `\pgf@xc` (ellipse), and pass chord y from the `\chordyN` macros directly (not via `\pgf@ya`). These registers are not touched by `\pgfpointadd`.

## Resources To Read (in order of importance)

### 0. PGF Shape Declaration Reference
https://tikz.dev/base-nodes — Section 106.5 "Declaring New Shapes"

Key commands for shape declaration:
- `\pgfdeclareshape{name}{spec}` — main declaration command
- `\savedanchor{cmd}{code}` — computed+stored per node; code sets `\pgf@x`/`\pgf@y`
- `\saveddimen{cmd}{code}` — like savedanchor but stores a single dimension
- `\savedmacro{cmd}{code}` — stores arbitrary macro content (e.g. polygon side counts)
- `\anchor{name}{code}` — normal anchor, computed on-demand using saved anchors
- `\deferredanchor{name}{code}` — anchor expanded when nodes are used, not at declaration
- `\nodeparts{list}` — text labels comprising the shape (default: single "text" part)
- `\anchorborder{code}` — computes border intersection point for `\pgfpointshapeborder`

Path layers (in drawing order):
1. `\behindbackgroundpath{code}` — drawn first (behind everything)
2. `\backgroundpath{code}` — main shape outline (before text)
3. `\beforebackgroundpath{code}` — after background path, before text
4. `\behindforegroundpath{code}` — after text, before foreground
5. `\foregroundpath{code}` — drawn after text
6. `\beforeforegroundpath{code}` — drawn last (on top of everything)

Inheritance (for code reuse from existing shapes):
- `\inheritsavedanchors[from={shape}]` — all saved anchors collectively
- `\inheritanchor[from={shape}]{name}` — individual normal anchor
- `\inheritanchorborder[from={shape}]`
- `\inheritbackgroundpath[from={shape}]`, `\inheritforegroundpath[from={shape}]`
- `\inheritbehind/beforebackgroundpath[from={shape}]`
- `\inheritbehind/beforeforegroundpath[from={shape}]`

### 1. Original circle split — THE key reference
`References/pgflibraryshapes.multipart.code.tex` lines 23-174.
Focus on:
- `\saveddimen\radius` (lines 51-130): the tallest*2 radius formula
- `\savedanchor\centerpoint` (lines 33-39): center placement
- `\beforebackgroundpath` (lines 157-173): chord drawing at y=0

### 2. Original ellipse split
Same file, lines 1258-1354. Same pattern but with two radii (xradius, yradius) via `\savedanchor\radii`.

### 3. Rectangle split — for multipart infrastructure
Same file, lines 431-1251. Shows `\savedmacro` + `\addtosavedmacro` pattern, `\pgf@lib@sh@rs@process@list` for alignment/fill lists, dynamic per-part anchors, `\behindbackgroundpath` for custom fills.

### 4. Circle shape definition — what we inherit from
`/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/modules/pgfmoduleshapes.code.tex` lines 1187-1328. Our `\inheritbackgroundpath[from=circle]` copies this backgroundpath. Our `\inheritanchor[from=circle]{north}` etc. copy these anchor definitions. Understanding what `\radius` and `\centerpoint` mean in this context is critical.

### 5. Mark Wibrow's patch (in our plan file)
Shows how to conditionally draw chord lines by patching `\beforebackgroundpath`. Lighter approach than full shape declaration. The ellipse split version puts the chord INSIDE `\backgroundpath` alongside the ellipse outline — worth considering.

### 6. Our current code
`tex/pgflibraryshapes.multipart.enhanced.code.tex` — read the `\pgf@lib@sh@cs@computestack` macro (lines ~48-120) to understand the current radius computation and the bug.

## Key Insights

The normalized-vector radius formula `r = sqrt(xa² + ya²)` uses ya as a height dimension (comparable to the basic circle shape's half-height). For circle split, ya represents the content cell height including padding — NOT a stacked total.

The `\pgfpointadd` macro internally clobbers `\pgf@xa` and `\pgf@ya` (it saves argument 1's coordinates in those registers). Any values stored in `\pgf@xa`/`\pgf@ya` BEFORE a `\pgfpointadd` call will be destroyed. Use `\pgfutil@tempdimN` or `\pgf@xc`/`\pgf@yc` for values that must survive.
