import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SeededRandom } from '../src-v2/core/random.js';
import {
  deformPolygon, sweepRibbon, watercolorLayers, watercolorRibbon,
} from '../src-v2/decorations/watercolor.js';

describe('SeededRandom.gauss', () => {
  it('is deterministic from the same seed', () => {
    const a = new SeededRandom(123);
    const b = new SeededRandom(123);
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(a.gauss(), b.gauss());
    }
  });

  it('consumes exactly two rand() draws per pair (spare is cached)', () => {
    // A fresh generator's first gauss() consumes two rand()s and caches a spare;
    // the second gauss() consumes none. So after two gauss() calls the stream
    // position equals a generator that made exactly two rand() calls.
    const g = new SeededRandom(7);
    g.gauss();
    g.gauss();
    const afterGauss = g.rand();

    const r = new SeededRandom(7);
    r.rand();
    r.rand();
    const afterRand = r.rand();

    assert.strictEqual(afterGauss, afterRand);
  });

  it('is roughly standard-normal (mean ~0, stdev ~1)', () => {
    const rng = new SeededRandom(42);
    const N = 20000;
    let sum = 0, sumSq = 0;
    for (let i = 0; i < N; i++) {
      const v = rng.gauss();
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / N;
    const variance = sumSq / N - mean * mean;
    assert.ok(Math.abs(mean) < 0.05, `mean ${mean} not ~0`);
    assert.ok(Math.abs(Math.sqrt(variance) - 1) < 0.05, `stdev ${Math.sqrt(variance)} not ~1`);
  });

  it('never returns a non-finite value (log(0) guard)', () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 5000; i++) {
      assert.ok(Number.isFinite(rng.gauss()));
    }
  });
});

describe('deformPolygon', () => {
  const square = [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
  ];

  it('doubles the vertex count per round (closed)', () => {
    const out = deformPolygon(square, {
      rounds: 3, prng: new SeededRandom(1), closed: true,
    });
    // closed: each round n → 2n. 4 → 8 → 16 → 32
    assert.strictEqual(out.length, 32);
  });

  it('is deterministic for a fixed seed', () => {
    const a = deformPolygon(square, { rounds: 2, prng: new SeededRandom(5), closed: true });
    const b = deformPolygon(square, { rounds: 2, prng: new SeededRandom(5), closed: true });
    assert.deepStrictEqual(a, b);
  });

  it('weight(t)=0 leaves geometry undisplaced (hard edge)', () => {
    // With zero weight everywhere, midpoints are exact averages — no Gaussian push.
    const out = deformPolygon(square, {
      rounds: 1, prng: new SeededRandom(3), closed: true, weight: () => 0,
    });
    // First inserted midpoint is between (0,0) and (100,0) → (50,0)
    const mid = out[1];
    assert.ok(Math.abs(mid.x - 50) < 1e-9 && Math.abs(mid.y - 0) < 1e-9);
  });

  it('requires a prng', () => {
    assert.throws(() => deformPolygon(square, { rounds: 1 }));
  });

  it('carries arc-length parameter t in [0,1]', () => {
    const out = deformPolygon(square, { rounds: 2, prng: new SeededRandom(2), closed: true });
    for (const p of out) {
      assert.ok(p.t >= 0 && p.t <= 1, `t=${p.t} out of range`);
    }
  });
});

describe('sweepRibbon', () => {
  it('produces a closed ribbon with twice the spine vertex count', () => {
    const spine = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];
    const ribbon = sweepRibbon(spine, { width: 10 });
    assert.strictEqual(ribbon.length, spine.length * 2);
  });

  it('offsets vertices to both sides of the spine', () => {
    const spine = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const ribbon = sweepRibbon(spine, { width: 20, widthProfile: () => 1 });
    const ys = ribbon.map(p => p.y);
    assert.ok(Math.max(...ys) > 0 && Math.min(...ys) < 0, 'ribbon should straddle the spine');
  });
});

describe('watercolorLayers', () => {
  const tri = 'M 0 0 L 100 0 L 50 100 Z';

  it('returns nominal path plus the requested number of layers', () => {
    const out = watercolorLayers(tri, { layers: 8, prng: new SeededRandom(1) });
    assert.ok(typeof out.nominal === 'string' && out.nominal.startsWith('M'));
    assert.strictEqual(out.layers.length, 8);
    for (const l of out.layers) {
      assert.ok(l.d.startsWith('M'));
      assert.ok(typeof l.opacity === 'number');
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = watercolorLayers(tri, { layers: 5, seed: 11 });
    const b = watercolorLayers(tri, { layers: 5, seed: 11 });
    assert.deepStrictEqual(a, b);
  });

  it('nominal path is the undeformed outline (bbox source)', () => {
    // Coarse segmentLength on a triangle keeps the three corners; nominal must
    // not contain the deformation jitter, so its vertex count stays small.
    const out = watercolorLayers(tri, { layers: 3, segmentLength: 200, seed: 1 });
    const verts = out.nominal.match(/[ML]/g) || [];
    assert.ok(verts.length <= 4, `nominal has ${verts.length} verts, expected coarse`);
  });

  it('accepts pre-sampled points (ribbon path)', () => {
    const ribbon = sweepRibbon(
      [{ x: 0, y: 0 }, { x: 80, y: 20 }, { x: 160, y: 0 }], { width: 16 });
    const out = watercolorLayers(null, { points: ribbon, closed: true, layers: 4, seed: 2 });
    assert.strictEqual(out.layers.length, 4);
  });
});

describe('watercolorRibbon', () => {
  const spine = 'M 0 0 L 100 0 L 200 0';

  it('returns nominal path plus the requested number of layers', () => {
    const out = watercolorRibbon(spine, { layers: 6, width: 14, prng: new SeededRandom(1) });
    assert.ok(typeof out.nominal === 'string' && out.nominal.startsWith('M'));
    assert.strictEqual(out.layers.length, 6);
    for (const l of out.layers) {
      assert.ok(l.d.startsWith('M'));
      assert.ok(typeof l.opacity === 'number');
    }
  });

  it('nominal is a closed ribbon outline (ends with Z)', () => {
    const out = watercolorRibbon(spine, { layers: 2, width: 12, seed: 1 });
    assert.ok(/Z\s*$/.test(out.nominal), `nominal should close: ${out.nominal}`);
  });

  it('ribbon straddles the spine (covers the brush width)', () => {
    // A horizontal spine at y=0 with width 20 must produce geometry on both
    // sides of y=0 once swept; the nominal outline carries that extent.
    const out = watercolorRibbon('M 0 0 L 200 0', {
      layers: 1, width: 20, widthProfile: () => 1, seed: 3,
    });
    const ys = (out.nominal.match(/-?\d+(?:\.\d+)?/g) || [])
      .map(Number).filter((_, i) => i % 2 === 1); // odd indices are y values
    assert.ok(Math.max(...ys) > 1 && Math.min(...ys) < -1, 'ribbon should straddle y=0');
  });

  it('is deterministic for a fixed seed', () => {
    const a = watercolorRibbon(spine, { layers: 4, width: 12, seed: 7 });
    const b = watercolorRibbon(spine, { layers: 4, width: 12, seed: 7 });
    assert.deepStrictEqual(a, b);
  });

  it('degenerate spine (single point) yields no layers', () => {
    const out = watercolorRibbon('M 5 5', { layers: 4, seed: 1 });
    assert.deepStrictEqual(out.layers, []);
  });
});
