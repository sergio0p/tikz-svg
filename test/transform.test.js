import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Transform, TransformStack } from '../src-v2/core/transform.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

describe('Transform', () => {
  it('identity transform applies correctly', () => {
    const t = new Transform();
    const p = t.apply({ x: 3, y: 7 });
    assert.ok(near(p.x, 3));
    assert.ok(near(p.y, 7));
  });

  it('translate(dx, dy) moves points correctly', () => {
    const t = new Transform();
    t.translate(10, -5);
    const p = t.apply({ x: 1, y: 2 });
    assert.ok(near(p.x, 11));
    assert.ok(near(p.y, -3));
  });

  it('scale(2) doubles coordinates', () => {
    const t = new Transform();
    t.scale(2);
    const p = t.apply({ x: 3, y: 4 });
    assert.ok(near(p.x, 6));
    assert.ok(near(p.y, 8));
  });

  it('scale(2, 3) non-uniform scaling', () => {
    const t = new Transform();
    t.scale(2, 3);
    const p = t.apply({ x: 5, y: 7 });
    assert.ok(near(p.x, 10));
    assert.ok(near(p.y, 21));
  });

  it('rotate(90) rotates counterclockwise: (1,0) → (0,1)', () => {
    const t = new Transform();
    t.rotate(90);
    const p = t.apply({ x: 1, y: 0 });
    assert.ok(near(p.x, 0));
    assert.ok(near(p.y, 1));
  });

  it('rotate(90) takes (0,1) → (-1,0)', () => {
    const t = new Transform();
    t.rotate(90);
    const p = t.apply({ x: 0, y: 1 });
    assert.ok(near(p.x, -1));
    assert.ok(near(p.y, 0));
  });

  it('composition order: translate then rotate vs rotate then translate', () => {
    // translate(10,0) then rotate(90): first translate, then rotate
    const t1 = new Transform();
    t1.translate(10, 0);
    t1.rotate(90);
    const p1 = t1.apply({ x: 1, y: 0 });

    // rotate(90) then translate(10,0)
    const t2 = new Transform();
    t2.rotate(90);
    t2.translate(10, 0);
    const p2 = t2.apply({ x: 1, y: 0 });

    // They should differ
    assert.ok(!near(p1.x, p2.x) || !near(p1.y, p2.y),
      'translate-then-rotate should differ from rotate-then-translate');
  });

  it('inversion: apply then invert().apply returns original point', () => {
    const t = new Transform();
    t.translate(5, -3);
    t.rotate(37);
    t.scale(2, 0.5);
    const orig = { x: 7, y: -11 };
    const transformed = t.apply(orig);
    const inv = t.invert();
    const back = inv.apply(transformed);
    assert.ok(near(back.x, orig.x));
    assert.ok(near(back.y, orig.y));
  });

  it('get/set round-trip', () => {
    const t = new Transform();
    t.translate(3, 4);
    t.rotate(45);
    const snapshot = t.get();
    const p1 = t.apply({ x: 1, y: 1 });

    // Mutate transform
    t.reset();
    assert.ok(t.isIdentity());

    // Restore
    t.set(snapshot);
    const p2 = t.apply({ x: 1, y: 1 });
    assert.ok(near(p1.x, p2.x));
    assert.ok(near(p1.y, p2.y));
  });

  it('clone independence', () => {
    const t = new Transform();
    t.translate(10, 20);
    const c = t.clone();

    // Mutate original
    t.scale(5);
    const pOrig = t.apply({ x: 1, y: 0 });
    const pClone = c.apply({ x: 1, y: 0 });

    // Clone should not have the scale
    assert.ok(near(pClone.x, 11));
    assert.ok(near(pClone.y, 20));
    assert.ok(near(pOrig.x, 15));
    assert.ok(near(pOrig.y, 20));
  });

  it('toSVG() format', () => {
    const t = new Transform();
    t.translate(10, 20);
    const svg = t.toSVG();
    assert.strictEqual(svg, 'matrix(1,0,0,1,10,20)');
  });

  it('isIdentity() returns true for fresh transform', () => {
    const t = new Transform();
    assert.ok(t.isIdentity());
  });

  it('isIdentity() returns false after modification', () => {
    const t = new Transform();
    t.translate(1, 0);
    assert.ok(!t.isIdentity());
  });

  it('slantX shears in x direction', () => {
    const t = new Transform();
    t.slantX(2);
    // x' = x + 2*y, y' = y
    const p = t.apply({ x: 1, y: 3 });
    assert.ok(near(p.x, 7));  // 1 + 2*3
    assert.ok(near(p.y, 3));
  });

  it('slantY shears in y direction', () => {
    const t = new Transform();
    t.slantY(2);
    // x' = x, y' = 2*x + y
    const p = t.apply({ x: 3, y: 1 });
    assert.ok(near(p.x, 3));
    assert.ok(near(p.y, 7));  // 2*3 + 1
  });

  it('reset() returns to identity', () => {
    const t = new Transform();
    t.translate(100, 200);
    t.rotate(45);
    t.scale(3);
    assert.ok(!t.isIdentity());
    t.reset();
    assert.ok(t.isIdentity());
    const p = t.apply({ x: 5, y: 6 });
    assert.ok(near(p.x, 5));
    assert.ok(near(p.y, 6));
  });
});

describe('TransformStack', () => {
  it('push/pop preserves and restores state', () => {
    const ts = new TransformStack();
    ts.current.translate(10, 20);
    ts.push();

    // Modify after push
    ts.current.scale(5);
    ts.current.rotate(90);
    const pModified = ts.current.apply({ x: 1, y: 0 });

    // Pop should restore to translate-only state
    ts.pop();
    const pRestored = ts.current.apply({ x: 1, y: 0 });
    assert.ok(near(pRestored.x, 11));
    assert.ok(near(pRestored.y, 20));

    // Confirm the modified result was different
    assert.ok(!near(pModified.x, pRestored.x) || !near(pModified.y, pRestored.y));
  });

  it('nested push/pop', () => {
    const ts = new TransformStack();
    ts.current.translate(1, 0);
    ts.push();
    ts.current.translate(0, 1);
    ts.push();
    ts.current.scale(10);

    // innermost
    const p1 = ts.current.apply({ x: 1, y: 1 });
    assert.ok(near(p1.x, 11)); // (1*10) + 1
    assert.ok(near(p1.y, 11)); // (1*10) + 1

    ts.pop();
    const p2 = ts.current.apply({ x: 1, y: 1 });
    assert.ok(near(p2.x, 2));  // 1 + 1
    assert.ok(near(p2.y, 2));  // 1 + 1

    ts.pop();
    const p3 = ts.current.apply({ x: 1, y: 1 });
    assert.ok(near(p3.x, 2));  // 1 + 1
    assert.ok(near(p3.y, 1));  // 0 + 1
  });

  it('pop on empty stack throws', () => {
    const ts = new TransformStack();
    assert.throws(() => ts.pop(), /underflow/);
  });
});
