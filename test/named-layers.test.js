import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { emitSVG } from '../src-v2/svg/emitter.js';
import { render } from '../src-v2/index.js';

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
  backgroundPath() { return ''; },
  borderPoint(g, d) { return g.center; },
  namedAnchors() { return {}; },
};

describe('emitter named layers', () => {
  it('creates layer groups in declared order', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {}, edges: [], arrowDefs: [], shadowFilters: [],
      layers: ['background', 'main', 'foreground'],
      drawOrder: [],
    });
    const groups = svg.querySelectorAll('g[class^="layer-"]');
    assert.strictEqual(groups.length, 3);
    assert.strictEqual(groups[0].getAttribute('class'), 'layer-background');
    assert.strictEqual(groups[1].getAttribute('class'), 'layer-main');
    assert.strictEqual(groups[2].getAttribute('class'), 'layer-foreground');
  });

  it('routes items to their assigned layer', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 20, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 20, fill: 'red', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'A' },
      },
      edges: [], arrowDefs: [], shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 100',
        style: { stroke: 'blue', strokeWidth: 2, fill: 'none' },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
      layers: ['background', 'main', 'foreground'],
      drawOrder: [
        { type: 'drawPath', index: 0, layer: 'background' },
        { type: 'node', id: 'a', layer: 'foreground' },
      ],
    });
    const bg = svg.querySelector('.layer-background');
    const fg = svg.querySelector('.layer-foreground');
    assert.ok(bg.querySelector('.draw-path'), 'path should be in background');
    assert.ok(fg.querySelector('.node'), 'node should be in foreground');
    assert.ok(!bg.querySelector('.node'), 'node should NOT be in background');
  });

  it('defaults to main layer when layer not specified', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 20, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 20, fill: 'red', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'A' },
      },
      edges: [], arrowDefs: [], shadowFilters: [],
      layers: ['background', 'main', 'foreground'],
      drawOrder: [
        { type: 'node', id: 'a' },
      ],
    });
    const main = svg.querySelector('.layer-main');
    assert.ok(main.querySelector('.node'), 'node should be in main by default');
  });

  it('background renders behind foreground (SVG paint order)', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        bg: { id: 'bg', center: { x: 50, y: 50 }, geom: { radius: 30, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 30, fill: 'yellow', stroke: 'none', strokeWidth: 0, fontSize: 14, fontFamily: 'serif' },
          label: '' },
        fg: { id: 'fg', center: { x: 50, y: 50 }, geom: { radius: 15, outerSep: 0.75 },
          shape: circleShape, style: { shape: 'circle', radius: 15, fill: 'red', stroke: 'none', strokeWidth: 0, fontSize: 14, fontFamily: 'serif' },
          label: '' },
      },
      edges: [], arrowDefs: [], shadowFilters: [],
      layers: ['background', 'main', 'foreground'],
      drawOrder: [
        { type: 'node', id: 'fg', layer: 'foreground' },
        { type: 'node', id: 'bg', layer: 'background' },
      ],
    });
    const layers = svg.querySelectorAll('g[class^="layer-"]');
    const bgIndex = [...layers].findIndex(g => g.classList.contains('layer-background'));
    const fgIndex = [...layers].findIndex(g => g.classList.contains('layer-foreground'));
    assert.ok(bgIndex < fgIndex, 'background layer should be before foreground in DOM');
    assert.ok(layers[bgIndex].querySelector('#node-bg'), 'bg node in background layer');
    assert.ok(layers[fgIndex].querySelector('#node-fg'), 'fg node in foreground layer');
  });

  it('falls back to single draw-layer when layers not specified', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {}, edges: [], arrowDefs: [], shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 0',
        style: { stroke: '#000', strokeWidth: 1, fill: 'none' },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
      drawOrder: [
        { type: 'drawPath', index: 0 },
      ],
    });
    assert.ok(svg.querySelector('.draw-layer'), 'should use single draw-layer');
    assert.ok(!svg.querySelector('.layer-main'), 'should NOT have named layers');
  });
});

describe('render() with config.layers', () => {
  it('renders overlapping shapes on different layers', () => {
    const svg = makeSVG();
    render(svg, {
      layers: ['background', 'main', 'foreground'],
      draw: [
        { type: 'node', id: 'big', layer: 'background', position: { x: 100, y: 100 }, label: '', fill: 'yellow', stroke: 'none', radius: 40 },
        { type: 'node', id: 'small', layer: 'foreground', position: { x: 100, y: 100 }, label: '', fill: 'red', stroke: 'none', radius: 15 },
      ],
    });
    const bg = svg.querySelector('.layer-background');
    const fg = svg.querySelector('.layer-foreground');
    assert.ok(bg.querySelector('#node-big'), 'big circle in background');
    assert.ok(fg.querySelector('#node-small'), 'small circle in foreground');
  });

  it('mixes layers with paths and nodes', () => {
    const svg = makeSVG();
    render(svg, {
      layers: ['bg', 'main', 'fg'],
      draw: [
        { type: 'path', layer: 'bg', points: [{x:0,y:0},{x:200,y:0},{x:200,y:200},{x:0,y:200}], cycle: true, fill: '#eee', stroke: 'none' },
        { type: 'path', points: [{x:50,y:100},{x:150,y:100}], arrow: '->' },
        { type: 'node', id: 'top', layer: 'fg', position: {x:100,y:100}, label: 'Top' },
      ],
    });
    assert.ok(svg.querySelector('.layer-bg .draw-path'), 'bg rect in bg layer');
    assert.ok(svg.querySelector('.layer-main .draw-path'), 'arrow in main layer');
    assert.ok(svg.querySelector('.layer-fg #node-top'), 'node in fg layer');
  });

  it('defaults to main when no layer specified', () => {
    const svg = makeSVG();
    render(svg, {
      layers: ['background', 'main', 'foreground'],
      draw: [
        { type: 'node', id: 'a', position: { x: 50, y: 50 }, label: 'A' },
      ],
    });
    assert.ok(svg.querySelector('.layer-main #node-a'), 'should default to main');
  });

  it('works without config.layers (single draw-layer)', () => {
    const svg = makeSVG();
    render(svg, {
      draw: [
        { type: 'path', points: [{x:0,y:0},{x:100,y:0}] },
        { type: 'node', id: 'a', position: { x: 50, y: 0 }, label: 'A' },
      ],
    });
    assert.ok(svg.querySelector('.draw-layer'), 'single draw-layer');
    assert.ok(!svg.querySelector('.layer-main'), 'no named layers');
  });

  it('preserves declaration order within a layer', () => {
    const svg = makeSVG();
    render(svg, {
      layers: ['main'],
      draw: [
        { type: 'path', points: [{x:0,y:0},{x:100,y:0}] },
        { type: 'node', id: 'a', position: { x: 50, y: 0 }, label: 'A' },
        { type: 'path', points: [{x:0,y:50},{x:100,y:50}] },
      ],
    });
    const main = svg.querySelector('.layer-main');
    const children = [...main.children];
    assert.ok(children[0].classList.contains('draw-path'), 'first path');
    assert.ok(children[1].classList.contains('node'), 'node in middle');
    assert.ok(children[2].classList.contains('draw-path'), 'second path last');
  });
});
