import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { emitSVG } from '../src-v2/svg/emitter.js';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  document = dom.window.document;
});

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

describe('emitPlot', () => {
  it('renders a plot path in the edge layer', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 100 -50 L 200 0',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none' },
        marks: null,
        markPath: null,
        markFillMode: 'stroke',
      }],
    });
    const edgeLayer = svg.querySelector('.edge-layer');
    const paths = edgeLayer.querySelectorAll('path.plot-path');
    assert.strictEqual(paths.length, 1);
    assert.strictEqual(paths[0].getAttribute('stroke'), 'blue');
    assert.strictEqual(paths[0].getAttribute('d'), 'M 0 0 L 100 -50 L 200 0');
  });

  it('renders marks at each position', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 100 0',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none', markStroke: 'blue', markFill: 'blue' },
        marks: [{ x: 0, y: 0 }, { x: 50, y: -25 }, { x: 100, y: 0 }],
        markPath: 'M -3 0 A 3 3 0 1 0 3 0 A 3 3 0 1 0 -3 0 Z',
        markFillMode: 'filled',
      }],
    });
    const edgeLayer = svg.querySelector('.edge-layer');
    const markGroups = edgeLayer.querySelectorAll('g.plot-mark');
    assert.strictEqual(markGroups.length, 3);
  });

  it('applies dashed style to plot path', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 100 0',
        style: { stroke: 'red', strokeWidth: 1, fill: 'none', dashed: true },
        marks: null,
        markPath: null,
        markFillMode: 'stroke',
      }],
    });
    const path = svg.querySelector('.plot-path');
    assert.ok(path.getAttribute('stroke-dasharray'));
  });

  it('coexists with nodes and edges', () => {
    const svg = makeSVG();
    const circleShape = {
      savedGeometry(c) { return c; },
      backgroundPath() { return ''; },
      borderPoint(g, d) { return g.center; },
      namedAnchors() { return {}; },
    };
    emitSVG(svg, {
      nodes: {
        q0: {
          id: 'q0',
          center: { x: 50, y: -25 },
          geom: { radius: 15, outerSep: 0.75 },
          shape: circleShape,
          style: { shape: 'circle', radius: 15, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'peak',
        },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 50 -25 L 100 0',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none' },
        marks: null,
        markPath: null,
        markFillMode: 'stroke',
      }],
    });
    assert.ok(svg.querySelector('.node-layer #node-q0'), 'node should exist');
    assert.ok(svg.querySelector('.edge-layer .plot-path'), 'plot should exist');
  });
});
