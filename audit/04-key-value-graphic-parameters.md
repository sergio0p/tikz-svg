# Audit Report 4: Key–Value Syntax for Graphic Parameters

**TikZ Principle (§11.4):** All visual parameters in TikZ are expressed as key–value pairs: `[line width=2pt, color=red, fill=blue!20]`. Processed by `pgfkeys`, they cascade: package defaults → style definitions → per-command options. The mechanism is uniform — the same syntax applies to paths, nodes, scopes, and the whole picture. Named styles (`\tikzset{mystyle/.style={...}}`) allow reusable bundles.

---

## What We Have

### JS object configuration — the natural equivalent
JavaScript plain objects `{ key: value, ... }` are the direct JS equivalent of TikZ's `[key=value, ...]`. Used throughout: node configs, edge configs, shape factory params, arrow tip params, callout options. The mapping is idiomatic and natural.

### Three-level style cascade (`style/style.js`)
`resolveNodeStyle()` and `resolveEdgeStyle()` implement a precise three-level merge mirroring TikZ:

1. **`DEFAULTS`** (`core/constants.js`) — library-wide defaults (TikZ's package-level defaults)
2. **`config.stateStyle` / `config.edgeStyle`** — picture-level style (TikZ's `\tikzset{every node/.style={...}}`)
3. **Per-node / per-edge properties** — instance overrides (TikZ's per-command `[options]`)

```js
return { ...base, ...stateStyle, ...nodeProps };
```

This three-way spread is clean, correct, and directly analogous to `pgfkeys`' cascade.

### Arrow tip parameter system (`core/arrow-tips.js`)
Arrow tips have their own key–value defaults system via `resolveParams(def, userParams)`:
- Each tip definition has a `defaults` object (length, width, inset, lineWidth)
- Users pass partial `userParams` which override only the specified keys
- `getArrowDef()` scales all params proportionally to the requested `arrowSize`

This mirrors TikZ's arrow tip parameter system (`Stealth[length=3mm, width=2mm]`).

### Shape factory parameter system (`shapes/shape.js`)
`createShape(name, spec)` defines new shapes through a spec object with named methods. Shape geometry is configured via `savedGeometry(config)` which receives a merged config including all style properties and `outerSep`. Each shape decides which keys it uses — exactly like TikZ's shape-specific options.

### Callout options system (`legacy-callouts.js`)
The callout module uses its own `DEFAULTS` object merged with user `options`. Supports: `fill`, `stroke`, `strokeWidth`, `pointerWidth`, `pointerShorten`, `cornerRadius`, `pointerArc`, `padding`, `fontSize`, `lineHeight`, `fontFamily`, `fontStyle`, `textFill`, `angle`, `distance`, `pointerGap`.

### Supported graphic parameters for nodes

| JS Key | TikZ Equivalent |
|---|---|
| `radius` | `minimum size` / radius |
| `fill` | `fill=color` |
| `stroke` | `draw=color` |
| `strokeWidth` | `line width=...` |
| `fontSize`, `fontFamily` | `font=...` |
| `shape` | `shape=...` |
| `dashed` | `dashed` / `dash pattern` |
| `opacity` | `opacity=...` |
| `shadow` | `drop shadow` |
| `accepting` | automata `accepting` |
| `initial` | automata `initial` |
| `outerSep` | `outer sep=...` |
| `innerSep` | `inner sep=...` |
| `halfWidth`, `halfHeight` | `minimum width/height` |
| `rx`, `ry` | ellipse radii |
| `labelColor` | `text=color` |
| `className` | CSS class (no TikZ equivalent) |

### Supported graphic parameters for edges

| JS Key | TikZ Equivalent |
|---|---|
| `stroke`, `strokeWidth` | `draw=color`, `line width` |
| `arrow`, `arrowSize` | Arrow tip name + scale |
| `dashed` | `dashed` |
| `opacity` | `opacity=...` |
| `bend` | `bend left/right=N` |
| `loop` | `loop above/below/...` |
| `out`, `in`, `looseness` | `out=A, in=B, looseness=L` |
| `shortenStart`, `shortenEnd` | `shorten <=...`, `shorten >=...` |
| `labelPos` | `pos=...` |
| `labelSide` | `auto` / `swap` |
| `labelDistance` | distance offset |
| `sloped` | `sloped` |

---

## What Is Missing

### Named reusable style definitions
TikZ's `\tikzset{mystate/.style={circle, fill=blue!20, draw=blue}}` has no JS equivalent. There is no style registry. The workaround is JS object spreading:
```js
const myStyle = { fill: '#ddf', stroke: 'blue' };
states: { q0: { ...myStyle }, q1: { ...myStyle } }
```
This works but lacks TikZ's `/.append style` composability and named references.

### Shape-type style hooks
TikZ's `every circle/.style`, `every state/.style` hooks apply to all nodes of a given shape type. The library has only `stateStyle` (all nodes) and `edgeStyle` (all edges) — no per-shape-type grouping.

### Key aliases and shorthand resolution
TikZ resolves bare color names, shape names, and boolean flags as shorthand. The JS library requires explicit key names.

### Parameterized styles
TikZ's `outline/.style={draw=#1, fill=#1!50}` — no equivalent (JS closures serve a similar purpose but are not first-class style definitions).

### `/.default` handler
TikZ's `/.default=value` for optional style parameters is not implemented.

---

## Assessment

| Feature | Status |
|---|---|
| Key–value JS objects | ✅ Full (JS idiom) |
| Three-level cascade (defaults → global → per-element) | ✅ Full, TikZ-faithful |
| Node parameters (15+ keys) | ✅ Full |
| Edge parameters (12+ keys) | ✅ Full |
| Arrow tip parameter system | ✅ Full, TikZ-faithful |
| Shape factory parameter system | ✅ Full |
| Callout options system | ✅ Full (legacy module) |
| Named style definitions | ❌ Missing |
| Per-shape-type style hooks | ❌ Missing |
| Key aliases / shorthand | ❌ Missing |
| Parameterized styles | ❌ Missing |

**Overall:** The key–value spirit is the most faithfully captured of all nine principles. JS objects and the three-level cascade are natural, idiomatic, and correctly TikZ-analogous. The arrow tip and shape factory defaults systems add further depth. Named styles are the most impactful missing feature for users composing complex diagrams.
