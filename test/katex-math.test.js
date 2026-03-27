import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { isMathLabel, stripMath, isKaTeXAvailable, createLabelContent } from '../src-v2/core/katex-renderer.js';
import { emitSVG } from '../src-v2/svg/emitter.js';
import { estimateTextDimensions } from '../src-v2/core/text-measure.js';

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

describe('isMathLabel', () => {
  it('detects $...$ math', () => {
    assert.strictEqual(isMathLabel('$x^2$'), true);
    assert.strictEqual(isMathLabel('$\\frac{1}{4}$'), true);
  });

  it('detects mixed text and math', () => {
    assert.strictEqual(isMathLabel('value: $x^2$'), true);
    assert.strictEqual(isMathLabel('$a$ and $b$'), true);
  });

  it('rejects plain text', () => {
    assert.strictEqual(isMathLabel('hello'), false);
    assert.strictEqual(isMathLabel('q0'), false);
    assert.strictEqual(isMathLabel(''), false);
  });

  it('rejects null/undefined', () => {
    assert.strictEqual(isMathLabel(null), false);
    assert.strictEqual(isMathLabel(undefined), false);
  });

  it('rejects single $ (not paired)', () => {
    assert.strictEqual(isMathLabel('costs $5'), false);
  });
});

describe('stripMath', () => {
  it('removes $ delimiters', () => {
    assert.strictEqual(stripMath('$x^2$'), 'x^2');
    assert.strictEqual(stripMath('$\\frac{1}{4}$'), '\\frac{1}{4}');
  });

  it('handles mixed text and math', () => {
    assert.strictEqual(stripMath('value: $x^2$'), 'value: x^2');
  });

  it('passes through non-math text', () => {
    assert.strictEqual(stripMath('hello'), 'hello');
  });
});

describe('isKaTeXAvailable', () => {
  it('returns false when window.katex is not loaded', () => {
    assert.strictEqual(isKaTeXAvailable(), false);
  });
});

describe('createLabelContent (fallback mode)', () => {
  it('returns text element when KaTeX not available', () => {
    const result = createLabelContent('$x^2$', {
      fontSize: 14,
      fontFamily: 'serif',
      color: '#000',
    });
    assert.strictEqual(result.type, 'text');
    assert.strictEqual(result.content, 'x^2');
    assert.ok(result.width > 0);
    assert.ok(result.height > 0);
  });

  it('returns text for non-math labels', () => {
    const result = createLabelContent('hello', {
      fontSize: 14,
      fontFamily: 'serif',
      color: '#000',
    });
    assert.strictEqual(result.type, 'text');
    assert.strictEqual(result.content, 'hello');
  });
});

describe('emitter math fallback (no KaTeX loaded)', () => {
  it('renders $x^2$ as plain text "x^2" in fallback mode', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 20, outerSep: 0.75 },
          shape: circleShape,
          style: { shape: 'circle', radius: 20, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: '$x^2$' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
    });
    const text = svg.querySelector('#node-a text');
    assert.ok(text, 'should have text element (fallback)');
    assert.strictEqual(text.textContent, 'x^2');
  });

  it('renders non-math labels unchanged', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {
        a: { id: 'a', center: { x: 50, y: 50 }, geom: { radius: 20, outerSep: 0.75 },
          shape: circleShape,
          style: { shape: 'circle', radius: 20, fill: '#fff', stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
          label: 'hello' },
      },
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
    });
    const text = svg.querySelector('#node-a text');
    assert.strictEqual(text.textContent, 'hello');
  });

  it('strips $ from edge labels in fallback', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [{
        index: 0, from: 'a', to: 'b', label: '$\\alpha$', path: 'M 0 0 L 100 0',
        edgeGeometry: { path: 'M 0 0 L 100 0' },
        labelNode: { center: { x: 50, y: -10 }, geom: { halfWidth: 20, halfHeight: 8 }, angle: null },
        style: { stroke: '#000', strokeWidth: 1.5, fontSize: 14, fontFamily: 'serif' },
      }],
      arrowDefs: [],
      shadowFilters: [],
    });
    const text = svg.querySelector('.label-node text');
    assert.ok(text, 'should have label text');
    assert.strictEqual(text.textContent, '\\alpha');
  });

  it('strips $ from draw-path inline labels in fallback', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {},
      edges: [],
      arrowDefs: [],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 200 0',
        style: { stroke: '#000', strokeWidth: 1, fill: 'none' },
        arrowStartId: null, arrowEndId: null,
        labelNodes: [{ x: 200, y: 0, label: '$e_1$', anchor: 'right', fontSize: 14, fontFamily: 'serif' }],
      }],
    });
    const text = svg.querySelector('.draw-label');
    assert.strictEqual(text.textContent, 'e_1');
  });
});

describe('text measurement with math (fallback)', () => {
  it('estimates $\\frac{1}{4}$ using stripped text when KaTeX unavailable', () => {
    const dim = estimateTextDimensions('$\\frac{1}{4}$', 14);
    assert.ok(dim.width > 0, 'should have width');
    assert.ok(dim.height > 0, 'should have height');
  });

  it('estimates mixed text+math', () => {
    const dim = estimateTextDimensions('value: $x^2$', 14);
    assert.ok(dim.width > 0, 'should have width');
  });
});
