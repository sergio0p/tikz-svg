import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyRandomSteps } from '../src-v2/decorations/random-steps.js';
import { SeededRandom } from '../src-v2/core/random.js';

describe('applyRandomSteps', () => {
  it('preserves endpoints on open paths', () => {
    const prng = new SeededRandom(42);
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
    const result = applyRandomSteps(pts, 3, prng, { closed: false });
    assert.strictEqual(result[0].x, 0);
    assert.strictEqual(result[0].y, 0);
    assert.strictEqual(result[2].x, 20);
    assert.strictEqual(result[2].y, 0);
  });

  it('offsets interior points within amplitude bounds', () => {
    const prng = new SeededRandom(42);
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push({ x: i * 10, y: 0 });
    const result = applyRandomSteps(pts, 3, prng, { closed: false });
    for (let i = 1; i < result.length - 1; i++) {
      // With tangent-frame offsets, the bound is sqrt(2)*amplitude in worst case
      assert.ok(Math.abs(result[i].x - pts[i].x) <= 5, `x offset too large at ${i}`);
      assert.ok(Math.abs(result[i].y - pts[i].y) <= 5, `y offset too large at ${i}`);
    }
  });

  it('offsets ALL points on closed paths (no fixed endpoints)', () => {
    const prng = new SeededRandom(42);
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const result = applyRandomSteps(pts, 3, prng, { closed: true });
    let anyOffset = false;
    for (let i = 0; i < result.length; i++) {
      if (result[i].x !== pts[i].x || result[i].y !== pts[i].y) anyOffset = true;
    }
    assert.ok(anyOffset, 'closed path should have offset points');
  });

  it('is deterministic (same seed → same result)', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
    const a = applyRandomSteps(pts, 3, new SeededRandom(99), { closed: false });
    const b = applyRandomSteps(pts, 3, new SeededRandom(99), { closed: false });
    assert.deepStrictEqual(a, b);
  });

  it('respects fixedStart/fixedEnd distances (pre/post regions)', () => {
    const prng = new SeededRandom(42);
    const pts = [];
    for (let i = 0; i <= 10; i++) pts.push({ x: i * 10, y: 0 });
    // fixedStart=15 means first 15px are unmodified (points at dist 0 and 10)
    // fixedEnd=15 means last 15px are unmodified (points at dist 90 and 100)
    const result = applyRandomSteps(pts, 3, prng, {
      closed: false, fixedStart: 15, fixedEnd: 15,
    });
    assert.strictEqual(result[0].x, 0);
    assert.strictEqual(result[1].x, 10);
    assert.strictEqual(result[1].y, 0);
    assert.strictEqual(result[9].x, 90);
    assert.strictEqual(result[9].y, 0);
    assert.strictEqual(result[10].x, 100);
  });
});
