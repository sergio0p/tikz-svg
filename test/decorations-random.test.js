import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../src-v2/core/random.js';

describe('SeededRandom', () => {
  it('produces deterministic sequence from same seed', () => {
    const a = new SeededRandom(123);
    const b = new SeededRandom(123);
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(a.rand(), b.rand());
    }
  });

  it('produces values in [-1, 1]', () => {
    const rng = new SeededRandom(456);
    for (let i = 0; i < 1000; i++) {
      const v = rng.rand();
      assert.ok(v >= -1 && v <= 1, `value ${v} out of range`);
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    const va = Array.from({ length: 10 }, () => a.rand());
    const vb = Array.from({ length: 10 }, () => b.rand());
    assert.notDeepStrictEqual(va, vb);
  });

  it('covers both positive and negative values', () => {
    const rng = new SeededRandom(789);
    let hasPos = false, hasNeg = false;
    for (let i = 0; i < 100; i++) {
      const v = rng.rand();
      if (v > 0) hasPos = true;
      if (v < 0) hasNeg = true;
    }
    assert.ok(hasPos, 'should produce positive values');
    assert.ok(hasNeg, 'should produce negative values');
  });
});
