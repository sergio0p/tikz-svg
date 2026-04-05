import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import cloudCallout from '../src-v2/shapes/cloud-callout.js';
import cloudShape from '../src-v2/shapes/cloud.js';
import { getShape } from '../src-v2/shapes/shape.js';

const near = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

function makeGeom(overrides = {}) {
  return cloudCallout.savedGeometry({
    center: { x: 100, y: 100 },
    rx: 20,
    ry: 15,
    outerSep: 2,
    calloutPointerOffset: { x: 60, y: 50 },
    ...overrides,
  });
}

describe('Cloud callout registration', () => {
  it('is registered in the shape registry', () => {
    assert.strictEqual(getShape('cloud callout'), cloudCallout);
  });
});

describe('Cloud callout savedGeometry', () => {
  const geom = makeGeom();

  it('stores center', () => {
    assert.deepStrictEqual(geom.center, { x: 100, y: 100 });
  });

  it('inherits cloud geometry (puffs, inner/outer radii)', () => {
    assert.strictEqual(geom.puffs, 10);
    assert.ok(geom.xInner > 0);
    assert.ok(geom.xOuter > 0);
    assert.ok(geom.anglestep === 36);
  });

  it('stores pointer tip offset', () => {
    assert.ok(geom.tipRel);
    assert.ok(near(geom.tipRel.x, 60));
    assert.ok(near(geom.tipRel.y, 50));
  });

  it('stores callout pointer parameters', () => {
    assert.strictEqual(geom.calloutPointerSegments, 2);
    assert.strictEqual(geom.calloutPointerStartSize, 0.2);
    assert.strictEqual(geom.calloutPointerEndSize, 0.1);
  });
});

describe('Cloud callout anchors (inherited from cloud)', () => {
  const geom = makeGeom();

  it('center anchor', () => {
    const p = cloudCallout.anchor('center', geom);
    assert.deepStrictEqual(p, { x: 100, y: 100 });
  });

  it('north is above center', () => {
    const p = cloudCallout.anchor('north', geom);
    assert.ok(p.y < 100, `north.y=${p.y}`);
  });

  it('east is right of center', () => {
    const p = cloudCallout.anchor('east', geom);
    assert.ok(p.x > 100, `east.x=${p.x}`);
  });

  it('pointer anchor at the tip', () => {
    const p = cloudCallout.anchor('pointer', geom);
    assert.ok(near(p.x, 160, 1), `pointer.x=${p.x} ≈ 160`);
    assert.ok(near(p.y, 150, 1), `pointer.y=${p.y} ≈ 150`);
  });
});

describe('Cloud callout borderPoint (delegated to cloud)', () => {
  const geom = makeGeom();

  it('east direction', () => {
    const p = cloudCallout.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(p.x > 100);
  });

  it('matches cloud border for same geometry', () => {
    const cloudGeom = cloudShape.savedGeometry({
      center: { x: 100, y: 100 },
      rx: 20, ry: 15, outerSep: 2,
    });
    const cloudPt = cloudShape.borderPoint(cloudGeom, { x: 1, y: 0 });
    const calloutPt = cloudCallout.borderPoint(geom, { x: 1, y: 0 });
    // Should be approximately the same (cloud geometry is identical)
    assert.ok(near(cloudPt.x, calloutPt.x, 2), `cloud=${cloudPt.x} ≈ callout=${calloutPt.x}`);
  });
});

describe('Cloud callout backgroundPath', () => {
  const geom = makeGeom();
  const path = cloudCallout.backgroundPath(geom);

  it('starts with M and contains Z', () => {
    assert.ok(path.startsWith('M'));
    assert.ok(path.includes('Z'));
  });

  it('contains cloud body (C commands for Bezier puffs)', () => {
    const cCount = (path.match(/ C /g) || []).length;
    // Cloud body has 20 C commands (10 puffs × 2 half-arcs)
    assert.ok(cCount >= 20, `has ≥20 C commands: got ${cCount}`);
  });

  it('contains thought-bubble ellipses (extra A commands)', () => {
    const aCount = (path.match(/ A /g) || []).length;
    // Default 2 segments → 2 ellipses → 4 A commands (2 arcs per ellipse)
    assert.ok(aCount >= 4, `has ≥4 A commands for bubbles: got ${aCount}`);
  });

  it('all coordinates are finite', () => {
    const numbers = path.match(/-?\d+\.?\d*/g);
    for (const n of numbers) {
      assert.ok(Number.isFinite(parseFloat(n)), `${n} is finite`);
    }
  });
});

describe('Cloud callout with custom segments', () => {
  it('3 segments produce 3 bubble ellipses', () => {
    const geom = makeGeom({ calloutPointerSegments: 3 });
    const path = cloudCallout.backgroundPath(geom);
    const aCount = (path.match(/ A /g) || []).length;
    // 3 bubbles × 2 arcs each = 6 A commands
    assert.ok(aCount >= 6, `3 segments: got ${aCount} A commands`);
  });

  it('1 segment produces 1 bubble', () => {
    const geom = makeGeom({ calloutPointerSegments: 1 });
    const path = cloudCallout.backgroundPath(geom);
    const aCount = (path.match(/ A /g) || []).length;
    assert.ok(aCount >= 2, `1 segment: got ${aCount} A commands`);
  });
});

describe('Cloud callout pointer shortening', () => {
  it('shortened pointer moves tip closer', () => {
    const normal = makeGeom({ calloutPointerShorten: 0 });
    const short = makeGeom({ calloutPointerShorten: 15 });

    const dNorm = Math.sqrt(normal.tipRel.x ** 2 + normal.tipRel.y ** 2);
    const dShort = Math.sqrt(short.tipRel.x ** 2 + short.tipRel.y ** 2);
    assert.ok(dShort < dNorm);
  });
});

describe('Cloud callout pointer in different directions', () => {
  for (const [name, offset] of [
    ['right', { x: 60, y: 0 }],
    ['left', { x: -60, y: 0 }],
    ['above', { x: 0, y: -50 }],
    ['below', { x: 0, y: 50 }],
  ]) {
    it(`pointer ${name}`, () => {
      const geom = makeGeom({ calloutPointerOffset: offset });
      const path = cloudCallout.backgroundPath(geom);
      assert.ok(path.startsWith('M'));
      assert.ok(path.includes(' A '));
    });
  }
});

describe('Cloud callout emitter re-call', () => {
  it('works when re-called with center at origin', () => {
    const geom = makeGeom();
    const localGeom = cloudCallout.savedGeometry({
      ...geom,
      center: { x: 0, y: 0 },
    });
    const path = cloudCallout.backgroundPath(localGeom);
    assert.ok(path.startsWith('M'));
  });
});
