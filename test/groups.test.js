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
    assert.strictEqual(q0.fill, '#ff0000');
    assert.strictEqual(q1.fill, '#ff0000');
    assert.notStrictEqual(q2.fill, '#ff0000'); // q2 not in group
  });

  it('per-node prop overrides group style', () => {
    const config = {
      groups: [{ nodes: ['q0'], style: { fill: 'red', stroke: 'blue' } }],
      states: { q0: { fill: 'green' } },
    };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, '#00ff00');   // per-node wins
    assert.strictEqual(q0.stroke, '#0000ff'); // group fills in
  });

  it('group can reference a named style', () => {
    const config = {
      styles: { accent: { fill: 'red', stroke: 'blue' } },
      groups: [{ nodes: ['q0'], style: 'accent' }],
      states: { q0: {} },
    };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, '#ff0000');
    assert.strictEqual(q0.stroke, '#0000ff');
  });

  it('stateStyle is overridden by group style', () => {
    const config = {
      stateStyle: { fill: 'white' },
      groups: [{ nodes: ['q0'], style: { fill: 'red' } }],
      states: { q0: {} },
    };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, '#ff0000');
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
    assert.strictEqual(q0.fill, '#0000ff');
  });

  it('works with no groups defined', () => {
    const config = { states: { q0: { fill: 'green' } } };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, '#00ff00');
  });

  it('per-node named style overrides group style', () => {
    const config = {
      styles: { accent: { fill: 'gold' } },
      groups: [{ nodes: ['q0'], style: { fill: 'red', stroke: 'blue' } }],
      states: { q0: { style: 'accent' } },
    };
    const q0 = resolveNodeStyle('q0', config);
    assert.strictEqual(q0.fill, 'gold');   // 'gold' not in curated map — passes through
    assert.strictEqual(q0.stroke, '#0000ff'); // group fills in stroke
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
    assert.strictEqual(e0.stroke, '#0000ff');
  });
});
