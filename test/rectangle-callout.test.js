import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import rectCallout from '../src-v2/shapes/rectangle-callout.js';
import { getShape } from '../src-v2/shapes/shape.js';

const near = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

function makeGeom(overrides = {}) {
  return rectCallout.savedGeometry({
    center: { x: 100, y: 100 },
    halfWidth: 30,
    halfHeight: 20,
    outerSep: 2,
    calloutPointerOffset: { x: 50, y: 40 },
    ...overrides,
  });
}

describe('Rectangle callout registration', () => {
  it('is registered in the shape registry', () => {
    assert.strictEqual(getShape('rectangle callout'), rectCallout);
  });
});

describe('Rectangle callout savedGeometry', () => {
  const geom = makeGeom();

  it('stores center', () => {
    assert.deepStrictEqual(geom.center, { x: 100, y: 100 });
  });

  it('halfWidth includes outerSep', () => {
    assert.strictEqual(geom.halfWidth, 32); // 30 + 2
  });

  it('halfHeight includes outerSep', () => {
    assert.strictEqual(geom.halfHeight, 22); // 20 + 2
  });

  it('stores pointer tip relative offset', () => {
    assert.ok(geom.tipRel, 'tipRel exists');
    assert.ok(Number.isFinite(geom.tipRel.x));
    assert.ok(Number.isFinite(geom.tipRel.y));
  });

  it('stores before/after pointer points', () => {
    assert.ok(geom.beforeRel && geom.afterRel);
  });

  it('stores 4 corner offsets', () => {
    assert.strictEqual(geom.cornerRels.length, 4);
  });

  it('stores pointer anchor', () => {
    assert.ok(geom.pointerAnchorRel);
    assert.ok(Number.isFinite(geom.pointerAnchorRel.x));
  });
});

describe('Rectangle callout anchors', () => {
  const geom = makeGeom();

  it('center anchor', () => {
    const p = rectCallout.anchor('center', geom);
    assert.deepStrictEqual(p, { x: 100, y: 100 });
  });

  it('cardinal anchors use full dimensions', () => {
    const n = rectCallout.anchor('north', geom);
    assert.ok(near(n.y, 78), `north.y=${n.y} ≈ 78`); // 100 - 22

    const e = rectCallout.anchor('east', geom);
    assert.ok(near(e.x, 132), `east.x=${e.x} ≈ 132`); // 100 + 32
  });

  it('corner anchors', () => {
    const ne = rectCallout.anchor('north east', geom);
    assert.ok(near(ne.x, 132) && near(ne.y, 78), `NE: (${ne.x}, ${ne.y})`);

    const sw = rectCallout.anchor('south west', geom);
    assert.ok(near(sw.x, 68) && near(sw.y, 122), `SW: (${sw.x}, ${sw.y})`);
  });

  it('pointer anchor is near the pointer tip', () => {
    const p = rectCallout.anchor('pointer', geom);
    const tipAbs = { x: 100 + geom.tipRel.x, y: 100 + geom.tipRel.y };
    const dx = p.x - tipAbs.x, dy = p.y - tipAbs.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Pointer anchor is offset from tip by outerSep/sin(halfAngle).
    // For pointy pointers this can be significant.
    assert.ok(dist < 50, `pointer anchor dist from tip: ${dist}`);
  });

  it('numeric angle 0 = east', () => {
    const p = rectCallout.anchor('0', geom);
    assert.ok(near(p.x, 132), `0°.x=${p.x} ≈ 132`);
    assert.ok(near(p.y, 100), `0°.y=${p.y} ≈ 100`);
  });
});

describe('Rectangle callout borderPoint', () => {
  const geom = makeGeom();

  it('east direction', () => {
    const p = rectCallout.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(near(p.x, 132));
    assert.ok(near(p.y, 100));
  });

  it('north direction (SVG y-down)', () => {
    const p = rectCallout.borderPoint(geom, { x: 0, y: -1 });
    assert.ok(near(p.y, 78));
  });

  it('zero direction returns center', () => {
    const p = rectCallout.borderPoint(geom, { x: 0, y: 0 });
    assert.deepStrictEqual(p, geom.center);
  });
});

describe('Rectangle callout backgroundPath', () => {
  const geom = makeGeom();

  it('starts with M and ends with Z', () => {
    const path = rectCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
    assert.ok(path.endsWith('Z'));
  });

  it('contains 6 L commands (tip + after + 4 corners)', () => {
    const path = rectCallout.backgroundPath(geom);
    const lCount = (path.match(/ L /g) || []).length;
    assert.strictEqual(lCount, 6, `expected 6 L commands, got ${lCount}`);
  });

  it('path includes pointer tip coordinates', () => {
    const path = rectCallout.backgroundPath(geom);
    const tip = { x: 100 + geom.tipRel.x, y: 100 + geom.tipRel.y };
    // The tip should appear in the path
    assert.ok(path.includes(`${tip.x}`), `path contains tip.x=${tip.x}`);
  });

  it('all coordinates are finite', () => {
    const path = rectCallout.backgroundPath(geom);
    const numbers = path.match(/-?\d+\.?\d*/g);
    for (const n of numbers) {
      assert.ok(Number.isFinite(parseFloat(n)), `${n} is finite`);
    }
  });
});

describe('Rectangle callout pointer on different sides', () => {
  it('pointer to the right', () => {
    const geom = makeGeom({ calloutPointerOffset: { x: 60, y: 0 } });
    const path = rectCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'), 'valid path for right pointer');
  });

  it('pointer to the left', () => {
    const geom = makeGeom({ calloutPointerOffset: { x: -60, y: 0 } });
    const path = rectCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'), 'valid path for left pointer');
  });

  it('pointer above (SVG y-up = negative y)', () => {
    const geom = makeGeom({ calloutPointerOffset: { x: 0, y: -50 } });
    const path = rectCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'), 'valid path for top pointer');
  });

  it('pointer below', () => {
    const geom = makeGeom({ calloutPointerOffset: { x: 0, y: 50 } });
    const path = rectCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'), 'valid path for bottom pointer');
  });

  it('pointer diagonal NW', () => {
    const geom = makeGeom({ calloutPointerOffset: { x: -50, y: -40 } });
    const path = rectCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
  });
});

describe('Rectangle callout pointer shortening', () => {
  it('shortened pointer is closer to center', () => {
    const geomNormal = makeGeom({ calloutPointerShorten: 0 });
    const geomShort = makeGeom({ calloutPointerShorten: 10 });

    const tipNorm = Math.sqrt(geomNormal.tipRel.x ** 2 + geomNormal.tipRel.y ** 2);
    const tipShort = Math.sqrt(geomShort.tipRel.x ** 2 + geomShort.tipRel.y ** 2);

    assert.ok(tipShort < tipNorm, `shortened ${tipShort} < normal ${tipNorm}`);
    assert.ok(near(tipNorm - tipShort, 10, 1), `difference ≈ 10`);
  });
});

describe('Rectangle callout emitter re-call', () => {
  it('works when re-called with center at origin', () => {
    const geom = makeGeom();
    // Simulate emitter re-call
    const localGeom = rectCallout.savedGeometry({
      ...geom,
      center: { x: 0, y: 0 },
    });
    const path = rectCallout.backgroundPath(localGeom);
    assert.ok(path.startsWith('M'));
    // Path should be centered around origin
    const numbers = path.match(/-?\d+\.?\d*/g).map(Number);
    const hasNegative = numbers.some(n => n < 0);
    const hasPositive = numbers.some(n => n > 0);
    assert.ok(hasNegative && hasPositive, 'path spans both sides of origin');
  });
});
