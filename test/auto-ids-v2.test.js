/**
 * Auto-ID assignment for edges, edge labels, plots, and paths in src-v2.
 *
 * Rules:
 *  - Nodes already receive ids as `node-<key>` (existing behavior).
 *  - Edges: `edge-<from>-<to>` when unique; `edge-<from>-<to>-<n>` (1-indexed)
 *    when multiple edges share the same `from`→`to` pair.
 *  - Edge labels: `label-<from>-<to>[-n]`, mirroring the edge.
 *  - Plots: `plot-<i>` (0-indexed).
 *  - Paths: `path-<i>` (0-indexed).
 *  - User-supplied `id` wins verbatim.
 *  - `refs.byId` maps every assigned id to its element.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

const { render } = await import('../src-v2/index.js');

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('src-v2 auto-IDs: edges', () => {
  it('assigns edge-<from>-<to> for a single edge', () => {
    const svg = makeSvg();
    render(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
      },
      edges: [{ from: 'q0', to: 'q1', label: 'a' }],
    });

    assert.strictEqual(svg.querySelectorAll('path[id="edge-q0-q1"]').length, 1);
  });

  it('suffixes duplicate edges with 1-indexed counters', () => {
    const svg = makeSvg();
    render(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
      },
      edges: [
        { from: 'q0', to: 'q1', label: 'a' },
        { from: 'q0', to: 'q1', label: 'b', bend: 30 },
      ],
    });

    assert.ok(svg.querySelector('path[id="edge-q0-q1-1"]'));
    assert.ok(svg.querySelector('path[id="edge-q0-q1-2"]'));
    assert.strictEqual(svg.querySelector('path[id="edge-q0-q1"]'), null);
  });

  it('bent variant counts as multi-edge with a straight edge', () => {
    const svg = makeSvg();
    render(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
      },
      edges: [
        { from: 'q0', to: 'q1', label: 'a' },
        { from: 'q0', to: 'q1', label: 'b', bend: 45 },
        { from: 'q0', to: 'q1', label: 'c', bend: -45 },
      ],
    });

    assert.ok(svg.querySelector('path[id="edge-q0-q1-1"]'));
    assert.ok(svg.querySelector('path[id="edge-q0-q1-2"]'));
    assert.ok(svg.querySelector('path[id="edge-q0-q1-3"]'));
  });

  it('single self-loop gets edge-q0-q0 without a suffix', () => {
    const svg = makeSvg();
    render(svg, {
      states: { q0: { initial: true } },
      edges: [{ from: 'q0', to: 'q0', label: 'a', loop: 'above' }],
    });

    assert.ok(svg.querySelector('path[id="edge-q0-q0"]'));
  });

  it('multiple self-loops get suffixes', () => {
    const svg = makeSvg();
    render(svg, {
      states: { q0: { initial: true } },
      edges: [
        { from: 'q0', to: 'q0', label: 'a', loop: 'above' },
        { from: 'q0', to: 'q0', label: 'b', loop: 'below' },
      ],
    });

    assert.ok(svg.querySelector('path[id="edge-q0-q0-1"]'));
    assert.ok(svg.querySelector('path[id="edge-q0-q0-2"]'));
  });

  it('directed pair q0->q1 and q1->q0 are not treated as duplicates', () => {
    const svg = makeSvg();
    render(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
      },
      edges: [
        { from: 'q0', to: 'q1', label: 'a' },
        { from: 'q1', to: 'q0', label: 'b', bend: 30 },
      ],
    });

    assert.ok(svg.querySelector('path[id="edge-q0-q1"]'));
    assert.ok(svg.querySelector('path[id="edge-q1-q0"]'));
  });

  it('user-supplied edge.id wins verbatim', () => {
    const svg = makeSvg();
    render(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
      },
      edges: [{ from: 'q0', to: 'q1', id: 'my-edge' }],
    });

    assert.ok(svg.querySelector('path[id="my-edge"]'));
    assert.strictEqual(svg.querySelector('path[id="edge-q0-q1"]'), null);
  });
});

describe('src-v2 auto-IDs: edge labels', () => {
  it('labels get label-<from>-<to> mirroring the edge', () => {
    const svg = makeSvg();
    render(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
      },
      edges: [{ from: 'q0', to: 'q1', label: 'a' }],
    });

    assert.ok(svg.querySelector('g.label-node[id="label-q0-q1"]'));
  });

  it('multi-edge labels get matching suffixes', () => {
    const svg = makeSvg();
    render(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
      },
      edges: [
        { from: 'q0', to: 'q1', label: 'a' },
        { from: 'q0', to: 'q1', label: 'b', bend: 30 },
      ],
    });

    assert.ok(svg.querySelector('g.label-node[id="label-q0-q1-1"]'));
    assert.ok(svg.querySelector('g.label-node[id="label-q0-q1-2"]'));
  });

  it('edges without labels do not produce label elements', () => {
    const svg = makeSvg();
    render(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
      },
      edges: [{ from: 'q0', to: 'q1' }],
    });

    assert.strictEqual(svg.querySelector('g.label-node'), null);
  });
});

describe('src-v2 auto-IDs: plots', () => {
  const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];

  it('plots get plot-<index>', () => {
    const svg = makeSvg();
    render(svg, {
      plots: [
        { coordinates: pts },
        { coordinates: pts },
      ],
    });

    assert.ok(svg.querySelector('[id="plot-0"]'));
    assert.ok(svg.querySelector('[id="plot-1"]'));
  });

  it('user-supplied plot.id wins verbatim', () => {
    const svg = makeSvg();
    render(svg, {
      plots: [{ coordinates: pts, id: 'my-plot' }],
    });

    assert.ok(svg.querySelector('[id="my-plot"]'));
    assert.strictEqual(svg.querySelector('[id="plot-0"]'), null);
  });
});

describe('src-v2 auto-IDs: paths', () => {
  it('free-form paths get path-<index>', () => {
    const svg = makeSvg();
    render(svg, {
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
        { points: [{ x: 20, y: 0 }, { x: 30, y: 10 }] },
      ],
    });

    assert.ok(svg.querySelector('[id="path-0"]'));
    assert.ok(svg.querySelector('[id="path-1"]'));
  });

  it('user-supplied path.id wins verbatim', () => {
    const svg = makeSvg();
    render(svg, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], id: 'my-path' }],
    });

    assert.ok(svg.querySelector('[id="my-path"]'));
    assert.strictEqual(svg.querySelector('[id="path-0"]'), null);
  });
});

describe('src-v2 auto-IDs: refs.byId', () => {
  it('populates byId with every assigned id', () => {
    const svg = makeSvg();
    const refs = render(svg, {
      states: {
        q0: { initial: true },
        q1: { position: { right: 'q0' } },
      },
      edges: [
        { from: 'q0', to: 'q1', label: 'a' },
        { from: 'q0', to: 'q1', label: 'b', bend: 30 },
      ],
      plots: [{ coordinates: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }],
    });

    assert.ok(refs.byId['node-q0']);
    assert.ok(refs.byId['node-q1']);
    assert.ok(refs.byId['edge-q0-q1-1']);
    assert.ok(refs.byId['edge-q0-q1-2']);
    assert.ok(refs.byId['label-q0-q1-1']);
    assert.ok(refs.byId['label-q0-q1-2']);
    assert.ok(refs.byId['plot-0']);
    assert.ok(refs.byId['path-0']);
  });
});
