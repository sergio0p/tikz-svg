import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import diamondShape from '../src-v2/shapes/diamond.js';

const near = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

describe('Diamond TikZ-faithful sizing', () => {
  it('aspect=1: halfWidth = xa + ya (text + innerSep combined)', () => {
    // TikZ: halfW = xa + aspect*ya = 20 + 1*15 = 35, + outerSep
    const geom = diamondShape.savedGeometry({
      center: { x: 0, y: 0 },
      rx: 20, ry: 15,  // textHalfW+innerSep, textHalfH+innerSep
      outerSep: 2,
    });
    assert.ok(near(geom.halfWidth, 20 + 15 + 2, 0.01),
      `halfW = ${geom.halfWidth}, expected ${20 + 15 + 2}`);
    assert.ok(near(geom.halfHeight, 20 + 15 + 2, 0.01),
      `halfH = ${geom.halfHeight}, expected ${20 + 15 + 2}`);
  });

  it('aspect=2: halfWidth wider, halfHeight taller', () => {
    const geom = diamondShape.savedGeometry({
      center: { x: 0, y: 0 },
      rx: 20, ry: 15,
      outerSep: 0,
      shapeAspect: 2,
    });
    // halfW = 20 + 2*15 = 50
    // halfH = (1/2)*20 + 15 = 25
    assert.ok(near(geom.halfWidth, 50, 0.01), `halfW=${geom.halfWidth}`);
    assert.ok(near(geom.halfHeight, 25, 0.01), `halfH=${geom.halfHeight}`);
  });

  it('minimumWidth applied after aspect transform', () => {
    // Without minimum: halfW = 20+15 = 35
    // With minimum=80: halfW = max(35, 40) = 40
    const withoutMin = diamondShape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 20, ry: 15, outerSep: 0,
    });
    const withMin = diamondShape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 20, ry: 15, outerSep: 0,
      minimumWidth: 80,
    });
    assert.ok(near(withoutMin.halfWidth, 35, 0.01));
    assert.ok(near(withMin.halfWidth, 40, 0.01),
      `with min=80: halfW=${withMin.halfWidth}, expected 40`);
  });

  it('minimumWidth does not affect diamond when transform result is larger', () => {
    // halfW = 20+15 = 35. minimumWidth/2 = 30 < 35, so no effect.
    const g = diamondShape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 20, ry: 15, outerSep: 0,
      minimumWidth: 60,
    });
    assert.ok(near(g.halfWidth, 35, 0.01), `halfW=${g.halfWidth}`);
  });

  it('innerSep (via larger rx) affects diamond size even with minimumWidth', () => {
    // Simulating innerSep=0 vs innerSep=5 (pipeline adds to rx/ry)
    const g0 = diamondShape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 20, ry: 15, outerSep: 0,
      minimumWidth: 60,
    });
    const g5 = diamondShape.savedGeometry({
      center: { x: 0, y: 0 }, rx: 25, ry: 20, outerSep: 0,
      minimumWidth: 60,
    });
    // g0: halfW = 20+15 = 35, max(35, 30) = 35
    // g5: halfW = 25+20 = 45, max(45, 30) = 45
    assert.ok(g5.halfWidth > g0.halfWidth,
      `innerSep=5 halfW=${g5.halfWidth} > innerSep=0 halfW=${g0.halfWidth}`);
  });

  it('backgroundPath produces valid diamond path', () => {
    const geom = diamondShape.savedGeometry({
      center: { x: 100, y: 100 }, rx: 20, ry: 15, outerSep: 2,
    });
    const path = diamondShape.backgroundPath(geom);
    assert.ok(path.startsWith('M'));
    assert.ok(path.endsWith('Z'));
    assert.ok(path.includes('L'));
  });

  it('legacy halfWidth/halfHeight still works', () => {
    // Backward compat: if rx/ry not provided, fall back to halfWidth/halfHeight
    const geom = diamondShape.savedGeometry({
      center: { x: 0, y: 0 }, halfWidth: 30, halfHeight: 20, outerSep: 0,
    });
    // halfW = 30 + 1*20 = 50, halfH = 30 + 20 = 50
    assert.ok(near(geom.halfWidth, 50, 0.01), `legacy halfW=${geom.halfWidth}`);
  });

  it('stores rx/ry for emitter re-call', () => {
    const geom = diamondShape.savedGeometry({
      center: { x: 100, y: 100 }, rx: 20, ry: 15, outerSep: 2,
    });
    assert.strictEqual(geom.rx, 20);
    assert.strictEqual(geom.ry, 15);
  });
});
