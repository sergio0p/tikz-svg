**Status: PENDING** — Import path switch not yet executed. Needs visual validation.

# App Migration to tikz-svg: Feasibility Assessment & Plan

**Date:** 2026-03-24

## Apps Inventory

| App | Location | SVG Drawing Method | Lines of SVG code | Complexity |
|---|---|---|---|---|
| arbitrage.html | LECWeb/510/ | `renderAutomaton` (6 calls) | Already uses library | N/A |
| financial-markets.html | LECWeb/510/ | `renderAutomaton` (1 call) | Already uses library | N/A |
| monopoly.html | LECWeb/101/ | `ellipseCallout` (IIFE copy) | ~20 lines | Low |
| information-partition-app | E510/Apps/ | Hand-rolled SVG | ~210 lines | Medium |
| backward-induction | E510/GameTreeApp/ | Hand-rolled SVG + d3-hierarchy | ~956 lines | High |

## Assessment Per App

---

### 1. arbitrage.html & financial-markets.html — MIGRATE IMPORT PATH ONLY

These already use `renderAutomaton`. The only change needed is the import path from `src/` to `src-v2/`:

```diff
- import { renderAutomaton } from './tikz-svg/src/automata/automata.js';
+ import { renderAutomaton } from './tikz-svg/src-v2/automata/automata.js';
```

**Risk:** Low. The `src-v2` API is a superset of `src`. All existing config keys are supported.

**Validation:** Open each page in browser, visually compare the 7 total automata diagrams against current appearance. The rendering should be identical or improved (better label placement from node-based labels, correct outerSep).

**Files:**
- `/Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/arbitrage.html` (6 calls)
- `/Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/financial-markets.html` (1 call)

---

### 2. monopoly.html — NO MIGRATION

Uses `ellipseCallout` from a standalone `js/callouts.js` IIFE copy. This is the legacy callout module, not the render pipeline. The callout API is independent and unaffected by our changes.

**Recommendation:** Leave as-is. If callouts are ever integrated into the main `render()` pipeline (as a callout shape), this can be revisited.

---

### 3. information-partition-app.html — CANDIDATE FOR MIGRATION

**Current implementation** (lines 722–909): Hand-rolled SVG with `drawTree()` → `calculateLayout()` → `drawNode()` recursion.

**What it draws:**
- Circular nodes (r=22, two fill colors based on partition state)
- Quadratic Bézier edges between parent/child nodes
- Edge labels positioned along the perpendicular normal
- Arrow markers on edges
- Node labels (time + info set symbols)
- Dynamic: tree structure changes based on user interaction

**What our library provides:**
- Circles with configurable fill/stroke ✅
- Edges with arrow tips ✅
- Edge labels with auto-positioning ✅
- Named styles (new!) — perfect for the two node color variants ✅
- Groups (new!) — could group nodes by partition type ✅

**What our library does NOT provide:**
- Automatic tree layout algorithm ❌ — the app has its own `calculateLayout()` that computes `(x, y)` for each node based on leaf count and level depth
- Dynamic re-rendering after user interaction ❌ — `render()` clears and rebuilds the SVG; the app would need to call it on every state change

**Migration approach:**
1. Keep the existing `calculateLayout()` function — it computes `{ x, y }` positions for each node
2. Replace `drawTree()` / `drawNode()` with a single `render()` call that uses computed positions
3. Convert the tree's node/edge data into `config.states` and `config.edges`
4. Use named styles for the two node color variants (trivial vs non-trivial partition)

**Before (hand-rolled, ~210 lines):**
```js
function drawTree() {
  svg.innerHTML = '';
  // ... manual defs, arrow markers
  const layout = calculateLayout(tree, width, height);
  drawNode(svg, tree, layout); // recursive, creates circles + paths + text
}
```

**After (tikz-svg, ~60 lines):**
```js
import { render } from './tikz-svg/src-v2/index.js';
import { Transform } from './tikz-svg/src-v2/core/transform.js';

function drawTree() {
  const tree = appState.partitionTree;
  const layout = calculateLayout(tree, width, height); // KEEP existing layout

  // Convert tree to render config
  const { states, edges } = treeToConfig(tree, layout);

  render(document.getElementById('tree-svg'), {
    styles: {
      trivial:    { fill: '#E5E7EB', stroke: '#13294B', strokeWidth: 2, labelColor: '#13294B' },
      nonTrivial: { fill: '#4B9CD3', stroke: '#13294B', strokeWidth: 2, labelColor: 'white' },
    },
    edgeStyle: { stroke: '#13294B', strokeWidth: 2, arrow: 'stealth' },
    states,
    edges,
  });
}

function treeToConfig(node, layout, states = {}, edges = []) {
  const pos = layout.get(node);
  const id = nodeId(node); // unique ID from node's info set + time
  states[id] = {
    position: { x: pos.x, y: pos.y },
    style: isFinest(node.infoSet) ? 'trivial' : 'nonTrivial',
    label: buildLabel(node),
    radius: 22,
  };
  node.children.forEach((child, idx) => {
    const childId = nodeId(child);
    treeToConfig(child, layout, states, edges);
    edges.push({
      from: id,
      to: childId,
      label: (idx === 0) ? child.label : child.notation,
    });
  });
  return { states, edges };
}
```

**Estimated effort:** Medium. ~150 lines removed, ~60 added. The tricky part is generating unique stable node IDs from the tree structure and ensuring the dynamic rebuild (user picks a partition → tree changes → re-render) works correctly.

**Risk:** Medium. The layout algorithm stays unchanged, but visual differences may emerge from:
- Different label positioning (our library uses TikZ anchor selection vs. the app's manual perpendicular offset)
- Different edge curvature (the app uses `Q` curves tuned to its tree; our library uses `borderPoint` start/end)
- Arrow marker sizing differences

**Validation:** Side-by-side comparison of tree rendering at each step of the partition building process.

---

### 4. backward-induction app — DO NOT MIGRATE (YET)

**Current implementation:** 956-line `tree-renderer.js` with d3-hierarchy for layout, extensive perpendicular leaf placement, collision avoidance, payoff labels, player color coding, and animation support via `animations.js`.

**Why not now:**
1. **d3-hierarchy dependency** — uses `d3.tree()` for layout, which our library cannot replace
2. **Perpendicular leaf placement** — 300+ lines of custom layout logic for placing terminal nodes perpendicular to their parent edges. This is a sophisticated game-theory-specific layout that has no TikZ equivalent.
3. **Animation integration** — `animations.js` manipulates individual SVG elements for backward induction step-through. Our `render()` clears and rebuilds, which would break incremental animation.
4. **Payoff rendering** — terminal nodes display payoff tuples with player-specific coloring, which our label system doesn't support (single-color text only).

**Prerequisite for future migration:**
- Tree layout algorithm in the library (audit report #6)
- Multi-part/multi-color labels (KaTeX integration from TODO.md)
- Incremental SVG updates (don't clear on re-render)
- Or: use the library only for the static rendering parts and keep d3 for layout

**Recommendation:** Defer. The cost/benefit ratio is unfavorable — the app works well, and the library would need significant extensions to match its capabilities.

---

## Migration Plan

### Task 1: LECWeb import path migration

- [ ] **Step 1:** Update import paths in `arbitrage.html` (6 occurrences)
```bash
sed -i '' 's|/tikz-svg/src/automata/automata.js|/tikz-svg/src-v2/automata/automata.js|g' \
  /Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/arbitrage.html
```

- [ ] **Step 2:** Update import path in `financial-markets.html` (1 occurrence)
```bash
sed -i '' 's|/tikz-svg/src/automata/automata.js|/tikz-svg/src-v2/automata/automata.js|g' \
  /Users/sergiop/Dropbox/Teaching/Projects/LECWeb/510/financial-markets.html
```

- [ ] **Step 3:** Open both pages in browser and visually validate all 7 diagrams

### Task 2: Information partition app migration

> This task should NOT be done until Task 1 is validated. The information partition app is more complex and its migration is optional — it works fine as-is.

- [ ] **Step 1:** Create a backup of the current app
- [ ] **Step 2:** Add tikz-svg symlink or import path to E510/Apps/
- [ ] **Step 3:** Write `treeToConfig()` conversion function
- [ ] **Step 4:** Replace `drawTree()` body with `render()` call
- [ ] **Step 5:** Remove `drawNode()`, simplify `calculateLayout()` (only needs to return positions)
- [ ] **Step 6:** Visual comparison at each partition step (3 states × 2 time periods = several tree shapes)
- [ ] **Step 7:** Test edge labels — verify they appear in readable positions
- [ ] **Step 8:** Test dynamic rebuild — user picks partition → tree updates correctly

## Summary

| App | Action | Priority | Risk |
|---|---|---|---|
| arbitrage.html | Change import path | High | Low |
| financial-markets.html | Change import path | High | Low |
| monopoly.html | No change | — | — |
| information-partition-app | Migrate to `render()` | Medium | Medium |
| backward-induction | No change (defer) | Low | High |
