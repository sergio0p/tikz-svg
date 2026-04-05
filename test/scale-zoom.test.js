/**
 * Tests that scale/scaleX/scaleY cause the SVG element to grow,
 * matching TikZ behavior where scale makes the picture physically larger.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

let JSDOM, document;

before(async () => {
  try {
    const jsdom = await import('jsdom');
    JSDOM = jsdom.JSDOM;
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    globalThis.document = document;
  } catch {
    console.log('jsdom not available — skipping scale-zoom tests');
    process.exit(0);
  }
});

function makeSvg() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

// Spread nodes in both x and y so scale affects both dimensions.
// Large spread relative to padding (40px) so ratio is clearly > 1.
const basicConfig = {
  states: {
    q0: { position: { x: 0, y: 0 } },
    q1: { position: { x: 200, y: 0 } },
    q2: { position: { x: 100, y: 200 } },
  },
  edges: [{ from: 'q0', to: 'q1', label: 'a' }],
};

describe('scale → SVG element sizing', () => {
  it('scale=1 does not set explicit width/height', async () => {
    const { render } = await import('../src-v2/index.js');
    const svg = makeSvg();
    render(svg, { ...basicConfig, scale: 1 });

    assert.ok(svg.getAttribute('viewBox'), 'viewBox should be set');
    assert.strictEqual(svg.getAttribute('width'), null, 'width should not be set at scale=1');
    assert.strictEqual(svg.getAttribute('height'), null, 'height should not be set at scale=1');
  });

  it('scale=2 sets width/height matching the (expanded) viewBox', async () => {
    const { render } = await import('../src-v2/index.js');
    const svg = makeSvg();
    render(svg, { ...basicConfig, scale: 2 });

    const vb = svg.getAttribute('viewBox');
    assert.ok(vb, 'viewBox should be set');
    const [, , vbW, vbH] = vb.split(/\s+/).map(Number);

    const w = Number(svg.getAttribute('width'));
    const h = Number(svg.getAttribute('height'));
    assert.strictEqual(w, vbW, 'width should equal viewBox width');
    assert.strictEqual(h, vbH, 'height should equal viewBox height');
  });

  it('scale=2 produces a larger SVG element than scale=1', async () => {
    const { render } = await import('../src-v2/index.js');

    const svg1 = makeSvg();
    render(svg1, { ...basicConfig, scale: 1 });
    const vb1 = svg1.getAttribute('viewBox').split(/\s+/).map(Number);

    const svg2 = makeSvg();
    render(svg2, { ...basicConfig, scale: 2 });
    const vb2 = svg2.getAttribute('viewBox').split(/\s+/).map(Number);

    // Coordinates are 2× apart → viewBox is larger (not exactly 2× due to
    // constant padding, but clearly bigger).  Element width/height track it.
    assert.ok(vb2[2] > vb1[2] * 1.4,
      `scaled viewBox width (${vb2[2]}) should be clearly larger than unscaled (${vb1[2]})`);
    assert.ok(vb2[3] > vb1[3] * 1.4,
      `scaled viewBox height (${vb2[3]}) should be clearly larger than unscaled (${vb1[3]})`);
  });

  it('scaleX=2 makes width larger but height stays similar', async () => {
    const { render } = await import('../src-v2/index.js');

    const svg1 = makeSvg();
    render(svg1, { ...basicConfig, scale: 1 });
    const vb1 = svg1.getAttribute('viewBox').split(/\s+/).map(Number);

    const svg2 = makeSvg();
    render(svg2, { ...basicConfig, scaleX: 2 });
    const vb2 = svg2.getAttribute('viewBox').split(/\s+/).map(Number);

    const wRatio = vb2[2] / vb1[2];
    const hRatio = vb2[3] / vb1[3];
    assert.ok(wRatio > 1.3, `width ratio should be >1.3, got ${wRatio.toFixed(2)}`);
    assert.ok(hRatio < 1.2, `height ratio should be ~1, got ${hRatio.toFixed(2)}`);

    // Element dimensions should match viewBox
    assert.strictEqual(Number(svg2.getAttribute('width')), vb2[2]);
    assert.strictEqual(Number(svg2.getAttribute('height')), vb2[3]);
  });

  it('scaleY=2 makes height larger but width stays similar', async () => {
    const { render } = await import('../src-v2/index.js');

    const svg1 = makeSvg();
    render(svg1, { ...basicConfig, scale: 1 });
    const vb1 = svg1.getAttribute('viewBox').split(/\s+/).map(Number);

    const svg2 = makeSvg();
    render(svg2, { ...basicConfig, scaleY: 2 });
    const vb2 = svg2.getAttribute('viewBox').split(/\s+/).map(Number);

    const wRatio = vb2[2] / vb1[2];
    const hRatio = vb2[3] / vb1[3];
    assert.ok(wRatio < 1.2, `width ratio should be ~1, got ${wRatio.toFixed(2)}`);
    assert.ok(hRatio > 1.3, `height ratio should be >1.3, got ${hRatio.toFixed(2)}`);

    assert.strictEqual(Number(svg2.getAttribute('width')), vb2[2]);
    assert.strictEqual(Number(svg2.getAttribute('height')), vb2[3]);
  });

  it('font size and stroke width stay constant across scale values', async () => {
    const { render } = await import('../src-v2/index.js');

    const svg1 = makeSvg();
    render(svg1, { ...basicConfig, scale: 1 });

    const svg2 = makeSvg();
    render(svg2, { ...basicConfig, scale: 2 });

    // Font sizes should be identical
    const text1 = svg1.querySelector('text');
    const text2 = svg2.querySelector('text');
    assert.ok(text1 && text2, 'both should have text elements');
    assert.strictEqual(
      text1.getAttribute('font-size'),
      text2.getAttribute('font-size'),
      'font size should not change with scale'
    );

    // Stroke widths should be identical
    const path1 = svg1.querySelector('.edge-layer path, .draw-layer path');
    const path2 = svg2.querySelector('.edge-layer path, .draw-layer path');
    if (path1 && path2) {
      assert.strictEqual(
        path1.getAttribute('stroke-width'),
        path2.getAttribute('stroke-width'),
        'stroke width should not change with scale'
      );
    }
  });
});

describe('transformCanvas → uniform visual scaling', () => {
  it('wraps content in a <g transform="scale(...)"> element', async () => {
    const { render } = await import('../src-v2/index.js');
    const svg = makeSvg();
    render(svg, { ...basicConfig, transformCanvas: { scale: 2 } });

    const wrapper = svg.querySelector('g[transform]');
    assert.ok(wrapper, 'should have a transform wrapper');
    assert.strictEqual(wrapper.getAttribute('transform'), 'scale(2)');
  });

  it('does not wrap when transformCanvas is absent', async () => {
    const { render } = await import('../src-v2/index.js');
    const svg = makeSvg();
    render(svg, basicConfig);

    // The top-level <g> elements should be layers, not a scale wrapper
    const topGs = Array.from(svg.querySelectorAll(':scope > g'));
    for (const g of topGs) {
      const t = g.getAttribute('transform');
      assert.ok(!t || !t.includes('scale'), 'no scale wrapper without transformCanvas');
    }
  });

  it('adjusts viewBox to encompass scaled content', async () => {
    const { render } = await import('../src-v2/index.js');

    const svg1 = makeSvg();
    render(svg1, basicConfig);
    const vb1 = svg1.getAttribute('viewBox').split(/\s+/).map(Number);

    const svg2 = makeSvg();
    render(svg2, { ...basicConfig, transformCanvas: { scale: 2 } });
    const vb2 = svg2.getAttribute('viewBox').split(/\s+/).map(Number);

    // viewBox should be 2× in both dimensions
    assert.ok(Math.abs(vb2[2] - vb1[2] * 2) < 0.01,
      `width should be 2×: got ${vb2[2]}, expected ${vb1[2] * 2}`);
    assert.ok(Math.abs(vb2[3] - vb1[3] * 2) < 0.01,
      `height should be 2×: got ${vb2[3]}, expected ${vb1[3] * 2}`);
  });

  it('supports independent scaleX/scaleY', async () => {
    const { render } = await import('../src-v2/index.js');
    const svg = makeSvg();
    render(svg, { ...basicConfig, transformCanvas: { scaleX: 3, scaleY: 1.5 } });

    const wrapper = svg.querySelector('g[transform]');
    assert.strictEqual(wrapper.getAttribute('transform'), 'scale(3,1.5)');
  });

  it('does not set explicit width/height (element stays same size)', async () => {
    const { render } = await import('../src-v2/index.js');
    const svg = makeSvg();
    render(svg, { ...basicConfig, transformCanvas: { scale: 2 } });

    // transformCanvas alone should not set width/height (only scale does that)
    assert.strictEqual(svg.getAttribute('width'), null);
    assert.strictEqual(svg.getAttribute('height'), null);
  });
});
