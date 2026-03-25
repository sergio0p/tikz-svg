import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

import { emitSVG } from '../src-v2/svg/emitter.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function createSVG() {
  return document.createElementNS(SVG_NS, 'svg');
}

describe('emitter decoration integration', () => {
  it('applies decoration to edge paths', () => {
    const svg = createSVG();
    const model = {
      nodes: {
        A: {
          id: 'A', center: { x: 0, y: 0 },
          geom: { radius: 20, outerSep: 0 },
          style: { shape: 'circle', fill: '#fff', stroke: '#000', strokeWidth: 1 },
          label: 'A',
        },
        B: {
          id: 'B', center: { x: 100, y: 0 },
          geom: { radius: 20, outerSep: 0 },
          style: { shape: 'circle', fill: '#fff', stroke: '#000', strokeWidth: 1 },
          label: 'B',
        },
      },
      edges: [{
        index: 0, from: 'A', to: 'B', label: null,
        path: 'M 20 0 L 80 0',
        edgeGeometry: { startPoint: { x: 20, y: 0 }, endPoint: { x: 80, y: 0 }, type: 'straight' },
        labelNode: null,
        style: {
          stroke: '#000', strokeWidth: 1, arrow: null, arrowId: null,
          decoration: { type: 'random steps', segmentLength: 10, amplitude: 3 },
        },
      }],
      arrowDefs: [],
      shadowFilters: [],
      seed: 42,
    };

    emitSVG(svg, model);

    const edgePaths = svg.querySelectorAll('.edge-layer path');
    assert.strictEqual(edgePaths.length, 1);
    const d = edgePaths[0].getAttribute('d');
    const lCount = (d.match(/L /g) || []).length;
    assert.ok(lCount > 2, `expected multiple L segments, got ${lCount}`);
  });

  it('applies decoration to node borders (circle → path)', () => {
    const svg = createSVG();
    const model = {
      nodes: {
        A: {
          id: 'A', center: { x: 0, y: 0 },
          geom: { radius: 20, outerSep: 0 },
          style: {
            shape: 'circle', fill: '#fff', stroke: '#000', strokeWidth: 1,
            decoration: { type: 'random steps', segmentLength: 10, amplitude: 2 },
          },
          label: 'A',
        },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      seed: 42,
    };

    emitSVG(svg, model);

    const nodeGroup = svg.querySelector('.node-layer g');
    const circles = nodeGroup.querySelectorAll('circle');
    const paths = nodeGroup.querySelectorAll('path');
    assert.strictEqual(circles.length, 0, 'decorated circle should not use <circle>');
    assert.ok(paths.length >= 1, 'decorated circle should render as <path>');
  });

  it('non-decorated nodes render as native SVG elements', () => {
    const svg = createSVG();
    const model = {
      nodes: {
        A: {
          id: 'A', center: { x: 0, y: 0 },
          geom: { radius: 20, outerSep: 0 },
          style: { shape: 'circle', fill: '#fff', stroke: '#000', strokeWidth: 1 },
          label: 'A',
        },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
    };

    emitSVG(svg, model);

    const nodeGroup = svg.querySelector('.node-layer g');
    assert.strictEqual(nodeGroup.querySelectorAll('circle').length, 1);
    assert.strictEqual(nodeGroup.querySelectorAll('path').length, 0);
  });

  it('decorated edges are deterministic with same seed', () => {
    function renderAndGetPath(seed) {
      const svg = createSVG();
      emitSVG(svg, {
        nodes: {
          A: { id: 'A', center: { x: 0, y: 0 }, geom: { radius: 20, outerSep: 0 },
               style: { shape: 'circle', fill: '#fff', stroke: '#000', strokeWidth: 1 }, label: 'A' },
          B: { id: 'B', center: { x: 100, y: 0 }, geom: { radius: 20, outerSep: 0 },
               style: { shape: 'circle', fill: '#fff', stroke: '#000', strokeWidth: 1 }, label: 'B' },
        },
        edges: [{
          index: 0, from: 'A', to: 'B', label: null, path: 'M 20 0 L 80 0',
          edgeGeometry: { type: 'straight' }, labelNode: null,
          style: { stroke: '#000', strokeWidth: 1, arrowId: null,
                   decoration: { type: 'random steps', segmentLength: 10, amplitude: 3 } },
        }],
        arrowDefs: [], shadowFilters: [], seed,
      });
      return svg.querySelector('.edge-layer path').getAttribute('d');
    }
    assert.strictEqual(renderAndGetPath(42), renderAndGetPath(42));
  });
});
