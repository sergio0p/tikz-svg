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

describe('preparation shape', () => {
  it('registers and returns geometry', async () => {
    await import('../src-v2/shapes/preparation.js');
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 100, y: 50 },
      halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    assert.ok(geom.center);
    assert.strictEqual(geom.halfWidth, 50);
    assert.strictEqual(geom.halfHeight, 20);
  });

  it('produces a 6-vertex closed SVG path', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    const path = shape.backgroundPath(geom);
    assert.ok(path.startsWith('M'), 'path starts with M');
    assert.ok(path.endsWith('Z'), 'path ends with Z');
    const lineCount = (path.match(/L /g) || []).length;
    assert.strictEqual(lineCount, 5, 'should have 5 L commands (6 vertices total)');
  });

  it('has standard anchors', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const names = shape.anchors();
    for (const a of ['center', 'north', 'south', 'east', 'west']) {
      assert.ok(names.includes(a), `missing anchor: ${a}`);
    }
  });

  it('east and west anchors are at the points', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 50, halfHeight: 20, outerSep: 0,
    });
    const east = shape.anchor('east', geom);
    const west = shape.anchor('west', geom);
    assert.strictEqual(east.y, 0, 'east anchor at center y');
    assert.strictEqual(west.y, 0, 'west anchor at center y');
    assert.ok(east.x > west.x, 'east.x > west.x');
  });

  it('stores all config inputs in geom for emitter re-call', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('preparation');
    const geom = shape.savedGeometry({
      center: { x: 50, y: 50 }, halfWidth: 50, halfHeight: 20,
      outerSep: 0, pointWidth: 15,
    });
    const geom2 = shape.savedGeometry({ ...geom, center: { x: 0, y: 0 } });
    assert.strictEqual(geom2.halfWidth, geom.halfWidth);
    assert.strictEqual(geom2.halfHeight, geom.halfHeight);
    assert.strictEqual(geom2.pointWidth, geom.pointWidth);
  });
});
