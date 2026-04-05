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

describe('parallelogram shape', () => {
  it('registers and returns geometry', async () => {
    await import('../src-v2/shapes/parallelogram.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 },
      halfWidth: 40, halfHeight: 20, outerSep: 0,
    });
    assert.ok(geom.center);
    assert.strictEqual(geom.halfWidth, 40);
    assert.strictEqual(geom.halfHeight, 20);
    assert.strictEqual(geom.leftAngle, 120);
    assert.strictEqual(geom.rightAngle, 60);
  });

  it('produces a closed SVG path', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 20, outerSep: 0,
    });
    const path = shape.backgroundPath(geom);
    assert.ok(path.startsWith('M'), 'path starts with M');
    assert.ok(path.endsWith('Z'), 'path ends with Z');
  });

  it('has standard anchors', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    const names = shape.anchors();
    for (const a of ['center', 'north', 'south', 'east', 'west']) {
      assert.ok(names.includes(a), `missing anchor: ${a}`);
    }
  });

  it('borderPoint returns point on boundary', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 20, outerSep: 0,
    });
    const pt = shape.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(pt.x > 0, 'east border should be positive x');
  });

  it('stores all config inputs in geom for emitter re-call', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('parallelogram');
    // With outerSep=0, re-call produces identical geometry
    const geom = shape.savedGeometry({
      center: { x: 50, y: 50 }, halfWidth: 30, halfHeight: 15, outerSep: 0,
    });
    const geom2 = shape.savedGeometry({ ...geom, center: { x: 0, y: 0 } });
    assert.strictEqual(geom2.halfWidth, geom.halfWidth);
    assert.strictEqual(geom2.halfHeight, geom.halfHeight);
    assert.strictEqual(geom2.leftAngle, 120);
    assert.strictEqual(geom2.rightAngle, 60);
  });
});
