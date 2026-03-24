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
    console.log('jsdom not available — skipping pipeline transform tests');
    process.exit(0);
  }
});

/** Parse translate(x, y) from a transform attribute string. */
function parseTranslate(transformStr) {
  const m = transformStr.match(/translate\(([-\d.e+]+),?\s*([-\d.e+]+)\)/);
  if (!m) throw new Error(`No translate found in: ${transformStr}`);
  return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
}

function assertClose(actual, expected, tolerance, msg) {
  assert.ok(Math.abs(actual - expected) < tolerance,
    `${msg}: got ${actual}, expected ~${expected}`);
}

describe('Pipeline transform', () => {
  it('global transform translates all node positions', async () => {
    const { render } = await import('../src-v2/index.js');
    const { Transform } = await import('../src-v2/core/transform.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const refs = render(svg, {
      transform: new Transform().translate(100, 200),
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { x: 50, y: 0 } },
      },
      edges: [{ from: 'q0', to: 'q1' }],
    });

    const q0Pos = parseTranslate(refs.nodes.q0.getAttribute('transform'));
    assert.strictEqual(q0Pos.x, 100);
    assert.strictEqual(q0Pos.y, 200);

    const q1Pos = parseTranslate(refs.nodes.q1.getAttribute('transform'));
    assert.strictEqual(q1Pos.x, 150);
    assert.strictEqual(q1Pos.y, 200);
  });

  it('global transform rotates positions', async () => {
    const { render } = await import('../src-v2/index.js');
    const { Transform } = await import('../src-v2/core/transform.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const t = new Transform().rotate(90);
    const expected = t.apply({ x: 50, y: 0 });

    const refs = render(svg, {
      transform: t,
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { x: 50, y: 0 } },
      },
      edges: [],
    });

    const q1Pos = parseTranslate(refs.nodes.q1.getAttribute('transform'));
    assertClose(q1Pos.x, expected.x, 0.01, 'q1 x after 90° rotation');
    assertClose(q1Pos.y, expected.y, 0.01, 'q1 y after 90° rotation');
  });

  it('group transform applies only to group members', async () => {
    const { render } = await import('../src-v2/index.js');
    const { Transform } = await import('../src-v2/core/transform.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const refs = render(svg, {
      groups: [
        { nodes: ['q1'], transform: new Transform().translate(100, 0) },
      ],
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { x: 50, y: 0 } },
      },
      edges: [],
    });

    const q0Pos = parseTranslate(refs.nodes.q0.getAttribute('transform'));
    assert.strictEqual(q0Pos.x, 0);
    assert.strictEqual(q0Pos.y, 0);

    const q1Pos = parseTranslate(refs.nodes.q1.getAttribute('transform'));
    assert.strictEqual(q1Pos.x, 150);
    assert.strictEqual(q1Pos.y, 0);
  });

  it('works with no transform (backward compat)', async () => {
    const { render } = await import('../src-v2/index.js');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);

    const refs = render(svg, {
      states: {
        q0: { position: { x: 10, y: 20 } },
      },
      edges: [],
    });

    const q0Pos = parseTranslate(refs.nodes.q0.getAttribute('transform'));
    assert.strictEqual(q0Pos.x, 10);
    assert.strictEqual(q0Pos.y, 20);
  });
});
