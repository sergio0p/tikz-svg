import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { resolveNodeStyle } from '../src-v2/style/style.js';
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

describe('named font sizes', () => {
  it('resolves "small" to 10', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, fontSize: 'small' } },
    });
    assert.strictEqual(style.fontSize, 10);
  });

  it('resolves "tiny" to 7', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, fontSize: 'tiny' } },
    });
    assert.strictEqual(style.fontSize, 7);
  });

  it('resolves "scriptsize" to 8', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, fontSize: 'scriptsize' } },
    });
    assert.strictEqual(style.fontSize, 8);
  });

  it('passes through numeric fontSize unchanged', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, fontSize: 16 } },
    });
    assert.strictEqual(style.fontSize, 16);
  });
});

describe('innerSep on nodes', () => {
  it('includes innerSep in resolved style', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 }, innerSep: 5 } },
    });
    assert.strictEqual(style.innerSep, 5);
  });

  it('defaults innerSep to DEFAULTS.innerSep', () => {
    const style = resolveNodeStyle('a', {
      states: { a: { position: { x: 0, y: 0 } } },
    });
    assert.strictEqual(style.innerSep, 3);
  });
});

describe('minimumWidth and minimumHeight', () => {
  it('enforces minimumWidth on rectangle', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'x', shape: 'rectangle', minimumWidth: 80, minimumHeight: 40 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const rect = node.querySelector('rect');
    const w = parseFloat(rect.getAttribute('width'));
    assert.ok(w >= 80, `rect width ${w} should be >= 80`);
    const h = parseFloat(rect.getAttribute('height'));
    assert.ok(h >= 40, `rect height ${h} should be >= 40`);
  });

  it('enforces minimumWidth on circle (becomes minimum diameter)', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'x', minimumWidth: 60 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const circle = node.querySelector('circle');
    const r = parseFloat(circle.getAttribute('r'));
    assert.ok(r >= 28, `circle radius ${r} should be >= 28`);
  });

  it('innerSep enlarges rectangle beyond base radius', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'Hi', shape: 'rectangle', innerSep: 15, radius: 10 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const rect = node.querySelector('rect');
    const w = parseFloat(rect.getAttribute('width'));
    // innerSep grows node to fit text+padding: max(10, textHalfW+15) × 2
    assert.ok(w >= 46, `rect width ${w} should reflect innerSep`);
  });
});

describe('xshift and yshift', () => {
  it('shifts node position by xshift/yshift', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { position: { x: 100, y: 100 }, label: 'A', xshift: 20, yshift: -10 },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const transform = node.getAttribute('transform');
    assert.ok(transform.includes('120'), 'x should be shifted +20');
    assert.ok(transform.includes('90'), 'y should be shifted -10');
  });

  it('applies xshift/yshift on top of a relative position', () => {
    const svg = makeSVG();
    render(svg, {
      // onGrid defaults to true → right-of offset is exactly nodeDistance (90) on x.
      states: {
        a: { position: { x: 100, y: 100 }, label: 'A' },
        b: { position: { right: 'a' }, xshift: 5, yshift: -3, label: 'B' },
      },
      edges: [],
    });
    // a at (100, 100); b = a + (90, 0) + shift (5, -3) = (195, 97)
    const nodeB = svg.querySelector('#node-b');
    const match = nodeB.getAttribute('transform').match(/translate\((-?[\d.]+),?\s*(-?[\d.]+)\)/);
    assert.ok(match, 'b should have a translate transform');
    assert.strictEqual(parseFloat(match[1]), 195, 'b.x should be 100 + 90 + 5');
    assert.strictEqual(parseFloat(match[2]), 97,  'b.y should be 100 + 0 + (-3)');
  });

  it('propagates xshift/yshift to downstream relative nodes', () => {
    const svg = makeSVG();
    render(svg, {
      // Chain: c is placed right-of b, and b's shift must already be baked
      // into the position c anchors against (TikZ coordinate-transform semantics).
      states: {
        a: { position: { x: 0, y: 0 }, label: 'A' },
        b: { position: { right: 'a' }, xshift: 10, yshift: 0, label: 'B' },
        c: { position: { right: 'b' }, label: 'C' },
      },
      edges: [],
    });
    // a: (0, 0); b: (90, 0) + (10, 0) = (100, 0); c: (100, 0) + (90, 0) = (190, 0)
    const nodeC = svg.querySelector('#node-c');
    const match = nodeC.getAttribute('transform').match(/translate\((-?[\d.]+),?\s*(-?[\d.]+)\)/);
    assert.ok(match, 'c should have a translate transform');
    assert.strictEqual(parseFloat(match[1]), 190, 'c.x should include b.xshift propagated');
    assert.strictEqual(parseFloat(match[2]), 0);
  });
});

describe('anchor positioning', () => {
  it('anchor=north west places NW corner at position', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'A',
          shape: 'rectangle',
          radius: 20,
          anchor: 'north west',
        },
      },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    const transform = node.getAttribute('transform');
    const match = transform.match(/translate\(([\d.]+),?\s*([\d.]+)\)/);
    assert.ok(match, 'should have translate');
    const cx = parseFloat(match[1]);
    const cy = parseFloat(match[2]);
    assert.ok(cx > 100, `center x ${cx} should be > 100 (shifted right)`);
    assert.ok(cy > 100, `center y ${cy} should be > 100 (shifted down)`);
  });
});

describe('rotate and per-node scale', () => {
  it('applies rotation to node group', () => {
    const svg = makeSVG();
    render(svg, {
      states: { a: { position: { x: 100, y: 100 }, label: 'R', rotate: 45 } },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    assert.ok(node.getAttribute('transform').includes('rotate(45)'));
  });

  it('applies per-node scale to node group', () => {
    const svg = makeSVG();
    render(svg, {
      states: { a: { position: { x: 100, y: 100 }, label: 'S', nodeScale: 1.5 } },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    assert.ok(node.getAttribute('transform').includes('scale(1.5)'));
  });

  it('combines translate + rotate + scale', () => {
    const svg = makeSVG();
    render(svg, {
      states: { a: { position: { x: 50, y: 50 }, label: 'X', rotate: 30, nodeScale: 2 } },
      edges: [],
    });
    const t = svg.querySelector('#node-a').getAttribute('transform');
    assert.ok(t.includes('translate'));
    assert.ok(t.includes('rotate'));
    assert.ok(t.includes('scale'));
  });
});

describe('textWidth and text wrapping', () => {
  it('wraps text into tspan elements when textWidth is set', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'This is a long label that should wrap',
          shape: 'rectangle',
          textWidth: 80,
        },
      },
      edges: [],
    });
    const tspans = svg.querySelector('#node-a').querySelectorAll('tspan');
    assert.ok(tspans.length > 1, `should have multiple tspans, got ${tspans.length}`);
  });

  it('respects explicit \\\\ line breaks', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'Line 1\\\\Line 2\\\\Line 3',
          shape: 'rectangle',
          textWidth: 200,
        },
      },
      edges: [],
    });
    const tspans = svg.querySelector('#node-a').querySelectorAll('tspan');
    assert.strictEqual(tspans.length, 3);
    assert.strictEqual(tspans[0].textContent, 'Line 1');
    assert.strictEqual(tspans[1].textContent, 'Line 2');
    assert.strictEqual(tspans[2].textContent, 'Line 3');
  });

  it('aligns text left when align=left', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'Short\\\\Longer text',
          shape: 'rectangle',
          textWidth: 120,
          align: 'left',
        },
      },
      edges: [],
    });
    const text = svg.querySelector('#node-a text');
    assert.strictEqual(text.getAttribute('text-anchor'), 'start');
  });

  it('aligns text right when align=right', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: {
          position: { x: 100, y: 100 },
          label: 'A\\\\B',
          shape: 'rectangle',
          textWidth: 120,
          align: 'right',
        },
      },
      edges: [],
    });
    const text = svg.querySelector('#node-a text');
    assert.strictEqual(text.getAttribute('text-anchor'), 'end');
  });

  it('without textWidth renders single line as before', () => {
    const svg = makeSVG();
    render(svg, {
      states: { a: { position: { x: 100, y: 100 }, label: 'Simple' } },
      edges: [],
    });
    const node = svg.querySelector('#node-a');
    assert.strictEqual(node.querySelectorAll('tspan').length, 0);
    assert.strictEqual(node.querySelector('text').textContent, 'Simple');
  });
});
