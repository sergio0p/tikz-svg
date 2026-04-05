import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ellipseCallout from '../src-v2/shapes/ellipse-callout.js';
import { getShape } from '../src-v2/shapes/shape.js';

const near = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

function makeGeom(overrides = {}) {
  return ellipseCallout.savedGeometry({
    center: { x: 100, y: 100 },
    rx: 30,
    ry: 20,
    outerSep: 2,
    calloutPointerOffset: { x: 50, y: 40 },
    ...overrides,
  });
}

describe('Ellipse callout registration', () => {
  it('is registered in the shape registry', () => {
    assert.strictEqual(getShape('ellipse callout'), ellipseCallout);
  });
});

describe('Ellipse callout savedGeometry', () => {
  const geom = makeGeom();

  it('stores center', () => {
    assert.deepStrictEqual(geom.center, { x: 100, y: 100 });
  });

  it('rx includes outerSep', () => {
    assert.strictEqual(geom.rx, 32); // 30 + 2
  });

  it('ry includes outerSep', () => {
    assert.strictEqual(geom.ry, 22); // 20 + 2
  });

  it('stores visual radii without outerSep', () => {
    assert.strictEqual(geom.vrx, 30);
    assert.strictEqual(geom.vry, 20);
  });

  it('stores pointer tip offset', () => {
    assert.ok(Number.isFinite(geom.tipRel.x));
    assert.ok(Number.isFinite(geom.tipRel.y));
  });

  it('stores before/after points on ellipse', () => {
    assert.ok(geom.beforeRel && geom.afterRel);
    // Before and after should be on the visual ellipse (approximately)
    const bNorm = (geom.beforeRel.x / 30) ** 2 + (geom.beforeRel.y / 20) ** 2;
    assert.ok(near(bNorm, 1, 0.01), `before on ellipse: norm=${bNorm}`);
    const aNorm = (geom.afterRel.x / 30) ** 2 + (geom.afterRel.y / 20) ** 2;
    assert.ok(near(aNorm, 1, 0.01), `after on ellipse: norm=${aNorm}`);
  });

  it('before and after angles differ by pointerArc', () => {
    const diff = geom.afterAngleDeg - geom.beforeAngleDeg;
    assert.ok(near(diff, 15, 0.01), `angle diff=${diff} ≈ 15`);
  });
});

describe('Ellipse callout anchors', () => {
  const geom = makeGeom();

  it('center anchor', () => {
    const p = ellipseCallout.anchor('center', geom);
    assert.deepStrictEqual(p, { x: 100, y: 100 });
  });

  it('cardinal anchors use full dimensions', () => {
    const e = ellipseCallout.anchor('east', geom);
    assert.ok(near(e.x, 132), `east.x=${e.x} ≈ 132`);
    const n = ellipseCallout.anchor('north', geom);
    assert.ok(near(n.y, 78), `north.y=${n.y} ≈ 78`);
  });

  it('pointer anchor exists', () => {
    const p = ellipseCallout.anchor('pointer', geom);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  });

  it('diagonal anchors are on the ellipse border', () => {
    const ne = ellipseCallout.anchor('north east', geom);
    assert.ok(ne.x > 100 && ne.y < 100, `NE: (${ne.x}, ${ne.y})`);
  });
});

describe('Ellipse callout borderPoint', () => {
  const geom = makeGeom();

  it('east direction', () => {
    const p = ellipseCallout.borderPoint(geom, { x: 1, y: 0 });
    assert.ok(near(p.x, 132));
    assert.ok(near(p.y, 100));
  });

  it('north direction', () => {
    const p = ellipseCallout.borderPoint(geom, { x: 0, y: -1 });
    assert.ok(near(p.x, 100));
    assert.ok(near(p.y, 78));
  });

  it('zero direction returns center', () => {
    const p = ellipseCallout.borderPoint(geom, { x: 0, y: 0 });
    assert.deepStrictEqual(p, geom.center);
  });
});

describe('Ellipse callout backgroundPath', () => {
  const geom = makeGeom();

  it('starts with M and ends with Z', () => {
    const path = ellipseCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
    assert.ok(path.endsWith('Z'));
  });

  it('contains L (line to after) and A (arc) commands', () => {
    const path = ellipseCallout.backgroundPath(geom);
    assert.ok(path.includes(' L '), 'has L command');
    assert.ok(path.includes(' A '), 'has A command');
  });

  it('arc uses visual radii', () => {
    const path = ellipseCallout.backgroundPath(geom);
    // The A command should reference vrx=30 and vry=20
    assert.ok(path.includes('30 20'), `arc uses visual radii: ${path}`);
  });

  it('all coordinates are finite', () => {
    const path = ellipseCallout.backgroundPath(geom);
    const numbers = path.match(/-?\d+\.?\d*/g);
    for (const n of numbers) {
      assert.ok(Number.isFinite(parseFloat(n)), `${n} is finite`);
    }
  });
});

describe('Ellipse callout pointer directions', () => {
  it('pointer to the right', () => {
    const geom = makeGeom({ calloutPointerOffset: { x: 60, y: 0 } });
    const path = ellipseCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
  });

  it('pointer above', () => {
    const geom = makeGeom({ calloutPointerOffset: { x: 0, y: -50 } });
    const path = ellipseCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
  });

  it('pointer to the left', () => {
    const geom = makeGeom({ calloutPointerOffset: { x: -60, y: 0 } });
    const path = ellipseCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
  });

  it('pointer below', () => {
    const geom = makeGeom({ calloutPointerOffset: { x: 0, y: 50 } });
    const path = ellipseCallout.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
  });
});

describe('Ellipse callout custom pointer arc', () => {
  it('wider arc produces more separated before/after', () => {
    const narrow = makeGeom({ calloutPointerArc: 10 });
    const wide = makeGeom({ calloutPointerArc: 40 });

    const narrowDist = Math.sqrt(
      (narrow.afterRel.x - narrow.beforeRel.x) ** 2 +
      (narrow.afterRel.y - narrow.beforeRel.y) ** 2
    );
    const wideDist = Math.sqrt(
      (wide.afterRel.x - wide.beforeRel.x) ** 2 +
      (wide.afterRel.y - wide.beforeRel.y) ** 2
    );

    assert.ok(wideDist > narrowDist, `wide=${wideDist} > narrow=${narrowDist}`);
  });
});

describe('Ellipse callout pointer shortening', () => {
  it('shortened pointer is closer to center', () => {
    const normal = makeGeom({ calloutPointerShorten: 0 });
    const short = makeGeom({ calloutPointerShorten: 10 });

    const dNorm = Math.sqrt(normal.tipRel.x ** 2 + normal.tipRel.y ** 2);
    const dShort = Math.sqrt(short.tipRel.x ** 2 + short.tipRel.y ** 2);

    assert.ok(dShort < dNorm);
    assert.ok(near(dNorm - dShort, 10, 1));
  });
});

describe('Ellipse callout emitter re-call', () => {
  it('works when re-called with center at origin', () => {
    const geom = makeGeom();
    const localGeom = ellipseCallout.savedGeometry({
      ...geom,
      center: { x: 0, y: 0 },
    });
    const path = ellipseCallout.backgroundPath(localGeom);
    assert.ok(path.startsWith('M'));
  });
});
