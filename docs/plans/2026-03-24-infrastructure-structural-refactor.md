# Infrastructure & Structural Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three highest-priority gaps from the audit: named style definitions, node/edge groups with shared styles, and wiring the existing Transform infrastructure to the render pipeline.

**Architecture:** Three additive, backward-compatible features layered onto the existing 6-phase pipeline. Each task extends the style cascade without changing the existing merge order. The style cascade after all three tasks: `DEFAULTS → stateStyle/edgeStyle → group style → per-element props (with named style expanded)`. All existing configs continue to work unchanged.

**Tech Stack:** Pure ES modules, `node --test`, jsdom for integration tests. No new dependencies.

**Stop-at-any-step guarantee:** Each task ships a complete, tested, backward-compatible feature. The library is fully usable after any task.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src-v2/style/registry.js` | **Create** | Named style storage and resolution |
| `src-v2/style/style.js` | **Modify** | Expand named style refs in cascade |
| `src-v2/index.js` | **Modify** | Group resolution, transform application |
| `src-v2/core/constants.js` | No change | — |
| `src-v2/core/transform.js` | No change | Already complete |
| `test/style-registry.test.js` | **Create** | Tests for style registry + resolution |
| `test/groups.test.js` | **Create** | Tests for group style cascade |
| `test/pipeline-transform.test.js` | **Create** | Tests for transform in pipeline |

---

### Task 1: Named Style Registry

**What it does:** Users define reusable style bundles in `config.styles` and reference them by name via a `style` property on any node or edge. Named styles expand into their properties before the cascade merge, so per-element properties still win.

**API after this task:**
```js
render(svg, {
  styles: {
    blueNode: { fill: '#ddf', stroke: 'blue', shape: 'diamond' },
    dangerEdge: { stroke: 'red', dashed: true },
  },
  states: {
    q0: { style: 'blueNode', initial: true },
    q1: { style: 'blueNode', fill: '#fdf' }, // fill overrides blueNode.fill
  },
  edges: [
    { from: 'q0', to: 'q1', style: 'dangerEdge', label: 'a' },
  ],
});
```

**Cascade after this task:** `DEFAULTS → stateStyle/edgeStyle → expanded named style → per-element props`

**Files:**
- Create: `src-v2/style/registry.js`
- Modify: `src-v2/style/style.js`
- Create: `test/style-registry.test.js`

- [ ] **Step 1: Write failing tests for the style registry**

Create `test/style-registry.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StyleRegistry } from '../src-v2/style/registry.js';

describe('StyleRegistry', () => {
  it('stores and retrieves a named style', () => {
    const reg = new StyleRegistry({ myStyle: { fill: 'red', stroke: 'blue' } });
    assert.deepStrictEqual(reg.get('myStyle'), { fill: 'red', stroke: 'blue' });
  });

  it('returns empty object for unknown style name', () => {
    const reg = new StyleRegistry({});
    assert.deepStrictEqual(reg.get('nope'), {});
  });

  it('expands style ref in a props object', () => {
    const reg = new StyleRegistry({ accent: { fill: 'red', stroke: 'blue' } });
    const props = { style: 'accent', opacity: 0.5 };
    const expanded = reg.expand(props);
    // Named style props are under per-element props, so per-element wins
    assert.deepStrictEqual(expanded, { fill: 'red', stroke: 'blue', opacity: 0.5 });
  });

  it('per-element props override named style', () => {
    const reg = new StyleRegistry({ accent: { fill: 'red', stroke: 'blue' } });
    const props = { style: 'accent', fill: 'green' };
    const expanded = reg.expand(props);
    assert.strictEqual(expanded.fill, 'green');
    assert.strictEqual(expanded.stroke, 'blue');
  });

  it('passes through props unchanged when no style ref', () => {
    const reg = new StyleRegistry({ accent: { fill: 'red' } });
    const props = { fill: 'green', opacity: 0.5 };
    const expanded = reg.expand(props);
    assert.deepStrictEqual(expanded, { fill: 'green', opacity: 0.5 });
  });

  it('strips the style key from expanded result', () => {
    const reg = new StyleRegistry({ x: { fill: 'red' } });
    const expanded = reg.expand({ style: 'x' });
    assert.strictEqual(expanded.style, undefined);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/style-registry.test.js`
Expected: FAIL — `Cannot find module '../src-v2/style/registry.js'`

- [ ] **Step 3: Implement StyleRegistry**

Create `src-v2/style/registry.js`:

```js
/**
 * Named style registry.
 * Stores style bundles by name and expands style references in property objects.
 */
export class StyleRegistry {
  /** @param {Object<string, Object>} styles - name → property bundle */
  constructor(styles = {}) {
    this._styles = styles;
  }

  /** Retrieve a named style's properties (empty object if not found). */
  get(name) {
    return this._styles[name] ?? {};
  }

  /**
   * Expand a style reference in a props object.
   * If props.style is a string, look it up and merge: named style under per-element.
   * The 'style' key is removed from the result.
   * @param {Object} props
   * @returns {Object} new props with named style expanded
   */
  expand(props) {
    if (!props || typeof props.style !== 'string') return { ...props };
    const { style: styleName, ...rest } = props;
    const namedProps = this.get(styleName);
    return { ...namedProps, ...rest };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/style-registry.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 5: Write failing tests for style cascade integration**

Add to `test/style-registry.test.js`:

```js
import { resolveNodeStyle, resolveEdgeStyle } from '../src-v2/style/style.js';

describe('Named style in cascade', () => {
  it('named style expands in node resolution', () => {
    const config = {
      styles: { accent: { fill: 'red', stroke: 'blue' } },
      stateStyle: { fontSize: 18 },
      states: { q0: { style: 'accent', opacity: 0.8 } },
    };
    const resolved = resolveNodeStyle('q0', config);
    assert.strictEqual(resolved.fill, 'red');
    assert.strictEqual(resolved.stroke, 'blue');
    assert.strictEqual(resolved.opacity, 0.8);
    assert.strictEqual(resolved.fontSize, 18);
  });

  it('per-node prop overrides named style', () => {
    const config = {
      styles: { accent: { fill: 'red' } },
      states: { q0: { style: 'accent', fill: 'green' } },
    };
    const resolved = resolveNodeStyle('q0', config);
    assert.strictEqual(resolved.fill, 'green');
  });

  it('named style expands in edge resolution', () => {
    const config = {
      styles: { warn: { stroke: 'orange', dashed: true } },
      edges: [{ from: 'q0', to: 'q1', style: 'warn', label: 'a' }],
    };
    const resolved = resolveEdgeStyle(0, config);
    assert.strictEqual(resolved.stroke, 'orange');
    assert.strictEqual(resolved.dashed, true);
  });

  it('works with no styles defined', () => {
    const config = { states: { q0: { fill: 'green' } } };
    const resolved = resolveNodeStyle('q0', config);
    assert.strictEqual(resolved.fill, 'green');
  });
});
```

- [ ] **Step 6: Run to verify cascade tests fail**

Run: `node --test test/style-registry.test.js`
Expected: Cascade tests FAIL — `resolveNodeStyle` doesn't handle `styles`/`style` yet.

- [ ] **Step 7: Modify `style.js` to expand named styles**

In `src-v2/style/style.js`, add the import and modify both resolve functions:

Add at top:
```js
import { StyleRegistry } from './registry.js';
```

Replace `resolveNodeStyle`:
```js
export function resolveNodeStyle(nodeId, config) {
  const base = {
    radius: DEFAULTS.nodeRadius,
    fill: DEFAULTS.nodeFill,
    stroke: DEFAULTS.nodeStroke,
    strokeWidth: DEFAULTS.nodeStrokeWidth,
    fontSize: DEFAULTS.fontSize,
    fontFamily: DEFAULTS.fontFamily,
    shadow: DEFAULTS.shadow,
    dashed: false,
    opacity: 1,
    shape: 'circle',
    accepting: false,
    initial: false,
    acceptingInset: DEFAULTS.acceptingInset,
    labelColor: '#000000',
    className: null,
  };
  const stateStyle = config.stateStyle || {};
  const nodeProps = config.states?.[nodeId] || {};
  // Expand named style reference if present
  const registry = new StyleRegistry(config.styles);
  const expandedProps = registry.expand(nodeProps);
  return { ...base, ...stateStyle, ...expandedProps };
}
```

Replace `resolveEdgeStyle`:
```js
export function resolveEdgeStyle(edgeIndex, config) {
  const base = {
    stroke: DEFAULTS.edgeColor,
    strokeWidth: DEFAULTS.edgeStrokeWidth,
    arrow: 'stealth',
    dashed: false,
    opacity: 1,
    bend: null,
    loop: null,
    labelPos: 0.5,
    labelSide: 'auto',
    labelDistance: DEFAULTS.labelDistance,
    innerSep: DEFAULTS.innerSep,
    shortenStart: DEFAULTS.shortenStart,
    shortenEnd: DEFAULTS.shortenEnd,
    className: null,
  };
  const edgeStyle = config.edgeStyle || {};
  const edgeProps = config.edges?.[edgeIndex] || {};
  // Expand named style reference if present
  const registry = new StyleRegistry(config.styles);
  const expandedProps = registry.expand(edgeProps);
  return { ...base, ...edgeStyle, ...expandedProps };
}
```

- [ ] **Step 8: Run all style tests**

Run: `node --test test/style-registry.test.js`
Expected: All 10 tests PASS.

- [ ] **Step 9: Run existing tests to verify backward compatibility**

Run: `node --test`
Expected: All existing tests PASS unchanged. The `StyleRegistry` constructor with no `config.styles` returns empty objects, so `expand()` is a no-op for existing configs.

- [ ] **Step 10: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/style/registry.js src-v2/style/style.js test/style-registry.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add named style registry with cascade integration"
```

---

### Task 2: Node/Edge Groups with Shared Styles

**What it does:** Users declare `groups` in the config — arrays of node IDs or edge indices that share a style bundle. Group styles insert between `stateStyle`/`edgeStyle` (picture-level) and per-element properties in the cascade.

**API after this task:**
```js
render(svg, {
  styles: { red: { fill: '#fee', stroke: 'red' } },
  groups: [
    { nodes: ['q0', 'q1'], style: { fill: '#ddf', stroke: 'blue' } },
    { nodes: ['q2', 'q3'], style: 'red' },  // can reference named style
    { edges: [0, 1], style: { dashed: true } },
  ],
  states: {
    q0: {},
    q1: { fill: '#fdf' },  // still overrides group
    q2: {},
    q3: {},
  },
  edges: [ ... ],
});
```

**Cascade after this task:** `DEFAULTS → stateStyle/edgeStyle → group style → expanded named style → per-element props`

**Files:**
- Modify: `src-v2/style/style.js`
- Modify: `src-v2/style/registry.js` (add group resolution helper)
- Create: `test/groups.test.js`

- [ ] **Step 1: Write failing tests for group resolution**

Create `test/groups.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNodeStyle, resolveEdgeStyle } from '../src-v2/style/style.js';

describe('Node groups', () => {
  it('group style applies to nodes in the group', () => {
    const config = {
      groups: [{ nodes: ['q0', 'q1'], style: { fill: 'red' } }],
      states: { q0: {}, q1: {}, q2: {} },
    };
    const q0 = resolveNodeStyle('q0', config);
    const q1 = resolveNodeStyle('q1', config);
    const q2 = resolveNodeStyle('q2', config);
    assert.strictEqual(q0.fill, 'red');
    assert.strictEqual(q1.fill, 'red');
    assert.notStrictEqual(q2.fill, 'red'); // q2 not in group
  });

  it('per-node prop overrides group style', () => {
    const config = {
      groups: [{ nodes: ['q0'], style: { fill: 'red', stroke: 'blue' } }],
      states: { q0: { fill: 'green' } },
    };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, 'green');   // per-node wins
    assert.strictEqual(q0.stroke, 'blue');  // group fills in
  });

  it('group can reference a named style', () => {
    const config = {
      styles: { accent: { fill: 'red', stroke: 'blue' } },
      groups: [{ nodes: ['q0'], style: 'accent' }],
      states: { q0: {} },
    };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, 'red');
    assert.strictEqual(q0.stroke, 'blue');
  });

  it('stateStyle is overridden by group style', () => {
    const config = {
      stateStyle: { fill: 'white' },
      groups: [{ nodes: ['q0'], style: { fill: 'red' } }],
      states: { q0: {} },
    };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, 'red');
  });

  it('multiple groups — last group wins on overlap', () => {
    const config = {
      groups: [
        { nodes: ['q0'], style: { fill: 'red' } },
        { nodes: ['q0'], style: { fill: 'blue' } },
      ],
      states: { q0: {} },
    };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, 'blue');
  });

  it('works with no groups defined', () => {
    const config = { states: { q0: { fill: 'green' } } };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, 'green');
  });

  it('per-node named style overrides group style', () => {
    const config = {
      styles: { accent: { fill: 'gold' } },
      groups: [{ nodes: ['q0'], style: { fill: 'red', stroke: 'blue' } }],
      states: { q0: { style: 'accent' } },
    };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, 'gold');   // named style on node wins over group
    assert.strictEqual(q0.stroke, 'blue'); // group fills in stroke
  });
});

describe('Edge groups', () => {
  it('group style applies to edges in the group', () => {
    const config = {
      groups: [{ edges: [0], style: { dashed: true } }],
      edges: [
        { from: 'q0', to: 'q1' },
        { from: 'q1', to: 'q2' },
      ],
    };
    const e0 = resolveEdgeStyle(0, config);
    const e1 = resolveEdgeStyle(1, config);
    assert.strictEqual(e0.dashed, true);
    assert.strictEqual(e1.dashed, false);
  });

  it('per-edge prop overrides group style', () => {
    const config = {
      groups: [{ edges: [0], style: { stroke: 'red' } }],
      edges: [{ from: 'q0', to: 'q1', stroke: 'blue' }],
    };
    const e0 = resolveEdgeStyle(0, config);
    assert.strictEqual(e0.stroke, 'blue');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/groups.test.js`
Expected: FAIL — group styles not applied.

- [ ] **Step 3: Add group resolution to registry.js**

In `src-v2/style/registry.js`, add:

```js
/**
 * Resolve the merged group style for a node or edge.
 * Groups are processed in order; later groups override earlier ones.
 * @param {Array} groups - config.groups array
 * @param {string} type - 'nodes' or 'edges'
 * @param {string|number} id - node ID or edge index
 * @param {StyleRegistry} registry - for resolving named style refs in groups
 * @returns {Object} merged group style properties
 */
export function resolveGroupStyle(groups, type, id, registry) {
  if (!groups || !Array.isArray(groups)) return {};
  let merged = {};
  for (const group of groups) {
    const members = group[type];
    if (!members || !Array.isArray(members)) continue;
    if (!members.includes(id)) continue;
    const groupStyle = typeof group.style === 'string'
      ? registry.get(group.style)
      : (group.style || {});
    merged = { ...merged, ...groupStyle };
  }
  return merged;
}
```

- [ ] **Step 4: Modify `style.js` to include group styles in cascade**

In `src-v2/style/style.js`, update the import:

```js
import { StyleRegistry, resolveGroupStyle } from './registry.js';
```

Update `resolveNodeStyle`:
```js
export function resolveNodeStyle(nodeId, config) {
  const base = {
    radius: DEFAULTS.nodeRadius,
    fill: DEFAULTS.nodeFill,
    stroke: DEFAULTS.nodeStroke,
    strokeWidth: DEFAULTS.nodeStrokeWidth,
    fontSize: DEFAULTS.fontSize,
    fontFamily: DEFAULTS.fontFamily,
    shadow: DEFAULTS.shadow,
    dashed: false,
    opacity: 1,
    shape: 'circle',
    accepting: false,
    initial: false,
    acceptingInset: DEFAULTS.acceptingInset,
    labelColor: '#000000',
    className: null,
  };
  const registry = new StyleRegistry(config.styles);
  const stateStyle = config.stateStyle || {};
  const groupStyle = resolveGroupStyle(config.groups, 'nodes', nodeId, registry);
  const nodeProps = config.states?.[nodeId] || {};
  const expandedProps = registry.expand(nodeProps);
  return { ...base, ...stateStyle, ...groupStyle, ...expandedProps };
}
```

Update `resolveEdgeStyle`:
```js
export function resolveEdgeStyle(edgeIndex, config) {
  const base = {
    stroke: DEFAULTS.edgeColor,
    strokeWidth: DEFAULTS.edgeStrokeWidth,
    arrow: 'stealth',
    dashed: false,
    opacity: 1,
    bend: null,
    loop: null,
    labelPos: 0.5,
    labelSide: 'auto',
    labelDistance: DEFAULTS.labelDistance,
    innerSep: DEFAULTS.innerSep,
    shortenStart: DEFAULTS.shortenStart,
    shortenEnd: DEFAULTS.shortenEnd,
    className: null,
  };
  const registry = new StyleRegistry(config.styles);
  const edgeStyle = config.edgeStyle || {};
  const groupStyle = resolveGroupStyle(config.groups, 'edges', edgeIndex, registry);
  const edgeProps = config.edges?.[edgeIndex] || {};
  const expandedProps = registry.expand(edgeProps);
  return { ...base, ...edgeStyle, ...groupStyle, ...expandedProps };
}
```

- [ ] **Step 5: Run group tests**

Run: `node --test test/groups.test.js`
Expected: All 9 tests PASS.

- [ ] **Step 6: Run all tests for backward compatibility**

Run: `node --test`
Expected: All tests PASS. `resolveGroupStyle` returns `{}` when no groups defined.

- [ ] **Step 7: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/style/registry.js src-v2/style/style.js test/groups.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: add node/edge groups with shared styles"
```

---

### Task 3: Wire Transform to Render Pipeline

**What it does:** Users pass a `transform` option on the top-level config or on individual groups. The transform is applied to resolved node positions before geometry computation. Uses the existing `Transform` class from `core/transform.js` — no new math.

**API after this task:**
```js
import { Transform } from './src-v2/core/transform.js';

render(svg, {
  transform: new Transform().rotate(45),  // rotate entire picture
  groups: [
    {
      nodes: ['q2', 'q3'],
      style: { fill: 'blue' },
      transform: new Transform().translate(100, 0),  // shift this group
    },
  ],
  states: { ... },
  edges: [ ... ],
});
```

**Files:**
- Modify: `src-v2/index.js` (apply transforms between Phase 2 and Phase 3)
- Create: `test/pipeline-transform.test.js`

- [ ] **Step 1: Write failing tests for pipeline transform**

Create `test/pipeline-transform.test.js`:

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let JSDOM, document;

before(async () => {
  try {
    const jsdom = await import('jsdom');
    JSDOM = jsdom.JSDOM;
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    globalThis.document = document;
  } catch {
    console.log('jsdom not available — skipping pipeline transform tests');
    process.exit(0);
  }
});

/** Parse translate(x, y) from a transform attribute string. */
function parseTranslate(transformStr) {
  const m = transformStr.match(/translate\(([-\d.]+),?\s*([-\d.]+)\)/);
  if (!m) throw new Error(`No translate found in: ${transformStr}`);
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function assertClose(actual, expected, tolerance, msg) {
  assert.ok(Math.abs(actual - expected) < tolerance,
    `${msg}: got ${actual}, expected ~${expected}`);
}

describe('Pipeline transform', () => {
  it('global transform translates all node positions', async () => {
    const { render } = await import('../src-v2/index.js');
    const { Transform } = await import('../src-v2/core/transform.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const refs = render(svg, {
      transform: new Transform().translate(100, 200),
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { x: 50, y: 0 } },
      },
      edges: [{ from: 'q0', to: 'q1' }],
    });

    const q0Pos = parseTranslate(refs.nodes.q0.getAttribute('transform'));
    assert.strictEqual(q0Pos.x, 100);
    assert.strictEqual(q0Pos.y, 200);

    const q1Pos = parseTranslate(refs.nodes.q1.getAttribute('transform'));
    assert.strictEqual(q1Pos.x, 150);
    assert.strictEqual(q1Pos.y, 200);
  });

  it('global transform rotates positions', async () => {
    const { render } = await import('../src-v2/index.js');
    const { Transform } = await import('../src-v2/core/transform.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const t = new Transform().rotate(90);
    const expected = t.apply({ x: 50, y: 0 });

    const refs = render(svg, {
      transform: t,
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { x: 50, y: 0 } },
      },
      edges: [],
    });

    const q1Pos = parseTranslate(refs.nodes.q1.getAttribute('transform'));
    assertClose(q1Pos.x, expected.x, 0.01, 'q1 x after 90° rotation');
    assertClose(q1Pos.y, expected.y, 0.01, 'q1 y after 90° rotation');
  });

  it('group transform applies only to group members', async () => {
    const { render } = await import('../src-v2/index.js');
    const { Transform } = await import('../src-v2/core/transform.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const refs = render(svg, {
      groups: [
        { nodes: ['q1'], transform: new Transform().translate(100, 0) },
      ],
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { x: 50, y: 0 } },
      },
      edges: [],
    });

    const q0Pos = parseTranslate(refs.nodes.q0.getAttribute('transform'));
    assert.strictEqual(q0Pos.x, 0);
    assert.strictEqual(q0Pos.y, 0);

    const q1Pos = parseTranslate(refs.nodes.q1.getAttribute('transform'));
    assert.strictEqual(q1Pos.x, 150);
    assert.strictEqual(q1Pos.y, 0);
  });

  it('works with no transform (backward compat)', async () => {
    const { render } = await import('../src-v2/index.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const refs = render(svg, {
      states: {
        q0: { position: { x: 10, y: 20 } },
      },
      edges: [],
    });

    const q0Pos = parseTranslate(refs.nodes.q0.getAttribute('transform'));
    assert.strictEqual(q0Pos.x, 10);
    assert.strictEqual(q0Pos.y, 20);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test test/pipeline-transform.test.js`
Expected: FAIL — `config.transform` not applied.

- [ ] **Step 3: Add transform application to `index.js`**

In `src-v2/index.js`, add a new Phase 2.5 between position resolution and node geometry. This is the key change — insert after line 65 (after `resolvePositions`) and before line 70 (the `nodeRegistry` loop). No new imports needed — user passes pre-built `Transform` instances; we just call `.apply()` on them.

Insert new phase after line 65 (`const resolvedStates = resolvePositions(...)`) and before the Phase 3 comment:

```js
  // ── PHASE 2.5: APPLY TRANSFORMS ────────────────────────────────────
  // Apply global and per-group coordinate transforms to resolved positions.
  // This is a coordinate transform (TikZ-preferred): positions are remapped,
  // not wrapped in SVG transform attributes.

  if (config.transform || config.groups) {
    for (const id of stateIds) {
      const pos = resolvedStates[id].position;
      let transformed = { x: pos.x, y: pos.y };

      // Apply group transforms (in declaration order)
      if (config.groups) {
        for (const group of config.groups) {
          if (!group.transform) continue;
          if (!group.nodes || !Array.isArray(group.nodes)) continue;
          if (!group.nodes.includes(id)) continue;
          transformed = group.transform.apply(transformed);
        }
      }

      // Apply global transform last (so it wraps group transforms)
      if (config.transform) {
        transformed = config.transform.apply(transformed);
      }

      resolvedStates[id].position = transformed;
    }
  }
```

- [ ] **Step 4: Run transform tests**

Run: `node --test test/pipeline-transform.test.js`
Expected: All 4 tests PASS.

- [ ] **Step 5: Run all tests for backward compatibility**

Run: `node --test`
Expected: All tests PASS. When `config.transform` is undefined and no groups have transforms, the new code block is skipped entirely.

- [ ] **Step 6: Commit**

```bash
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg add src-v2/index.js test/pipeline-transform.test.js
git -C /Users/sergiop/Dropbox/Scripts/tikz-svg commit -m "feat: wire Transform to render pipeline with global and per-group support"
```

---

## Verification Checklist

After all 3 tasks:

- [ ] `node --test` — all tests pass (existing + 23 new)
- [ ] No existing API contract changed — `render()` and `renderAutomaton()` signatures unchanged
- [ ] New features are purely additive — `config.styles`, `config.groups`, `config.transform` are all optional
- [ ] `renderAutomaton()` works unchanged (delegates to `render()`)
- [ ] Style cascade order is documented: `DEFAULTS → stateStyle/edgeStyle → group → named style + per-element`
