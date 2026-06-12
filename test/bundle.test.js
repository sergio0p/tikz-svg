import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const BUNDLE = new URL('../dist/tikz-svg.min.js', import.meta.url);
const bundleExists = existsSync(BUNDLE);

let render;
before(async () => {
  if (!bundleExists) return;
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  ({ render } = await import(BUNDLE.href));
});

describe('dist bundle smoke test', { skip: !bundleExists && 'dist/tikz-svg.min.js not built (run npm run build)' }, () => {
  it('renders a basic diagram with nodes, edge, and viewBox', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const refs = render(svg, {
      states: {
        q0: { label: 'q0', initial: true },
        q1: { label: 'q1', position: { right: 'q0' }, accepting: true },
      },
      edges: [{ from: 'q0', to: 'q1', label: 'a' }],
    });
    assert.ok(refs.nodes.q0);
    assert.ok(refs.nodes.q1);
    assert.equal(refs.edges.length, 1);
    const vb = svg.getAttribute('viewBox');
    assert.ok(vb && vb.split(' ').length === 4, 'viewBox should be set');
    assert.ok(svg.querySelectorAll('circle').length >= 2, 'should emit node circles');
  });

  it('honors explicit viewport config in the bundle', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    render(svg, {
      states: { a: { label: 'A' } },
      viewBox: [0, 0, 120, 80],
      width: '100%',
    });
    assert.equal(svg.getAttribute('viewBox'), '0 0 120 80');
    assert.equal(svg.getAttribute('width'), '100%');
  });
});
