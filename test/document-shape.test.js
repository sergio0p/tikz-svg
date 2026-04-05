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

describe('document shape', () => {
  it('registers and returns geometry', async () => {
    await import('../src-v2/shapes/document.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 },
      halfWidth: 40, halfHeight: 25, outerSep: 0,
    });
    assert.ok(geom.center);
    assert.strictEqual(geom.halfWidth, 40);
    assert.strictEqual(geom.halfHeight, 25);
    assert.ok(geom.bendHeight >= 0);
  });

  it('backgroundPath contains cubic Bézier (C command)', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25, outerSep: 0,
    });
    const path = shape.backgroundPath(geom);
    assert.ok(path.includes('C'), 'should have cubic Bézier for wavy bottom');
    assert.ok(path.endsWith('Z'), 'path should be closed');
  });

  it('has standard anchors', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const names = shape.anchors();
    for (const a of ['center', 'north', 'south', 'east', 'west']) {
      assert.ok(names.includes(a), `missing anchor: ${a}`);
    }
  });

  it('south anchor accounts for bend height', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25,
      outerSep: 0, bendHeight: 10,
    });
    const south = shape.anchor('south', geom);
    assert.ok(south.y > 25, `south.y (${south.y}) should exceed halfHeight (25)`);
  });

  it('stores all config inputs in geom for emitter re-call', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 50, y: 50 }, halfWidth: 40, halfHeight: 25,
      outerSep: 0, bendHeight: 8,
    });
    const geom2 = shape.savedGeometry({ ...geom, center: { x: 0, y: 0 } });
    assert.strictEqual(geom2.halfWidth, geom.halfWidth);
    assert.strictEqual(geom2.halfHeight, geom.halfHeight);
    assert.strictEqual(geom2.bendHeight, geom.bendHeight);
  });
});
