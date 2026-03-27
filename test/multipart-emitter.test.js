import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Set up global DOM
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

import { render } from '../src-v2/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function createSVG() {
  return document.createElementNS(SVG_NS, 'svg');
}

describe('multipart emitter: per-part fills', () => {
  it('renders per-part fill rects for rectangle split', () => {
    const svg = createSVG();
    render(svg, {
      states: {
        n1: {
          position: { x: 0, y: 0 },
          shape: 'rectangle split',
          parts: 2,
          partFills: ['red', 'blue'],
          label: ['Top', 'Bottom'],
        },
      },
      edges: [],
    });

    const node = svg.querySelector('#node-n1');
    assert.ok(node, 'node should exist');

    // Should have a clipPath in local defs
    const clipPath = node.querySelector('clipPath');
    assert.ok(clipPath, 'should have a clipPath');

    // Should have filled rects inside a clipped group
    const clippedGroup = node.querySelector('g[clip-path]');
    assert.ok(clippedGroup, 'should have a clipped group');
    const rects = clippedGroup.querySelectorAll('rect');
    assert.strictEqual(rects.length, 2, 'should have 2 fill rects');
    assert.strictEqual(rects[0].getAttribute('fill'), 'red');
    assert.strictEqual(rects[1].getAttribute('fill'), 'blue');
  });

  it('renders per-part labels for rectangle split', () => {
    const svg = createSVG();
    render(svg, {
      states: {
        n1: {
          position: { x: 0, y: 0 },
          shape: 'rectangle split',
          parts: 3,
          partFills: ['red', 'green', 'blue'],
          label: ['A', 'B', 'C'],
        },
      },
      edges: [],
    });

    const node = svg.querySelector('#node-n1');
    const texts = node.querySelectorAll('text');
    assert.strictEqual(texts.length, 3, 'should have 3 text elements');
    assert.strictEqual(texts[0].textContent, 'A');
    assert.strictEqual(texts[1].textContent, 'B');
    assert.strictEqual(texts[2].textContent, 'C');
  });

  it('renders per-part fills for circle split', () => {
    const svg = createSVG();
    render(svg, {
      states: {
        n1: {
          position: { x: 0, y: 0 },
          shape: 'circle split',
          parts: 2,
          radius: 25,
          partFills: ['#ff0', '#0ff'],
          label: ['Top', 'Bottom'],
        },
      },
      edges: [],
    });

    const node = svg.querySelector('#node-n1');
    const clipPath = node.querySelector('clipPath');
    assert.ok(clipPath, 'should have clipPath for circle split');

    const clippedGroup = node.querySelector('g[clip-path]');
    const rects = clippedGroup.querySelectorAll('rect');
    assert.strictEqual(rects.length, 2);
  });

  it('renders per-part fills for ellipse split', () => {
    const svg = createSVG();
    render(svg, {
      states: {
        n1: {
          position: { x: 0, y: 0 },
          shape: 'ellipse split',
          parts: 3,
          rx: 40,
          ry: 25,
          partFills: ['red', 'white', 'blue'],
          label: ['R', 'W', 'B'],
        },
      },
      edges: [],
    });

    const node = svg.querySelector('#node-n1');
    const clippedGroup = node.querySelector('g[clip-path]');
    const rects = clippedGroup.querySelectorAll('rect');
    assert.strictEqual(rects.length, 3);
    const texts = node.querySelectorAll('text');
    assert.strictEqual(texts.length, 3);
  });

  it('uses left alignment when partAlign is left', () => {
    const svg = createSVG();
    render(svg, {
      states: {
        n1: {
          position: { x: 0, y: 0 },
          shape: 'rectangle split',
          parts: 2,
          partFills: ['white', 'white'],
          partAlign: 'left',
          label: ['Hello', 'World'],
        },
      },
      edges: [],
    });

    const texts = svg.querySelector('#node-n1').querySelectorAll('text');
    assert.strictEqual(texts[0].getAttribute('text-anchor'), 'start');
    assert.strictEqual(texts[1].getAttribute('text-anchor'), 'start');
  });

  it('uses right alignment when partAlign is right', () => {
    const svg = createSVG();
    render(svg, {
      states: {
        n1: {
          position: { x: 0, y: 0 },
          shape: 'rectangle split',
          parts: 2,
          partFills: ['white', 'white'],
          partAlign: 'right',
          label: ['Hello', 'World'],
        },
      },
      edges: [],
    });

    const texts = svg.querySelector('#node-n1').querySelectorAll('text');
    assert.strictEqual(texts[0].getAttribute('text-anchor'), 'end');
  });

  it('falls back to single label if not array', () => {
    const svg = createSVG();
    render(svg, {
      states: {
        n1: {
          position: { x: 0, y: 0 },
          shape: 'circle split',
          parts: 2,
          label: 'SingleLabel',
        },
      },
      edges: [],
    });

    const node = svg.querySelector('#node-n1');
    const texts = node.querySelectorAll('text');
    assert.strictEqual(texts.length, 1);
    assert.strictEqual(texts[0].textContent, 'SingleLabel');
  });

  it('renders without partFills (standard single fill)', () => {
    const svg = createSVG();
    render(svg, {
      states: {
        n1: {
          position: { x: 0, y: 0 },
          shape: 'rectangle split',
          parts: 2,
          label: 'Plain',
        },
      },
      edges: [],
    });

    const node = svg.querySelector('#node-n1');
    // Should NOT have a clipPath (no partFills)
    const clipPath = node.querySelector('clipPath');
    assert.strictEqual(clipPath, null, 'no clipPath without partFills');
  });
});
