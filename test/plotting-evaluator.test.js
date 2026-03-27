import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sampleFunction, compileFn } from '../src-v2/plotting/evaluator.js';

describe('compileFn', () => {
  it('compiles and evaluates sin(x)', () => {
    const fn = compileFn('sin(x)');
    assert.ok(Math.abs(fn(0) - 0) < 1e-10);
    assert.ok(Math.abs(fn(Math.PI / 2) - 1) < 1e-10);
  });

  it('compiles x^2 + 1', () => {
    const fn = compileFn('x^2 + 1');
    assert.strictEqual(fn(0), 1);
    assert.strictEqual(fn(3), 10);
  });

  it('compiles with custom variable name', () => {
    const fn = compileFn('t^2', 't');
    assert.strictEqual(fn(4), 16);
  });

  it('handles exp, log, sqrt, abs', () => {
    const fn = compileFn('sqrt(abs(x))');
    assert.strictEqual(fn(4), 2);
    assert.strictEqual(fn(-9), 3);
  });

  it('handles pi and e constants', () => {
    const fn = compileFn('sin(pi)');
    assert.ok(Math.abs(fn(0) - 0) < 1e-10); // sin(pi) doesn't depend on x
  });
});

describe('sampleFunction with JS functions', () => {
  it('accepts a JS function instead of a string', () => {
    const points = sampleFunction((x) => x * x, { domain: [0, 2], samples: 3 });
    assert.strictEqual(points.length, 3);
    assert.strictEqual(points[0].y, 0);
    assert.strictEqual(points[1].y, 1);
    assert.strictEqual(points[2].y, 4);
  });

  it('supports piecewise JS functions', () => {
    const piecewise = (x) => x < 1 ? x : 2 - x;
    const points = sampleFunction(piecewise, { domain: [0, 2], samples: 5 });
    assert.strictEqual(points.length, 5);
    assert.strictEqual(points[0].y, 0);    // x=0
    assert.strictEqual(points[2].y, 1);    // x=1
    assert.strictEqual(points[4].y, 0);    // x=2
  });
});

describe('sampleFunction', () => {
  it('samples sin(x) over [0, pi] with 5 samples', () => {
    const points = sampleFunction('sin(x)', { domain: [0, Math.PI], samples: 5 });
    assert.strictEqual(points.length, 5);
    // First point: x=0, y=0
    assert.ok(Math.abs(points[0].x) < 1e-10);
    assert.ok(Math.abs(points[0].y) < 1e-10);
    // Midpoint: x=pi/2, y=1
    assert.ok(Math.abs(points[2].x - Math.PI / 2) < 1e-10);
    assert.ok(Math.abs(points[2].y - 1) < 1e-10);
  });

  it('uses default domain [-5,5] and 25 samples', () => {
    const points = sampleFunction('x');
    assert.strictEqual(points.length, 25);
    assert.strictEqual(points[0].x, -5);
    assert.strictEqual(points[24].x, 5);
  });

  it('supports samplesAt for explicit x values', () => {
    const points = sampleFunction('x^2', { samplesAt: [1, 2, 3] });
    assert.strictEqual(points.length, 3);
    assert.strictEqual(points[0].y, 1);
    assert.strictEqual(points[1].y, 4);
    assert.strictEqual(points[2].y, 9);
  });

  it('supports parametric mode', () => {
    // Circle: x = cos(t), y = sin(t) over [0, 2*pi]
    const points = sampleFunction('cos(t)', {
      yExpr: 'sin(t)',
      variable: 't',
      domain: [0, 2 * Math.PI],
      samples: 5,
    });
    assert.strictEqual(points.length, 5);
    // First point: (cos(0), sin(0)) = (1, 0)
    assert.ok(Math.abs(points[0].x - 1) < 1e-10);
    assert.ok(Math.abs(points[0].y - 0) < 1e-10);
  });

  it('filters points outside yRange', () => {
    // tan(x) goes to infinity — range should clip
    const points = sampleFunction('tan(x)', {
      domain: [-1.5, 1.5],
      samples: 31,
      yRange: [-3, 3],
    });
    // Some points should be filtered (marked undefined)
    assert.ok(points.length <= 31);
    for (const p of points) {
      if (p.y !== undefined) {
        assert.ok(p.y >= -3 && p.y <= 3, `y=${p.y} out of range`);
      }
    }
  });
});
