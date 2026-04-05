# Audit Report 6: Special Syntax for Specifying Trees

**TikZ Principle (§11.6):** TikZ provides a `child` keyword for building tree structures. A `\node` can have any number of children introduced by `child { node {label} }`. The `trees` library provides automatic layout (vertical/horizontal growth, sibling distance, level distance). Styles like `every node/.style`, `edge from parent/.style` apply uniformly across the tree.

---

## What We Have

### No dedicated tree support

The library has no tree layout system. There is no `child` keyword, no tree traversal algorithm, no level-based positioning, and no `edge from parent` style.

### Manual tree encoding via relative positioning

A tree topology can be manually encoded using the general positioning system with relative specs and explicit edges:

```js
render(svg, {
  states: {
    root:   { position: { x: 0, y: 0 } },
    left:   { position: { 'below left': 'root', distance: 50 } },
    right:  { position: { 'below right': 'root', distance: 50 } },
    child1: { position: { 'below left': 'right', distance: 50 } },
    child2: { position: { 'below right': 'right', distance: 50 } },
  },
  edges: [
    { from: 'root', to: 'left', arrow: 'none' },
    { from: 'root', to: 'right', arrow: 'none' },
    { from: 'right', to: 'child1', arrow: 'none' },
    { from: 'right', to: 'child2', arrow: 'none' },
  ],
});
```

This works visually for small manually-positioned trees. It does not compute sibling or level distances automatically, and does not scale to large trees.

### `Path` class enables tree-edge drawing
If a more sophisticated caller builds tree coordinates externally (e.g., a D3 tree layout), the `Path` class and `emitter.js` could render the resulting edges. The infrastructure is not a blocker; it is the coordination layer (the tree layout algorithm) that is absent.

---

## What Is Missing

### Automatic tree layout algorithm
TikZ's tree layout algorithm places nodes based on tree structure, computing sibling distance and level distance, and avoiding overlaps. No such algorithm is implemented.

### `child` hierarchical declaration
No way to declare parent–child relationships in a nested, structural way. The library only supports flat node + edge lists.

### `grow` direction
`grow=down`, `grow=right`, `grow=north`, etc. — absent.

### Sibling distance and level distance
`sibling distance=15mm`, `level distance=15mm` options — no equivalent.

### `edge from parent` style
Automatic edge styling for parent→child connections — absent.

### `every child node/.style`
Applying uniform style to all children — absent (but partially achievable via `stateStyle`).

### Fork-down, fork-right edge styles
TikZ's tree library supports special edge shapes (sharp elbows, rounded forks) for tree edges. Not implemented.

---

## Assessment

| Feature | Status |
|---|---|
| `child` hierarchical declaration | ❌ Missing |
| Automatic tree layout | ❌ Missing |
| `grow` direction | ❌ Missing |
| Level / sibling distance | ❌ Missing |
| `edge from parent` style | ❌ Missing |
| Manual tree via relative positioning | ⚠️ Workaround (small trees only) |
| Infrastructure for external layout | ✅ `Path` + emitter usable by external algorithms |

**Overall:** Trees are entirely unimplemented as an automated feature. Manual encoding of small trees is possible but does not scale. This is an acknowledged out-of-scope area for the current automata/diagram focus.

**Priority for future work:** Medium — if the library expands to support pedagogical content (parse trees, proof trees, derivation trees), a layout algorithm such as Reingold–Tilford would be the natural addition.
