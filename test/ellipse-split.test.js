import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getShape } from '../src-v2/shapes/shape.js';
import '../src-v2/shapes/ellipse-split.js';

const shape = getShape('ellipse split');

describe('ellipse split shape', () => {
  describe('savedGeometry', () => {
    it('stores defaults for 2 parts', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20 });
      assert.strictEqual(geom.parts, 2);
      assert.strictEqual(geom.drawSplits, true);
      assert.strictEqual(geom.rx, 30);
      assert.strictEqual(geom.ry, 20);
    });

    it('includes outerSep in radii', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20, outerSep: 2 });
      assert.strictEqual(geom.rx, 32);
      assert.strictEqual(geom.ry, 22);
    });

    it('clamps parts to 1–4', () => {
      assert.strictEqual(shape.savedGeometry({ center: { x: 0, y: 0 }, parts: 0 }).parts, 1);
      assert.strictEqual(shape.savedGeometry({ center: { x: 0, y: 0 }, parts: 5 }).parts, 4);
    });
  });

  describe('anchors', () => {
    const geom = shape.savedGeometry({ center: { x: 100, y: 100 }, rx: 30, ry: 20, parts: 2 });

    it('has compass anchors on the ellipse', () => {
      const north = shape.anchor('north', geom);
      assert.deepStrictEqual(north, { x: 100, y: 80 });

      const east = shape.anchor('east', geom);
      assert.deepStrictEqual(east, { x: 130, y: 100 });

      const south = shape.anchor('south', geom);
      assert.deepStrictEqual(south, { x: 100, y: 120 });
    });

    it('has per-part anchors', () => {
      const one = shape.anchor('one', geom);
      assert.strictEqual(one.x, 100);
      assert.ok(one.y < 100, 'part one should be above center');

      const two = shape.anchor('two', geom);
      assert.ok(two.y > 100, 'part two should be below center');
    });

    it('has text and lower aliases', () => {
      assert.deepStrictEqual(shape.anchor('text', geom), shape.anchor('one', geom));
      assert.deepStrictEqual(shape.anchor('lower', geom), shape.anchor('two', geom));
    });

    it('has split anchors for 2 parts', () => {
      const split = shape.anchor('one split', geom);
      assert.strictEqual(split.y, 100);

      const splitEast = shape.anchor('one split east', geom);
      assert.strictEqual(splitEast.y, 100);
      assert.ok(Math.abs(splitEast.x - 130) < 0.01, 'split east at ellipse edge');
    });

    it('diagonal anchors are on the ellipse', () => {
      const ne = shape.anchor('north east', geom);
      // Verify it's on the ellipse: ((x-cx)/rx)^2 + ((y-cy)/ry)^2 ≈ 1
      const u = (ne.x - 100) / 30;
      const v = (ne.y - 100) / 20;
      assert.ok(Math.abs(u * u + v * v - 1) < 1e-6, 'NE should be on ellipse');
    });
  });

  describe('borderPoint', () => {
    const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20 });

    it('returns point on ellipse', () => {
      const bp = shape.borderPoint(geom, { x: 1, y: 0 });
      assert.ok(Math.abs(bp.x - 30) < 1e-10);
      assert.ok(Math.abs(bp.y - 0) < 1e-10);
    });

    it('border point is on the ellipse boundary', () => {
      const bp = shape.borderPoint(geom, { x: 1, y: 1 });
      const u = bp.x / 30;
      const v = bp.y / 20;
      assert.ok(Math.abs(u * u + v * v - 1) < 1e-6);
    });
  });

  describe('backgroundPath', () => {
    it('contains ellipse arc commands', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20, parts: 2 });
      const path = shape.backgroundPath(geom);
      assert.ok(path.includes('A'), 'should contain arc commands');
      assert.ok(path.includes('Z'), 'should be closed');
    });

    it('includes chord lines for 2 parts', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20, parts: 2 });
      const path = shape.backgroundPath(geom);
      const afterClose = path.split('Z')[1];
      assert.ok(afterClose && afterClose.includes('L'), 'should have chord line');
    });

    it('omits chords when drawSplits is false', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20, parts: 2, drawSplits: false });
      const path = shape.backgroundPath(geom);
      const afterClose = path.split('Z')[1] || '';
      assert.ok(!afterClose.includes('M'), 'should not have chord lines');
    });
  });

  describe('partRegions', () => {
    it('returns one region per part', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20, parts: 3 });
      const regions = shape.partRegions(geom);
      assert.strictEqual(regions.length, 3);
    });

    it('regions cover the full height', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, rx: 30, ry: 20, parts: 2 });
      const regions = shape.partRegions(geom);
      const topY = regions[0].clipRect.y;
      const bottomY = regions[1].clipRect.y + regions[1].clipRect.height;
      assert.ok(Math.abs(topY - (-20)) < 1e-10);
      assert.ok(Math.abs(bottomY - 20) < 1e-10);
    });
  });
});
