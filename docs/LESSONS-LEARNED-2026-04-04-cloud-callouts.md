# Lessons Learned: Cloud & Callout Shapes (2026-04-04)

## 1. Emitter Re-Call Contract

The emitter calls `savedGeometry({...geom, center: {x:0, y:0}})` to generate center-relative paths for SVG rendering. Any input that `savedGeometry` destructures from config **must be stored in the returned geom object**, or it vanishes on re-call and produces zero-sized shapes.

**What happened:** The cloud shape destructured `rx` and `ry` from config but didn't store them in the geom. On emitter re-call, `config.rx` was `undefined`, defaulting to `0`. The entire cloud path was all zeros — invisible.

**Rule:** After writing `savedGeometry`, check: does every destructured config field appear in the returned object? If not, add it.

## 2. Silent Position Failure

`position: [x, y]` arrays silently fell through to `{x: 0, y: 0}` because `parsePositionSpec` only checked for `.x`/`.y` properties, which arrays don't have. Both the callout node and its red dot ended up at the origin, stacked on top of each other.

**Rule:** Inputs should either work or throw. Never silently degrade to a default that looks like a bug.

**Fix:** Added `Array.isArray(position)` handling in `resolvePositions` to convert `[x, y]` → `{x, y}`.

## 3. Demo Blind Audition Sizing

The emitter auto-computes a `viewBox` that fits all content. This means **absolute coordinate values don't affect visual size** — only proportions matter. Changing `CM` from 28 to 60 had zero visual effect because the viewBox scaled everything to fit the same SVG container.

**Rule:** To match TikZ PNG sizing in blind audition demos:
1. After `render()`, read the auto-computed viewBox
2. Set the SVG's `width` to match the PNG's display width (e.g., 400px)
3. Compute `height = width * (viewBox height / viewBox width)`

This makes both sides display at the same width with proportional heights.

## 4. TikZ Color Formula

TikZ's `color!N` notation means N% color + (100-N)% white. The exact formula:

```
blue!10  = 0.10 * (0, 0, 255) + 0.90 * (255, 255, 255) = #E6E6FF
green!10 = 0.10 * (0, 255, 0) + 0.90 * (255, 255, 255) = #E6FFE6
orange!15 = 0.15 * (255, 165, 0) + 0.85 * (255, 255, 255) = #FFF2D9
yellow!15 = 0.15 * (255, 255, 0) + 0.85 * (255, 255, 255) = #FFFFD9
red!8    = 0.08 * (255, 0, 0) + 0.92 * (255, 255, 255) = #FFEBEB
```

**Rule:** Compute exact hex values from the formula. Don't guess.

## 5. Cloud Text-to-Shape Ratio

The cloud shape scales text dimensions by √2 internally (fitting a rectangle inside an ellipse). This means `innerSep` and `minimumWidth` are dominated by `Math.max` clamping — when minimums or the √2-scaled text size is larger, `innerSep` changes nothing.

**What happened:** Changed `innerSep` from 3 to -4 with zero visible effect, because `minimumWidth / 2 = 66` dominated `textHalfW + innerSep` in every case.

**Rule:** Font size is the lever that controls the text-to-cloud ratio. Adjust `fontSize`, not `innerSep` or `minimumWidth`.
