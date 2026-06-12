/**
 * Tests for the 2026-06-12 bounding-box upgrades:
 *
 * 1. rotate/scale-aware node transforms in the auto-viewBox
 *    (translate-only parsing used to clip rotated / nodeScale'd nodes)
 * 2. arrow-marker extents included in the bounds
 * 3. per-path `useAsBoundingBox` flag (TikZ §15 `use as bounding box`)
 * 4. transform-less <g> wrappers (initial arrows) contribute their extents
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let render, __testables;
before(async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  ({ render } = await import('../src-v2/index.js'));
  ({ __testables } = await import('../src-v2/svg/emitter.js'));
});

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSVG() {
  return document.createElementNS(SVG_NS, 'svg');
}

function parseViewBox(svg) {
  const [x, y, w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  return { x, y, w, h, right: x + w, bottom: y + h };
}

describe('parseGroupTransform', () => {
  it('parses translate only as identity linear part', () => {
    const m = __testables.parseGroupTransform('translate(10, -5)');
    assert.deepEqual(m, { a: 1, b: 0, c: 0, d: 1, tx: 10, ty: -5 });
  });

  it('parses translate + rotate', () => {
    const m = __testables.parseGroupTransform('translate(0, 0) rotate(90)');
    assert.ok(Math.abs(m.a) < 1e-12 && Math.abs(m.d) < 1e-12);
    assert.ok(Math.abs(m.b - 1) < 1e-12 && Math.abs(m.c + 1) < 1e-12);
  });

  it('parses translate + scale with one and two args', () => {
    const m1 = __testables.parseGroupTransform('translate(1, 2) scale(3)');
    assert.equal(m1.a, 3);
    assert.equal(m1.d, 3);
    const m2 = __testables.parseGroupTransform('translate(1, 2) scale(3, 0.5)');
    assert.equal(m2.a, 3);
    assert.equal(m2.d, 0.5);
  });

  it('composes rotate and scale (scale applied first, SVG order)', () => {
    const m = __testables.parseGroupTransform('translate(0,0) rotate(90) scale(2)');
    // p=(1,0) → scale → (2,0) → rotate90 → (0,2)
    const x = m.a * 1 + m.c * 0;
    const y = m.b * 1 + m.d * 0;
    assert.ok(Math.abs(x) < 1e-12, `x should be 0, got ${x}`);
    assert.ok(Math.abs(y - 2) < 1e-12, `y should be 2, got ${y}`);
  });

  it('returns null for transforms with no recognized component', () => {
    assert.equal(__testables.parseGroupTransform('matrix(1,0,0,1,0,0)'), null);
  });
});

describe('rotate/scale-aware auto viewBox', () => {
  it('nodeScale enlarges the bounds proportionally', () => {
    const small = makeSVG();
    render(small, {
      padding: 0,
      states: { a: { label: 'A', position: { x: 0, y: 0 } } },
    });
    const big = makeSVG();
    render(big, {
      padding: 0,
      states: { a: { label: 'A', position: { x: 0, y: 0 }, nodeScale: 3 } },
    });
    const vbS = parseViewBox(small);
    const vbB = parseViewBox(big);
    // 3× scaled node: content extent should grow by ~3× (padding constant)
    assert.ok(vbB.w > vbS.w * 2,
      `scaled node should widen viewBox: ${vbS.w} → ${vbB.w}`);
  });

  it('rotated rectangle node extends bounds along the rotated diagonal', () => {
    const flat = makeSVG();
    render(flat, {
      states: {
        a: { label: 'WIDE LABEL', shape: 'rectangle', position: { x: 0, y: 0 } },
      },
    });
    const rot = makeSVG();
    render(rot, {
      states: {
        a: { label: 'WIDE LABEL', shape: 'rectangle', position: { x: 0, y: 0 }, rotate: 90 },
      },
    });
    const vbF = parseViewBox(flat);
    const vbR = parseViewBox(rot);
    // A wide rectangle rotated 90° must produce a taller bbox than unrotated
    assert.ok(vbR.h > vbF.h + 5,
      `rotated wide node should be taller: ${vbF.h} → ${vbR.h}`);
    // And its height should be close to the unrotated width (within estimate noise)
    assert.ok(Math.abs(vbR.h - vbF.w) < 10,
      `rotated height ${vbR.h} should approximate unrotated width ${vbF.w}`);
  });
});

describe('marker extents in bounds', () => {
  it('buildMarkerExtentMap maps each marker to a positive radius', () => {
    const svg = makeSVG();
    render(svg, {
      states: {
        a: { label: 'A', position: { x: 0, y: 0 } },
        b: { label: 'B', position: { x: 120, y: 0 } },
      },
      edges: [{ from: 'a', to: 'b' }],
    });
    const map = __testables.buildMarkerExtentMap(svg);
    assert.ok(map.size >= 1, 'at least one marker defined');
    for (const radius of map.values()) {
      assert.ok(radius > 0 && isFinite(radius), `radius should be positive, got ${radius}`);
    }
  });

  it('a free path with an arrow tip gets extra room past the endpoint', () => {
    const plain = makeSVG();
    render(plain, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }],
    });
    const tipped = makeSVG();
    render(tipped, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], arrow: '->' }],
    });
    const vbP = parseViewBox(plain);
    const vbT = parseViewBox(tipped);
    assert.ok(vbT.right > vbP.right,
      `arrow tip should extend right edge: ${vbP.right} → ${vbT.right}`);
  });
});

describe('useAsBoundingBox path flag', () => {
  const scene = () => ({
    states: {
      a: { label: 'A', position: { x: 0, y: 0 } },
      b: { label: 'B', position: { x: 300, y: 200 } },
    },
  });

  it('viewport follows the flagged path exactly (no padding by default)', () => {
    const svg = makeSVG();
    render(svg, {
      ...scene(),
      paths: [{
        points: [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 80 }, { x: 10, y: 80 }],
        cycle: true,
        useAsBoundingBox: true,
        stroke: 'none',
      }],
    });
    const vb = parseViewBox(svg);
    assert.equal(vb.x, 10);
    assert.equal(vb.y, 20);
    assert.equal(vb.w, 100);
    assert.equal(vb.h, 60);
  });

  it('explicit config.padding is honored around the flagged path', () => {
    const svg = makeSVG();
    render(svg, {
      ...scene(),
      padding: 5,
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }],
        cycle: true,
        useAsBoundingBox: true,
        stroke: 'none',
      }],
    });
    const vb = parseViewBox(svg);
    assert.equal(vb.x, -5);
    assert.equal(vb.y, -5);
    assert.equal(vb.w, 110);
    assert.equal(vb.h, 60);
  });

  it('other content may overflow the flagged viewport', () => {
    const svg = makeSVG();
    render(svg, {
      ...scene(),
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }],
        cycle: true,
        useAsBoundingBox: true,
        stroke: 'none',
      }],
    });
    const vb = parseViewBox(svg);
    // node b at (300, 200) lies far outside the 50×50 viewport
    assert.ok(vb.right < 300, `node b should overflow: right edge ${vb.right}`);
  });

  it('config.viewBox still wins over useAsBoundingBox', () => {
    const svg = makeSVG();
    render(svg, {
      ...scene(),
      viewBox: [0, 0, 999, 999],
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
        useAsBoundingBox: true,
        stroke: 'none',
      }],
    });
    assert.equal(svg.getAttribute('viewBox'), '0 0 999 999');
  });

  it('multiple flagged paths union their extents', () => {
    const svg = makeSVG();
    render(svg, {
      ...scene(),
      paths: [
        {
          points: [{ x: 0, y: 0 }, { x: 40, y: 40 }],
          useAsBoundingBox: true,
          stroke: 'none',
        },
        {
          points: [{ x: 200, y: 100 }, { x: 240, y: 140 }],
          useAsBoundingBox: true,
          stroke: 'none',
        },
      ],
    });
    const vb = parseViewBox(svg);
    assert.equal(vb.x, 0);
    assert.equal(vb.y, 0);
    assert.equal(vb.right, 240);
    assert.equal(vb.bottom, 140);
  });
});

describe('initial-arrow group contributes to bounds', () => {
  it('an initial node extends the viewBox toward the arrow', () => {
    const plain = makeSVG();
    render(plain, {
      states: { a: { label: 'A', position: { x: 0, y: 0 } } },
    });
    const withInitial = makeSVG();
    render(withInitial, {
      states: { a: { label: 'A', position: { x: 0, y: 0 }, initial: 'left' } },
    });
    const vbP = parseViewBox(plain);
    const vbI = parseViewBox(withInitial);
    // initial arrow approaches from the left → left edge must move further left
    assert.ok(vbI.x < vbP.x - 10,
      `initial arrow should extend left edge: ${vbP.x} → ${vbI.x}`);
  });
});
