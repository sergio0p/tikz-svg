import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { morphPath, shapeToSVGPath } from '../src-v2/decorations/index.js';
import { SeededRandom } from '../src-v2/core/random.js';

describe('morphPath', () => {
  it('returns a valid SVG path for a straight line', () => {
    const result = morphPath('M 0 0 L 100 0', {
      type: 'random steps', segmentLength: 10, amplitude: 3, seed: 42,
    });
    assert.ok(result.startsWith('M '));
    assert.ok(result.includes('L '));
    assert.ok((result.match(/L /g) || []).length > 2);
  });

  it('preserves endpoints for open paths', () => {
    const result = morphPath('M 0 0 L 100 0', {
      type: 'random steps', segmentLength: 20, amplitude: 5, seed: 42,
    });
    assert.ok(result.startsWith('M 0 0'));
    assert.ok(result.endsWith('L 100 0'));
  });

  it('produces C commands when roundedCorners is set', () => {
    const result = morphPath('M 0 0 L 50 0 L 100 0', {
      type: 'random steps', segmentLength: 10, amplitude: 3,
      roundedCorners: 4, seed: 42,
    });
    assert.ok(result.includes('C'), 'should have cubic bezier curves (PGF-matching)');
  });

  it('closes the path for closed input', () => {
    const result = morphPath('M 0 0 L 50 0 L 50 50 L 0 50 Z', {
      type: 'random steps', segmentLength: 10, amplitude: 3, seed: 42,
    });
    assert.ok(result.endsWith('Z'));
  });

  it('is deterministic with same seed', () => {
    const opts = { type: 'random steps', segmentLength: 10, amplitude: 3, seed: 99 };
    const a = morphPath('M 0 0 L 100 0', opts);
    const b = morphPath('M 0 0 L 100 0', opts);
    assert.strictEqual(a, b);
  });

  it('accepts a shared PRNG instance', () => {
    const prng = new SeededRandom(42);
    const result = morphPath('M 0 0 L 100 0', {
      type: 'random steps', segmentLength: 10, amplitude: 3, prng,
    });
    assert.ok(result.startsWith('M '));
  });

  it('returns original path if too short to decorate', () => {
    const result = morphPath('M 0 0 L 5 0', {
      type: 'random steps', segmentLength: 20, amplitude: 3, seed: 42,
    });
    assert.strictEqual(result, 'M 0 0 L 5 0');
  });

  it('handles pre/post fixed regions', () => {
    const result = morphPath('M 0 0 L 100 0', {
      type: 'random steps', segmentLength: 10, amplitude: 5,
      preLength: 10, postLength: 10, seed: 42,
    });
    assert.ok(result.startsWith('M 0 0'));
  });

  it('returns original path for unknown decoration type', () => {
    const result = morphPath('M 0 0 L 100 0', { type: 'unknown' });
    assert.strictEqual(result, 'M 0 0 L 100 0');
  });
});

describe('shapeToSVGPath', () => {
  it('generates a closed path for circle', () => {
    const path = shapeToSVGPath('circle', { radius: 20, outerSep: 0 });
    assert.ok(path.startsWith('M 20 0'));
    assert.ok(path.endsWith('Z'));
    assert.ok(path.includes('C'));
  });

  it('generates a closed path for ellipse', () => {
    const path = shapeToSVGPath('ellipse', { rx: 30, ry: 20, outerSep: 0 });
    assert.ok(path.startsWith('M 30 0'));
    assert.ok(path.endsWith('Z'));
  });

  it('generates a closed rectangle path', () => {
    const path = shapeToSVGPath('rectangle', {
      halfWidth: 20, halfHeight: 15, outerSep: 0,
    });
    assert.ok(path.includes('M -20 -15'));
    assert.ok(path.includes('L 20 -15'));
    assert.ok(path.endsWith('Z'));
  });

  it('applies inset for accepting borders', () => {
    const outer = shapeToSVGPath('circle', { radius: 20, outerSep: 0 });
    const inner = shapeToSVGPath('circle', { radius: 20, outerSep: 0 }, { inset: 3 });
    assert.ok(outer.startsWith('M 20'));
    assert.ok(inner.startsWith('M 17'));
  });

  it('returns empty string for unknown shapes', () => {
    assert.strictEqual(shapeToSVGPath('star', {}), '');
  });
});
