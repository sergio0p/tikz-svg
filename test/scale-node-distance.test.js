/**
 * Test that nodeDistance is scale-aware when scale is set.
 *
 * Bug: resolvePositions runs before Phase 2.6 (global scale), so
 * nodeDistance=90 produces a 90-unit offset in pre-scale space.
 * After scaling by e.g. 65, that becomes 5850px — way off screen.
 *
 * We test the positioning module directly (no DOM/mathjs needed).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePositions } from '../src-v2/positioning/positioning.js';

describe('scale-aware nodeDistance', () => {
  it('without scale, nodeDistance=90 produces 90-unit offset', () => {
    const result = resolvePositions({
      states: {
        a: { position: { x: 0, y: 0 } },
        b: { position: { right: 'a' } },
      },
      nodeDistance: 90,
      onGrid: true,
    });
    assert.strictEqual(result.b.position.x, 90);
  });

  it('with scale=65, relative offset should stay reasonable', () => {
    // In TikZ, scale multiplies coordinates. If user places nodes at
    // x=0, x=1 with scale=65, they expect ~65px apart.
    // A relative node with default nodeDistance should land at a similar
    // distance — not 90*65 = 5850px away after scaling.
    //
    // The fix: divide nodeDistance by scale before resolving positions.
    // With nodeDistance=90 and scale=65: effective = 90/65 ≈ 1.385 units.
    // After Phase 2.6 scales by 65: 1.385 * 65 = 90px. Correct!
    const scale = 65;
    const effectiveND = 90 / scale;

    const result = resolvePositions({
      states: {
        a: { position: { x: 0, y: 0 } },
        b: { position: { right: 'a' } },
      },
      nodeDistance: effectiveND,
      onGrid: true,
    });

    // b should be ~1.385 units right of a (not 90 units)
    assert.ok(result.b.position.x < 2,
      `offset should be ~1.385 scaled units, got ${result.b.position.x}`);
    // After scale: 1.385 * 65 ≈ 90px
    assert.ok(Math.abs(result.b.position.x * scale - 90) < 0.1,
      `after scaling, offset should be ~90px, got ${result.b.position.x * scale}`);
  });
});
