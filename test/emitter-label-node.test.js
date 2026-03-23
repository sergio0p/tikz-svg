import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Set up DOM globals before importing emitter
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

const { emitSVG } = await import('../src-v2/svg/emitter.js');

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg() {
  return document.createElementNS(SVG_NS, 'svg');
}

describe('emitLabelNode', () => {
  it('label produces a <g> with <rect> and <text> in label-layer', () => {
    const svg = makeSvg();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        from: 'a', to: 'b',
        label: 'test',
        path: 'M 0 0 L 100 0',
        edgeGeometry: { type: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 0 } },
        labelNode: {
          center: { x: 50, y: -10 },
          anchor: 'south',
          geom: { center: { x: 50, y: -10 }, halfWidth: 20, halfHeight: 10 },
          angle: null,
        },
        style: { stroke: '#000', strokeWidth: 1 },
      }],
      arrowDefs: [],
      shadowFilters: [],
    });

    const labelLayer = svg.querySelector('.label-layer');
    assert.ok(labelLayer, 'label-layer exists');

    const g = labelLayer.querySelector('g.label-node');
    assert.ok(g, 'label <g> exists');

    const rect = g.querySelector('rect');
    assert.ok(rect, '<rect> exists in label node');
    assert.strictEqual(rect.getAttribute('fill'), 'none');

    const text = g.querySelector('text');
    assert.ok(text, '<text> exists in label node');
    assert.strictEqual(text.textContent, 'test');
    assert.strictEqual(text.getAttribute('text-anchor'), 'middle');
  });

  it('no label node emitted when label is null', () => {
    const svg = makeSvg();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        from: 'a', to: 'b',
        label: null,
        path: 'M 0 0 L 100 0',
        edgeGeometry: { type: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 0 } },
        labelNode: null,
        style: { stroke: '#000', strokeWidth: 1 },
      }],
      arrowDefs: [],
      shadowFilters: [],
    });

    const labelLayer = svg.querySelector('.label-layer');
    assert.strictEqual(labelLayer.children.length, 0);
  });

  it('sloped label has transform with matrix', () => {
    const svg = makeSvg();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        from: 'a', to: 'b',
        label: 'sloped',
        path: 'M 0 0 L 100 -100',
        edgeGeometry: { type: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: -100 } },
        labelNode: {
          center: { x: 50, y: -50 },
          anchor: 'south',
          geom: { center: { x: 50, y: -50 }, halfWidth: 25, halfHeight: 10 },
          angle: -45,
        },
        style: { stroke: '#000', strokeWidth: 1 },
      }],
      arrowDefs: [],
      shadowFilters: [],
    });

    const g = svg.querySelector('.label-layer g.label-node');
    const transform = g.getAttribute('transform');
    assert.ok(transform, 'transform exists');
    assert.ok(transform.includes('matrix'), 'transform uses matrix for rotation');
  });
});
