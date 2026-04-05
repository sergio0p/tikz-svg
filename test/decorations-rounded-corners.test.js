import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyRoundedCorners, roundPathCorners } from '../src-v2/decorations/rounded-corners.js';

describe('applyRoundedCorners', () => {
  it('produces C commands for interior corners on open paths', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const path = applyRoundedCorners(pts, 3, false);
    assert.ok(path.includes('C'), 'should contain cubic bezier (PGF-matching)');
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
    const cCount = (path.match(/C/g) || []).length;
    assert.strictEqual(cCount, 4);
    assert.ok(path.endsWith('Z'));
  });

  it('clamps radius to half segment length', () => {
    const pts = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 10 }];
    const path = applyRoundedCorners(pts, 10, false);
    assert.ok(path.includes('C'), 'should still produce a curve');
  });

  it('returns plain path when radius is 0', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const path = applyRoundedCorners(pts, 0, false);
    assert.ok(!path.includes('C'));
  });

  it('handles fewer than 3 points gracefully', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const path = applyRoundedCorners(pts, 3, false);
    assert.ok(!path.includes('C'));
  });
});

describe('roundPathCorners', () => {
  it('rounds a simple polygon path string', () => {
    const d = 'M -20 -15 L 20 -15 L 20 15 L -20 15 Z';
    const result = roundPathCorners(d, 4);
    assert.ok(result.includes('C'), 'should contain cubic bezier');
    assert.ok(result.includes('Z'), 'should remain closed');
    assert.ok(!result.includes('Q'), 'should not use quadratic');
  });

  it('returns original path when radius is 0', () => {
    const d = 'M 0 0 L 10 0 L 10 10 Z';
    assert.strictEqual(roundPathCorners(d, 0), d);
  });

  it('returns original path for curves (non-polygon)', () => {
    const d = 'M 0 0 C 5 5 10 5 10 0 Z';
    assert.strictEqual(roundPathCorners(d, 4), d);
  });

  it('returns original path for fewer than 3 vertices', () => {
    const d = 'M 0 0 L 10 0';
    assert.strictEqual(roundPathCorners(d, 4), d);
  });
});
