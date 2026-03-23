# tikz-svg Skill Documentation Gaps

Audit of options supported by the library source code but missing from the SKILL.md file at `LECWeb/.claude/skills/tikz-svg/SKILL.md`.

---

## State/Node Config — Missing Options

| Option | Type | Default | Description | Source |
|--------|------|---------|-------------|--------|
| `position: {x, y}` | Object | — | Absolute positioning (not just relative) | `positioning.js:25` |
| `rx` | number | `radius` | Ellipse horizontal semi-axis | `index.js:75` |
| `ry` | number | `radius` | Ellipse vertical semi-axis | `index.js:76` |
| `halfWidth` | number | `radius` | Rectangle half-width | `index.js:71` |
| `halfHeight` | number | `radius` | Rectangle half-height | `index.js:72` |
| `opacity` | number | `1` | Node opacity | `style.js:21` |
| `className` | string | `null` | CSS class on node `<g>` | `emitter.js:279` |

---

## Edge Config — Missing Options

| Option | Type | Default | Description | Source |
|--------|------|---------|-------------|--------|
| `out` | number | — | Departure angle in degrees (0=east, CCW) | `edges.js:210` |
| `in` | number | — | Arrival angle in degrees | `edges.js:210` |
| `looseness` | number | `1` | Control-point distance multiplier for bends/loops | `edges.js:211` |
| `arrow: 'none'` | string | `'stealth'` | Suppresses arrowhead entirely | `arrows.js:57` |
| `arrowSize` | number | `8` | Arrow marker size in px | `arrows.js:59` |
| `dashed: 'string'` | string | `'6 4'` | Custom SVG stroke-dasharray (not just boolean) | `emitter.js:209` |
| `opacity` | number | `1` | Edge opacity | `style.js:49` |
| `className` | string | `null` | CSS class on edge `<path>` | `emitter.js:221` |

---

## Label Positioning — Missing Options

| Option | Type | Default | Description | Source |
|--------|------|---------|-------------|--------|
| `labelPos` | number | `0.5` | Position along edge (0=start, 1=end) | `labels.js:101` |
| `labelSide` | string | `'auto'` | `'left'`, `'right'`, or `'auto'` (outer side of curve) | `labels.js:41` |
| `labelDistance` | number | `8` | Perpendicular offset from edge in px | `labels.js:103` |
| `sloped` | boolean | `false` | Rotate label to follow edge tangent | `labels.js:96` |

All four can be set globally in `edgeStyle` or per-edge.

---

## Arrow Tips — Skill Inaccuracy

SKILL.md states: *"Built-in: Stealth, Latex, To, Bar, Circle, Bracket"*

**Reality:** Only `stealth` and `none` are implemented. The other five do not exist in `arrows.js`. This is misleading — either the skill should be corrected or the arrow types should be implemented.

---

## Feature Gap: Label-Size-Aware Placement

`labelDistance` is a fixed pixel offset that doesn't account for label text length. Short labels ("p") and long labels ("1−p") need different distances to avoid overlapping the edge. Already noted in `TODO.md`.

---

## Impact During This Session

These gaps caused multiple round-trips during lecture editing:

1. **Absolute `{x, y}` positioning** — had to grep the source to discover it
2. **`out`/`in` angles** — not in skill, tried them, produced curved edges instead of straight
3. **`arrow: 'none'`** — had to verify it existed in source
4. **`labelSide`/`labelDistance`** — not in skill, labels overlapped edges
5. **`dashed` as custom string** — had to read emitter.js to confirm `'4 2'` works
