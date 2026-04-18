/**
 * TikZ named dash patterns (§15.3.2). Values from tikz.code.tex using
 * \pgflinewidth = 0.4pt as the reference dot width.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let resolveDash, DASH_PATTERNS, render;
before(async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  ({ resolveDash } = await import('../src-v2/style/style.js'));
  ({ DASH_PATTERNS } = await import('../src-v2/core/constants.js'));
  ({ render } = await import('../src-v2/index.js'));
});

const SVG_NS = 'http://www.w3.org/2000/svg';
function makeSVG() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  return svg;
}

describe('DASH_PATTERNS constant', () => {
  it('has the 12 TikZ named patterns (solid excluded)', () => {
    const expected = [
      'dotted', 'densely dotted', 'loosely dotted',
      'dashed', 'densely dashed', 'loosely dashed',
      'dash dot', 'densely dash dot', 'loosely dash dot',
      'dash dot dot', 'densely dash dot dot', 'loosely dash dot dot',
    ];
    for (const name of expected) {
      assert.ok(name in DASH_PATTERNS, `${name} missing`);
    }
  });
});

describe('resolveDash helper', () => {
  it('returns null for null/undefined/solid', () => {
    assert.strictEqual(resolveDash(null), null);
    assert.strictEqual(resolveDash(undefined), null);
    assert.strictEqual(resolveDash('solid'), null);
  });

  it('returns the pattern string for known names', () => {
    assert.strictEqual(resolveDash('dashed'), '3 3');
    assert.strictEqual(resolveDash('densely dashed'), '3 2');
    assert.strictEqual(resolveDash('loosely dashed'), '3 6');
    assert.strictEqual(resolveDash('dotted'), '0.4 2');
    assert.strictEqual(resolveDash('dash dot'), '3 2 0.4 2');
  });

  it('joins numeric arrays with spaces', () => {
    assert.strictEqual(resolveDash([6, 4]), '6 4');
    assert.strictEqual(resolveDash([3, 2, 1]), '3 2 1');
  });

  it('passes unknown strings through as-is (raw user pattern)', () => {
    assert.strictEqual(resolveDash('10 5 2 5'), '10 5 2 5');
  });
});

describe('dash on edges via render()', () => {
  it('accepts dash: "dashed"', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { initial: true }, q1: { position: { right: 'q0' } } },
      edges: [{ from: 'q0', to: 'q1', dash: 'dashed' }],
    });
    const p = svg.querySelector('path[id^="edge-"]');
    assert.strictEqual(p.getAttribute('stroke-dasharray'), '3 3');
  });

  it('accepts dash: "densely dotted"', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { initial: true }, q1: { position: { right: 'q0' } } },
      edges: [{ from: 'q0', to: 'q1', dash: 'densely dotted' }],
    });
    const p = svg.querySelector('path[id^="edge-"]');
    assert.strictEqual(p.getAttribute('stroke-dasharray'), '0.4 1');
  });

  it('accepts dash as numeric array', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { initial: true }, q1: { position: { right: 'q0' } } },
      edges: [{ from: 'q0', to: 'q1', dash: [8, 4] }],
    });
    const p = svg.querySelector('path[id^="edge-"]');
    assert.strictEqual(p.getAttribute('stroke-dasharray'), '8 4');
  });

  it('dash: "solid" emits no dasharray', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { initial: true }, q1: { position: { right: 'q0' } } },
      edges: [{ from: 'q0', to: 'q1', dash: 'solid' }],
    });
    const p = svg.querySelector('path[id^="edge-"]');
    assert.strictEqual(p.getAttribute('stroke-dasharray'), null);
  });
});

describe('legacy dashed/dotted booleans on edges', () => {
  it('dashed: true still emits "6 4" (existing behavior)', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { initial: true }, q1: { position: { right: 'q0' } } },
      edges: [{ from: 'q0', to: 'q1', dashed: true }],
    });
    const p = svg.querySelector('path[id^="edge-"]');
    assert.strictEqual(p.getAttribute('stroke-dasharray'), '6 4');
  });
});

describe('dash on free-form paths via render()', () => {
  it('dash: "loosely dashed" emits "3 6"', () => {
    const svg = makeSVG();
    render(svg, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], dash: 'loosely dashed' }],
    });
    const p = svg.querySelector('path.draw-path');
    assert.strictEqual(p.getAttribute('stroke-dasharray'), '3 6');
  });

  it('legacy dotted: true still works on paths', () => {
    const svg = makeSVG();
    render(svg, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], dotted: true }],
    });
    const p = svg.querySelector('path.draw-path');
    assert.strictEqual(p.getAttribute('stroke-dasharray'), '2 3');
  });
});

describe('dash on plots via render()', () => {
  it('dash: "dash dot" emits "3 2 0.4 2"', () => {
    const svg = makeSVG();
    render(svg, {
      plots: [{ coordinates: [{ x: 0, y: 0 }, { x: 1, y: 1 }], dash: 'dash dot' }],
    });
    const p = svg.querySelector('path.plot-path');
    assert.strictEqual(p.getAttribute('stroke-dasharray'), '3 2 0.4 2');
  });
});
