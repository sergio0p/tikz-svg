# Audit Report 8: Grouping of Graphic Parameters

**TikZ Principle (§11.8):** Graphic parameters can be grouped into scopes so they apply to a set of commands. TikZ's `\begin{scope}[options]\end{scope}` localizes options: everything inside inherits those options, overridable per-command. Scopes can nest arbitrarily. The `tikzpicture` environment is the outermost scope. Clipping is also local to the scope.

---

## What We Have

### Two-level style cascade — picture-scope and element-scope
`style/style.js` implements the cascade:
1. **`DEFAULTS`** — implicit base scope (library-wide)
2. **`stateStyle` / `edgeStyle`** — picture-level scope (equivalent to options on the `tikzpicture` environment)
3. **Per-node / per-edge properties** — element-level override

```js
render(svg, {
  stateStyle: { fill: '#eef', stroke: '#00f', strokeWidth: 2 }, // scope-level
  states: {
    q0: {},                    // inherits all scope values
    q1: { fill: '#fef' },      // overrides only fill
    q2: { stroke: 'red' },     // overrides only stroke
  }
});
```

This is structurally TikZ-correct: `{ ...base, ...stateStyle, ...nodeProps }`.

### `DEFAULTS` as the base scope (`core/constants.js`)
All defaults flow from a single source of truth. Changing `DEFAULTS.nodeRadius` affects all nodes that don't override it — exactly how TikZ's package-level defaults work.

### `TransformStack` — scope-based transform management (`core/transform.js`)
`TransformStack` implements a push/pop stack for affine transform state:

```js
const stack = new TransformStack();
stack.push();                    // save current transform (begin scope)
stack.current.translate(10, 20); // modify within scope
const pt = stack.current.apply(point);
stack.pop();                     // restore (end scope)
```

This is a faithful implementation of PGF's `\pgftransformreset` + save/restore mechanism. The stack supports arbitrary depth.

### `Path.transform(T)` — scope-limited path transformation
`path.transform(transformObj)` returns a new `Path` with all points transformed, without mutating the original. This is equivalent to applying a TikZ scope transform to a path before drawing.

### Callout module — self-contained scope
`legacy-callouts.js` is an IIFE that maintains its own `DEFAULTS` scope, independent of the main pipeline's `DEFAULTS`. Each callout call merges the callout-specific defaults with user options, providing scope isolation between the callout subsystem and the rest of the library.

---

## What Is Missing

### Nested scopes in the render config
The library supports exactly two levels: picture-wide and per-element. There is no way to group a subset of nodes/edges with shared overrides that differs from the picture-wide style:

```js
// This is NOT possible:
render(svg, {
  scopes: [
    { nodeIds: ['q0', 'q1'], style: { fill: 'red' } },
    { nodeIds: ['q2', 'q3'], style: { fill: 'blue' } },
  ],
  ...
});
```

To achieve this, users must repeat the style on each node individually.

### `TransformStack` disconnected from the render pipeline
`core/transform.js` provides a complete `TransformStack`, but the main `render()` pipeline does not use it. All transforms in `emitter.js` are applied via inline string attributes (`translate(x,y)`), not through the `TransformStack`. The infrastructure exists but is unused.

### Clipping scopes
TikZ's `\begin{scope}` also scopes clipping paths. Since the library has no clip support (see Report 3), this is moot, but it remains a missing combination.

### `every scope/.style` and `execute at begin/end scope`
TikZ hooks for scope lifecycle — absent.

---

## Assessment

| Feature | Status |
|---|---|
| Picture-level style scope (`stateStyle`, `edgeStyle`) | ✅ Full |
| Per-element override | ✅ Full |
| `DEFAULTS` as base scope | ✅ Full |
| `TransformStack` push/pop for transforms | ✅ Implemented |
| `Path.transform(T)` for scope-transformed paths | ✅ Full |
| Callout IIFE scope isolation | ✅ Full |
| `TransformStack` wired to render pipeline | ❌ Not wired |
| Nested scopes for node/edge subsets | ❌ Missing |
| Clipping scopes | ❌ Missing (clipping absent) |
| `execute at begin/end scope` hooks | ❌ Missing |

**Overall:** The spirit of parameter grouping is captured through the two-level cascade and `DEFAULTS`. The `TransformStack` is a well-designed but disconnected asset. The key gap is nested grouping for subsets of elements — a meaningful limitation when authoring diagrams with visually distinct regions.
