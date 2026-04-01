# Animation Vocabulary for tikz-svg

## Problem

Describing animated lecture diagrams to Claude is slow and error-prone without a shared vocabulary. Each animation sequence devolves into lengthy back-and-forth clarifications. Beamer's `<2->` syntax works because it's terse, human-readable, and unambiguous. We need the same for HTML/SVG animations — but richer, since SVG supports transitions that Beamer cannot.

## Design Principles

1. **Human-first** — the vocabulary must be something you can dictate verbally
2. **TikZ-flavored** — borrow Beamer's `<N>` mental model where it fits
3. **Minimal notation** — only require structure where ambiguity would arise
4. **The agent is the interpreter** — the vocabulary doesn't need to be machine-parseable; it needs to be unambiguous to a Claude agent reading it
5. **Declaration order is paint order** — last declared draws on top (same as TikZ)

## Non-Goals

- No formal grammar or parser (the agent interprets natural language)
- No animation engine in the library (tikz-svg generates static frames; transitions are CSS/SVG)
- No interactive/click-driven playback (linear frame sequence only, for now)

---

## 1. The Vocabulary

### 1.1 Frame Model

Animations are organized as a **flipbook** of numbered frames. Each frame has three phases:

```
in     — entry transitions (elements arriving)
during — the main frame (elements present, actions happening)
out    — exit transitions (elements leaving)
```

Playback order for frame N:
1. Execute all `in` actions (simultaneously; phase duration = max of all `in` durations)
2. Execute all `during` actions
3. Execute all `out` actions
4. Advance to frame N+1

### 1.2 Notation

```
<frame[, phase[:duration]]> element action [property [from->]to] [easing]
```

| Part | Required | Description |
|------|----------|-------------|
| `frame` | yes | Integer step number |
| `phase` | no | `in`, `out`, or omitted for `during` |
| `duration` | no | Milliseconds, attached to phase with `:` |
| `element` | yes | Named element (node id, edge id, or group) |
| `action` | yes | Verb describing what happens |
| `property` | depends | Some actions need a property target (color, opacity, etc.) |
| `from->to` | no | Transition values; `from` optional (defaults to current state) |
| `easing` | no | `ease-in`, `ease-out`, `ease-in-out`, `linear` |

All parts except `frame` and `element` + `action` are optional. Omitted values use config defaults.

**Phase shorthand:**
- `<2>` — no phase, element simply exists on this frame
- `<2, in>` — entry phase, default duration
- `<2, in:500>` — entry phase, 500ms
- `<2, :500>` — during phase (phase name omitted), 500ms
- `<2, out>` — exit phase, default duration

### 1.3 Persistence

- `<2>` — element exists on frame 2 only
- `<2->` — element exists from frame 2 onward (Beamer-style range)
- `<2-5>` — element exists on frames 2 through 5
- `<1,3,5>` — element exists on frames 1, 3, and 5

This follows Beamer's overlay spec syntax exactly.

### 1.4 Phase Timing

- Each phase's duration = `max()` of all declared durations in that phase
- If no duration is specified on any action, a global default from config applies
- Actions with shorter durations finish early and **hold** until the phase completes

---

## 2. Core Action Verbs

These are the verbs the agent understands. Grouped by category.

### 2.1 Appearance

| Verb | Meaning | Example |
|------|---------|---------|
| `fades` | Opacity transition | `<2, in:500> node-A fades ease-in` |
| `appears` | Instant show (no transition) | `<1> node-A appears` |
| `disappears` | Instant hide | `<3, out> node-A disappears` |
| `dims` | Reduces opacity / grays out | `<2> node-A dims` |

### 2.2 Color / Style

| Verb | Meaning | Example |
|------|---------|---------|
| `color` | Fill or stroke color change | `<2, :500> node-A color white->purple` |
| `fill` | Fill color change | `<2> node-A fill none->yellow` |
| `stroke` | Stroke color change | `<2> edge-B stroke black->red` |
| `highlight` | Temporary bright pulse, reverts | `<2> node-A highlights` |
| `thickness` | Stroke width change | `<2> edge-A thickness 1->3` |
| `dashes` | Change to dashed/dotted | `<2> edge-A dashes` |

### 2.3 Spatial

| Verb | Meaning | Example |
|------|---------|---------|
| `moves` | Translate to new position | `<2, :800> node-A moves (3,4) ease-in` |
| `follows` | Move along a path | `<2, :1000> node-A follows path-1` |
| `swaps` | Two elements exchange | `<2, :500> node-A swaps node-B` |

### 2.4 Transform

| Verb | Meaning | Example |
|------|---------|---------|
| `rotates` | Rotation | `<2, :1000> node-A rotates 0->360` |
| `scales` | Uniform scale | `<2, in:500> node-A scales 0->1` |
| `grows` | Scale from zero + fade in | `<2, in:500> node-A grows` |
| `shrinks` | Scale to zero + fade out | `<2, out:500> node-A shrinks` |
| `morphs` | Shape interpolation | `<3, out:800> rectangle morphs circle` |

### 2.5 Reveal (Progressive Disclosure)

| Verb | Meaning | Example |
|------|---------|---------|
| `draws` | Stroke-dashoffset animation (pen drawing) | `<2, in:800> edge-A draws` |
| `undraws` | Reverse stroke draw | `<3, out:500> edge-A undraws` |
| `types` | Text appears character by character | `<2, in:1000> node-A types` |
| `wipes` | Directional reveal via clip-path | `<2, in:500> node-A wipes left-to-right` |

### 2.6 Camera / Viewport

Camera actions apply to the whole scene, not individual elements.

| Verb | Meaning | Example |
|------|---------|---------|
| `zooms` | ViewBox scale toward target | `<3, in:500> camera zooms node-A` |
| `zooms out` | ViewBox returns to full view | `<5, out:500> camera zooms out` |
| `pans` | ViewBox translation | `<3, :500> camera pans (200, 100)` |
| `focuses` | Zoom + dim everything except target | `<3> camera focuses node-A` |

### 2.7 Group / Composite

| Verb | Meaning | Example |
|------|---------|---------|
| `stagger` | Same action across group, offset in time | `<2, in:500> nodes q0,q1,q2 fade stagger:100` |

---

## 3. Instruction File Format

The instruction file is a Markdown document with human-readable animation descriptions. The agent reads this file and generates the animated HTML.

```markdown
# Lecture: DFA for Binary Divisibility

## Setup
- Automaton with nodes q0, q1, q2 in a triangle
- q0 is initial, q2 is accepting
- Edges: q0->q1 "0", q1->q2 "1", q2->q0 "0", self-loops as needed
- Style: blue nodes, white text, thick edges

## Frame 1: The States
<1, in:500> nodes q0, q1, q2 fade stagger:150
<1, in:300> labels fade

## Frame 2: Initial State
<2, in:400> q0 highlight
<2, in:500> initial arrow draws

## Frame 3: First Transition
<2> q0 dims
<3, in:600> edge q0->q1 draws
<3> q1 highlight

## Frame 4: Accepting
<4, in:500> edge q1->q2 draws
<4> q2 highlight
<4, in:300> accepting ring grows

## Frame 5: Full Picture
<5, in:500> all edges fade
<5> camera zooms out
```

### Conventions

- **Setup section**: Describes the initial scene layout — what nodes, edges, positions, styles exist. This maps to a `render()` config. No animation here, just the cast of characters.
- **Frame sections**: Each describes what changes at that step. The heading is a human-readable title (useful for the presenter, ignored by the agent).
- **Free-form notes**: Text outside `<>` notation is context for the agent — intent, explanations, clarifications. The agent uses these to resolve ambiguity.
- **Element naming**: Use node/edge ids from the Setup section. Natural references like "the edge from q0 to q1" are fine — the agent resolves them.

---

## 4. Agent Contract

### Input
- The instruction file (Markdown)
- Access to the tikz-svg library (`src-v2/`)

### Output
- An HTML file containing:
  - A sequence of `render()` configs (one per frame, or per phase if transitions require intermediate states)
  - CSS transitions/animations for inter-frame changes
  - A minimal playback controller (next/prev/auto-play)

### Responsibilities
- Parse the Setup section into an initial `render()` config
- For each frame, compute the delta from the previous frame's config
- Map action verbs to CSS/SVG transitions (fade -> opacity, move -> transform, draw -> stroke-dashoffset, etc.)
- Handle camera actions by manipulating the SVG `viewBox`
- Resolve natural-language element references to config ids
- Apply easing and timing defaults from config

### What the Agent Does NOT Do
- Modify tikz-svg library source code
- Build a reusable animation engine
- Handle interactive/click events (future work)

---

## 5. Playback Shell

A lightweight HTML/JS wrapper that manages frame playback:

- **Frame array**: ordered list of rendered SVG states + transition metadata
- **Controls**: next, previous, play/pause, frame counter
- **Keyboard**: arrow keys for next/prev, space for play/pause
- **Transitions**: CSS transitions between frames, driven by the transition annotations from the agent
- **Phase sequencing**: for each frame, plays `in` -> `during` -> `out` in order, advancing only when all actions in a phase complete

The shell is intentionally minimal — it's a viewer, not an editor. The instruction file is the source of truth.

---

## 6. Workflow

```
You (VS Code session 1)          Agent (session 2 / watcher)
       |                                    |
  Write/edit instruction.md  ------>  Detects file change
       |                                    |
       |                             Reads instruction.md
       |                                    |
       |                             Generates render configs
       |                                    |
       |                             Writes animation.html
       |                                    |
  Browser auto-refreshes    <------  (served via http-server)
       |
  Watch result, iterate
```

The feedback loop should be fast — edit a line in the instruction file, save, see the change in the browser within seconds.

---

## 7. Config Defaults

Stored in a config section of the instruction file or a separate config file:

```markdown
## Config
- default-in-duration: 500ms
- default-during-duration: 2000ms
- default-out-duration: 500ms
- default-easing: ease-in-out
- playback-speed: 1x
```

These are overridable per-action via the notation. Exact defaults to be determined through usage.

---

## 8. Future Considerations (Not In Scope)

- **Interactive playback**: click/hover triggers, branching paths
- **Export to video**: render frame sequence to MP4/GIF
- **Collaborative editing**: multiple users editing the instruction file
- **Library animation engine**: if patterns stabilize, extract reusable animation primitives into tikz-svg
- **Formal parser**: if the notation proves stable enough, a parser could replace agent interpretation
- **Presenter notes**: per-frame notes for what to say during the animation

---

*Spec written 2026-03-31. Based on brainstorming session exploring Beamer overlay mechanisms, animation industry notation systems (X-sheets, timing charts), visualization grammars (gganimate, Gemini, Canis), and iterative vocabulary design.*
