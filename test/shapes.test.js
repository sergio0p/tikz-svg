import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import circleShape from '../src-v2/shapes/circle.js';
import rectangleShape from '../src-v2/shapes/rectangle.js';
import ellipseShape from '../src-v2/shapes/ellipse.js';
import { getShape } from '../src-v2/shapes/shape.js';

const SQRT1_2 = Math.SQRT1_2;
const near = (a, b, eps = 0.001) => Math.abs(a - b) < eps;

describe('Shape registry', () => {
  it('circle is registered', () => {
    assert.strictEqual(getShape('circle'), circleShape);
  });
  it('rectangle is registered', () => {
    assert.strictEqual(getShape('rectangle'), rectangleShape);
  });
  it('ellipse is registered', () => {
    assert.strictEqual(getShape('ellipse'), ellipseShape);
  });
  it('throws on unknown shape', () => {
    assert.throws(() => getShape('hexagon'), /unknown shape/);
  });
});

describe('Circle', () => {
  const geom = circleShape.savedGeometry({ center: { x: 100, y: 200 }, radius: 20 });

  it('savedGeometry returns correct values', () => {
    assert.deepStrictEqual(geom.center, { x: 100, y: 200 });
    assert.strictEqual(geom.radius, 20);
  });

  it('center anchor', () => {
    const p = circleShape.anchor('center', geom);
    assert.deepStrictEqual(p, { x: 100, y: 200 });
  });

  it('cardinal anchors', () => {
    const n = circleShape.anchor('north', geom);
    assert.ok(near(n.x, 100) && near(n.y, 180)); // y - r
    const s = circleShape.anchor('south', geom);
    assert.ok(near(s.x, 100) && near(s.y, 220)); // y + r
    const e = circleShape.anchor('east', geom);
    assert.ok(near(e.x, 120) && near(e.y, 200));
    const w = circleShape.anchor('west', geom);
    assert.ok(near(w.x, 80) && near(w.y, 200));
  });

  it('diagonal anchors', () => {
    const ne = circleShape.anchor('north east', geom);
    assert.ok(near(ne.x, 100 + 20 * SQRT1_2));
    assert.ok(near(ne.y, 200 - 20 * SQRT1_2));
  });

  it('numeric angle 0 = east', () => {
    const p = circleShape.anchor('0', geom);
    assert.ok(near(p.x, 120) && near(p.y, 200));
  });

  it('numeric angle 90 = north (up in SVG)', () => {
    const p = circleShape.anchor('90', geom);
    assert.ok(near(p.x, 100) && near(p.y, 180));
  });

  it('borderPoint direction (1,0) = east', () => {
    const p = circleShape.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(near(p.x, 120) && near(p.y, 200));
  });

  it('borderPoint 45° direction', () => {
    const p = circleShape.borderPoint(geom, { x: 1, y: -1 });
    assert.ok(near(p.x, 100 + 20 * SQRT1_2));
    assert.ok(near(p.y, 200 - 20 * SQRT1_2));
  });

  it('backgroundPath is a valid SVG arc path', () => {
    const path = circleShape.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
    assert.ok(path.includes('A'));
    assert.ok(path.endsWith('Z'));
  });

  it('anchors() returns all anchor names', () => {
    const names = circleShape.anchors();
    assert.ok(names.includes('center'));
    assert.ok(names.includes('north east'));
    assert.ok(names.length >= 9);
  });
});

describe('Rectangle', () => {
  const geom = rectangleShape.savedGeometry({
    center: { x: 100, y: 200 },
    halfWidth: 40,
    halfHeight: 25,
  });

  it('savedGeometry', () => {
    assert.deepStrictEqual(geom.center, { x: 100, y: 200 });
    assert.strictEqual(geom.halfWidth, 40);
    assert.strictEqual(geom.halfHeight, 25);
  });

  it('cardinal anchors', () => {
    assert.deepStrictEqual(rectangleShape.anchor('north', geom), { x: 100, y: 175 });
    assert.deepStrictEqual(rectangleShape.anchor('south', geom), { x: 100, y: 225 });
    assert.deepStrictEqual(rectangleShape.anchor('east', geom), { x: 140, y: 200 });
    assert.deepStrictEqual(rectangleShape.anchor('west', geom), { x: 60, y: 200 });
  });

  it('corner anchors', () => {
    assert.deepStrictEqual(rectangleShape.anchor('north east', geom), { x: 140, y: 175 });
    assert.deepStrictEqual(rectangleShape.anchor('south west', geom), { x: 60, y: 225 });
  });

  it('borderPoint (1,0) = east edge midpoint', () => {
    const p = rectangleShape.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(near(p.x, 140) && near(p.y, 200));
  });

  it('borderPoint (1,1) hits correct edge based on aspect ratio', () => {
    // hw=40, hh=25, direction (1,1): tVert = 40/1 = 40, tHoriz = 25/1 = 25
    // hits horizontal edge first (top/bottom), t = 25
    const p = rectangleShape.borderPoint(geom, { x: 1, y: 1 });
    assert.ok(near(p.x, 125)); // 100 + 1*25
    assert.ok(near(p.y, 225)); // 200 + 1*25
  });

  it('borderPoint (0,1) = south', () => {
    const p = rectangleShape.borderPoint(geom, { x: 0, y: 1 });
    assert.ok(near(p.x, 100) && near(p.y, 225));
  });
});

describe('Ellipse', () => {
  const geom = ellipseShape.savedGeometry({
    center: { x: 100, y: 200 },
    rx: 40,
    ry: 20,
  });

  it('savedGeometry', () => {
    assert.strictEqual(geom.rx, 40);
    assert.strictEqual(geom.ry, 20);
  });

  it('cardinal anchors', () => {
    assert.deepStrictEqual(ellipseShape.anchor('east', geom), { x: 140, y: 200 });
    assert.deepStrictEqual(ellipseShape.anchor('north', geom), { x: 100, y: 180 });
  });

  it('borderPoint at 0° = east', () => {
    const p = ellipseShape.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(near(p.x, 140) && near(p.y, 200));
  });

  it('borderPoint at 45° is on ellipse (not circle)', () => {
    const p = ellipseShape.borderPoint(geom, { x: 1, y: -1 });
    // Should be on the ellipse, not at 45° on a circle
    const dx = p.x - 100;
    const dy = p.y - 200;
    // Verify it's on the ellipse: (dx/rx)^2 + (dy/ry)^2 ≈ 1
    const ellipseEq = (dx / 40) ** 2 + (dy / 20) ** 2;
    assert.ok(near(ellipseEq, 1.0, 0.01));
  });
});
