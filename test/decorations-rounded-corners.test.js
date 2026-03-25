import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyRoundedCorners } from '../src-v2/decorations/rounded-corners.js';

describe('applyRoundedCorners', () => {
  it('produces Q commands for interior corners on open paths', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const path = applyRoundedCorners(pts, 3, false);
    assert.ok(path.includes('Q'), 'should contain quadratic bezier');
    assert.ok(path.startsWith('M 0 0'), 'should start at first point');
    assert.ok(path.endsWith('L 10 10'), 'should end at last point');
  });

  it('preserves endpoints on open paths', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const path = applyRoundedCorners(pts, 3, false);
    assert.ok(path.startsWith('M 0 0'));
    assert.ok(path.includes('L 10 10'));
  });

  it('rounds all corners on closed paths', () => {
    const pts = [
      { x: 0, y: 0 }, { x: 10, y: 0 },
      { x: 10, y: 10 }, { x: 0, y: 10 },
    ];
    const path = applyRoundedCorners(pts, 3, true);
    const qCount = (path.match(/Q/g) || []).length;
    assert.strictEqual(qCount, 4);
    assert.ok(path.endsWith('Z'));
  });

  it('clamps radius to half segment length', () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 10 }];
    const path = applyRoundedCorners(pts, 10, false);
    assert.ok(path.includes('Q'), 'should still produce a curve');
  });

  it('returns plain path when radius is 0', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const path = applyRoundedCorners(pts, 0, false);
    assert.ok(!path.includes('Q'));
  });

  it('handles fewer than 3 points gracefully', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const path = applyRoundedCorners(pts, 3, false);
    assert.ok(!path.includes('Q'));
  });
});
