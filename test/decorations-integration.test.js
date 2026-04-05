import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

import { render } from '../src-v2/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('decoration integration (full pipeline)', () => {
  it('renders wavy edges using named style', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 666,
      nodeDistance: 200,
      styles: {
        wavy: {
          decoration: {
            type: 'random steps',
            segmentLength: 23,
            amplitude: 2.8,
            roundedCorners: 4,
            preLength: 2.8,
            postLength: 2.8,
          },
        },
      },
      states: {
        A: { position: [0, 0] },
        B: { position: { right: 'A' } },
      },
      edges: [
        { from: 'A', to: 'B', label: 'wavy', style: 'wavy' },
      ],
    });

    const paths = svg.querySelectorAll('.edge-layer path');
    assert.strictEqual(paths.length, 1);
    const d = paths[0].getAttribute('d');
    assert.ok(d.includes('C'), 'wavy edge should have rounded corners (cubic)');
  });

  it('renders wavy node borders via stateStyle', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 666,
      stateStyle: {
        decoration: {
          type: 'random steps',
          segmentLength: 15,
          amplitude: 2,
          roundedCorners: 3,
        },
      },
      states: {
        q0: { position: [0, 0] },
      },
      edges: [],
    });

    const nodeGroup = svg.querySelector('.node-layer g');
    const paths = nodeGroup.querySelectorAll('path');
    assert.ok(paths.length >= 1, 'decorated node should render as path');
    const circles = nodeGroup.querySelectorAll('circle');
    assert.strictEqual(circles.length, 0, 'no native circle when decorated');
  });

  it('renders wavy ellipse node borders', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 666,
      states: {
        q0: {
          position: [0, 0],
          shape: 'ellipse',
          rx: 40,
          ry: 25,
          decoration: {
            type: 'random steps',
            segmentLength: 15,
            amplitude: 2,
          },
        },
      },
      edges: [],
    });

    const nodeGroup = svg.querySelector('.node-layer g');
    const paths = nodeGroup.querySelectorAll('path');
    assert.ok(paths.length >= 1, 'decorated ellipse should render as path');
    const ellipses = nodeGroup.querySelectorAll('ellipse');
    assert.strictEqual(ellipses.length, 0, 'no native ellipse when decorated');
  });

  it('is deterministic across render calls', () => {
    const svg1 = document.createElementNS(SVG_NS, 'svg');
    const svg2 = document.createElementNS(SVG_NS, 'svg');
    const config = {
      seed: 123,
      stateStyle: {
        decoration: { type: 'random steps', segmentLength: 10, amplitude: 3 },
      },
      states: { q0: { position: [0, 0] } },
      edges: [],
    };

    render(svg1, config);
    render(svg2, config);

    const d1 = svg1.querySelector('.node-layer path')?.getAttribute('d');
    const d2 = svg2.querySelector('.node-layer path')?.getAttribute('d');
    assert.strictEqual(d1, d2, 'same seed should produce identical output');
  });

  it('non-decorated elements remain unaffected', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      states: {
        A: { position: [0, 0] },
        B: { position: { right: 'A' } },
      },
      edges: [{ from: 'A', to: 'B' }],
    });

    // Nodes should use native circle elements
    const nodeGroup = svg.querySelector('.node-layer g');
    assert.ok(nodeGroup.querySelector('circle'), 'normal node uses <circle>');
    assert.ok(!nodeGroup.querySelector('path'), 'normal node has no <path>');
  });
});
