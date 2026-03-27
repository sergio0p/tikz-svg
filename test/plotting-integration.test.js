import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { plot } from '../src-v2/plotting/index.js';

describe('plot() API', () => {
  it('plots sin(x) with default options', () => {
    const result = plot('sin(x)', { domain: [0, Math.PI], samples: 5 });
    assert.ok(result.path, 'should have a path');
    assert.ok(!result.path.isEmpty(), 'path should not be empty');
    assert.strictEqual(result.points.length, 5);
    assert.strictEqual(result.marks, null); // no marks by default
  });

  it('plots with smooth handler', () => {
    const result = plot('x^2', {
      domain: [0, 3],
      samples: 10,
      handler: 'smooth',
    });
    const d = result.path.toSVGPath();
    assert.ok(d.includes('C'), 'smooth should produce curves');
  });

  it('plots with marks', () => {
    const result = plot('x', {
      domain: [0, 4],
      samples: 5,
      mark: '*',
      markSize: 3,
    });
    assert.ok(result.marks, 'should have marks');
    assert.strictEqual(result.marks.length, 5);
    assert.ok(result.markPath, 'should have markPath');
  });

  it('plots from inline coordinates', () => {
    const result = plot(null, {
      coordinates: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }],
    });
    assert.strictEqual(result.points.length, 3);
    assert.ok(!result.path.isEmpty());
  });

  it('plots parametric', () => {
    const result = plot('cos(t)', {
      yExpr: 'sin(t)',
      variable: 't',
      domain: [0, 2 * Math.PI],
      samples: 20,
      handler: 'smooth',
    });
    assert.strictEqual(result.points.length, 20);
    // First point should be near (1, 0)
    assert.ok(Math.abs(result.points[0].x - 1) < 0.01);
    assert.ok(Math.abs(result.points[0].y - 0) < 0.01);
  });

  it('plots ybar', () => {
    const result = plot(null, {
      coordinates: [{ x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 2 }],
      handler: 'ybar',
      barWidth: 6,
    });
    const d = result.path.toSVGPath();
    assert.ok(d.includes('Z'), 'ybar should produce closed rectangles');
  });

  it('supports ycomb', () => {
    const result = plot('sin(x)', {
      domain: [0, 6],
      samples: 7,
      handler: 'ycomb',
    });
    const d = result.path.toSVGPath();
    // 7 combs = 7 moveTo
    assert.strictEqual((d.match(/M/g) || []).length, 7);
  });

  it('supports yRange filtering', () => {
    const result = plot('tan(x)', {
      domain: [-1.5, 1.5],
      samples: 31,
      yRange: [-3, 3],
    });
    // All defined points should be within range
    for (const p of result.points) {
      if (!p.undefined) {
        assert.ok(p.y >= -3 && p.y <= 3);
      }
    }
  });
});
