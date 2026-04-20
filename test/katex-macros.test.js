import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let document;
let capturedOptions;

// Stub window.katex before importing any src-v2 module that branches on
// isKaTeXAvailable(). The stub records the options passed to renderToString
// so tests can assert macros were threaded through.
before(async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  document = dom.window.document;

  capturedOptions = [];
  dom.window.katex = {
    renderToString(tex, opts) {
      capturedOptions.push({ tex, opts });
      // Minimal HTML that emitter can hold without error.
      return `<span class="katex">${tex}</span>`;
    },
  };
});

beforeEach(() => {
  capturedOptions.length = 0;
});

describe('config.katexMacros', () => {
  it('passes user macros to KaTeX for node labels', async () => {
    const { render } = await import('../src-v2/index.js');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    render(svg, {
      katexMacros: { '\\pay': '\\phantom{-}#1,#2' },
      states: {
        a: { position: { x: 0, y: 0 }, label: '$\\pay 1 2$' },
      },
      edges: [],
    });

    const mathCalls = capturedOptions.filter(c => c.tex.includes('\\pay'));
    assert.ok(mathCalls.length > 0, 'katex.renderToString should be called for $...$');
    const opts = mathCalls[0].opts;
    assert.ok(opts.macros, 'macros option should be present');
    assert.strictEqual(opts.macros['\\pay'], '\\phantom{-}#1,#2');
  });

  it('defaults to an empty macros object when config.katexMacros is absent', async () => {
    const { render } = await import('../src-v2/index.js');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    render(svg, {
      states: {
        a: { position: { x: 0, y: 0 }, label: '$x^2$' },
      },
      edges: [],
    });

    const mathCalls = capturedOptions.filter(c => c.tex === 'x^2');
    assert.ok(mathCalls.length > 0, 'katex.renderToString should be called');
    assert.deepStrictEqual(mathCalls[0].opts.macros, {});
  });

  it('resets macros between renders (macros from a previous call do not leak)', async () => {
    const { render } = await import('../src-v2/index.js');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    // First render: set a macro.
    render(svg, {
      katexMacros: { '\\foo': 'BAR' },
      states: { a: { position: { x: 0, y: 0 }, label: '$\\foo$' } },
      edges: [],
    });

    capturedOptions.length = 0;

    // Second render: no macros. Previous macro must not carry over.
    render(svg, {
      states: { a: { position: { x: 0, y: 0 }, label: '$\\foo$' } },
      edges: [],
    });

    const mathCalls = capturedOptions.filter(c => c.tex === '\\foo');
    assert.ok(mathCalls.length > 0);
    assert.deepStrictEqual(mathCalls[0].opts.macros, {}, 'should reset between renders');
  });
});
