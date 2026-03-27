import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { emitSVG } from '../src-v2/svg/emitter.js';
import { render } from '../src-v2/index.js';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  document = dom.window.document;
});

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

const circleShape = {
  savedGeometry(c) { return c; },
  backgroundPath() { return ''; },
  borderPoint(g, d) { return g.center; },
  namedAnchors() { return {}; },
};

describe('ordered emission (drawOrder)', () => {
  it('renders elements in declaration order into a single layer', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 15, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 15, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'A' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 0',
        style: { stroke: '#000', strokeWidth: 1.5, fill: 'none' },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
      drawOrder: [
        { type: 'node', id: 'a' },
        { type: 'drawPath', index: 0 },
      ],
    });
    const drawLayer = svg.querySelector('.draw-layer');
    assert.ok(drawLayer, 'should have draw-layer');
    const children = [...drawLayer.children];
    assert.ok(children[0].classList.contains('node'), 'first child should be node');
    assert.ok(children[1].classList.contains('draw-path'), 'second child should be path');
  });

  it('falls back to layer-based rendering when drawOrder is absent', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 15, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 15, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'A' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
    });
    assert.ok(svg.querySelector('.edge-layer'), 'should have edge-layer');
    assert.ok(svg.querySelector('.node-layer'), 'should have node-layer');
    assert.ok(!svg.querySelector('.draw-layer'), 'should NOT have draw-layer');
  });

  it('renders plots in draw order', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      plots: [{
        path: 'M 0 0 L 100 50',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none' },
        marks: null, markPath: null, markFillMode: 'stroke',
      }],
      drawPaths: [{
        d: 'M 0 0 L 200 0',
        style: { stroke: '#000', strokeWidth: 1.5, fill: 'none' },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
      drawOrder: [
        { type: 'drawPath', index: 0 },
        { type: 'plot', index: 0 },
      ],
    });
    const drawLayer = svg.querySelector('.draw-layer');
    const children = [...drawLayer.children];
    assert.ok(children[0].classList.contains('draw-path'), 'path first');
    assert.ok(children[1].classList.contains('plot-path'), 'plot second');
  });

});

describe('render() with config.draw', () => {
  it('renders draw items in order', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], arrow: '<->' },
        { type: 'node', id: 'lbl', position: { x: 100, y: 0 }, label: 'mid' },
        { type: 'path', points: [{ x: 100, y: -50 }, { x: 100, y: 50 }], dotted: true },
      ],
    });
    const drawLayer = svg.querySelector('.draw-layer');
    assert.ok(drawLayer, 'should use draw-layer');
    const children = [...drawLayer.children];
    assert.ok(children.length >= 3, `expected >= 3 children, got ${children.length}`);
  });

  it('renders path before node — path behind node', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] },
        { type: 'node', id: 'a', position: { x: 100, y: 0 }, label: 'A', fill: 'white' },
      ],
    });
    const children = [...svg.querySelector('.draw-layer').children];
    assert.ok(children[0].classList.contains('draw-path'), 'path first');
    assert.ok(children[1].classList.contains('node'), 'node second (on top)');
  });

  it('renders node before path — node behind path', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'node', id: 'a', position: { x: 100, y: 0 }, label: 'A', fill: 'white' },
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] },
      ],
    });
    const children = [...svg.querySelector('.draw-layer').children];
    assert.ok(children[0].classList.contains('node'), 'node first (behind)');
    assert.ok(children[1].classList.contains('draw-path'), 'path second (on top)');
  });

  it('applies global scale to draw items', () => {
    const svg = makeSVG();
    render(svg, {
      scale: 100,
      draw: [
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }] },
        { type: 'node', id: 'a', position: { x: 1, y: 0 }, label: 'A' },
      ],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('d').includes('200'), 'path x=2 should scale to 200');
    const node = svg.querySelector('#node-a');
    assert.ok(node.getAttribute('transform').includes('100'), 'node x=1 should scale to 100');
  });

  it('mixes plots and paths in draw order', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'path', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], arrow: '<->' },
        { type: 'plot', expr: (x) => x * x, domain: [0, 2], samples: 5, scaleX: 50, scaleY: 50, offsetX: 0, offsetY: 0, stroke: 'blue' },
        { type: 'node', id: 'lbl', position: { x: 200, y: 0 }, label: 'x', anchor: 'west' },
      ],
    });
    const layer = svg.querySelector('.draw-layer');
    assert.ok(layer.querySelector('.draw-path'), 'has path');
    assert.ok(layer.querySelector('.plot-path'), 'has plot');
    assert.ok(layer.querySelector('#node-lbl'), 'has node');
  });

  it('still works with config.states/edges/paths when config.draw is absent', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { position: { x: 50, y: 50 }, label: 'Q' } },
      edges: [],
      paths: [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }],
    });
    assert.ok(svg.querySelector('.edge-layer'), 'should use traditional layers');
    assert.ok(svg.querySelector('.node-layer'), 'should use traditional layers');
    assert.ok(!svg.querySelector('.draw-layer'), 'no draw-layer');
  });
});

// Keep this test from Task 1 — emitter-level edge test
describe('ordered emission edge test', () => {
  it('renders edge with its label in order', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        index: 0, from: 'a', to: 'b', label: 'edge', path: 'M 0 0 L 100 0',
        edgeGeometry: { path: 'M 0 0 L 100 0' },
        labelNode: { center: { x: 50, y: -10 }, geom: { halfWidth: 20, halfHeight: 8 }, angle: null },
        style: { stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
      }],
      arrowDefs: [],
      shadowFilters: [],
      drawOrder: [
        { type: 'edge', index: 0 },
      ],
    });
    const drawLayer = svg.querySelector('.draw-layer');
    assert.ok(drawLayer, 'should have draw-layer');
    const paths = drawLayer.querySelectorAll('path');
    assert.ok(paths.length >= 1, 'should have edge path');
  });
});
