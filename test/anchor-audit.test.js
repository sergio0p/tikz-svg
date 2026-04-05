import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
  document = dom.window.document;
});

describe('mid/base anchors on createShape shapes', () => {
  it('diamond has mid and base anchors', async () => {
    await import('../src-v2/shapes/diamond.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('diamond');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 }, radius: 30, outerSep: 0,
    });
    const mid = shape.anchor('mid', geom);
    const base = shape.anchor('base', geom);
    assert.strictEqual(mid.x, 100);
    assert.strictEqual(mid.y, 50);
    assert.strictEqual(base.x, 100);
    assert.strictEqual(base.y, 50);
  });

  it('diamond has mid east/west and base east/west', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('diamond');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 }, radius: 30, outerSep: 0,
    });
    const midEast = shape.anchor('mid east', geom);
    const midWest = shape.anchor('mid west', geom);
    const baseEast = shape.anchor('base east', geom);
    const baseWest = shape.anchor('base west', geom);
    assert.strictEqual(midEast.y, 50);
    assert.strictEqual(midWest.y, 50);
    assert.strictEqual(baseEast.y, 50);
    assert.strictEqual(baseWest.y, 50);
    assert.ok(midEast.x > 100);
    assert.ok(midWest.x < 100);
  });

  it('trapezium has mid and base anchors', async () => {
    await import('../src-v2/shapes/trapezium.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('trapezium');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 30, halfHeight: 15, outerSep: 0,
    });
    const mid = shape.anchor('mid', geom);
    const base = shape.anchor('base', geom);
    assert.strictEqual(mid.x, 0);
    assert.strictEqual(base.x, 0);
  });

  it('cloud has mid and base anchors', async () => {
    await import('../src-v2/shapes/cloud.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('cloud');
    const geom = shape.savedGeometry({
      center: { x: 50, y: 50 }, rx: 30, ry: 20, outerSep: 0,
    });
    const mid = shape.anchor('mid', geom);
    assert.strictEqual(mid.x, 50);
    assert.strictEqual(mid.y, 50);
  });

  it('preparation has mid and base anchors', async () => {
    await import('../src-v2/shapes/preparation.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    const midEast = shape.anchor('mid east', geom);
    assert.ok(midEast.x > 0);
    assert.strictEqual(midEast.y, 0);
  });
});

describe('mid/base anchors on registerShape shapes', () => {
  it('circle has mid/base anchors', async () => {
    await import('../src-v2/shapes/circle.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('circle');
    const geom = shape.savedGeometry({ center: { x: 50, y: 50 }, radius: 20, outerSep: 0 });
    const mid = shape.anchor('mid', geom);
    const base = shape.anchor('base', geom);
    assert.strictEqual(mid.x, 50);
    assert.strictEqual(base.x, 50);
    const midEast = shape.anchor('mid east', geom);
    assert.ok(midEast.x > 50);
    assert.strictEqual(midEast.y, 50);
  });

  it('rectangle has mid/base anchors', async () => {
    await import('../src-v2/shapes/rectangle.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('rectangle');
    const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 20, outerSep: 0 });
    const midEast = shape.anchor('mid east', geom);
    const baseWest = shape.anchor('base west', geom);
    assert.strictEqual(midEast.x, 40);
    assert.strictEqual(midEast.y, 0);
    assert.strictEqual(baseWest.x, -40);
    assert.strictEqual(baseWest.y, 0);
  });

  it('ellipse has mid/base anchors', async () => {
    await import('../src-v2/shapes/ellipse.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('ellipse');
    const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20, outerSep: 0 });
    const mid = shape.anchor('mid', geom);
    assert.strictEqual(mid.x, 0);
    assert.strictEqual(mid.y, 0);
    const midEast = shape.anchor('mid east', geom);
    assert.strictEqual(midEast.x, 30);
  });

  it('rectangle callout has mid/base anchors', async () => {
    await import('../src-v2/shapes/rectangle-callout.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('rectangle callout');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 20, outerSep: 0,
      calloutPointerOffset: { x: 60, y: 40 },
    });
    const base = shape.anchor('base', geom);
    assert.strictEqual(base.x, 0);
  });

  it('ellipse callout has mid/base anchors', async () => {
    await import('../src-v2/shapes/ellipse-callout.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('ellipse callout');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 30, ry: 20, outerSep: 0,
      calloutPointerOffset: { x: 60, y: 40 },
    });
    const midWest = shape.anchor('mid west', geom);
    assert.ok(midWest.x < 0);
  });

  it('cloud callout has mid/base anchors', async () => {
    await import('../src-v2/shapes/cloud-callout.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('cloud callout');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 30, ry: 20, outerSep: 0,
      calloutPointerOffset: { x: 60, y: 40 },
    });
    const mid = shape.anchor('mid', geom);
    assert.strictEqual(mid.x, 0);
  });
});

describe('corner N / side N anchors on regular polygon', () => {
  it('pentagon has corner 1 through corner 5', async () => {
    await import('../src-v2/shapes/regular-polygon.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    for (let i = 1; i <= 5; i++) {
      const pt = shape.anchor(`corner ${i}`, geom);
      assert.ok(pt, `corner ${i} should exist`);
      const dist = Math.sqrt(pt.x ** 2 + pt.y ** 2);
      assert.ok(Math.abs(dist - 30) < 0.01, `corner ${i} dist=${dist} should be ~30`);
    }
  });

  it('corner 1 of pentagon is at top (90 degrees)', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    const c1 = shape.anchor('corner 1', geom);
    assert.ok(Math.abs(c1.x) < 0.01, `corner 1 x=${c1.x} should be ~0`);
    assert.ok(c1.y < 0, `corner 1 y=${c1.y} should be negative (top)`);
  });

  it('pentagon has side 1 through side 5', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    for (let i = 1; i <= 5; i++) {
      const pt = shape.anchor(`side ${i}`, geom);
      assert.ok(pt, `side ${i} should exist`);
    }
  });

  it('side 1 is midpoint between corner 1 and corner 2', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    const c1 = shape.anchor('corner 1', geom);
    const c2 = shape.anchor('corner 2', geom);
    const s1 = shape.anchor('side 1', geom);
    assert.ok(Math.abs(s1.x - (c1.x + c2.x) / 2) < 0.01);
    assert.ok(Math.abs(s1.y - (c1.y + c2.y) / 2) < 0.01);
  });

  it('hexagon has corner 1 through corner 6 and side 1 through side 6', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 6, outerSep: 0,
    });
    for (let i = 1; i <= 6; i++) {
      assert.ok(shape.anchor(`corner ${i}`, geom), `corner ${i}`);
      assert.ok(shape.anchor(`side ${i}`, geom), `side ${i}`);
    }
  });

  it('corner N throws for N > sides', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('regular polygon');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, radius: 30, sides: 5, outerSep: 0,
    });
    assert.throws(() => shape.anchor('corner 6', geom));
  });
});

describe('corner N / side N anchors on preparation', () => {
  it('has corner 1 through corner 6', async () => {
    await import('../src-v2/shapes/preparation.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    for (let i = 1; i <= 6; i++) {
      const pt = shape.anchor(`corner ${i}`, geom);
      assert.ok(pt, `corner ${i} should exist`);
    }
  });

  it('has side 1 through side 6', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    for (let i = 1; i <= 6; i++) {
      const pt = shape.anchor(`side ${i}`, geom);
      assert.ok(pt, `side ${i} should exist`);
    }
  });

  it('side 1 is midpoint of corner 1 and corner 2', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    const c1 = shape.anchor('corner 1', geom);
    const c2 = shape.anchor('corner 2', geom);
    const s1 = shape.anchor('side 1', geom);
    assert.ok(Math.abs(s1.x - (c1.x + c2.x) / 2) < 0.01);
    assert.ok(Math.abs(s1.y - (c1.y + c2.y) / 2) < 0.01);
  });

  it('corner 7 throws', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    assert.throws(() => shape.anchor('corner 7', geom));
  });
});

describe('trapezium shape-specific anchors', () => {
  it('has corner anchors', async () => {
    await import('../src-v2/shapes/trapezium.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('trapezium');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 30, halfHeight: 15, outerSep: 0,
    });
    for (const name of ['bottom left corner', 'top left corner', 'top right corner', 'bottom right corner']) {
      const pt = shape.anchor(name, geom);
      assert.ok(pt, `${name} should exist`);
    }
  });

  it('has side anchors (midpoints)', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('trapezium');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 30, halfHeight: 15, outerSep: 0,
    });
    for (const name of ['left side', 'right side', 'top side', 'bottom side']) {
      const pt = shape.anchor(name, geom);
      assert.ok(pt, `${name} should exist`);
    }
  });

  it('top side is midpoint of top left and top right corners', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('trapezium');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 30, halfHeight: 15, outerSep: 0,
    });
    const tl = shape.anchor('top left corner', geom);
    const tr = shape.anchor('top right corner', geom);
    const ts = shape.anchor('top side', geom);
    assert.ok(Math.abs(ts.x - (tl.x + tr.x) / 2) < 0.01);
    assert.ok(Math.abs(ts.y - (tl.y + tr.y) / 2) < 0.01);
  });
});
