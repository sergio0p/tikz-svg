/**
 * Integration tests for the full render pipeline.
 * Uses jsdom to provide a DOM environment.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// We need a DOM. Use a dynamic import to handle jsdom not being installed gracefully.
let JSDOM;
let document;

before(async () => {
  try {
    const jsdom = await import('jsdom');
    JSDOM = jsdom.JSDOM;
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    globalThis.document = document;
  } catch {
    console.log('jsdom not available — skipping integration tests');
    process.exit(0);
  }
});

describe('Full pipeline integration', () => {
  it('renders a basic 3-state DFA', async () => {
    const { renderAutomaton } = await import('../src/automata/automata.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const refs = renderAutomaton(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
        q2: { position: { right: 'q1' }, accepting: true },
      },
      edges: [
        { from: 'q0', to: 'q1', label: 'a' },
        { from: 'q1', to: 'q2', label: 'b' },
        { from: 'q0', to: 'q0', label: 'c', loop: 'above' },
      ],
    });

    // Check nodes were created
    assert.ok(refs.nodes.q0, 'q0 node should exist');
    assert.ok(refs.nodes.q1, 'q1 node should exist');
    assert.ok(refs.nodes.q2, 'q2 node should exist');

    // Check edges
    assert.strictEqual(refs.edges.length, 3, 'should have 3 edges');

    // Check labels
    assert.strictEqual(refs.labels.length, 3, 'should have 3 labels');

    // Check q2 has accepting (double circle) — should have 2 circle elements
    const q2Group = refs.nodes.q2;
    const circles = q2Group.querySelectorAll('circle');
    assert.strictEqual(circles.length, 2, 'accepting state should have 2 circles');

    // Check viewBox is set
    assert.ok(svg.getAttribute('viewBox'), 'viewBox should be set');

    // Check defs has arrow markers
    const markers = svg.querySelectorAll('marker');
    assert.ok(markers.length > 0, 'should have arrow markers in defs');

    // Check initial arrow exists
    const initialArrows = svg.querySelectorAll('.initial-arrow');
    assert.strictEqual(initialArrows.length, 1, 'should have 1 initial arrow');
  });

  it('renders NFA with self-loop', async () => {
    const { renderAutomaton } = await import('../src/automata/automata.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const refs = renderAutomaton(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' }, accepting: true },
      },
      edges: [
        { from: 'q0', to: 'q1', label: '0,1' },
        { from: 'q1', to: 'q1', label: '0', loop: 'above' },
        { from: 'q1', to: 'q0', label: '1', bend: 'left' },
      ],
    });

    assert.strictEqual(refs.edges.length, 3);
    assert.ok(refs.nodes.q0);
    assert.ok(refs.nodes.q1);
  });

  it('validates edge endpoints', async () => {
    const { renderAutomaton } = await import('../src/automata/automata.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    assert.throws(() => {
      renderAutomaton(svg, {
        states: { q0: {} },
        edges: [{ from: 'q0', to: 'qMissing', label: 'x' }],
      });
    }, /unknown state/);
  });

  it('handles style overrides', async () => {
    const { renderAutomaton } = await import('../src/automata/automata.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const refs = renderAutomaton(svg, {
      stateStyle: { fill: '#fecaca', shadow: true },
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' }, fill: '#bfdbfe' },
      },
      edges: [
        { from: 'q0', to: 'q1', label: 'a' },
      ],
    });

    // q0 should have stateStyle fill
    const q0Circle = refs.nodes.q0.querySelector('circle');
    assert.strictEqual(q0Circle.getAttribute('fill'), '#fecaca');

    // q1 should have per-node override
    const q1Circle = refs.nodes.q1.querySelector('circle');
    assert.strictEqual(q1Circle.getAttribute('fill'), '#bfdbfe');

    // Shadow filter should exist in defs
    const filters = svg.querySelectorAll('filter');
    assert.ok(filters.length > 0, 'should have shadow filters');
  });
});
