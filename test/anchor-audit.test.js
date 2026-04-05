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
