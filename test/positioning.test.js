import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePositions, parsePositionSpec } from '../src-v2/positioning/positioning.js';

const near = (a, b, eps = 0.1) => Math.abs(a - b) < eps;

describe('parsePositionSpec', () => {
  it('returns null for absolute position', () => {
    assert.strictEqual(parsePositionSpec({ x: 10, y: 20 }), null);
  });

  it('returns null for undefined', () => {
    assert.strictEqual(parsePositionSpec(undefined), null);
  });

  it('parses simple direction', () => {
    const spec = parsePositionSpec({ right: 'q0' });
    assert.strictEqual(spec.direction, 'right');
    assert.strictEqual(spec.refNode, 'q0');
    assert.strictEqual(spec.distance, null);
  });

  it('parses direction with distance', () => {
    const spec = parsePositionSpec({ below: 'q1', distance: 80 });
    assert.strictEqual(spec.direction, 'below');
    assert.strictEqual(spec.distance, 80);
  });

  it('parses diagonal direction', () => {
    const spec = parsePositionSpec({ 'above right': 'q0' });
    assert.strictEqual(spec.direction, 'above right');
  });

  it('parses separate x/y distances', () => {
    const spec = parsePositionSpec({ 'above right': 'q0', distance: [60, 40] });
    assert.deepStrictEqual(spec.distance, [60, 40]);
  });
});

describe('resolvePositions', () => {
  it('first node defaults to origin', () => {
    const result = resolvePositions({
      states: { q0: {} },
    });
    assert.deepStrictEqual(result.q0.position, { x: 0, y: 0 });
  });

  it('absolute position passthrough', () => {
    const result = resolvePositions({
      states: { q0: { position: { x: 50, y: 100 } } },
    });
    assert.deepStrictEqual(result.q0.position, { x: 50, y: 100 });
  });

  it('right: q0 with default nodeDistance', () => {
    const result = resolvePositions({
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { right: 'q0' } },
      },
      nodeDistance: 60,
    });
    assert.ok(near(result.q1.position.x, 60));
    assert.ok(near(result.q1.position.y, 0));
  });

  it('above: q0 (negative y in SVG)', () => {
    const result = resolvePositions({
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { above: 'q0' } },
      },
      nodeDistance: 60,
    });
    assert.ok(near(result.q1.position.x, 0));
    assert.ok(near(result.q1.position.y, -60));
  });

  it('above right with diagonal factor', () => {
    const result = resolvePositions({
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { 'above right': 'q0' } },
      },
      nodeDistance: 60,
    });
    const expected = 60 * 0.707107;
    assert.ok(near(result.q1.position.x, expected));
    assert.ok(near(result.q1.position.y, -expected));
  });

  it('chain: q0 → q1 → q2', () => {
    const result = resolvePositions({
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { right: 'q0' } },
        q2: { position: { below: 'q1' } },
      },
      nodeDistance: 60,
    });
    assert.ok(near(result.q2.position.x, 60));
    assert.ok(near(result.q2.position.y, 60));
  });

  it('explicit distance override', () => {
    const result = resolvePositions({
      states: {
        q0: { position: { x: 0, y: 0 } },
        q1: { position: { right: 'q0', distance: 100 } },
      },
    });
    assert.ok(near(result.q1.position.x, 100));
  });

  it('cycle detection', () => {
    assert.throws(() => {
      resolvePositions({
        states: {
          q0: { position: { right: 'q1' } },
          q1: { position: { right: 'q0' } },
        },
      });
    }, /Cycle/i);
  });

  it('missing reference', () => {
    assert.throws(() => {
      resolvePositions({
        states: {
          q0: { position: { right: 'qMissing' } },
        },
      });
    }, /unknown/i);
  });
});
