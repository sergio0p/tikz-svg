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
