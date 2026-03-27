import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { estimateTextDimensions } from '../src-v2/core/text-measure.js';
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

describe('estimateTextDimensions', () => {
  it('estimates single-line text', () => {
    const dim = estimateTextDimensions('Hello', 14);
    assert.ok(dim.width > 30 && dim.width < 60, `width ${dim.width}`);
    assert.ok(dim.height > 10 && dim.height < 25, `height ${dim.height}`);
  });

  it('estimates empty string as zero dimensions', () => {
    const dim = estimateTextDimensions('', 14);
    assert.strictEqual(dim.width, 0);
    assert.strictEqual(dim.height, 0);
  });

  it('handles explicit line breaks', () => {
    const dim = estimateTextDimensions('A\\\\B\\\\C', 14);
    assert.ok(dim.height > 40, `height ${dim.height} should reflect 3 lines`);
    assert.ok(dim.width < 20, `width ${dim.width} should be narrow`);
  });

  it('handles textWidth wrapping', () => {
    const dim = estimateTextDimensions('This is a long label that wraps', 14, 80);
    assert.ok(dim.width <= 80, `width ${dim.width} should be <= textWidth 80`);
    assert.ok(dim.height > 14 * 1.2, 'should be multi-line');
  });

  it('uses textWidth as width when set', () => {
    const dim = estimateTextDimensions('Short', 14, 200);
    assert.strictEqual(dim.width, 200);
  });

  it('handles null/undefined label', () => {
    const dim = estimateTextDimensions(null, 14);
    assert.strictEqual(dim.width, 0);
    assert.strictEqual(dim.height, 0);
  });
});

describe('auto-size nodes from text', () => {
  it('rectangle auto-sizes to fit long text', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'A longer label here', shape: 'rectangle', fill: 'white' },
      },
      edges: [],
    });
    const rect = svg.querySelector('#node-a rect');
    const w = parseFloat(rect.getAttribute('width'));
    assert.ok(w > 100, `rect width ${w} should auto-size to text`);
  });

  it('rectangle auto-sizes to fit short text', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'Hi', shape: 'rectangle', fill: 'white' },
      },
      edges: [],
    });
    const rect = svg.querySelector('#node-a rect');
    const w = parseFloat(rect.getAttribute('width'));
    assert.ok(w > 15 && w < 60, `rect width ${w} should be compact`);
  });

  it('circle auto-sizes to fit text', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'Long circle text', fill: 'white' },
      },
      edges: [],
    });
    const circle = svg.querySelector('#node-a circle');
    const r = parseFloat(circle.getAttribute('r'));
    assert.ok(r > 25, `circle radius ${r} should auto-size`);
  });

  it('explicit radius overrides auto-sizing', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'Long text that would need big shape', radius: 15, fill: 'white' },
      },
      edges: [],
    });
    const circle = svg.querySelector('#node-a circle');
    const r = parseFloat(circle.getAttribute('r'));
    assert.ok(r < 25, `circle radius ${r} should respect explicit radius`);
  });

  it('auto-sized node with fill covers paths underneath', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        lbl: { position: { x: 100, y: 100 }, label: '¼', shape: 'rectangle', fill: 'white', stroke: 'none', fontSize: 'scriptsize' },
      },
      edges: [],
      paths: [
        { points: [{ x: 100, y: 50 }, { x: 100, y: 150 }], dotted: true },
      ],
    });
    const rect = svg.querySelector('#node-lbl rect');
    assert.ok(rect, 'should have a background rect');
    assert.strictEqual(rect.getAttribute('fill'), 'white');
    const w = parseFloat(rect.getAttribute('width'));
    assert.ok(w > 5, `rect width ${w} should cover text`);
  });

  it('minimumWidth still works as floor with auto-sizing', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'X', shape: 'rectangle', minimumWidth: 80, fill: 'white' },
      },
      edges: [],
    });
    const rect = svg.querySelector('#node-a rect');
    const w = parseFloat(rect.getAttribute('width'));
    assert.ok(w >= 78, `rect width ${w} should respect minimumWidth 80`);
  });
});
