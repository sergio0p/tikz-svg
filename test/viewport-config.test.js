import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let render;
before(async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  ({ render } = await import('../src-v2/index.js'));
});

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

const twoNodes = () => ({
  states: {
    a: { label: 'A', position: { x: 0, y: 0 } },
    b: { label: 'B', position: { x: 100, y: 0 } },
  },
  edges: [{ from: 'a', to: 'b' }],
});

describe('explicit viewport config', () => {
  it('config.viewBox array overrides the auto-computed viewBox', () => {
    const svg = makeSVG();
    render(svg, { ...twoNodes(), viewBox: [0, 0, 200, 100] });
    assert.equal(svg.getAttribute('viewBox'), '0 0 200 100');
  });

  it('config.viewBox string is passed through verbatim', () => {
    const svg = makeSVG();
    render(svg, { ...twoNodes(), viewBox: '-10 -10 220 120' });
    assert.equal(svg.getAttribute('viewBox'), '-10 -10 220 120');
  });

  it('config.viewBox wins over transformCanvas viewBox scaling', () => {
    const svg = makeSVG();
    render(svg, { ...twoNodes(), transformCanvas: { scale: 2 }, viewBox: [0, 0, 50, 50] });
    assert.equal(svg.getAttribute('viewBox'), '0 0 50 50');
  });

  it('config.width / config.height set the SVG attributes', () => {
    const svg = makeSVG();
    render(svg, { ...twoNodes(), width: 400, height: 300 });
    assert.equal(svg.getAttribute('width'), '400');
    assert.equal(svg.getAttribute('height'), '300');
  });

  it('width/height accept CSS strings', () => {
    const svg = makeSVG();
    render(svg, { ...twoNodes(), width: '100%' });
    assert.equal(svg.getAttribute('width'), '100%');
    assert.equal(svg.getAttribute('height'), null);
  });

  it('without overrides the auto viewBox is still computed', () => {
    const svg = makeSVG();
    render(svg, twoNodes());
    const vb = svg.getAttribute('viewBox');
    assert.ok(vb && vb.split(' ').length === 4);
    const [, , w, h] = vb.split(' ').map(Number);
    assert.ok(w > 100, `viewBox width ${w} should cover the 100px node span`);
    assert.ok(h > 0);
  });

  it('explicit viewBox applies in draw-order (layers) mode too', () => {
    const svg = makeSVG();
    render(svg, { ...twoNodes(), layers: ['back', 'main'], viewBox: [0, 0, 300, 150] });
    assert.equal(svg.getAttribute('viewBox'), '0 0 300 150');
  });
});
