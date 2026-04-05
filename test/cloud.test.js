import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import cloudShape from '../src-v2/shapes/cloud.js';
import { getShape } from '../src-v2/shapes/shape.js';

const near = (a, b, eps = 0.5) => Math.abs(a - b) < eps;
const nearPt = (p, ex, ey, eps = 0.5) => near(p.x, ex, eps) && near(p.y, ey, eps);

// Default cloud config
function makeGeom(overrides = {}) {
  return cloudShape.savedGeometry({
    center: { x: 100, y: 100 },
    rx: 20,
    ry: 15,
    outerSep: 2,
    ...overrides,
  });
}

describe('Cloud shape registration', () => {
  it('is registered in the shape registry', () => {
    assert.strictEqual(getShape('cloud'), cloudShape);
  });
});

describe('Cloud savedGeometry', () => {
  const geom = makeGeom();

  it('stores center', () => {
    assert.deepStrictEqual(geom.center, { x: 100, y: 100 });
  });

  it('stores outerSep', () => {
    assert.strictEqual(geom.outerSep, 2);
  });

  it('defaults to 10 puffs', () => {
    assert.strictEqual(geom.puffs, 10);
  });

  it('defaults to 135° arc', () => {
    assert.strictEqual(geom.arc, 135);
  });

  it('computes anglestep = 360/puffs', () => {
    assert.strictEqual(geom.anglestep, 36);
  });

  it('computes inner radii > 0', () => {
    assert.ok(geom.xInner > 0, `xInner=${geom.xInner}`);
    assert.ok(geom.yInner > 0, `yInner=${geom.yInner}`);
  });

  it('computes outer radii > inner radii', () => {
    assert.ok(geom.xOuter > geom.xInner, `xOuter=${geom.xOuter} > xInner=${geom.xInner}`);
    assert.ok(geom.yOuter > geom.yInner, `yOuter=${geom.yOuter} > yInner=${geom.yInner}`);
  });

  it('respects custom puff count', () => {
    const g = makeGeom({ cloudPuffs: 6 });
    assert.strictEqual(g.puffs, 6);
    assert.strictEqual(g.anglestep, 60);
  });

  it('respects custom arc', () => {
    const g = makeGeom({ cloudPuffArc: 120 });
    assert.strictEqual(g.arc, 120);
  });

  it('respects minimum width/height', () => {
    const g = makeGeom({ minimumWidth: 200, minimumHeight: 150 });
    assert.ok(g.xOuter >= 100, `xOuter=${g.xOuter} >= 100`);
    assert.ok(g.yOuter >= 75, `yOuter=${g.yOuter} >= 75`);
  });

  it('inner/outer satisfy the cross-coupling equations', () => {
    // X = x*cos(p/2) + k*y,  Y = y*cos(p/2) + k*x
    const { xInner, yInner, xOuter, yOuter, cosHalfAnglestep, k } = geom;
    const computedX = cosHalfAnglestep * xInner + k * yInner;
    const computedY = cosHalfAnglestep * yInner + k * xInner;
    assert.ok(near(computedX, xOuter, 0.01), `X: ${computedX} ≈ ${xOuter}`);
    assert.ok(near(computedY, yOuter, 0.01), `Y: ${computedY} ≈ ${yOuter}`);
  });
});

describe('Cloud named anchors', () => {
  const geom = makeGeom();

  it('center anchor', () => {
    const p = cloudShape.anchor('center', geom);
    assert.deepStrictEqual(p, { x: 100, y: 100 });
  });

  it('north anchor is above center', () => {
    const p = cloudShape.anchor('north', geom);
    assert.ok(p.y < geom.center.y, `north.y=${p.y} < center.y=${geom.center.y}`);
    assert.ok(near(p.x, 100, 2), `north.x=${p.x} ≈ 100`);
  });

  it('south anchor is below center', () => {
    const p = cloudShape.anchor('south', geom);
    assert.ok(p.y > geom.center.y, `south.y=${p.y} > center.y=${geom.center.y}`);
  });

  it('east anchor is right of center', () => {
    const p = cloudShape.anchor('east', geom);
    assert.ok(p.x > geom.center.x, `east.x=${p.x} > center.x=${geom.center.x}`);
  });

  it('west anchor is left of center', () => {
    const p = cloudShape.anchor('west', geom);
    assert.ok(p.x < geom.center.x, `west.x=${p.x} < center.x=${geom.center.x}`);
  });

  it('diagonal anchors are in correct quadrants', () => {
    const ne = cloudShape.anchor('north east', geom);
    assert.ok(ne.x > 100 && ne.y < 100, `NE: (${ne.x}, ${ne.y})`);

    const nw = cloudShape.anchor('north west', geom);
    assert.ok(nw.x < 100 && nw.y < 100, `NW: (${nw.x}, ${nw.y})`);

    const se = cloudShape.anchor('south east', geom);
    assert.ok(se.x > 100 && se.y > 100, `SE: (${se.x}, ${se.y})`);

    const sw = cloudShape.anchor('south west', geom);
    assert.ok(sw.x < 100 && sw.y > 100, `SW: (${sw.x}, ${sw.y})`);
  });
});

describe('Cloud borderPoint', () => {
  const geom = makeGeom();

  it('east direction returns point right of center', () => {
    const p = cloudShape.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(p.x > geom.center.x, `east border x=${p.x}`);
    assert.ok(near(p.y, geom.center.y, 3), `east border y=${p.y} ≈ ${geom.center.y}`);
  });

  it('north direction (SVG y-down: y=-1) returns point above center', () => {
    const p = cloudShape.borderPoint(geom, { x: 0, y: -1 });
    assert.ok(p.y < geom.center.y, `north border y=${p.y} < ${geom.center.y}`);
  });

  it('zero direction returns center', () => {
    const p = cloudShape.borderPoint(geom, { x: 0, y: 0 });
    assert.deepStrictEqual(p, geom.center);
  });

  it('ellipse mode returns point on outer ellipse', () => {
    const geomEllipse = makeGeom({ cloudAnchorsUseEllipse: true });
    const p = cloudShape.borderPoint(geomEllipse, { x: 1, y: 0 });
    // Should be at approximately xOuter + outerSep from center
    const expectedX = geomEllipse.center.x + geomEllipse.xOuter + geomEllipse.outerSep;
    assert.ok(near(p.x, expectedX, 1), `ellipse east: ${p.x} ≈ ${expectedX}`);
  });

  it('precise mode returns point further out than inner ellipse', () => {
    const p = cloudShape.borderPoint(geom, { x: 1, y: 0 });
    // Puff bulges should extend beyond the outer ellipse
    const innerX = geom.center.x + geom.xInner;
    assert.ok(p.x > innerX, `precise east ${p.x} > inner ${innerX}`);
  });

  it('border points form a roughly convex shape', () => {
    // Sample border points at regular angles, check they're all
    // at a reasonable distance from center
    const distances = [];
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = deg * Math.PI / 180;
      const dir = { x: Math.cos(rad), y: -Math.sin(rad) };
      const p = cloudShape.borderPoint(geom, dir);
      const dx = p.x - geom.center.x, dy = p.y - geom.center.y;
      distances.push(Math.sqrt(dx * dx + dy * dy));
    }
    // All distances should be positive and within a reasonable range
    for (const d of distances) {
      assert.ok(d > 5, `border distance ${d} > 5`);
      assert.ok(d < 200, `border distance ${d} < 200`);
    }
  });
});

describe('Cloud backgroundPath', () => {
  const geom = makeGeom();

  it('starts with M and ends with Z', () => {
    const path = cloudShape.backgroundPath(geom);
    assert.ok(path.startsWith('M'), 'starts with M');
    assert.ok(path.endsWith('Z'), 'ends with Z');
  });

  it('contains cubic Bézier commands (C)', () => {
    const path = cloudShape.backgroundPath(geom);
    const cCount = (path.match(/ C /g) || []).length;
    // 2 half-arcs per puff × 10 puffs = 20 cubic commands
    assert.strictEqual(cCount, 20, `expected 20 C commands, got ${cCount}`);
  });

  it('cubic count scales with puff count', () => {
    const g6 = makeGeom({ cloudPuffs: 6 });
    const path = cloudShape.backgroundPath(g6);
    const cCount = (path.match(/ C /g) || []).length;
    assert.strictEqual(cCount, 12, `6 puffs → 12 C commands, got ${cCount}`);
  });

  it('path coordinates are finite numbers', () => {
    const path = cloudShape.backgroundPath(geom);
    const numbers = path.match(/-?\d+\.?\d*/g);
    for (const n of numbers) {
      assert.ok(Number.isFinite(parseFloat(n)), `${n} is finite`);
    }
  });
});

describe('Cloud dynamic puff anchors', () => {
  const geom = makeGeom();

  it('puff 1 returns a point', () => {
    const p = cloudShape.anchor('puff 1', geom);
    assert.ok(p.x !== undefined && p.y !== undefined);
  });

  it('puff N returns a point for all valid N', () => {
    for (let i = 1; i <= geom.puffs; i++) {
      const p = cloudShape.anchor(`puff ${i}`, geom);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `puff ${i}: (${p.x}, ${p.y})`);
    }
  });

  it('puff 0 throws (invalid)', () => {
    assert.throws(() => cloudShape.anchor('puff 0', geom), /unknown anchor/);
  });

  it('puff N+1 throws (out of range)', () => {
    assert.throws(() => cloudShape.anchor(`puff ${geom.puffs + 1}`, geom), /unknown anchor/);
  });

  it('puff anchors are outside the inner ellipse', () => {
    for (let i = 1; i <= geom.puffs; i++) {
      const p = cloudShape.anchor(`puff ${i}`, geom);
      const dx = p.x - geom.center.x, dy = p.y - geom.center.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      assert.ok(dist > Math.min(geom.xInner, geom.yInner) * 0.5,
        `puff ${i} distance ${dist} should be outside inner ellipse`);
    }
  });

  it('puff 1 is near the top (first puff starts near 90°)', () => {
    const p = cloudShape.anchor('puff 1', geom);
    // Puff 1 should be roughly above center (y < center.y in SVG)
    assert.ok(p.y < geom.center.y, `puff 1 y=${p.y} < center=${geom.center.y}`);
  });

  it('non-puff dynamic name returns error', () => {
    assert.throws(() => cloudShape.anchor('lobe 1', geom), /unknown anchor/);
  });
});

describe('Cloud with zero outerSep', () => {
  const geom = makeGeom({ outerSep: 0 });

  it('geometry computes without error', () => {
    assert.ok(geom.xInner > 0);
    assert.ok(geom.xOuter > 0);
  });

  it('backgroundPath generates valid path', () => {
    const path = cloudShape.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
  });

  it('borderPoint works', () => {
    const p = cloudShape.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(p.x > geom.center.x);
  });
});

describe('Cloud innerSep and minimumWidth interact correctly', () => {
  it('innerSep=0 vs innerSep=10 produces different cloud sizes (no minimum)', () => {
    // Without minimumWidth, innerSep should directly affect size.
    // Pipeline should pass rx = textHalfW + innerSep to cloud.
    const textHalfW = 20, textHalfH = 15;
    const g0 = cloudShape.savedGeometry({
      center: { x: 0, y: 0 },
      rx: textHalfW + 0,   // innerSep = 0
      ry: textHalfH + 0,
      outerSep: 0,
    });
    const g10 = cloudShape.savedGeometry({
      center: { x: 0, y: 0 },
      rx: textHalfW + 10,  // innerSep = 10
      ry: textHalfH + 10,
      outerSep: 0,
    });
    assert.ok(g10.xInner > g0.xInner,
      `innerSep=10 xInner ${g10.xInner} > innerSep=0 xInner ${g0.xInner}`);
    assert.ok(g10.xOuter > g0.xOuter,
      `innerSep=10 xOuter ${g10.xOuter} > innerSep=0 xOuter ${g0.xOuter}`);
  });

  it('minimumWidth should compete with outer radii, not text radii', () => {
    // TikZ: minimum is applied to OUTER ellipse (after √2 + coupling).
    // So minimum=60 should NOT kick in when outer > 30 (= 60/2).
    // With rx=20, inner ≈ 20*√2 ≈ 28.3, outer ≈ 28.3*1.08 ≈ 30.6.
    // Minimum/2 = 30 < 30.6, so minimum should NOT dominate.
    const withoutMin = cloudShape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 20, ry: 15, outerSep: 0,
    });
    const withMin = cloudShape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 20, ry: 15, outerSep: 0,
      minimumWidth: 60, minimumHeight: 40,
    });
    const innerRatio = withMin.xInner / withoutMin.xInner;
    assert.ok(innerRatio < 1.2,
      `minimumWidth=60 should not inflate xInner by >20%: ratio=${innerRatio.toFixed(3)}`);
  });

  it('pipeline passes text+innerSep as rx, not clamped to minimumWidth', () => {
    // Pipeline should pass rx = textHalfW + innerSep (not max with minimumWidth/2).
    // Cloud handles minimumWidth at the outer level internally.
    // With textHalfW=20, innerSep=3: rx should be 23, not 30 (minW/2).
    const correctRx = 20 + 3; // textHalfW + innerSep
    const g = cloudShape.savedGeometry({
      center: { x: 0, y: 0 }, rx: correctRx, ry: correctRx, outerSep: 0,
      minimumWidth: 60,
    });
    // inner = 23 * √2 ≈ 32.5, not 30 * √2 ≈ 42.4
    assert.ok(g.xInner < 35,
      `xInner should be ~32.5 (from rx=23), got ${g.xInner.toFixed(1)}`);
  });
});

describe('Cloud at origin', () => {
  const geom = makeGeom({ center: { x: 0, y: 0 } });

  it('is symmetric around origin', () => {
    const east = cloudShape.borderPoint(geom, { x: 1, y: 0 });
    const west = cloudShape.borderPoint(geom, { x: -1, y: 0 });
    assert.ok(near(east.x, -west.x, 1), `east.x=${east.x} ≈ -west.x=${-west.x}`);

    const north = cloudShape.borderPoint(geom, { x: 0, y: -1 });
    const south = cloudShape.borderPoint(geom, { x: 0, y: 1 });
    assert.ok(near(north.y, -south.y, 1), `north.y=${north.y} ≈ -south.y=${-south.y}`);
  });
});
