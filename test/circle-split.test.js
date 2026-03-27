import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getShape } from '../src-v2/shapes/shape.js';
import '../src-v2/shapes/circle-split.js';

const shape = getShape('circle split');

describe('circle split shape', () => {
  describe('savedGeometry', () => {
    it('stores defaults for 2 parts', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20 });
      assert.strictEqual(geom.parts, 2);
      assert.strictEqual(geom.drawSplits, true);
      assert.strictEqual(geom.radius, 20);
    });

    it('includes outerSep in radius', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20, outerSep: 2 });
      assert.strictEqual(geom.radius, 22);
      assert.strictEqual(geom.outerSep, 2);
    });

    it('clamps parts to 1–4', () => {
      assert.strictEqual(shape.savedGeometry({ center: { x: 0, y: 0 }, parts: 0 }).parts, 1);
      assert.strictEqual(shape.savedGeometry({ center: { x: 0, y: 0 }, parts: 7 }).parts, 4);
    });
  });

  describe('anchors', () => {
    const geom = shape.savedGeometry({ center: { x: 100, y: 100 }, radius: 20, parts: 2 });

    it('has compass anchors on the circle', () => {
      const north = shape.anchor('north', geom);
      assert.deepStrictEqual(north, { x: 100, y: 80 });

      const east = shape.anchor('east', geom);
      assert.deepStrictEqual(east, { x: 120, y: 100 });
    });

    it('has per-part anchors', () => {
      const one = shape.anchor('one', geom);
      assert.strictEqual(one.x, 100);
      assert.ok(one.y < 100, 'part one should be above center for 2 parts');

      const two = shape.anchor('two', geom);
      assert.strictEqual(two.x, 100);
      assert.ok(two.y > 100, 'part two should be below center for 2 parts');
    });

    it('has text and lower aliases', () => {
      const text = shape.anchor('text', geom);
      const one = shape.anchor('one', geom);
      assert.deepStrictEqual(text, one);

      const lower = shape.anchor('lower', geom);
      const two = shape.anchor('two', geom);
      assert.deepStrictEqual(lower, two);
    });

    it('has split anchors for 2 parts (chord at center)', () => {
      const split = shape.anchor('one split', geom);
      assert.strictEqual(split.y, 100); // chord at center for 2 parts
      assert.strictEqual(split.x, 100);

      const splitEast = shape.anchor('one split east', geom);
      assert.strictEqual(splitEast.y, 100);
      assert.ok(Math.abs(splitEast.x - 120) < 0.01, 'split east should be at circle edge');
    });

    it('has split anchors for 3 parts', () => {
      const geom3 = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20, parts: 3 });
      const s1 = shape.anchor('one split', geom3);
      const s2 = shape.anchor('two split', geom3);
      assert.ok(s1.y < 0, 'first chord above center for 3 parts');
      assert.ok(s2.y > 0, 'second chord below center for 3 parts');
    });
  });

  describe('borderPoint', () => {
    const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20 });

    it('returns point on circle', () => {
      const bp = shape.borderPoint(geom, { x: 1, y: 0 });
      assert.ok(Math.abs(bp.x - 20) < 1e-10);
      assert.ok(Math.abs(bp.y - 0) < 1e-10);
    });
  });

  describe('backgroundPath', () => {
    it('contains circle arc commands', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20, parts: 2 });
      const path = shape.backgroundPath(geom);
      assert.ok(path.includes('A'), 'should contain arc commands');
      assert.ok(path.includes('Z'), 'should be closed');
    });

    it('includes chord lines when drawSplits is true', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20, parts: 2 });
      const path = shape.backgroundPath(geom);
      // For 2 parts, chord is a horizontal line through center (M ... L ...)
      const segments = path.split('Z')[1]; // after the circle closure
      assert.ok(segments && segments.includes('M'), 'should have chord move command');
      assert.ok(segments && segments.includes('L'), 'should have chord line command');
    });

    it('omits chord lines when drawSplits is false', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20, parts: 2, drawSplits: false });
      const path = shape.backgroundPath(geom);
      const afterClose = path.split('Z')[1] || '';
      assert.ok(!afterClose.includes('M'), 'should not have chord lines');
    });

    it('has no chords for 1 part', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20, parts: 1 });
      const path = shape.backgroundPath(geom);
      const afterClose = path.split('Z')[1] || '';
      assert.ok(!afterClose.includes('M'), 'single part should have no chords');
    });
  });

  describe('partRegions', () => {
    it('returns one region per part', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20, parts: 3 });
      const regions = shape.partRegions(geom);
      assert.strictEqual(regions.length, 3);
    });

    it('regions cover the full height', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20, parts: 2 });
      const regions = shape.partRegions(geom);
      const topY = regions[0].clipRect.y;
      const bottomY = regions[1].clipRect.y + regions[1].clipRect.height;
      assert.ok(Math.abs(topY - (-20)) < 1e-10, 'top should be at -r');
      assert.ok(Math.abs(bottomY - 20) < 1e-10, 'bottom should be at +r');
    });

    it('has labelCenter for each region', () => {
      const geom = shape.savedGeometry({ center: { x: 0, y: 0 }, radius: 20, parts: 2 });
      const regions = shape.partRegions(geom);
      assert.ok(regions[0].labelCenter.y < 0, 'first part label above center');
      assert.ok(regions[1].labelCenter.y > 0, 'second part label below center');
    });
  });
});
