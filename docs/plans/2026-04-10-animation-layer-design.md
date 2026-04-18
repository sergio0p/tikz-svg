# Animation Support for tikz-svg — Full Design

*Created 2026-04-10. Based on the animation vocabulary spec (`Animation/2026-03-31-animation-vocabulary-design.md`) and the Beamer overlay reference (`docs/References/TIKZ_BEAMER_OVERLAY_MECHANISM.md`).*

---

## Big Picture

Lecture slides in Beamer reveal content progressively using `\draw<2->`, `\fill<3>`, `\node<4->`. We need the same capability in our web lectures. The system has three layers:

```
┌──────────────────────────────────────────────────┐
│  Layer 3: Authoring                              │
│  Instruction files using the animation           │
│  vocabulary ("frame 2: demand curve draws")       │
│  Agent interprets → generates Layer 2 config      │
├──────────────────────────────────────────────────┤
│  Layer 2: Controller                             │
│  JS module that manages frame state,             │
│  reads data-frame attributes, applies            │
│  transitions (fades, draws, moves, zooms).       │
│  Arrow keys / scroll for navigation.             │
├──────────────────────────────────────────────────┤
│  Layer 1: Library (tikz-svg render())            │
│  Emits SVG elements with id, data-frame,         │
│  class attributes. Sets initial visibility.      │
│  Returns refs including byId map.                │
└──────────────────────────────────────────────────┘
```

**Layer 1** is the tikz-svg library change. It makes SVG elements targetable and frame-aware. No animation logic — just metadata on DOM elements.

**Layer 2** is a standalone JS module (not part of tikz-svg). It reads `data-frame` attributes, manages a step counter, and applies transitions. It implements the vocabulary's action verbs: `fades`, `draws`, `moves`, `dims`, `zooms`, etc. Navigation via arrow keys, scroll, or API.

**Layer 3** is the authoring experience. Markdown instruction files describe animations in the vocabulary notation (`<2, in:500> demand-curve draws`). A Claude agent reads the instruction file and generates the HTML with render() configs + controller setup. This layer is pure convention — no code, just a spec the agent follows.

Each layer is independent. Layer 1 is useful without Layer 2 (elements get IDs for manual GSAP targeting). Layer 2 works without Layer 3 (you can write controller configs by hand). Layer 3 is sugar that makes Layer 2 easy to author.

---

## Layer 1: Library Changes (CURRENT SCOPE)

### Properties added to all draw item types

Three optional properties recognized on nodes, edges, paths, and plots:

| Property | Type | Default | SVG output |
|----------|------|---------|------------|
| `id` | string | auto for nodes, none for others | `id="..."` attribute |
| `frame` | string | none | `data-frame="..."` + `visibility:hidden` if frame 1 excluded |
| `className` | string | none | Appended to `class` attribute |

### ID strategy

- **Nodes**: auto-ID from state key → `node-${stateId}`. Always present.
- **Edges, paths, plots**: ID only when the author provides one. Anonymous elements are not targetable — fine for static scaffolding (axes, ticks) that never animates.
- **Collision prevention**: when the target `<svg>` element has an `id` attribute, prefix all generated IDs: `${svgId}--node-A`, `${svgId}--edge-choose`. This prevents collisions when multiple charts share a page.

### Frame syntax

Beamer overlay syntax from the vocabulary spec:

| Spec | Meaning |
|------|---------|
| `'1'` | Frame 1 only |
| `'2-'` | Frame 2 onward |
| `'1-3'` | Frames 1 through 3 |
| `'2,4,6'` | Frames 2, 4, and 6 |

No `frame` property → always visible, no `data-frame` attribute.

### Emitter behavior

For each SVG element generated:

1. Set `id` attribute if the item has one (explicit or auto-generated for nodes)
2. If `frame` present → set `data-frame="..."` attribute
3. If `frame` present and frame 1 is NOT included → set `visibility: hidden`
4. If `className` present → append to element's `class` list

The library does NOT parse frame specs — it stores the raw string. Parsing is the controller's job.

### Usage examples

**Progressive reveal of a step function:**
```js
draw: [
  // Axes — always visible, no id needed
  { type: 'path', points: [{x:0,y:0.3},{x:0,y:-14}], arrow: '->', stroke: '#586e75' },
  { type: 'path', points: [{x:0,y:0},{x:5.5,y:0}], arrow: '->', stroke: '#586e75' },

  // Demand steps — each gets id + frame
  { type: 'path', id: 'step1', frame: '1-', points: [...], stroke: '#268bd2' },
  { type: 'path', id: 'step2', frame: '2-', points: [...], stroke: '#268bd2' },
  { type: 'path', id: 'step3', frame: '3-', points: [...], stroke: '#268bd2' },

  // CS fill — only on frame 5
  { type: 'path', id: 'cs-fill', frame: '5', fill: 'rgba(38,139,210,0.5)', points: [...], cycle: true },
]
```

**Automaton with staged edges:**
```js
states: {
  A: { label: 'start' },
  B: { position: { right: 'A' }, label: 'end', frame: '2-' },
},
edges: [
  { from: 'A', to: 'B', label: 'go', id: 'edge-go', frame: '2-' },
]
```

### Enhanced return value

```js
{
  nodes:      { [stateId]: gElement },   // existing
  edges:      [ pathElement, ... ],       // existing
  labels:     [ textElement, ... ],       // existing
  paths:      [ pathElement, ... ],       // NEW
  plots:      [ pathElement, ... ],       // NEW
  byId:       { [id]: svgElement, ... },  // NEW — all ID'd elements
  frameCount: 5,                          // NEW — max frame number found
}
```

### Files changed

1. **`src-v2/index.js`** — pass `id`, `frame`, `className` through to the model for all draw item types
2. **`src-v2/svg/emitter.js`** — set attributes on generated SVG elements; build `byId` map and `frameCount`; prefix IDs when SVG has an `id`

Estimated: ~80 lines across the two files.

---

## Layer 2: Controller (FUTURE)

A standalone JS module, separate from tikz-svg. Loaded alongside GSAP/ScrollTrigger in lecture pages.

### Responsibilities

- **Frame state**: maintains current frame number
- **Navigation**: arrow keys (left/right), scroll-driven, or API (`controller.goTo(3)`)
- **Visibility**: on frame change, queries all `[data-frame]` elements, parses specs, shows/hides
- **Transitions**: applies the animation vocabulary's action verbs:
  - `fades` → opacity transition
  - `draws` → stroke-dashoffset animation (computes dasharray post-render)
  - `moves` → transform/translate animation
  - `dims` → opacity reduction
  - `zooms` → viewBox manipulation
  - `appears/disappears` → instant show/hide
  - `stagger` → time-offset across elements sharing a `className`
- **Phase sequencing**: for each frame, plays `in` → `during` → `out` phases per the vocabulary spec
- **Default behavior**: if no transition is specified, elements show/hide instantly (Beamer-style)

### Configuration

The controller reads a config object (not instruction files — that's Layer 3):

```js
const controller = new FrameController(svgElement, refs, {
  frames: 5,
  transitions: {
    'step2': { verb: 'draws', duration: 800 },
    'cs-fill': { verb: 'fades', duration: 500 },
  },
  navigation: 'arrows',  // 'arrows' | 'scroll' | 'both'
});
```

Or with no transitions config, it falls back to instant show/hide based on `data-frame` attributes alone.

### Interaction with existing scroll-animations.js

The controller replaces the current `overlay-frame` system for animated charts. Text-only overlay frames can continue using the existing GSAP-based system. The two systems coexist — the controller manages SVG frames, scroll-animations.js manages HTML overlay frames.

---

## Layer 3: Authoring (FUTURE)

Instruction files in the animation vocabulary notation. A Claude agent reads these and generates:
1. A `render()` config with `id` and `frame` properties on draw items
2. A `FrameController` config with transitions mapped from vocabulary verbs
3. The HTML file wiring everything together

Example instruction file:
```markdown
# Emma's Demand

## Setup
- Step function with 5 segments (P=9→0)
- Axes: P vertical, Q horizontal
- Style: blue demand, solarized axes

## Frame 1: First Step
<1, in:500> step1 draws

## Frame 2: Second Step
<2, in:500> step2 draws

## Frame 3: Consumer Surplus
<3, in:300> cs-fill fades
<3> step1,step2,step3 dims
```

The agent interprets this, maps to render() config + controller config, and writes the HTML. The instruction file is the source of truth; the HTML is generated output.

---

## Implementation Order

1. **Layer 1** — library changes (this plan). Small, testable, no external dependencies.
2. **Layer 2** — controller module. Can be developed independently using test HTML files with hardcoded `data-frame` attributes.
3. **Layer 3** — authoring convention. No code — just the vocabulary spec plus agent skills/prompts.

Layers 2 and 3 can proceed in parallel once Layer 1 is deployed.
