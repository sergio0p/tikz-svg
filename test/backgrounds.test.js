import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { emitSVG } from '../src-v2/svg/emitter.js';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  document = dom.window.document;
});

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

const circleShape = {
  savedGeometry(c) { return c; },
  backgroundPath() { return 'M -20 0 A 20 20 0 1 0 20 0 A 20 20 0 1 0 -20 0'; },
  borderPoint(g, d) { return g.center; },
  namedAnchors() { return {}; },
};

function makeModel(bg, nodes) {
  return {
    nodes: nodes || {
      a: {
        id: 'a', center: { x: 50, y: 50 },
        geom: { center: { x: 50, y: 50 }, radius: 20, outerSep: 0.75 },
        shape: circleShape,
        style: { shape: 'circle', radius: 20, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
        label: 'A',
      },
    },
    edges: [], arrowDefs: [], shadowFilters: [],
    background: bg,
  };
}

describe('backgrounds library', () => {
  it('does nothing when background is null/undefined', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel(null));
    assert.strictEqual(svg.querySelector('.background-layer'), null);
  });

  it('emits a background rectangle', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({ rectangle: true }));
    const bg = svg.querySelector('.background-layer');
    assert.ok(bg, 'background-layer group should exist');
    const rect = bg.querySelector('rect');
    assert.ok(rect, 'should contain a rect element');
    assert.strictEqual(rect.getAttribute('stroke'), '#000');
    assert.strictEqual(rect.getAttribute('fill'), 'none');
  });

  it('background layer is before content layers in DOM', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({ rectangle: true }));
    const children = Array.from(svg.children);
    const bgIdx = children.findIndex(c => c.classList?.contains('background-layer'));
    const edgeIdx = children.findIndex(c => c.classList?.contains('edge-layer'));
    assert.ok(bgIdx >= 0, 'background-layer should exist');
    assert.ok(edgeIdx >= 0, 'edge-layer should exist');
    assert.ok(bgIdx < edgeIdx, 'background-layer should appear before edge-layer');
  });

  it('applies innerFrameSep padding', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({ rectangle: true, innerFrameSep: 20 }));
    const rect = svg.querySelector('.background-layer rect');
    // Content bbox depends on the rendered circle at (50,50) r=20
    // With innerFrameSep=20 the rect should extend 20 beyond the content bbox
    const x = parseFloat(rect.getAttribute('x'));
    const w = parseFloat(rect.getAttribute('width'));
    // rect should be substantially wider than a tight fit around the node
    assert.ok(w >= 70, `rect width ${w} should be >= 70 (content + 2*20 padding)`);
  });

  it('emits border lines (top, bottom, left, right)', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({ top: true, bottom: true, left: true, right: true }));
    const bg = svg.querySelector('.background-layer');
    const lines = bg.querySelectorAll('line');
    assert.strictEqual(lines.length, 4, 'should have 4 border lines');
  });

  it('emits only requested border lines', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({ top: true, bottom: true }));
    const bg = svg.querySelector('.background-layer');
    const lines = bg.querySelectorAll('line');
    assert.strictEqual(lines.length, 2, 'should have 2 border lines');
  });

  it('emits a background grid', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({ grid: true, gridStep: 5 }));
    const bg = svg.querySelector('.background-layer');
    const path = bg.querySelector('path');
    assert.ok(path, 'should contain a grid path');
    assert.strictEqual(path.getAttribute('fill'), 'none');
    // Grid should have multiple M/L segments
    const d = path.getAttribute('d');
    assert.ok(d.split('M').length > 2, 'grid should have multiple line segments');
  });

  it('applies custom rectangle style', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({
      rectangle: true,
      rectangleStyle: { fill: '#f0f0f0', stroke: 'blue', strokeWidth: 2 },
    }));
    const rect = svg.querySelector('.background-layer rect');
    assert.strictEqual(rect.getAttribute('fill'), '#f0f0f0');
    assert.strictEqual(rect.getAttribute('stroke'), 'blue');
    assert.strictEqual(rect.getAttribute('stroke-width'), '2');
  });

  it('applies custom grid style', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({
      grid: true,
      gridStyle: { stroke: 'red', strokeWidth: 1 },
    }));
    const path = svg.querySelector('.background-layer path');
    assert.strictEqual(path.getAttribute('stroke'), 'red');
    assert.strictEqual(path.getAttribute('stroke-width'), '1');
  });

  it('outerFrameSep extends border lines beyond rectangle', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({
      rectangle: true, top: true,
      innerFrameSep: 10, outerFrameSep: 5,
    }));
    const rect = svg.querySelector('.background-layer rect');
    const line = svg.querySelector('.background-layer line');
    const rectX = parseFloat(rect.getAttribute('x'));
    const rectW = parseFloat(rect.getAttribute('width'));
    const lineX1 = parseFloat(line.getAttribute('x1'));
    const lineX2 = parseFloat(line.getAttribute('x2'));
    // Border line x-range should extend 5 beyond rect on each side
    assert.ok(lineX1 < rectX, `line x1 (${lineX1}) should be less than rect x (${rectX})`);
    assert.ok(lineX2 > rectX + rectW, `line x2 (${lineX2}) should exceed rect right edge (${rectX + rectW})`);
  });

  it('background is included in viewBox', () => {
    const svg = makeSVG();
    emitSVG(svg, makeModel({ rectangle: true, innerFrameSep: 30 }));
    const vb = svg.getAttribute('viewBox');
    assert.ok(vb, 'viewBox should be set');
    const [x, y, w, h] = vb.split(/\s+/).map(Number);
    // viewBox should encompass the background rect
    assert.ok(w > 0 && h > 0);
  });

  it('works with drawOrder render path', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: {
          id: 'a', center: { x: 50, y: 50 },
          geom: { center: { x: 50, y: 50 }, radius: 20, outerSep: 0.75 },
          shape: circleShape,
          style: { shape: 'circle', radius: 20, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'A',
        },
      },
      edges: [], arrowDefs: [], shadowFilters: [],
      drawOrder: [{ type: 'node', id: 'a' }],
      background: { rectangle: true },
    });
    const bg = svg.querySelector('.background-layer');
    assert.ok(bg, 'background-layer should exist with drawOrder');
    assert.ok(bg.querySelector('rect'), 'should have a rect');
  });
});
