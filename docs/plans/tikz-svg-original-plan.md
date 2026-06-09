# TikZ-SVG: A Declarative SVG Rendering Engine

## Project Goal

Build a JavaScript library that replicates the core functionality of TikZ/PGF for SVG output. The user provides a declarative config object describing nodes, edges, and styles. The library resolves positions, computes geometry (anchors, border intersections, bezier curves), and emits SVG elements.

The first domain library on top of this core is `automata` (finite state machines), but the architecture must support future domain libraries (game trees, circuits, graphs) and eventually a TikZ-to-HTML converter.

**Output target:** SVG (DOM elements via `createElementNS`, not strings).
**API style:** Declarative config object as primary input.
**Module format:** ES modules (`export`/`import`).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Domain Libraries (automata, future: game-tree)  │
├─────────────────────────────────────────────────┤
│  Style Engine (defaults, cascading, filters)     │
├─────────────────────────────────────────────────┤
│  SVG Emitter (nodes, edges, labels, defs)        │
├─────────────────────────────────────────────────┤
│  Geometry Engine (edges, beziers, label placement)│
├─────────────────────────────────────────────────┤
│  Position Resolver (relative positioning)         │
├─────────────────────────────────────────────────┤
│  Shape System (anchors, border intersection)      │
├─────────────────────────────────────────────────┤
│  Core Utilities (resolvePoint, math helpers)      │
└─────────────────────────────────────────────────┘
```

Each layer is a set of pure functions (data in → data out), except the SVG Emitter which produces DOM nodes.

---

## File Structure

```
tikz-svg/
├── src/
│   ├── core/
│   │   ├── math.js            # Vector math, angle helpers
│   │   ├── resolve-point.js   # Universal coordinate resolver
│   │   └── constants.js       # Direction table, default values
│   ├── shapes/
│   │   ├── shape.js           # Shape registry + base interface
│   │   ├── circle.js          # Circle: anchors + border
│   │   ├── rectangle.js       # Rectangle: anchors + border
│   │   └── ellipse.js         # Ellipse: anchors + border
│   ├── positioning/
│   │   └── positioning.js     # Relative position resolver
│   ├── geometry/
│   │   ├── edges.js           # Straight, bent, loop path computation
│   │   ├── arrows.js          # Arrowhead marker definitions
│   │   └── labels.js          # Label placement along paths
│   ├── style/
│   │   └── style.js           # Defaults cascade, filter/shadow defs
│   ├── svg/
│   │   └── emitter.js         # SVG DOM construction
│   ├── automata/
│   │   └── automata.js        # Automata domain library
│   └── index.js               # Public API entry point
├── test/
│   ├── shapes.test.js
│   ├── positioning.test.js
│   ├── geometry.test.js
│   └── integration.test.js
├── examples/
│   ├── basic-dfa.html
│   ├── nfa-with-loops.html
│   └── styled-automaton.html
└── README.md
```

---

## Layer 1: Core Utilities (`src/core/`)

### `math.js`

Vector and angle helper functions used throughout.

```js
export function vec(x, y) → { x, y }
export function vecAdd(a, b) → { x, y }
export function vecSub(a, b) → { x, y }
export function vecScale(v, s) → { x, y }
export function vecLength(v) → number
export function vecNormalize(v) → { x, y }
export function vecFromAngle(degrees) → { x, y }     // unit vector
export function degToRad(degrees) → number
export function radToDeg(radians) → number
export function angleBetween(from, to) → degrees      // atan2-based
export function lerp(a, b, t) → number
export function pointOnQuadBezier(p0, p1, p2, t) → { x, y }
export function tangentOnQuadBezier(p0, p1, p2, t) → { x, y }
export function pointOnCubicBezier(p0, p1, p2, p3, t) → { x, y }
export function tangentOnCubicBezier(p0, p1, p2, p3, t) → { x, y }
export function perpendicularOffset(point, tangent, distance) → { x, y }
```

### `resolve-point.js`

Universal coordinate resolver. Ported from the callouts library pattern, extended with node name lookup.

```js
/**
 * Resolve a point from various input formats.
 *
 * @param {Object|string} point - One of:
 *   - { x, y }           → absolute SVG coordinates
 *   - { Q, P }           → domain coordinates (requires opts.coordSystem)
 *   - 'nodeName'         → center of a named node (requires nodeRegistry)
 *   - 'nodeName.anchor'  → specific anchor on a named node
 *   - '#selector'        → DOM element center (via getBBox)
 * @param {Object} opts - { coordSystem?, nodeRegistry? }
 * @returns {{ x: number, y: number }}
 */
export function resolvePoint(point, opts) { ... }
```

### `constants.js`

The direction table, directly from the TikZ positioning library source. Each direction maps to:
- `newAnchor`: which anchor on the NEW node faces the reference
- `refAnchor`: which anchor on the REFERENCE node faces the new node
- `vector`: unit direction vector `{ x, y }` (SVG y-down: "above" = negative y)
- `factor`: diagonal scaling factor (1.0 for cardinal, 0.707107 for diagonal)

```js
export const DIRECTIONS = {
  right:        { newAnchor: 'west',       refAnchor: 'east',       vector: { x:  1, y:  0 }, factor: 1.0 },
  left:         { newAnchor: 'east',        refAnchor: 'west',       vector: { x: -1, y:  0 }, factor: 1.0 },
  above:        { newAnchor: 'south',       refAnchor: 'north',      vector: { x:  0, y: -1 }, factor: 1.0 },
  below:        { newAnchor: 'north',       refAnchor: 'south',      vector: { x:  0, y:  1 }, factor: 1.0 },
  'above right': { newAnchor: 'south west', refAnchor: 'north east', vector: { x:  1, y: -1 }, factor: 0.707107 },
  'above left':  { newAnchor: 'south east', refAnchor: 'north west', vector: { x: -1, y: -1 }, factor: 0.707107 },
  'below right': { newAnchor: 'north west', refAnchor: 'south east', vector: { x:  1, y:  1 }, factor: 0.707107 },
  'below left':  { newAnchor: 'north east', refAnchor: 'south west', vector: { x: -1, y:  1 }, factor: 0.707107 },
};

export const DEFAULTS = {
  nodeDistance: 60,     // default distance between nodes (center-to-center in onGrid mode)
  onGrid: true,         // true = center-to-center spacing (simpler, recommended default)
  nodeRadius: 20,       // default circle radius
  fontSize: 14,
  fontFamily: 'serif',
  edgeStrokeWidth: 1.5,
  edgeColor: '#000000',
  nodeFill: '#FFFFFF',
  nodeStroke: '#000000',
  nodeStrokeWidth: 1.5,
  arrowSize: 8,
  bendAngle: 30,        // default bend angle in degrees
  loopSize: 25,         // default loop radius
  loopAngle: 15,        // half-angle spread for loops
  shadow: false,
  shadowDefaults: { dx: 2, dy: 2, blur: 3, color: 'rgba(0,0,0,0.25)' },
  acceptingInset: 3,    // inner circle offset for accepting states
  initialArrowLength: 25,
};
```

---

## Layer 2: Shape System (`src/shapes/`)

This directly mirrors PGF's `\pgfdeclareshape`. Each shape defines:
1. **Saved geometry** — computed once from config (equivalent to `\savedanchor`)
2. **Named anchors** — cardinal + diagonal + `center` (equivalent to `\anchor`)
3. **Border intersection** — given external point, find intersection on border (equivalent to `\anchorborder`)
4. **Background path** — SVG path string for drawing the shape (equivalent to `\backgroundpath`)

### `shape.js` — Registry and base interface

```js
/**
 * Shape registry. Shapes are looked up by name.
 *
 * Each shape object must implement:
 *   savedGeometry(config) → object
 *     Compute and return cached geometry from node config.
 *     For circle: { center: {x,y}, radius: number }
 *     For rectangle: { center: {x,y}, halfWidth: number, halfHeight: number }
 *
 *   anchor(name, geom) → { x, y }
 *     Return absolute position of a named anchor.
 *     Must handle: 'center', 'north', 'south', 'east', 'west',
 *                  'north east', 'north west', 'south east', 'south west'
 *     If name is a number, treat as degrees and delegate to borderPoint.
 *
 *   borderPoint(geom, direction) → { x, y }
 *     Given a direction vector { x, y } (relative to center),
 *     return the point on the shape border where a ray from center
 *     in that direction intersects the border. Returned in absolute coords.
 *
 *   backgroundPath(geom) → string
 *     Return SVG path `d` attribute string for drawing the shape.
 *
 *   anchors(geom) → string[]
 *     Return list of supported named anchor names.
 */

const registry = {};

export function registerShape(name, shapeImpl) { registry[name] = shapeImpl; }
export function getShape(name) → shapeImpl
```

### `circle.js`

Ported from PGF's `\pgfdeclareshape{circle}`.

```
savedGeometry:
  center = node's resolved { x, y }
  radius = max(config.radius, config.minimumSize/2)
           plus outerSep if applicable

Named anchors:
  center → center
  north  → { center.x, center.y - radius }
  south  → { center.x, center.y + radius }    // SVG y-down
  east   → { center.x + radius, center.y }
  west   → { center.x - radius, center.y }
  north east → { center.x + 0.707107 * radius, center.y - 0.707107 * radius }
  (etc. for all 8 cardinal/diagonal directions)

Numeric anchor (e.g. anchor 30):
  Interpret as degrees (0 = east, 90 = north in TikZ, but we use SVG convention:
  0 = right, positive = clockwise). Convert to unit vector, call borderPoint.
  IMPORTANT: TikZ convention is counterclockwise from east. We should match this
  for compatibility. So angle 90 = up (north) in our system too, meaning
  the vector is { cos(90°), -sin(90°) } = { 0, -1 } in SVG coords.

Border intersection (from pgfcorepoints.code.tex pgfpointborderellipse):
  PGF uses an approximation. We use the exact formula:
    angle = atan2(dy * rx, dx * ry)    // for circle, rx = ry = r
    borderX = center.x + r * cos(angle)
    borderY = center.y + r * sin(angle)
  For a circle this simplifies to normalizing the direction vector and scaling by r.

Background path:
  Not an SVG <path> — emit as <circle cx="..." cy="..." r="..."/>
  But provide a path string too for composite shapes:
    M cx+r cy A r r 0 1 0 cx-r cy A r r 0 1 0 cx+r cy Z
```

### `rectangle.js`

Ported from PGF's `\pgfdeclareshape{rectangle}`.

```
savedGeometry:
  center = node's resolved { x, y }
  halfWidth = max(textWidth/2 + innerSep, minimumWidth/2) + outerSep
  halfHeight = max(textHeight/2 + innerSep, minimumHeight/2) + outerSep
  → northeast = { center.x + halfWidth, center.y - halfHeight }  // SVG y-down
  → southwest = { center.x - halfWidth, center.y + halfHeight }

Named anchors (from pgfmoduleshapes_code.tex lines 1015-1071):
  center    → center
  north     → { center.x, center.y - halfHeight }
  south     → { center.x, center.y + halfHeight }
  east      → { center.x + halfWidth, center.y }
  west      → { center.x - halfWidth, center.y }
  north east → { center.x + halfWidth, center.y - halfHeight }  // corner
  north west → { center.x - halfWidth, center.y - halfHeight }
  south east → { center.x + halfWidth, center.y + halfHeight }
  south west → { center.x - halfWidth, center.y + halfHeight }

Border intersection (from pgfcorepoints.code.tex pgfpointborderrectangle):
  PGF algorithm: mirror into first quadrant, test ray against right edge,
  if intersection within bounds use it, otherwise test top edge, mirror back.
  JS translation:

  function borderRectangle(center, halfW, halfH, direction) {
    const dx = direction.x, dy = direction.y;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (absDx < 1e-10 && absDy < 1e-10) return { ...center };
    let bx, by;
    if (absDy * halfW < absDx * halfH) {
      // hits left/right edge
      bx = halfW;
      by = absDx > 1e-10 ? (absDy / absDx) * halfW : 0;
    } else {
      // hits top/bottom edge
      by = halfH;
      bx = absDy > 1e-10 ? (absDx / absDy) * halfH : 0;
    }
    return {
      x: center.x + (dx < 0 ? -bx : bx),
      y: center.y + (dy < 0 ? -by : by)
    };
  }

Background path:
  Emit as <rect> element, or path string:
    M x1 y1 H x2 V y2 H x1 Z
  With optional rounded corners (rx, ry attributes on <rect>).
```

### `ellipse.js`

Same structure as circle but with independent rx, ry.

```
Border intersection (exact, improving on PGF's approximation):
  function borderEllipse(center, rx, ry, direction) {
    const dx = direction.x, dy = direction.y;
    if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) return { ...center };
    const angle = Math.atan2(dy * rx, dx * ry);
    return {
      x: center.x + rx * Math.cos(angle),
      y: center.y + ry * Math.sin(angle)
    };
  }
```

---

## Layer 3: Position Resolver (`src/positioning/`)

### `positioning.js`

Ported from `tikzlibrarypositioning.code.tex`. Resolves the absolute position of each node, handling relative references.

**Input:** The `states` config object where some nodes have `position: { right: 'q0' }` or `position: { x: 100, y: 200 }`.

**Output:** Every node gets an absolute `{ x, y }`.

#### Algorithm

```
1. Build dependency graph:
   - Nodes with absolute positions { x, y } have no dependencies.
   - Nodes with relative positions { direction: 'refNode' } depend on refNode.
   - Nodes with relative positions { direction: 'refNode', distance: N } override the default nodeDistance.

2. Topological sort the dependency graph.
   - Error on cycles.

3. Resolve in topological order:
   For each node with position = { [direction]: refNodeName, distance? }:

     a. Look up direction in DIRECTIONS table → { newAnchor, refAnchor, vector, factor }
     b. Get the reference node (already resolved).
     c. Determine effective distance:
        - If distance specified explicitly: use it
        - Otherwise: use config.nodeDistance
     d. If onGrid (default):
        - newPos = refNode.center + vector * distance * factor
     e. If NOT onGrid (anchor-to-anchor like TikZ default):
        - refPoint = refNode.anchor(refAnchor)
        - newPos = refPoint + vector * distance * factor
        - Then adjust so that newNode.anchor(newAnchor) lands at that point
          (requires knowing the new node's geometry, so compute it first)
```

#### Parsing position specs

Support these formats:
```js
position: { x: 100, y: 200 }                          // absolute
position: { right: 'q0' }                              // relative, default distance
position: { right: 'q0', distance: 80 }                // relative, explicit distance
position: { 'above right': 'q0' }                      // diagonal
position: { 'above right': 'q0', distance: [60, 40] }  // separate x/y distances (TikZ `and` syntax)
```

The first node with no position is placed at `{ x: 0, y: 0 }` by default (or a configured origin).

---

## Layer 4: Geometry Engine (`src/geometry/`)

### `edges.js`

Compute SVG path data for edges between nodes.

#### Straight edges

```
Given source node and target node:
1. Compute direction vector from source center to target center.
2. Find source departure point: source.borderPoint(direction)
3. Find target arrival point: target.borderPoint(reverse direction)
4. Path: M sourcePoint L targetPoint
```

#### Bent edges (`bend: 'left'`, `bend: 'right'`, `bend: 30`, `bend: -30`)

TikZ `bend left=30` means the curve bows to the left by 30 degrees.

```
Given source border point S and target border point T:
1. Compute midpoint M of S-T.
2. Compute perpendicular offset direction.
   - "bend left" (positive angle): perpendicular to the LEFT of S→T direction
   - "bend right" (negative angle): perpendicular to the RIGHT
3. Compute control point for quadratic bezier:
   The bend angle θ determines how far the control point is offset.
   offset = |S-T| * tan(θ/2) / 2  (approximation that works well)
   Actually, for a cleaner approach matching TikZ more closely:
   - Rotate the vector S→T by +θ to get the departure direction from S
   - Rotate T→S by -θ to get the arrival direction at T
   - The intersection of these two rays gives the control point for a quadratic bezier
   This is equivalent to what TikZ does with `bend left`.

4. IMPORTANT: The border points must be recomputed AFTER knowing the bend.
   The source departure point is where a ray in the departure direction exits the source node.
   The target arrival point is where a ray in the arrival direction exits the target node.

   Algorithm:
   a. Compute angle from source center to target center: α
   b. Departure angle from source: α + θ (for bend left) or α - θ (for bend right)
   c. Arrival angle at target: (α + 180°) - θ (for bend left)
   d. Source point = source.borderPoint(vecFromAngle(departureAngle))
   e. Target point = target.borderPoint(vecFromAngle(arrivalAngle))
   f. Control point = intersection of the two tangent rays, OR:
      use the formula: controlPt = for quadratic bezier through S, T with given tangent angles.

5. Path: M sx sy Q cx cy tx ty
```

Provide a helper that produces a cubic bezier if more control is needed, but default to quadratic.

#### Self-loops (`loop: 'above'`, `loop: 'below'`, `loop: 'left'`, `loop: 'right'`)

TikZ self-loops use `in` and `out` angles. For `loop above`, the default is `out=120, in=60`.

```
Loop direction mapping:
  'above'  → out: 120, in: 60      (departs upper-left, arrives upper-right)
  'below'  → out: 240, in: 300     (departs lower-left, arrives lower-right)
  'left'   → out: 150, in: 210     (departs upper-left, arrives lower-left)
  'right'  → out: 30,  in: 330     (departs upper-right, arrives lower-right)

Algorithm:
1. Compute out/in angles from the loop direction (or use explicit { out, in } if provided).
2. Departure point = node.borderPoint(vecFromAngle(outAngle))
3. Arrival point = node.borderPoint(vecFromAngle(inAngle))
4. Compute two control points for a cubic bezier that arcs away from the node:
   cp1 = departurePoint + loopSize * vecFromAngle(outAngle)
   cp2 = arrivalPoint + loopSize * vecFromAngle(inAngle)
5. Path: M dx dy C cp1x cp1y cp2x cp2y ax ay

Note: angles follow TikZ convention (CCW from east), converted to SVG with vecFromAngle.
```

Also support explicit `{ out, in, looseness }` for full control.

### `arrows.js`

Define SVG `<marker>` elements for arrowheads.

```
Produce a <marker> element to go in <defs>:
  - id: generated unique ID (e.g. 'arrow-{color}-{size}')
  - markerWidth, markerHeight, refX, refY based on arrow size
  - orient="auto" so it rotates with the path
  - A <polygon> or <path> inside for the arrowhead shape

Default arrowhead: simple triangle (TikZ's default stealth-like arrow).

The marker shortens the visible line slightly. The edge path endpoint should NOT
be adjusted for the marker — SVG markers handle this via refX. But the border
intersection point already gives us the node's edge, and the marker extends from
there, so the arrow tip may overlap the node. Solution: pull the edge endpoint
back by a small amount (1-2px) from the border point, or use refX on the marker
to account for the arrowhead length.

Provide a function:
  createArrowMarker(id, { size, color, type }) → SVGMarkerElement

Arrow types for future expansion: 'stealth', 'latex', 'triangle', 'none'.
Start with 'stealth' (default) and 'none'.
```

### `labels.js`

Position labels along edges. TikZ supports `pos=0.5` (midway), `above`, `below`, `sloped`.

```
For straight edges:
  labelPoint = lerp(source, target, pos)
  offset perpendicular to the edge direction by a small amount (above/below)

For quadratic bezier edges:
  labelPoint = pointOnQuadBezier(p0, p1, p2, pos)
  tangent = tangentOnQuadBezier(p0, p1, p2, pos)
  offset = perpendicularOffset(labelPoint, tangent, distance)

For self-loops:
  labelPoint = pointOnCubicBezier(p0, cp1, cp2, p3, 0.5)
  This is typically the outermost point of the loop.
  Offset further away from the node center.

Options:
  pos: 0.0 to 1.0 (default 0.5 = midway)
  side: 'above' | 'below' | 'left' | 'right' | 'auto' (default 'auto')
  distance: offset distance from path (default ~8px)
  sloped: boolean — rotate text to follow path tangent
```

---

## Layer 5: Style Engine (`src/style/`)

### `style.js`

Cascade defaults → global style → per-node/edge overrides. Ported from the callouts library's `{ ...DEFAULTS, ...options }` pattern but with a named intermediate layer.

```js
/**
 * Resolve the effective style for a node.
 * Merge order: DEFAULTS → config.stateStyle → config.states[id] properties
 */
export function resolveNodeStyle(nodeId, config) → {
  radius, fill, stroke, strokeWidth, fontSize, fontFamily,
  shadow, dashed, opacity, shape, accepting, initial,
  acceptingInset, labelColor, className
}

/**
 * Resolve the effective style for an edge.
 * Merge order: DEFAULTS → config.edgeStyle → per-edge properties
 */
export function resolveEdgeStyle(edgeIndex, config) → {
  stroke, strokeWidth, arrow, dashed, opacity, bend, loop,
  labelPos, labelSide, labelDistance, className
}
```

#### Shadow filter management

Each unique shadow config `{ dx, dy, blur, color }` needs a `<filter>` in `<defs>`.
Deduplicate by hashing parameters.

```js
/**
 * Collect all unique shadow configs from resolved styles.
 * Return array of { id, dx, dy, blur, color } for <defs>.
 * shadow: true → expand to DEFAULTS.shadowDefaults
 * shadow: { dx, dy, blur, color } → use as-is
 * shadow: false → no filter
 */
export function collectShadowFilters(resolvedNodes) → [{ id, dx, dy, blur, color }]
```

---

## Layer 6: SVG Emitter (`src/svg/`)

### `emitter.js`

Takes the fully resolved model (positions, geometry, styles) and constructs SVG DOM.

```js
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Main render function.
 * @param {SVGElement} svgEl - Target <svg> element (must exist in DOM)
 * @param {Object} resolved - Fully resolved model from the pipeline
 * @returns {Object} - References to created elements for external animation
 */
export function emitSVG(svgEl, resolved) {
  // 1. Clear existing content
  // 2. Create <defs>: arrowhead markers, shadow filters
  // 3. Create layer groups (ordered for correct paint order):
  //    <g id="edge-layer">
  //    <g id="label-layer">
  //    <g id="node-layer">
  // 4. Emit edges (into edge-layer)
  // 5. Emit edge labels (into label-layer)
  // 6. Emit nodes (into node-layer)
  // 7. Emit initial arrows (into edge-layer, but paint order above other edges)
  // 8. Compute viewBox from all element positions + padding
  // 9. Return element references map { nodes: {}, edges: [], labels: [] }
}
```

#### Node emission

```
For each node:
  1. Create <g> with id="node-{nodeId}", transform="translate(x, y)"
  2. If shadow: apply filter="url(#shadow-{id})"
  3. Emit background shape:
     - circle: <circle r="...">
     - rectangle: <rect x="..." y="..." width="..." height="..." rx="...">
  4. If accepting: emit inner circle/rect with radius - acceptingInset
  5. Emit label <text> centered in node
  6. Apply style attributes (fill, stroke, strokeWidth, dashed, opacity)
  7. If className: add to classList
  8. Attach .anchors object to the <g> element (like callouts library)
```

#### Edge emission

```
For each edge:
  1. Create <g> with id="edge-{from}-{to}" (or with index for duplicates)
  2. Compute path data from geometry engine
  3. Create <path d="..." fill="none" stroke="..." marker-end="url(#arrow-...)">
  4. Apply style attributes (strokeWidth, dashed, opacity, color)
```

#### Initial arrow emission

```
For each node with initial: true (or initial: 'left', etc.):
  1. Determine direction (default: 'left', meaning arrow comes from the left)
  2. Compute arrow tip = node.borderPoint(vecFromAngle(direction))
  3. Compute arrow start = tip + initialArrowLength * vec in approach direction
  4. Emit <path> with arrowhead marker
```

#### ViewBox computation

```
After all elements are placed:
  1. Find bounding box of all node centers ± radius/halfWidth/halfHeight
  2. Include edge control points and labels
  3. Add padding (e.g. 40px on each side)
  4. Set svgEl.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`)
```

---

## Layer 7: Automata Domain Library (`src/automata/`)

### `automata.js`

Thin convenience layer that sets automata-specific defaults and validates the config.

```js
/**
 * Render a finite automaton.
 *
 * @param {SVGElement} svgEl
 * @param {Object} config
 * @returns {Object} element references
 *
 * Config shape:
 * {
 *   stateStyle: {                  // defaults for all states
 *     radius: 20,
 *     fill: '#ffffff',
 *     stroke: '#000000',
 *     strokeWidth: 1.5,
 *     fontSize: 14,
 *     fontFamily: 'serif',
 *     shadow: true,                // or { dx, dy, blur, color }
 *   },
 *   edgeStyle: {                   // defaults for all edges
 *     stroke: '#000000',
 *     strokeWidth: 1.5,
 *     arrow: 'stealth',
 *   },
 *   nodeDistance: 60,
 *   onGrid: true,
 *   states: {
 *     q0: { initial: true },
 *     q1: { position: { right: 'q0' } },
 *     q2: { position: { right: 'q1' }, accepting: true },
 *     q3: { position: { below: 'q1' }, fill: '#fecaca' },  // per-state override
 *   },
 *   edges: [
 *     { from: 'q0', to: 'q1', label: 'a' },
 *     { from: 'q1', to: 'q2', label: 'b' },
 *     { from: 'q1', to: 'q1', label: 'a', loop: 'above' },
 *     { from: 'q1', to: 'q0', label: 'c', bend: 'left' },
 *     { from: 'q0', to: 'q3', label: 'd', bend: 30 },       // explicit angle
 *   ]
 * }
 */
export function renderAutomaton(svgEl, config) {
  // 1. Merge automata defaults with config
  // 2. Validate: all edge endpoints exist, no undefined states
  // 3. Run the pipeline: resolve positions → compute geometry → resolve styles → emit SVG
  // 4. Return element references
}
```

The automata layer's main job is just applying sensible defaults:
- Shape defaults to `circle`
- `accepting: true` triggers double circle
- `initial: true` triggers incoming arrow
- Edge labels default to `pos: 0.5, side: 'auto'`
- All states get the `state` CSS class for external styling

---

## The Pipeline

The main `render()` function in `index.js` orchestrates:

```js
export function render(svgEl, config) {
  // PHASE 1: PARSE — validate config, normalize shorthands
  const parsed = parseConfig(config);

  // PHASE 2: RESOLVE POSITIONS — topological sort, compute absolute { x, y }
  const positioned = resolvePositions(parsed);

  // PHASE 3: COMPUTE NODE GEOMETRY — create shape instances, cache anchors
  const withGeometry = computeNodeGeometry(positioned);

  // PHASE 4: COMPUTE EDGE GEOMETRY — paths, control points, label positions
  const withEdges = computeEdgeGeometry(withGeometry);

  // PHASE 5: RESOLVE STYLES — cascade defaults → globals → per-element
  const styled = resolveAllStyles(withEdges);

  // PHASE 6: EMIT SVG — construct DOM elements
  const refs = emitSVG(svgEl, styled);

  return refs;
}
```

Each phase returns a progressively enriched data structure. Phases 1–5 are pure functions (no DOM). Phase 6 is the only one that touches the DOM.

---

## Implementation Order

Each phase should be implemented, tested, and committed before moving on. Tests should be runnable with Node (using a mock SVG DOM like `jsdom` or just testing the pure-function phases 1–5 without DOM).

### Phase 1: Core + Shapes (foundation)

Files: `src/core/math.js`, `src/core/constants.js`, `src/shapes/shape.js`, `src/shapes/circle.js`, `src/shapes/rectangle.js`

**Tests to write:**
- Circle anchors: all 8 cardinal/diagonal for a circle at (100, 200) with r=20
- Circle border: point at 45° should be at (center.x + r*cos45, center.y - r*sin45)
- Circle border: numeric angle 0 should give east anchor
- Rectangle anchors: all 8 for a rect centered at (100, 200) with halfW=40, halfH=25
- Rectangle border: direction (1, 0) → east edge midpoint
- Rectangle border: direction (1, 1) → corner or edge intersection depending on aspect ratio
- Rectangle border: matches PGF algorithm (test against known values)

### Phase 2: Position Resolver

Files: `src/core/resolve-point.js`, `src/positioning/positioning.js`

**Tests to write:**
- Absolute position passthrough
- `right: 'q0'` with default nodeDistance, onGrid
- `above left: 'q0'` with diagonal factor
- Chain: q0 absolute, q1 right of q0, q2 below of q1
- Explicit distance override
- Cycle detection → error
- Missing reference → error

### Phase 3: Edge Geometry

Files: `src/geometry/edges.js`, `src/geometry/labels.js`, `src/geometry/arrows.js`

**Tests to write:**
- Straight edge between two circles: endpoints on borders, not centers
- Bent edge: control point on correct side for bend left vs bend right
- Self-loop: departure and arrival points are distinct, path curves away
- Label at midpoint of straight edge
- Label at midpoint of curved edge (on the curve, not on the chord)

### Phase 4: Style Engine

Files: `src/style/style.js`

**Tests to write:**
- Default cascade: unset properties get defaults
- Global stateStyle overrides defaults
- Per-node properties override stateStyle
- Shadow: true expands to default shadow config
- Shadow deduplication: same config → same filter ID

### Phase 5: SVG Emitter

Files: `src/svg/emitter.js`

**Tests to write (need jsdom or browser):**
- Emitting a single circle node: correct SVG elements, attributes, transform
- Accepting state: two concentric circles
- Initial arrow: path element with marker
- Edge with arrowhead: path + marker-end
- Shadow filter in defs
- ViewBox computed correctly from node positions
- Layer ordering: edges behind nodes

### Phase 6: Automata Library + Integration

Files: `src/automata/automata.js`, `src/index.js`

**Tests to write:**
- Full DFA render: 3 states, transitions, accepting, initial
- NFA with self-loop
- Multiple edges between same pair (explicit bends)
- Style overrides (custom colors, shadows)
- Return value contains element references

### Phase 7: Examples and Polish

Files: `examples/*.html`, `README.md`

- Basic DFA example
- NFA with epsilon transitions
- Styled automaton with shadows and colors
- Example showing GSAP animation on returned element refs

---

## Edge Cases and Known Gotchas

1. **SVG y-axis is inverted** relative to TikZ. "Above" = negative y. This must be consistent everywhere. The DIRECTIONS table already accounts for this. The angle convention (0° = east, CCW positive) should match TikZ, so `vecFromAngle(90)` should return `{ x: 0, y: -1 }` (up in SVG).

2. **Multiple edges between same node pair.** Each is a separate entry in the `edges` array with explicit `bend`. The emitter needs unique IDs — use an index suffix: `edge-q0-q1-0`, `edge-q0-q1-1`.

3. **Text measurement for auto-sizing.** Rectangle nodes that auto-size to fit their label text need `getBBox()` on a temporary SVG text element (same pattern as the callouts library's `measureText`). This requires the SVG to be in the DOM. For circle nodes, the radius is usually fixed, so this is less critical. Handle text measurement as an optional enhancement — start with fixed sizes.

4. **Arrowhead overlap.** SVG markers extend beyond the path endpoint. If the path endpoint is exactly on the node border, the arrowhead tip penetrates the node. Solution: pull the path endpoint back from the border by a small amount (approximately half the marker's refX). This adjustment should be configurable via `arrowShorten` (TikZ calls this `shorten >`).

5. **Loop sizing.** Self-loops need to be large enough to not overlap the node but small enough to not collide with neighboring elements. The `loopSize` parameter controls this. TikZ's default `looseness=8` for loops produces a specific curve shape — we should match it visually even if the exact parametrization differs.

6. **Font metrics.** SVG text rendering varies across browsers. `dominant-baseline: central` and `text-anchor: middle` handle centering. For the automata use case, labels are short (single characters or short strings), so precise font metrics are less critical.

---

## Conventions for Claude Code

- **No external dependencies** for the core library. Pure JS, ES modules, no build step needed.
- Use `const` by default, `let` only when reassignment is needed.
- Use `document.createElementNS(SVG_NS, tagName)` for all SVG element creation. Never `innerHTML` for dynamic content.
- All geometry functions should be **pure** (no side effects, no DOM access). Only `emitter.js` touches the DOM.
- Comment non-obvious math with brief explanations of what geometric operation is being performed.
- Keep each file under ~300 lines. If it grows beyond that, split.
- Export only the public API from `index.js`. Internal modules can export freely for testing.
- Use JSDoc comments on all public functions.

---

## Testing Approach

Use a simple test runner that works in Node without heavy dependencies. A minimal approach:

```js
// test/run.js
// Import each test file, run assertions, report pass/fail.
// Use assert from Node's built-in 'assert' module.
// For DOM tests (emitter), use jsdom: npm install jsdom
```

Alternatively, if the developer prefers, use `vitest` or `mocha`. But the pure-function layers (math, shapes, positioning, geometry, style) should be testable with zero DOM dependencies.

For **visual regression testing**, create example HTML files that render known automata and can be opened in a browser for visual inspection. These serve as living documentation.

---

## Future Extensions (not in scope now, but inform architecture)

- **TikZ parser:** Read `\begin{tikzpicture}...\end{tikzpicture}` and emit the config object. Regex-based for the subset we support. This is a separate module that produces config objects consumed by `render()`.
- **Game tree library:** Similar to automata but with tree layout (d3-hierarchy), payoff labels, player colors. Reuses shapes, edges, and the emitter.
- **Export to string:** `emitter.js` could have a parallel `emitSVGString()` that builds XML strings instead of DOM nodes, for Node/server-side use.
- **Interactive mode:** Click handlers on nodes/edges, drag-to-move, edit labels. The returned element references make this possible without library changes.
- **GSAP integration:** Not built in, but the returned element references map enables `gsap.from(refs.nodes.q0, { opacity: 0 })` etc.
