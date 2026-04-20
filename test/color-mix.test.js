import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { resolveColor } from '../src-v2/core/color.js';
import { render } from '../src-v2/index.js';
import { resolveNodeStyle, resolveEdgeStyle } from '../src-v2/style/style.js';

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

describe('resolveColor (unit)', () => {
  it('passes through #rrggbb hex, normalized to lowercase', () => {
    assert.strictEqual(resolveColor('#FF0000'), '#ff0000');
    assert.strictEqual(resolveColor('#abc'), '#abc');
  });

  it('resolves named TikZ colors to hex', () => {
    assert.strictEqual(resolveColor('red'),   '#ff0000');
    assert.strictEqual(resolveColor('green'), '#00ff00');
    assert.strictEqual(resolveColor('black'), '#000000');
    assert.strictEqual(resolveColor('white'), '#ffffff');
  });

  it('mixes X!p!Y in RGB space', () => {
    // 70% green + 30% black = (0, 0.7*255, 0) = (0, 178.5, 0) → rounds to 179 → #00b300
    assert.strictEqual(resolveColor('green!70!black'), '#00b300');
    // 50% red + 50% blue = #800080
    assert.strictEqual(resolveColor('red!50!blue'), '#800080');
  });

  it('treats X!p as shorthand for X!p!white', () => {
    // 30% red + 70% white = (255*0.3 + 255*0.7, 255*0.7, 255*0.7) = (255, 178.5, 178.5)
    assert.strictEqual(resolveColor('red!30'), '#ffb3b3');
  });

  it('returns hex when one operand is already hex', () => {
    // 100% of #ff0000 + 0% of #000000 = #ff0000
    assert.strictEqual(resolveColor('#ff0000!100!#000000'), '#ff0000');
  });

  it('passes through unknown or malformed specs unchanged', () => {
    assert.strictEqual(resolveColor('notacolor'), 'notacolor');
    assert.strictEqual(resolveColor('red!badpercent!blue'), 'red!badpercent!blue');
    assert.strictEqual(resolveColor('red!50!blue!25!black'), 'red!50!blue!25!black');
  });

  it('passes through non-strings', () => {
    assert.strictEqual(resolveColor(null), null);
    assert.strictEqual(resolveColor(undefined), undefined);
  });
});

describe('color-mix integration with style resolution', () => {
  it('resolves node fill containing TikZ mix syntax', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, fill: 'green!70!black' } },
    });
    assert.strictEqual(style.fill, '#00b300');
  });

  it('resolves edge stroke containing named color', () => {
    const style = resolveEdgeStyle(0, {
      states: { a: { position: { x: 0, y: 0 } }, b: { position: { x: 50, y: 0 } } },
      edges: [{ from: 'a', to: 'b', stroke: 'red' }],
    });
    assert.strictEqual(style.stroke, '#ff0000');
  });

  it('render() produces expected hex in emitted SVG for mixed colors', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 0, y: 0 }, fill: 'green!70!black', stroke: 'none' },
      },
      edges: [],
    });
    const circle = svg.querySelector('#node-a circle');
    assert.ok(circle, 'circle should exist');
    assert.strictEqual(circle.getAttribute('fill'), '#00b300');
  });
});
