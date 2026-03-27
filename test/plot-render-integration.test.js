import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { resolvePlotStyle } from '../src-v2/style/style.js';
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

describe('resolvePlotStyle', () => {
  it('returns defaults when no overrides', () => {
    const style = resolvePlotStyle(0, { plots: [{ expr: 'x' }] });
    assert.strictEqual(style.stroke, '#2563eb');
    assert.strictEqual(style.strokeWidth, 2);
    assert.strictEqual(style.fill, 'none');
    assert.strictEqual(style.handler, 'lineto');
    assert.strictEqual(style.markSize, 3);
  });

  it('merges config.plotStyle as base', () => {
    const config = {
      plots: [{ expr: 'x' }],
      plotStyle: { stroke: 'red', strokeWidth: 3 },
    };
    const style = resolvePlotStyle(0, config);
    assert.strictEqual(style.stroke, 'red');
    assert.strictEqual(style.strokeWidth, 3);
    assert.strictEqual(style.fill, 'none');
  });

  it('per-plot overrides beat plotStyle', () => {
    const config = {
      plots: [{ expr: 'x', stroke: 'green' }],
      plotStyle: { stroke: 'red' },
    };
    const style = resolvePlotStyle(0, config);
    assert.strictEqual(style.stroke, 'green');
  });

  it('includes handler and mark options', () => {
    const config = {
      plots: [{
        expr: 'sin(x)',
        handler: 'smooth',
        tension: 0.8,
        mark: '*',
        markSize: 4,
        markRepeat: 3,
      }],
    };
    const style = resolvePlotStyle(0, config);
    assert.strictEqual(style.handler, 'smooth');
    assert.strictEqual(style.tension, 0.8);
    assert.strictEqual(style.mark, '*');
    assert.strictEqual(style.markSize, 4);
    assert.strictEqual(style.markRepeat, 3);
  });
});

describe('render() with config.plots', () => {
  it('renders a simple function plot', () => {
    const svg = makeSVG();
    render(svg, {
      states: { origin: { position: { x: 0, y: 0 }, label: '' } },
      edges: [],
      plots: [{
        expr: 'x',
        domain: [0, 5],
        samples: 6,
        scaleX: 20,
        scaleY: 20,
        offsetX: 0,
        offsetY: 0,
      }],
    });
    const plotPath = svg.querySelector('.plot-path');
    assert.ok(plotPath, 'should render a plot path');
    assert.ok(plotPath.getAttribute('d').includes('L'), 'should have line segments');
  });

  it('renders a plot with smooth handler', () => {
    const svg = makeSVG();
    render(svg, {
      states: { origin: { position: { x: 0, y: 0 }, label: '' } },
      edges: [],
      plots: [{
        expr: 'sin(x)',
        domain: [0, 6.28],
        samples: 20,
        handler: 'smooth',
        scaleX: 50,
        scaleY: 50,
        offsetX: 0,
        offsetY: 0,
      }],
    });
    const plotPath = svg.querySelector('.plot-path');
    assert.ok(plotPath.getAttribute('d').includes('C'), 'smooth should produce curves');
  });

  it('renders a plot with marks', () => {
    const svg = makeSVG();
    render(svg, {
      states: { origin: { position: { x: 0, y: 0 }, label: '' } },
      edges: [],
      plots: [{
        expr: 'x',
        domain: [0, 3],
        samples: 4,
        mark: '*',
        markSize: 3,
        scaleX: 30,
        scaleY: 30,
        offsetX: 0,
        offsetY: 0,
      }],
    });
    const marks = svg.querySelectorAll('.plot-mark');
    assert.strictEqual(marks.length, 4);
  });

  it('places a node at a plot data point', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        peak: {
          at: { plot: 0, point: 2 },
          label: 'max',
          shape: 'rectangle',
          radius: 10,
        },
      },
      edges: [],
      plots: [{
        expr: 'sin(x)',
        domain: [0, Math.PI],
        samples: 5,
        handler: 'smooth',
        scaleX: 50,
        scaleY: 50,
        offsetX: 100,
        offsetY: 100,
      }],
    });
    const node = svg.querySelector('#node-peak');
    assert.ok(node, 'node should exist');
    const transform = node.getAttribute('transform');
    assert.ok(transform.includes('translate'), 'node should be positioned');
  });

  it('renders plot from inline coordinates', () => {
    const svg = makeSVG();
    render(svg, {
      states: { origin: { position: { x: 0, y: 0 }, label: '' } },
      edges: [],
      plots: [{
        coordinates: [{ x: 0, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 1 }],
        handler: 'ybar',
        barWidth: 0.8,
        scaleX: 50,
        scaleY: 30,
        offsetX: 50,
        offsetY: 100,
      }],
    });
    const plotPath = svg.querySelector('.plot-path');
    assert.ok(plotPath.getAttribute('d').includes('Z'), 'ybar should produce closed paths');
  });

  it('places a node above a plot data point with offset', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        lbl: {
          at: { plot: 0, point: 0, above: 30 },
          label: 'start',
          shape: 'rectangle',
          radius: 10,
        },
      },
      edges: [],
      plots: [{
        coordinates: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        scaleX: 50,
        scaleY: 50,
        offsetX: 100,
        offsetY: 200,
      }],
    });
    const node = svg.querySelector('#node-lbl');
    assert.ok(node, 'node should exist');
    // point 0: SVG (100, 200). above: 30 → y = 170
    const transform = node.getAttribute('transform');
    assert.ok(transform.includes('170'), 'node should be shifted above');
  });

  it('works with no states and only plots', () => {
    const svg = makeSVG();
    const result = render(svg, {
      states: {},
      edges: [],
      plots: [{
        expr: 'x^2',
        domain: [0, 3],
        samples: 4,
        scaleX: 20,
        scaleY: 20,
        offsetX: 0,
        offsetY: 0,
      }],
    });
    const plotPath = svg.querySelector('.plot-path');
    assert.ok(plotPath, 'should render plot even with no states');
  });
});
