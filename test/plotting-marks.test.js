import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMark, getMarkPositions, getMarkFillMode } from '../src-v2/plotting/marks.js';

describe('mark registry', () => {
  it('retrieves built-in marks', () => {
    for (const name of ['*', '+', 'x', 'o', '|', '-', 'square', 'square*',
      'triangle', 'triangle*', 'diamond', 'diamond*', 'pentagon', 'pentagon*']) {
      assert.ok(getMark(name), `mark "${name}" should exist`);
    }
  });

  it('returns null for unknown mark', () => {
    assert.strictEqual(getMark('nonexistent'), null);
  });

  it('distinguishes filled vs stroked marks', () => {
    assert.strictEqual(getMarkFillMode('*'), 'filled');
    assert.strictEqual(getMarkFillMode('o'), 'stroke');
    assert.strictEqual(getMarkFillMode('square'), 'stroke');
    assert.strictEqual(getMarkFillMode('square*'), 'filled');
    assert.strictEqual(getMarkFillMode('+'), 'stroke');
  });

  it('mark returns a Path with segments', () => {
    const markFn = getMark('*');
    const path = markFn(3); // size = 3
    assert.ok(!path.isEmpty(), 'mark path should not be empty');
    const d = path.toSVGPath();
    assert.ok(d.length > 0);
  });

  it('mark size scales the symbol', () => {
    const markFn = getMark('+');
    const small = markFn(2);
    const large = markFn(6);
    // Larger mark should have coordinates further from origin
    const smallBbox = small.bbox();
    const largeBbox = large.bbox();
    assert.ok(largeBbox.maxX > smallBbox.maxX);
  });
});

describe('getMarkPositions', () => {
  const points = [
    { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 },
    { x: 3, y: 3 }, { x: 4, y: 4 }, { x: 5, y: 5 },
  ];

  it('returns all positions by default', () => {
    const positions = getMarkPositions(points, {});
    assert.strictEqual(positions.length, 6);
  });

  it('respects markRepeat', () => {
    const positions = getMarkPositions(points, { markRepeat: 3 });
    // Every 3rd point: indices 0, 3 (1-indexed: 1st, 4th)
    assert.strictEqual(positions.length, 2);
  });

  it('respects markPhase', () => {
    const positions = getMarkPositions(points, { markRepeat: 2, markPhase: 2 });
    // Phase 2 means start at 2nd point: indices 1, 3, 5
    assert.strictEqual(positions.length, 3);
  });

  it('respects markIndices', () => {
    const positions = getMarkPositions(points, { markIndices: [1, 3, 6] });
    // 1-indexed: points at indices 0, 2, 5
    assert.strictEqual(positions.length, 3);
    assert.strictEqual(positions[0].x, 0);
    assert.strictEqual(positions[1].x, 2);
    assert.strictEqual(positions[2].x, 5);
  });

  it('skips undefined points', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: undefined, undefined: true }, { x: 2, y: 2 }];
    const positions = getMarkPositions(pts, {});
    assert.strictEqual(positions.length, 2);
  });
});
