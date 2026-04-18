import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Path } from '../src-v2/core/path.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

describe('Path – empty', () => {
  it('isEmpty() returns true', () => {
    const p = new Path();
    assert.strictEqual(p.isEmpty(), true);
  });

  it('toSVGPath() returns empty string', () => {
    assert.strictEqual(new Path().toSVGPath(), '');
  });

  it('bbox() returns null', () => {
    assert.strictEqual(new Path().bbox(), null);
  });
});

describe('Path – basic segments', () => {
  it('moveTo + lineTo produce correct SVG', () => {
    const p = new Path().moveTo(1, 2).lineTo(3, 4);
    assert.strictEqual(p.toSVGPath(), 'M 1 2 L 3 4');
  });

  it('curveTo produces correct SVG with all 6 args', () => {
    const p = new Path().moveTo(0, 0).curveTo(1, 2, 3, 4, 5, 6);
    assert.strictEqual(p.toSVGPath(), 'M 0 0 C 1 2 3 4 5 6');
  });

  it('close adds Z', () => {
    const p = new Path().moveTo(0, 0).lineTo(10, 0).close();
    assert.ok(p.toSVGPath().endsWith('Z'));
  });

  it('chaining works', () => {
    const p = new Path().moveTo(0, 0).lineTo(10, 0).lineTo(10, 10).close();
    assert.strictEqual(p.segments.length, 4);
    assert.strictEqual(p.toSVGPath(), 'M 0 0 L 10 0 L 10 10 Z');
  });
});

describe('Path – rect', () => {
  it('produces M + 3L + Z with correct coords', () => {
    const p = new Path().rect(5, 10, 20, 30);
    assert.strictEqual(p.segments.length, 5);
    assert.strictEqual(p.segments[0].type, 'M');
    assert.deepStrictEqual(p.segments[0].args, [5, 10]);
    assert.strictEqual(p.segments[1].type, 'L');
    assert.deepStrictEqual(p.segments[1].args, [25, 10]);
    assert.strictEqual(p.segments[2].type, 'L');
    assert.deepStrictEqual(p.segments[2].args, [25, 40]);
    assert.strictEqual(p.segments[3].type, 'L');
    assert.deepStrictEqual(p.segments[3].args, [5, 40]);
    assert.strictEqual(p.segments[4].type, 'Z');
  });
});

describe('Path – circle', () => {
  it('produces M + 4C + Z', () => {
    const p = new Path().circle(0, 0, 10);
    const types = p.segments.map(s => s.type);
    assert.deepStrictEqual(types, ['M', 'C', 'C', 'C', 'C', 'Z']);
  });

  it('starts at (cx+r, cy) and ends back there', () => {
    const p = new Path().circle(5, 5, 10);
    assert.ok(near(p.segments[0].args[0], 15));
    assert.ok(near(p.segments[0].args[1], 5));
    // Last curveTo endpoint should be back at start
    const lastC = p.segments[4];
    assert.ok(near(lastC.args[4], 15));
    assert.ok(near(lastC.args[5], 5));
  });
});

describe('Path – ellipse', () => {
  it('produces M + 4C + Z with rx != ry', () => {
    const p = new Path().ellipse(0, 0, 20, 10);
    const types = p.segments.map(s => s.type);
    assert.deepStrictEqual(types, ['M', 'C', 'C', 'C', 'C', 'Z']);
    // Start at (rx, 0)
    assert.ok(near(p.segments[0].args[0], 20));
    assert.ok(near(p.segments[0].args[1], 0));
    // Top of ellipse: the first curveTo ends at (0, -ry)
    assert.ok(near(p.segments[1].args[4], 0));
    assert.ok(near(p.segments[1].args[5], -10));
  });
});

describe('Path – arc', () => {
  it('starts at correct point', () => {
    const p = new Path().arc(0, 0, 10, 0, 90);
    // Start at angle 0: (10, 0)
    assert.ok(near(p.segments[0].args[0], 10));
    assert.ok(near(p.segments[0].args[1], 0));
  });

  it('produces curveTo segments', () => {
    const p = new Path().arc(0, 0, 10, 0, 180);
    const curves = p.segments.filter(s => s.type === 'C');
    assert.ok(curves.length >= 2);
  });

  it('endpoint of 90° arc is correct', () => {
    const p = new Path().arc(0, 0, 10, 0, 90);
    const last = p.lastPoint();
    // At 90° (TikZ convention, SVG y-down): cos(90°)=0, -sin(90°)=-1 → (0, -10)
    assert.ok(near(last.x, 0, 1e-4));
    assert.ok(near(last.y, -10, 1e-4));
  });
});

describe('Path – bbox', () => {
  it('simple rectangle has correct bounds', () => {
    const p = new Path().rect(5, 10, 20, 30);
    const bb = p.bbox();
    assert.ok(near(bb.minX, 5));
    assert.ok(near(bb.minY, 10));
    assert.ok(near(bb.maxX, 25));
    assert.ok(near(bb.maxY, 40));
  });

  it('curves include control points in bbox', () => {
    const p = new Path().moveTo(0, 0).curveTo(0, -50, 100, -50, 100, 0);
    const bb = p.bbox();
    assert.ok(bb.minY <= -50);
    assert.ok(bb.maxX >= 100);
  });
});

describe('Path – clone', () => {
  it('produces independent copy', () => {
    const orig = new Path().moveTo(0, 0).lineTo(10, 10);
    const copy = orig.clone();
    copy.lineTo(20, 20);
    assert.strictEqual(orig.segments.length, 2);
    assert.strictEqual(copy.segments.length, 3);
  });

  it('modifying clone segment args does not affect original', () => {
    const orig = new Path().moveTo(1, 2);
    const copy = orig.clone();
    copy.segments[0].args[0] = 99;
    assert.strictEqual(orig.segments[0].args[0], 1);
  });
});

describe('Path – append', () => {
  it('combines two paths', () => {
    const a = new Path().moveTo(0, 0).lineTo(10, 0);
    const b = new Path().moveTo(20, 20).lineTo(30, 30);
    a.append(b);
    assert.strictEqual(a.segments.length, 4);
    assert.strictEqual(a.segments[2].type, 'M');
    assert.deepStrictEqual(a.segments[2].args, [20, 20]);
  });
});

describe('Path – lastPoint', () => {
  it('returns endpoint of last segment', () => {
    const p = new Path().moveTo(1, 2).lineTo(3, 4).curveTo(5, 6, 7, 8, 9, 10);
    const lp = p.lastPoint();
    assert.strictEqual(lp.x, 9);
    assert.strictEqual(lp.y, 10);
  });

  it('returns null for empty path', () => {
    assert.strictEqual(new Path().lastPoint(), null);
  });

  it('returns lastMove point when last segment is Z', () => {
    const p = new Path().moveTo(1, 2).lineTo(3, 4).close();
    const lp = p.lastPoint();
    assert.strictEqual(lp.x, 1);
    assert.strictEqual(lp.y, 2);
  });
});

describe('Path – toSVGPath precision', () => {
  it('rounds to at most 4 decimal places', () => {
    const p = new Path().moveTo(1.123456789, 2.987654321);
    const svg = p.toSVGPath();
    assert.strictEqual(svg, 'M 1.1235 2.9877');
  });

  it('does not produce -0', () => {
    const p = new Path().moveTo(-0.00001, 0);
    const svg = p.toSVGPath();
    assert.ok(!svg.includes('-0 '));
  });
});

describe('Path – roundCorners', () => {
  it('on a rectangle produces curves at corners', () => {
    const p = new Path().rect(0, 0, 100, 100);
    const rounded = p.roundCorners(10);
    const curves = rounded.segments.filter(s => s.type === 'C');
    assert.ok(curves.length >= 3, `expected at least 3 curves, got ${curves.length}`);
    // Lines should be shortened
    const lines = rounded.segments.filter(s => s.type === 'L');
    assert.ok(lines.length >= 3);
  });

  it('with radius 0 returns equivalent path', () => {
    const p = new Path().rect(0, 0, 50, 50);
    const rounded = p.roundCorners(0);
    assert.strictEqual(rounded.toSVGPath(), p.toSVGPath());
  });

  it('preserves curveTo segments unchanged', () => {
    const p = new Path().moveTo(0, 0).curveTo(10, 20, 30, 40, 50, 0);
    const rounded = p.roundCorners(5);
    const curves = rounded.segments.filter(s => s.type === 'C');
    assert.strictEqual(curves.length, 1);
    assert.deepStrictEqual(curves[0].args, [10, 20, 30, 40, 50, 0]);
  });
});

describe('Path – transform', () => {
  it('transforms all points through a transform object', () => {
    // Mock transform that translates by (10, 20)
    const tx = {
      apply(pt) { return { x: pt.x + 10, y: pt.y + 20 }; },
    };

    const p = new Path().moveTo(0, 0).lineTo(5, 5).curveTo(1, 1, 2, 2, 3, 3);
    const t = p.transform(tx);

    assert.deepStrictEqual(t.segments[0].args, [10, 20]);
    assert.deepStrictEqual(t.segments[1].args, [15, 25]);
    assert.deepStrictEqual(t.segments[2].args, [11, 21, 12, 22, 13, 23]);
  });

  it('preserves Z segments', () => {
    const tx = { apply(pt) { return pt; } };
    const p = new Path().moveTo(0, 0).close();
    const t = p.transform(tx);
    assert.strictEqual(t.segments[1].type, 'Z');
  });

  it('returns a new Path (original unchanged)', () => {
    const tx = { apply(pt) { return { x: pt.x + 1, y: pt.y + 1 }; } };
    const orig = new Path().moveTo(0, 0);
    const t = orig.transform(tx);
    assert.strictEqual(orig.segments[0].args[0], 0);
    assert.strictEqual(t.segments[0].args[0], 1);
  });
});
