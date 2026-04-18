/**
 * TikZ `nonzero rule` / `even odd rule` → SVG `fill-rule`.
 * Opt-in only: no attribute emitted unless the style sets fillRule.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let render;
before(async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  ({ render } = await import('../src-v2/index.js'));
});

const SVG_NS = 'http://www.w3.org/2000/svg';
function makeSVG() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('fill-rule: default (omitted)', () => {
  it('omits fill-rule attribute on paths when unset', () => {
    const svg = makeSVG();
    render(svg, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }], cycle: true }],
    });
    const p = svg.querySelector('path.draw-path');
    assert.ok(p);
    assert.strictEqual(p.getAttribute('fill-rule'), null);
  });

  it('omits fill-rule on nodes when unset', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { shape: 'rectangle' } },
    });
    const rect = svg.querySelector('rect');
    assert.ok(rect);
    assert.strictEqual(rect.getAttribute('fill-rule'), null);
  });
});

describe('fill-rule: evenodd on paths', () => {
  it('emits fill-rule="evenodd" on a closed path', () => {
    const svg = makeSVG();
    render(svg, {
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }],
        cycle: true,
        fill: '#eee',
        fillRule: 'evenodd',
      }],
    });
    const p = svg.querySelector('path.draw-path');
    assert.ok(p);
    assert.strictEqual(p.getAttribute('fill-rule'), 'evenodd');
  });
});

describe('fill-rule: nonzero on paths', () => {
  it('emits fill-rule="nonzero" when set explicitly', () => {
    const svg = makeSVG();
    render(svg, {
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }],
        cycle: true,
        fill: '#eee',
        fillRule: 'nonzero',
      }],
    });
    const p = svg.querySelector('path.draw-path');
    assert.strictEqual(p.getAttribute('fill-rule'), 'nonzero');
  });
});

describe('fill-rule: nodes', () => {
  it('emits fill-rule on a rectangle node when set', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { shape: 'rectangle', fillRule: 'evenodd' } },
    });
    const rect = svg.querySelector('rect');
    assert.strictEqual(rect.getAttribute('fill-rule'), 'evenodd');
  });
});

describe('fill-rule: plots', () => {
  it('emits fill-rule on a filled plot path', () => {
    const svg = makeSVG();
    render(svg, {
      plots: [{
        coordinates: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }],
        fill: '#eee',
        fillRule: 'evenodd',
      }],
    });
    const p = svg.querySelector('path.plot-path');
    assert.strictEqual(p.getAttribute('fill-rule'), 'evenodd');
  });
});
