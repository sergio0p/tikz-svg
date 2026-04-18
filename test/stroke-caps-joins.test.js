/**
 * lineCap / lineJoin / miterLimit → SVG stroke-linecap / stroke-linejoin / stroke-miterlimit.
 * TikZ cap name `rect` translates to SVG `square`.
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

describe('stroke cap/join: defaults (omitted)', () => {
  it('edges omit stroke-linecap and stroke-miterlimit by default', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { initial: true }, q1: { position: { right: 'q0' } } },
      edges: [{ from: 'q0', to: 'q1' }],
    });
    const p = svg.querySelector('path[id^="edge-"]');
    assert.strictEqual(p.getAttribute('stroke-linecap'), null);
    assert.strictEqual(p.getAttribute('stroke-miterlimit'), null);
  });

  it('free-form paths omit all three by default', () => {
    const svg = makeSVG();
    render(svg, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] }],
    });
    const p = svg.querySelector('path.draw-path');
    assert.strictEqual(p.getAttribute('stroke-linecap'), null);
    assert.strictEqual(p.getAttribute('stroke-linejoin'), null);
    assert.strictEqual(p.getAttribute('stroke-miterlimit'), null);
  });
});

describe('stroke cap/join: edges', () => {
  it('emits lineCap as stroke-linecap', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { initial: true }, q1: { position: { right: 'q0' } } },
      edges: [{ from: 'q0', to: 'q1', lineCap: 'round' }],
    });
    const p = svg.querySelector('path[id^="edge-"]');
    assert.strictEqual(p.getAttribute('stroke-linecap'), 'round');
  });

  it('emits lineJoin as stroke-linejoin', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { initial: true }, q1: { position: { right: 'q0' } } },
      edges: [{ from: 'q0', to: 'q1', lineJoin: 'bevel' }],
    });
    const p = svg.querySelector('path[id^="edge-"]');
    assert.strictEqual(p.getAttribute('stroke-linejoin'), 'bevel');
  });

  it('emits miterLimit as stroke-miterlimit', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { initial: true }, q1: { position: { right: 'q0' } } },
      edges: [{ from: 'q0', to: 'q1', miterLimit: 8 }],
    });
    const p = svg.querySelector('path[id^="edge-"]');
    assert.strictEqual(p.getAttribute('stroke-miterlimit'), '8');
  });
});

describe('stroke cap: TikZ rect → SVG square', () => {
  it('translates lineCap: "rect" → stroke-linecap="square"', () => {
    const svg = makeSVG();
    render(svg, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], lineCap: 'rect' }],
    });
    const p = svg.querySelector('path.draw-path');
    assert.strictEqual(p.getAttribute('stroke-linecap'), 'square');
  });

  it('passes "butt" through unchanged', () => {
    const svg = makeSVG();
    render(svg, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], lineCap: 'butt' }],
    });
    const p = svg.querySelector('path.draw-path');
    assert.strictEqual(p.getAttribute('stroke-linecap'), 'butt');
  });
});

describe('stroke cap/join: plots', () => {
  it('plots keep round linejoin by default (preserves existing behavior)', () => {
    const svg = makeSVG();
    render(svg, {
      plots: [{ coordinates: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }],
    });
    const p = svg.querySelector('path.plot-path');
    assert.strictEqual(p.getAttribute('stroke-linejoin'), 'round');
  });

  it('plot lineJoin override wins', () => {
    const svg = makeSVG();
    render(svg, {
      plots: [{ coordinates: [{ x: 0, y: 0 }, { x: 1, y: 1 }], lineJoin: 'miter' }],
    });
    const p = svg.querySelector('path.plot-path');
    assert.strictEqual(p.getAttribute('stroke-linejoin'), 'miter');
  });
});

describe('stroke cap/join: nodes', () => {
  it('emits lineJoin on a rectangle node', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { shape: 'rectangle', lineJoin: 'bevel' } },
    });
    const rect = svg.querySelector('rect');
    assert.strictEqual(rect.getAttribute('stroke-linejoin'), 'bevel');
  });
});
