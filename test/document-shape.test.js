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

describe('document (tape) shape', () => {
  it('registers and returns geometry with default keys', async () => {
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
    assert.strictEqual(geom.tapeBendTop, 'none');
    assert.strictEqual(geom.tapeBendBottom, 'in and out');
    assert.strictEqual(geom.tapeBendHeight, 5);
    assert.strictEqual(geom.halfBendHeight, 2.5);
  });

  it('computes TikZ arc radii correctly', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25,
      outerSep: 0, tapeBendHeight: 10,
    });
    // bendxradius = cos(45°) × halfWidth = 0.707106 × 40 ≈ 28.284
    assert.ok(Math.abs(geom.bendxradius - 0.707106 * 40) < 0.01);
    // bendyradius = 3.414213 × halfBendHeight = 3.414213 × 5 ≈ 17.071
    assert.ok(Math.abs(geom.bendyradius - 3.414213 * 5) < 0.01);
  });

  it('backgroundPath uses elliptical arcs (A command) for bottom bend', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25, outerSep: 0,
    });
    const path = shape.backgroundPath(geom);
    assert.ok(path.includes('A'), 'should have elliptical arc for wavy bottom');
    assert.ok(path.endsWith('Z'), 'path should be closed');
  });

  it('backgroundPath is straight when both bends are none', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25, outerSep: 0,
      tapeBendTop: 'none', tapeBendBottom: 'none',
    });
    const path = shape.backgroundPath(geom);
    assert.ok(!path.includes('A'), 'no arcs when both bends are none');
    // Should be a plain rectangle: M, L, L, L, L, Z
    const segments = path.trim().split(/\s*(?=[MLZ])/);
    assert.ok(segments.length >= 5, 'should have at least 5 path segments');
  });

  it('backgroundPath has arcs on both sides when both are in-and-out', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25, outerSep: 0,
      tapeBendTop: 'in and out', tapeBendBottom: 'in and out',
    });
    const path = shape.backgroundPath(geom);
    const arcCount = (path.match(/A /g) || []).length;
    assert.strictEqual(arcCount, 4, 'should have 4 arcs (2 per side × 2 sides)');
  });

  it('supports out-and-in bend style', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25, outerSep: 0,
      tapeBendTop: 'out and in', tapeBendBottom: 'out and in',
    });
    const path = shape.backgroundPath(geom);
    const arcCount = (path.match(/A /g) || []).length;
    assert.strictEqual(arcCount, 4, 'should have 4 arcs for out-and-in');
  });

  it('has all standard anchors plus mid/base', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const names = shape.anchors();
    for (const a of ['center', 'mid', 'base', 'north', 'south', 'east', 'west',
                      'north east', 'north west', 'south east', 'south west',
                      'mid east', 'mid west', 'base east', 'base west']) {
      assert.ok(names.includes(a), `missing anchor: ${a}`);
    }
  });

  it('south anchor extends beyond halfHeight when bottom bends', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25,
      outerSep: 0, tapeBendBottom: 'in and out', tapeBendHeight: 10,
    });
    const south = shape.anchor('south', geom);
    assert.ok(south.y > 25, `south.y (${south.y}) should exceed halfHeight (25)`);
  });

  it('north anchor extends beyond halfHeight when top bends', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25,
      outerSep: 0, tapeBendTop: 'in and out', tapeBendHeight: 10,
    });
    const north = shape.anchor('north', geom);
    assert.ok(north.y < -25, `north.y (${north.y}) should be less than -halfHeight (-25)`);
  });

  it('stores all config inputs in geom for emitter re-call', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const geom = shape.savedGeometry({
      center: { x: 50, y: 50 }, halfWidth: 40, halfHeight: 25,
      outerSep: 0, tapeBendTop: 'out and in', tapeBendBottom: 'in and out',
      tapeBendHeight: 8,
    });
    const geom2 = shape.savedGeometry({ ...geom, center: { x: 0, y: 0 } });
    assert.strictEqual(geom2.halfWidth, geom.halfWidth);
    assert.strictEqual(geom2.halfHeight, geom.halfHeight);
    assert.strictEqual(geom2.tapeBendTop, 'out and in');
    assert.strictEqual(geom2.tapeBendBottom, 'in and out');
    assert.strictEqual(geom2.tapeBendHeight, 8);
  });

  it('custom tapeBendHeight changes arc radii', async () => {
    const { getShape } = await import('../src-v2/shapes/shape.js');
    const shape = getShape('document');
    const g1 = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25,
      outerSep: 0, tapeBendHeight: 5,
    });
    const g2 = shape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 40, halfHeight: 25,
      outerSep: 0, tapeBendHeight: 20,
    });
    assert.ok(g2.bendyradius > g1.bendyradius, 'larger bend height → larger bendyradius');
    assert.strictEqual(g1.bendxradius, g2.bendxradius, 'bendxradius depends only on halfWidth');
  });
});
