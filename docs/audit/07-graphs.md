# Audit Report 7: Special Syntax for Graphs

**TikZ Principle (§11.7):** The `\graph` command (from `\usetikzlibrary{graphs}`) provides a compact DOT-like syntax for declaring graph structures. Nodes differing only in label can be declared in bulk. Edge chains use `->` (directed) and `--` (undirected). With LuaTeX, automatic layout algorithms can position nodes without manual coordinates.

---

## What We Have

### Directed graph structure — the library's core abstraction
The library's fundamental model is a directed graph: a `states` object (nodes) plus an `edges` array. `render()` and `renderAutomaton()` both accept this model. This is the declarative equivalent of `\graph`'s node and edge declarations.

```js
render(svg, {
  states: {
    A: { position: { x: 0, y: 0 } },
    B: { position: { right: 'A' } },
    C: { position: { right: 'B' } },
  },
  edges: [
    { from: 'A', to: 'B', label: 'f' },
    { from: 'B', to: 'C', label: 'g' },
    { from: 'A', to: 'C', label: 'h', bend: 'left' },
  ]
});
```

### Graph integrity validation (`automata/automata.js`)
`renderAutomaton()` validates that every `edge.from`/`edge.to` references an existing state, throwing a descriptive error. TikZ silently drops invalid references; the JS library catches them early.

### Relative layout via topological sort
`resolvePositions()` uses Kahn's topological sort to resolve node positions in dependency order. This is a lightweight graph layout that handles chains, trees, and DAGs of position specs. It does not compute aesthetically optimal positions but correctly handles any dependency topology including diamond-shaped dependencies.

### Full edge geometry library
All edge types relevant to general graphs are supported: straight, bent (quadratic Bezier), explicit out/in angles (cubic Bezier), self-loops. The complete TikZ `to [bend left=N, out=A, in=B, looseness=L, shorten >=N]` option set is implemented.

### 18+ arrow tips covering TikZ's full catalog
The `ArrowTipRegistry` supports both directed and undirected edge styles. Undirected edges are expressed as `arrow: 'none'`. The full range of TikZ tip types is available: filled (stealth, latex, kite), open barbs (straight barb, hooks, arc barb), special tips (tee barb, bar, bracket).

---

## What Is Missing

### DOT-notation compact syntax
TikZ's `root -> { left, right -> {child, child} }` compact chain syntax is absent. All edges must be listed individually as objects.

### Automatic graph layout algorithms
TikZ (with LuaTeX's `graphdrawing` library) supports Sugiyama, force-based, circular, and other layout algorithms. The JS library has no automatic layout beyond relative position chaining. For large graphs, users must supply all positions explicitly or via relative specs.

### Edge chains
`a -> b -> c -> d` creating three edges in one declaration — absent.

### Undirected edge semantic
No semantic distinction between directed (`->`) and undirected (`--`) graph edges. Undirected is approximated by suppressing the arrow marker.

### Subgraph grouping with shared options
TikZ's `{ ... }` subgraph blocks with inherited options — absent.

### Node groups / bulk creation
`\graph` can implicitly create many nodes: `a, b, c, d -> e` creates five nodes. All nodes must be explicitly declared in JS.

---

## Assessment

| Feature | Status |
|---|---|
| Directed graph structure (nodes + edges) | ✅ Full |
| Graph integrity validation | ✅ Full (beyond TikZ) |
| Relative layout via topological sort | ✅ Partial (chain/DAG, not aesthetically optimal) |
| Full edge geometry (bend, out/in, loops) | ✅ Full |
| 18+ arrow tips for edge styling | ✅ Full |
| Undirected edges (arrow suppression) | ⚠️ Workaround |
| DOT-notation compact syntax | ❌ Missing |
| Automatic layout algorithms | ❌ Missing |
| Edge chains | ❌ Missing |
| Subgraph grouping | ❌ Missing |
| Implicit bulk node creation | ❌ Missing |

**Overall:** The data model is graph-complete. The rendering capabilities (edge types, tips, labels) go well beyond what `\graph` itself provides. What is missing is the compact declaration syntax and automatic layout — both significant for large diagrams, but not blocking for automata-scale graphs where manual positioning is standard.
