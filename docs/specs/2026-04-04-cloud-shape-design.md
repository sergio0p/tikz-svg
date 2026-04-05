# Cloud Shape Design Spec

## Overview

Implement the PGF `cloud` shape as a proper shape in the tikz-svg library, faithfully replicating the TikZ algorithm from `pgflibraryshapes.symbols.code.tex` (lines 612-1414). This is a prerequisite for the `cloud callout` shape.

## Algorithm (from PGF source)

### Geometry Computation

1. **Inner ellipse radii** from text dimensions + innerSep, scaled by sqrt(2)
2. **Aspect ratio adjustment** (unless `cloudIgnoreAspect`)
3. **Trig constants**:
   - `arcradiusquotient = 0.5 * sec((180-arc)/2)`
   - `archeightquotient = arcradiusquotient * (1 - sin((180-arc)/2))`
4. **Cross-coupling factor** `k = sin(p/2) * (1-cos(a/2)) / sin(a/2)` where `p = 360/puffs`, `a = puffArc`
5. **Outer ellipse radii** (circum-ellipse through puff extremities):
   - `X = x*cos(p/2) + k*y`, `Y = y*cos(p/2) + k*x`
   - Clamped to minimum width/height
6. **Recalculate inner radii** from (possibly clamped) outer radii:
   - `x = (X*cos(p/2) - k*Y) / (cos^2(p/2) - k^2)`
   - `y = (Y*cos(p/2) - k*X) / (cos^2(p/2) - k^2)`
7. **Pre-compute Bezier constants**: `sin/cos/tan(arc/4)`, `sec/sin((180-arc)/2)`

### Background Path

Each puff drawn as two cubic Bezier half-arcs using Riskus (2006) approximation:

1. Start at angle `90 - anglestep/2` on the inner ellipse
2. For each puff:
   - Compute `arcstartpoint`/`arcendpoint` on inner ellipse
   - Call `getCloudPuffParameters` -> `arcslope`, `halfchordlength`, `arcradius`, `segmentheight`, `circlecenterpoint`
   - First half-arc: rotation `arcrotate = 90 - quarterarc + arcslope`, control points scaled by `arcradius * tan(arc/4)`, magic number `k = 0.552284745`
   - Second half-arc: rotation offset by `quarterarc + 90`
3. Close path
4. backgroundPath subtracts outerSep (draws at visual radius)

### Puff Parameters Helper

Given `arcstartpoint` and `arcendpoint`:
- `arcslope` = angle from endpoint to startpoint
- `halfchordlength` = half distance between them
- `arcradius` = halfchordlength * arcradiusquotient
- `outerarcradius` = arcradius + outerSep
- `segmentheight` = arcradius * (1 - sin((180-arc)/2))
- `circlecenterpoint` = startpoint + rotate({-halfchord, segmentheight - arcradius}, arcslope)

### Border Computation

Two modes:
- **Ellipse mode** (`cloudAnchorsUseEllipse`): `pointBorderEllipse` with outer radii
- **Precise mode** (default):
  1. Iterate miter points (puff junctions offset by outerSep) to find which puff contains the target angle
  2. Binary search within that puff's arc for the angle matching the external direction
  3. Return point on outer arc (arcradius + outerSep)

### Anchors

- **Named**: north, south, east, west, NE, NW, SE, SW (all via borderPoint with outer-radius-scaled directions)
- **Dynamic**: `puff N` -> apex of Nth puff (point on outer arc at `arcslope + 90` from puff's circle center)

## Factory Extension

Add optional `dynamicAnchor(name, geom)` to `createShape` spec. Resolution order:
1. `center` -> `geom.center`
2. Named anchors from `namedAnchors(geom)`
3. `dynamicAnchor(name, geom)` -> returns point or null
4. Numeric angle -> `borderPoint`

## Pipeline Integration

Phase 3 `geomConfig` switch case for `cloud`:
- Pass text dimensions (rx, ry from text half-width/height)
- Pass cloud-specific params: puffs, puffArc, cloudIgnoreAspect, cloudAnchorsUseEllipse

Emitter: uses generic `backgroundPath` fallback, no changes needed.

## Parameters

| Parameter | TikZ Key | Default | Our Key |
|-----------|----------|---------|---------|
| Number of puffs | `cloud puffs` | 10 | `cloudPuffs` |
| Arc per puff | `cloud puff arc` | 135 | `cloudPuffArc` |
| Ignore aspect | `cloud ignore aspect` | false | `cloudIgnoreAspect` |
| Ellipse border | `cloud anchors use ellipse` | false | `cloudAnchorsUseEllipse` |

## Files

| File | Action |
|------|--------|
| `src-v2/shapes/cloud.js` | New |
| `src-v2/shapes/shape.js` | Modify (dynamicAnchor support) |
| `src-v2/index.js` | Modify (Phase 3 cloud case) |
| `test/cloud.test.js` | New |
