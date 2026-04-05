**Status: COMPLETED** — Both shapes implemented in TeX library and JS (`src-v2/shapes/`).

Project Plan: Enhanced circle split and ellipse split Shapes
Goal
Create two new PGF shapes — circle split enhanced and ellipse split enhanced — that support all the features rectangle split has, adapted to circular/elliptical geometry. Delivered as a single standalone .sty file that users \usepackage alongside the standard TikZ libraries.
Feature Parity Matrix
Rectangle Split FeatureCircle Split EnhancedEllipse Split EnhancedN parts (up to 20)✓ horizontal lines across circle✓ horizontal lines across ellipsedraw splits toggle✓✓part fill (per-part colors)✓ via arc-bounded clip regions✓ via arc-bounded clip regionsuse custom fill✓✓ignore empty parts✓✓empty part height/width/depth✓✓part align✓ (left/center/right within part)✓horizontal split directionNot applicable (always horizontal chords)Not applicableallocate boxes✓ (reuse existing infrastructure)✓Per-part anchors (one, two, one split, etc.)✓✓
Architecture
File: pgflibraryshapes.multipart.enhanced.code.tex (loadable as a PGF library), plus a thin tikzlibraryshapes.multipart.enhanced.code.tex wrapper.
Dependencies: Only shapes.multipart (for the box allocation helpers and \pgf@lib@sh@getalpha/\pgf@lib@sh@toalpha utilities) and pgfmoduleshapes (already loaded by pgfcore).
Key Design Decisions
1. Multi-part geometry — how N parts fit in a circle/ellipse
For rectangle split, each part is a horizontal band of the rectangle. For a circle with N parts, each part is a horizontal "strip" bounded by two chords. The strip boundaries are placed so that each part has equal vertical extent (content height + inner ysep), and the radius grows to accommodate all parts. This parallels how rectangle split stacks parts vertically and grows the rectangle.
Specifically:

Compute the total needed height as the sum of all part heights (max of ht+dp per part, or the tallest-box-duplicated approach) plus inner ysep between each.
The y-coordinates of the N−1 dividing chords are determined by the cumulative part heights from top to bottom.
The radius (circle) or radii (ellipse) are computed to enclose all parts, analogous to the existing circle split radius calculation but generalized from 2 to N parts.

2. Per-part fill — clipping to circular/elliptical strips
Rectangle split fills rectangles. For circles/ellipses, each part's fill region is bounded by arcs above and below. The implementation:

In \behindbackgroundpath, for each part, construct a closed path: left arc segment → bottom chord → right arc segment → top chord (or the full top/bottom cap for the first/last part).
Use \pgfusepath{fill} for each part with its assigned color.
This requires computing the x-extent of each chord: for a circle of radius r with a chord at height y from center, the half-width is sqrt(r² − y²). For an ellipse with semi-axes a,b, a chord at height y has half-width a·sqrt(1 − y²/b²).
The arc segments between chords use \pgfpatharc or \pgfpathellipse partial arcs.

3. Draw splits — conditional chord stroking
Same approach as Mark Wibrow's patch but generalized to N−1 chords. In \backgroundpath, after drawing the circle/ellipse outline, loop over the N−1 dividing y-positions and draw chords from (−x_extent, y_i) to (+x_extent, y_i), conditional on the draw splits boolean.
4. Saved anchors and per-part anchors
For each part k (one through twenty):

k anchor: origin point for placing that part's text box (centered in its strip)
k split anchor: midpoint of the chord between part k and part k+1
k split east / k split west: endpoints of that chord on the shape border
k north / k south: point on the border directly above/below the part center
k east / k west: point on the border at the vertical center of part k

These are computed from the chord y-positions and the circle/ellipse equation.
5. Dynamic \nodeparts hackery
Reuse the same approach as rectangle split (lines 1151–1160 of multipart): after shape setup, dynamically redefine the node's box list based on the parts count via \pgfutil@g@addto@macro.
Implementation Steps

Keys and booleans — Define /pgf/circle split parts, /pgf/circle split draw splits, /pgf/circle split part fill, /pgf/circle split part align, /pgf/circle split ignore empty parts, /pgf/circle split empty part height/width/depth, /pgf/circle split use custom fill, and parallel keys for ellipse split. Consider whether to use a shared \pgf@lib@sh@cs@ prefix (circle split) and \pgf@lib@sh@es@ prefix (ellipse split) for internal macros, or a shared infrastructure with a shape-type parameter.
\savedmacro for parameters — One big \savedmacro\circlesplitparameters (analogous to \rectanglesplitparameters) that iterates over parts, measures boxes, computes per-part y-offsets, chord positions, and the overall radius. Store the y-position of each chord and the radius as saved values.
\savedanchor for per-part text origins — Compute where each part's text box goes, centered horizontally and vertically within its strip.
\anchor definitions — Standard compass anchors inherited/adapted from circle/ellipse. Per-part anchors generated in a loop (like rectangle split lines 1163–1222).
\backgroundpath — Draw the circle/ellipse. Conditionally draw the N−1 chord lines.
\behindbackgroundpath — Custom fill: loop over parts, clip to the arc-bounded strip, fill with the part's color.
\anchorborder — Inherit from circle (for circle split) or use \pgfpointborderellipse (for ellipse split).
Dynamic nodeparts — Same hackery as rectangle split.
Backward compatibility aliases — text = one, lower = two, ordinal aliases for second/third/fourth.
Test document — A comprehensive .tex file exercising all features: varying part counts, custom fills, draw splits on/off, empty parts, per-part alignment, minimum size constraints, anchors visualization.

Risks and Hard Parts

Arc-bounded fill paths: The trickiest part geometrically. PGF's \pgfpatharc works in degrees, so we need to convert chord y-positions to angles: for a circle, θ = arcsin(y/r); for an ellipse, the parametric angle t where b·sin(t) = y. PGF math can handle this but it's fiddly.
Performance: Rectangle split is already heavy with 20 parts. Circle/ellipse split with arc calculations per part will be slower. Probably fine for typical use (2–6 parts).
Radius calculation with unequal parts: If parts have very different heights, the circle may be dominated by the tallest part. Need to decide: equal-height strips (simpler, wastes space) or content-adaptive strip heights (matches rectangle split behavior, harder geometry).

Recommendation
Start with content-adaptive strip heights (matching rectangle split) since that's the whole point of feature parity. Start with circle split enhanced first since it's geometrically simpler (one radius vs two), get it fully working, then generalize to ellipse by replacing r with (a, b) throughout.