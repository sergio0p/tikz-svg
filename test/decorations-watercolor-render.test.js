import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

import { render } from '../src-v2/index.js';
import { resolveColor } from '../src-v2/core/color.js';
import { DEFAULTS } from '../src-v2/core/constants.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const vbWidth = (svg) => {
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  return vb[2];
};

const waterConfig = (extra = {}) => ({
  seed: 7,
  states: {
    q0: {
      position: [0, 0],
      shape: 'circle',
      fill: '#cc4444',
      decoration: { type: 'watercolor', layers: 10 },
      ...extra,
    },
  },
  edges: [],
});

describe('watercolor fill wash (render integration)', () => {
  it('emits a <g class="watercolor"> with bleed layers + one nominal path', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig());

    const g = svg.querySelector('.node-layer g.watercolor');
    assert.ok(g, 'watercolor wash group should exist');

    const bleed = g.querySelectorAll('path[data-bleed]');
    assert.strictEqual(bleed.length, 10, 'one path per requested layer, all data-bleed');

    const nominal = [...g.querySelectorAll('path')].filter(p => !p.hasAttribute('data-bleed'));
    assert.strictEqual(nominal.length, 1, 'exactly one nominal (bbox) path');
    assert.strictEqual(nominal[0].getAttribute('fill'), 'none', 'nominal is invisible');
  });

  it('paints layers with the fill pigment at fractional fill-opacity', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig());

    const bleed = svg.querySelectorAll('.node-layer g.watercolor path[data-bleed]');
    for (const p of bleed) {
      assert.strictEqual(p.getAttribute('fill'), '#cc4444');
      const o = parseFloat(p.getAttribute('fill-opacity'));
      assert.ok(o > 0 && o < 1, `layer fill-opacity ${o} should be translucent`);
    }
    // No native <circle> when washed.
    assert.strictEqual(svg.querySelectorAll('.node-layer circle').length, 0);
  });

  it('is deterministic for a fixed seed', () => {
    const a = document.createElementNS(SVG_NS, 'svg');
    const b = document.createElementNS(SVG_NS, 'svg');
    render(a, waterConfig());
    render(b, waterConfig());
    const da = [...a.querySelectorAll('.node-layer g.watercolor path[data-bleed]')].map(p => p.getAttribute('d'));
    const db = [...b.querySelectorAll('.node-layer g.watercolor path[data-bleed]')].map(p => p.getAttribute('d'));
    assert.deepStrictEqual(da, db);
  });

  it('does not let bleed inflate the viewBox (nominal-only bounds)', () => {
    // Same node, washed vs crisp. The bleed overflows the outline by design;
    // the washed viewBox must stay close to the crisp one, not balloon.
    const washed = document.createElementNS(SVG_NS, 'svg');
    const crisp = document.createElementNS(SVG_NS, 'svg');
    render(washed, waterConfig());
    render(crisp, {
      seed: 7,
      states: { q0: { position: [0, 0], shape: 'circle', fill: '#cc4444' } },
      edges: [],
    });
    const dw = vbWidth(washed);
    const dc = vbWidth(crisp);
    assert.ok(Math.abs(dw - dc) <= 12,
      `washed viewBox width ${dw} should track crisp ${dc} (bleed excluded)`);
  });

  it('falls back to crisp rendering when there is no fill pigment', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig({ fill: 'none' }));
    assert.strictEqual(svg.querySelectorAll('.node-layer g.watercolor').length, 0,
      'no wash group without a fill pigment');
  });
});

const edgeConfig = () => ({
  seed: 7,
  states: {
    a: { position: [0, 0], shape: 'circle', radius: 14 },
    b: { position: [140, 0], shape: 'circle', radius: 14 },
  },
  edges: [{ from: 'a', to: 'b', stroke: '#aa3322', decoration: { type: 'watercolor', layers: 10 } }],
});

describe('watercolor stroke ribbon — edges (render integration)', () => {
  it('emits a ribbon <g class="watercolor"> in the edge layer', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, edgeConfig());

    const g = svg.querySelector('.edge-layer g.watercolor');
    assert.ok(g, 'edge ribbon wash group should exist');

    const bleed = g.querySelectorAll('path[data-bleed]');
    assert.strictEqual(bleed.length, 10, 'one path per requested layer');

    // edgeConfig inherits the default arrow:'stealth', so the wash carries an
    // invisible spine path for the arrow tip — exclude it from the nominal count.
    const nominal = [...g.querySelectorAll('path')]
      .filter(p => !p.hasAttribute('data-bleed') && !p.hasAttribute('data-wash-spine'));
    assert.strictEqual(nominal.length, 1, 'exactly one nominal (bbox) path');
    assert.strictEqual(nominal[0].getAttribute('fill'), 'none', 'nominal is invisible');

    const spine = g.querySelectorAll('path[data-wash-spine]');
    assert.strictEqual(spine.length, 1, 'exactly one arrow-carrying spine path');
  });

  it('paints the ribbon with the stroke pigment, translucent', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, edgeConfig());
    const bleed = svg.querySelectorAll('.edge-layer g.watercolor path[data-bleed]');
    for (const p of bleed) {
      assert.strictEqual(p.getAttribute('fill'), '#aa3322', 'pigment = edge stroke');
      const o = parseFloat(p.getAttribute('fill-opacity'));
      assert.ok(o > 0 && o < 1, `ribbon layer opacity ${o} should be translucent`);
    }
    // No crisp <path> stroke for the washed edge.
    assert.strictEqual(svg.querySelectorAll('.edge-layer path[stroke="#aa3322"]').length, 0);
  });

  it('is deterministic for a fixed seed', () => {
    const a = document.createElementNS(SVG_NS, 'svg');
    const b = document.createElementNS(SVG_NS, 'svg');
    render(a, edgeConfig());
    render(b, edgeConfig());
    const da = [...a.querySelectorAll('.edge-layer g.watercolor path[data-bleed]')].map(p => p.getAttribute('d'));
    const db = [...b.querySelectorAll('.edge-layer g.watercolor path[data-bleed]')].map(p => p.getAttribute('d'));
    assert.deepStrictEqual(da, db);
  });
});

const drawPathConfig = (extra = {}) => ({
  seed: 7,
  states: {},
  paths: [{
    points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 90 }],
    stroke: '#2244aa',
    decoration: { type: 'watercolor', layers: 10 },
    ...extra,
  }],
});

describe('watercolor stroke ribbon — draw paths (render integration)', () => {
  it('washes a stroked draw path as a ribbon', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, drawPathConfig());
    const g = svg.querySelector('.edge-layer g.watercolor');
    assert.ok(g, 'draw-path ribbon group should exist');
    const bleed = g.querySelectorAll('path[data-bleed]');
    assert.strictEqual(bleed.length, 10);
    assert.strictEqual(bleed[0].getAttribute('fill'), '#2244aa', 'pigment = path stroke');
    // No crisp draw-path when washed.
    assert.strictEqual(svg.querySelectorAll('.edge-layer path.draw-path').length, 0);
  });

  it('filldraw path emits two groups: fill wash + stroke ribbon', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, drawPathConfig({
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 90 }],
      cycle: true, fill: '#66aa44', stroke: '#224422',
    }));
    const groups = svg.querySelectorAll('.edge-layer g.watercolor');
    assert.strictEqual(groups.length, 2, 'one fill wash + one stroke ribbon');
    const pigments = new Set(
      [...svg.querySelectorAll('.edge-layer g.watercolor path[data-bleed]')]
        .map(p => p.getAttribute('fill')));
    assert.ok(pigments.has('#66aa44') && pigments.has('#224422'),
      `expected both pigments, got ${[...pigments].join(',')}`);
  });

  it('does not let ribbon bleed inflate the viewBox (nominal-only bounds)', () => {
    // A bare draw path: the ribbon IS the bbox. Washed bounds must cover the
    // brush width (~±6px) but exclude the much larger deformation bleed.
    const washed = document.createElementNS(SVG_NS, 'svg');
    const crisp = document.createElementNS(SVG_NS, 'svg');
    render(washed, drawPathConfig());
    render(crisp, {
      seed: 7, states: {},
      paths: [{ points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 90 }], stroke: '#2244aa' }],
    });
    const dw = vbWidth(washed);
    const dc = vbWidth(crisp);
    assert.ok(Math.abs(dw - dc) <= 20,
      `washed viewBox width ${dw} should track crisp ${dc} (bleed excluded)`);
  });
});

describe('watercolor paper grain (feTurbulence granulation)', () => {
  it('is off by default — no filter, no filter attr', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig());
    assert.strictEqual(svg.querySelectorAll('defs filter feTurbulence').length, 0,
      'no grain filter without opt-in');
    const g = svg.querySelector('.node-layer g.watercolor');
    assert.strictEqual(g.hasAttribute('filter'), false, 'no filter attr on the wash group');
    assert.strictEqual(g.hasAttribute('data-grain'), false, 'no leftover data-grain tag');
  });

  it('grain:true adds one shared filter and references it from the wash group', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig({ decoration: { type: 'watercolor', layers: 10, grain: true } }));

    const turb = svg.querySelectorAll('defs filter feTurbulence');
    assert.strictEqual(turb.length, 1, 'exactly one grain filter');
    assert.strictEqual(turb[0].getAttribute('baseFrequency'), '0.55', 'default frequency');
    assert.strictEqual(turb[0].getAttribute('type'), 'fractalNoise');

    const filterEl = turb[0].closest('filter');
    const g = svg.querySelector('.node-layer g.watercolor');
    assert.strictEqual(g.getAttribute('filter'), `url(#${filterEl.id})`,
      'wash group references the grain filter');
    assert.strictEqual(g.hasAttribute('data-grain'), false, 'transient tag consumed');

    // feColorMatrix encodes default strength 0.2 in the alpha row.
    const cm = filterEl.querySelector('feColorMatrix').getAttribute('values');
    assert.ok(cm.includes('-0.2 0.2'), `alpha row should carry ±strength, got "${cm}"`);
    // Clipped to painted area only.
    const comp = filterEl.querySelector('feComposite');
    assert.strictEqual(comp.getAttribute('in2'), 'SourceAlpha');
    assert.strictEqual(comp.getAttribute('operator'), 'in');
  });

  it('honours custom grain { frequency, strength }', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig({
      decoration: { type: 'watercolor', layers: 10, grain: { frequency: 0.8, strength: 0.3 } },
    }));
    const turb = svg.querySelector('defs filter feTurbulence');
    assert.strictEqual(turb.getAttribute('baseFrequency'), '0.8');
    const cm = svg.querySelector('defs filter feColorMatrix').getAttribute('values');
    assert.ok(cm.includes('-0.3 0.3'), `expected ±0.3 strength, got "${cm}"`);
  });

  it('seeds the turbulence from config.seed (deterministic)', () => {
    const a = document.createElementNS(SVG_NS, 'svg');
    const b = document.createElementNS(SVG_NS, 'svg');
    render(a, { ...waterConfig({ decoration: { type: 'watercolor', layers: 10, grain: true } }), seed: 123 });
    render(b, { ...waterConfig({ decoration: { type: 'watercolor', layers: 10, grain: true } }), seed: 123 });
    const sa = a.querySelector('feTurbulence').getAttribute('seed');
    const sb = b.querySelector('feTurbulence').getAttribute('seed');
    assert.strictEqual(sa, sb, 'same config.seed → same turbulence seed');
    assert.strictEqual(sa, String(123 % 9999));
  });

  it('deduplicates: two same-param grained washes share one filter', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 7, states: {},
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 60, y: 0 }], cycle: true, fill: '#66aa44',
          decoration: { type: 'watercolor', layers: 6, grain: true } },
        { points: [{ x: 0, y: 80 }, { x: 60, y: 80 }], cycle: true, fill: '#4466aa',
          decoration: { type: 'watercolor', layers: 6, grain: true } },
      ],
    });
    assert.strictEqual(svg.querySelectorAll('defs filter feTurbulence').length, 1,
      'identical grain params → a single shared filter (one continuous paper)');
    const refs = new Set([...svg.querySelectorAll('g.watercolor')].map(g => g.getAttribute('filter')));
    assert.strictEqual(refs.size, 1, 'both washes reference the same filter id');
  });

  it('emits separate filters for distinct grain params', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 7, states: {},
      paths: [
        { points: [{ x: 0, y: 0 }, { x: 60, y: 0 }], cycle: true, fill: '#66aa44',
          decoration: { type: 'watercolor', layers: 6, grain: { frequency: 0.4 } } },
        { points: [{ x: 0, y: 80 }, { x: 60, y: 80 }], cycle: true, fill: '#4466aa',
          decoration: { type: 'watercolor', layers: 6, grain: { frequency: 0.9 } } },
      ],
    });
    assert.strictEqual(svg.querySelectorAll('defs filter feTurbulence').length, 2,
      'distinct params → distinct filters');
  });

  it('grain does not change the viewBox (filters are geometry-invisible)', () => {
    const plain = document.createElementNS(SVG_NS, 'svg');
    const grained = document.createElementNS(SVG_NS, 'svg');
    render(plain, waterConfig());
    render(grained, waterConfig({ decoration: { type: 'watercolor', layers: 10, grain: true } }));
    assert.strictEqual(grained.getAttribute('viewBox'), plain.getAttribute('viewBox'),
      'grain must not perturb bounds');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Plan 2 — Fix #4: path fill colors are normalized before the wash paints them.
// A TikZ-mix / named token must resolve to hex for BOTH the watercolor fill-wash
// and the crisp fallback, not leak the raw string into the fill attribute.
// ─────────────────────────────────────────────────────────────────────────────
describe('watercolor fill wash — path fill color normalization (Fix #4)', () => {
  const mixCfg = (extra = {}) => ({
    seed: 7, states: {},
    paths: [{
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 90 }],
      cycle: true, fill: 'red!50!blue', ...extra,
    }],
  });

  it('normalizes a TikZ-mix path fill before painting the wash', () => {
    const expected = resolveColor('red!50!blue');
    assert.strictEqual(expected, '#800080', 'sanity: red!50!blue resolves to #800080');

    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, mixCfg({ decoration: { type: 'watercolor', layers: 8 } }));
    const bleed = svg.querySelectorAll('.edge-layer g.watercolor path[data-bleed]');
    assert.ok(bleed.length > 0, 'fill wash should paint bleed layers');
    for (const p of bleed) {
      assert.strictEqual(p.getAttribute('fill'), expected,
        'every bleed layer uses the resolved mix color, not the raw token');
    }
  });

  it('crisp regression: a non-washed path fill is normalized too', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, mixCfg());
    const p = svg.querySelector('.edge-layer path.draw-path');
    assert.ok(p, 'crisp draw-path should exist');
    assert.strictEqual(p.getAttribute('fill'), resolveColor('red!50!blue'),
      'crisp fill resolves the mix token, not the raw string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Plan 2 — Fix #2: a fill-only \draw must not sprout an unrequested black ribbon.
// The ribbon wash is emitted only when a stroke was actually requested, OR when
// there is no fill at all (a bare line still washes with the default stroke).
// ─────────────────────────────────────────────────────────────────────────────
describe('watercolor — fill-only path emits no black ribbon (Fix #2)', () => {
  const fillOnly = (extra = {}) => ({
    seed: 7, states: {},
    paths: [{
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 90 }],
      cycle: true, fill: '#66aa44',
      decoration: { type: 'watercolor', layers: 8 },
      ...extra,
    }],
  });

  const pigmentsOf = (svg) => new Set(
    [...svg.querySelectorAll('.edge-layer g.watercolor path[data-bleed]')]
      .map(p => p.getAttribute('fill')));

  it('a fill-only path produces exactly one fill wash, no stroke ribbon', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, fillOnly());
    assert.strictEqual(svg.querySelectorAll('.edge-layer g.watercolor').length, 1,
      'fill wash only — no implicit black ribbon');
    assert.deepStrictEqual([...pigmentsOf(svg)], ['#66aa44'],
      'only the fill pigment, never default #000000');
  });

  it('explicit stroke:"none" with a fill also suppresses the ribbon', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, fillOnly({ stroke: 'none' }));
    assert.strictEqual(svg.querySelectorAll('.edge-layer g.watercolor').length, 1,
      'no ribbon when stroke is explicitly none');
    assert.deepStrictEqual([...pigmentsOf(svg)], ['#66aa44']);
  });

  it('a bare line (no fill, no stroke) still washes as a default-stroke ribbon', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 7, states: {},
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 90 }],
        decoration: { type: 'watercolor', layers: 8 },
      }],
    });
    assert.strictEqual(svg.querySelectorAll('.edge-layer g.watercolor').length, 1,
      'a bare stroke path washes as exactly one ribbon');
    assert.deepStrictEqual([...pigmentsOf(svg)], [resolveColor(DEFAULTS.pathColor)],
      'default path color pigment when nothing else is specified');
  });

  it('filldraw still emits both fill wash and stroke ribbon (regression)', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, fillOnly({ stroke: '#224422' }));
    assert.strictEqual(svg.querySelectorAll('.edge-layer g.watercolor').length, 2,
      'explicit stroke + fill → fill wash + ribbon');
    const pig = pigmentsOf(svg);
    assert.ok(pig.has('#66aa44') && pig.has('#224422'),
      `expected both pigments, got ${[...pig].join(',')}`);
  });

  // A color= shorthand or a named-style stroke both count as a requested stroke
  // (they spread/merge a stroke into the path props), so the ribbon must fire.
  // These cells of the Fix #2 truth table had no direct render coverage.
  it('color= shorthand on a filled path still emits the ribbon', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, fillOnly({ color: '#ff0000' }));
    assert.strictEqual(svg.querySelectorAll('.edge-layer g.watercolor').length, 2,
      'color= requests a stroke → fill wash + ribbon');
    const pig = pigmentsOf(svg);
    assert.ok(pig.has('#66aa44') && pig.has('#ff0000'),
      `expected fill + color= ribbon pigment, got ${[...pig].join(',')}`);
  });

  it('a named-style stroke on a filled path still emits the ribbon', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, {
      seed: 7, states: {},
      styles: { ink: { stroke: '#0000ff' } },
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 90 }],
        cycle: true, fill: '#66aa44', style: 'ink',
        decoration: { type: 'watercolor', layers: 8 },
      }],
    });
    assert.strictEqual(svg.querySelectorAll('.edge-layer g.watercolor').length, 2,
      'named-style stroke requests a stroke → fill wash + ribbon');
    const pig = pigmentsOf(svg);
    assert.ok(pig.has('#66aa44') && pig.has('#0000ff'),
      `expected fill + named-style ribbon pigment, got ${[...pig].join(',')}`);
  });

  // Regression guard (review finding): an arrow implies a stroked line, so a
  // filled path that requests an arrow but no explicit stroke must still wash a
  // ribbon to carry the tip — otherwise the arrowhead floats with no line.
  it('a fill + arrow path (no explicit stroke) washes a ribbon to carry the tip', () => {
    const arrowed = {
      seed: 7, states: {},
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 90 }],
        fill: '#66aa44', arrow: '->',
        decoration: { type: 'watercolor', layers: 8 },
      }],
    };
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, arrowed);
    assert.strictEqual(svg.querySelectorAll('.edge-layer g.watercolor').length, 2,
      'fill wash + ribbon (the arrow forces the ribbon)');
    const pig = pigmentsOf(svg);
    assert.ok(pig.has('#66aa44') && pig.has(resolveColor(DEFAULTS.pathColor)),
      `expected fill + default-stroke ribbon, got ${[...pig].join(',')}`);

    // The invisible spine carries the marker-end so the tip lands on the line.
    const spine = svg.querySelector('.edge-layer path[data-wash-spine]');
    assert.ok(spine, 'a spine path should carry the arrow marker');
    assert.ok(spine.getAttribute('marker-end'), 'spine carries the end marker');

    // Contrast: the SAME path WITHOUT the arrow is fill-only → one group, no tip.
    const noArrow = document.createElementNS(SVG_NS, 'svg');
    render(noArrow, {
      ...arrowed,
      paths: [{ ...arrowed.paths[0], arrow: undefined }],
    });
    assert.strictEqual(noArrow.querySelectorAll('.edge-layer g.watercolor').length, 1,
      'no arrow, no explicit stroke → fill wash only');
    assert.strictEqual(noArrow.querySelector('.edge-layer path[data-wash-spine]'), null,
      'no ribbon → no spine → no floating arrowhead');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Plan 2 — Fix #3: a watercolor fill node keeps a visible border (stopgap).
// The invisible nominal path is stroked with the node's resolved stroke so a
// filldraw / white-fill node isn't near-invisible. stroke:'none' → no border.
// Still exactly ONE non-bleed path (no spine on nodes), so bbox math is intact.
// ─────────────────────────────────────────────────────────────────────────────
describe('watercolor fill node — visible border stopgap (Fix #3)', () => {
  const nominalOf = (svg) => {
    const g = svg.querySelector('.node-layer g.watercolor');
    const nonBleed = [...g.querySelectorAll('path')]
      .filter(p => !p.hasAttribute('data-bleed') && !p.hasAttribute('data-wash-spine'));
    return { g, nonBleed };
  };

  it('default-stroke node strokes the nominal with the node stroke', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig());
    const { nonBleed } = nominalOf(svg);
    assert.strictEqual(nonBleed.length, 1, 'exactly one non-bleed nominal path (no spine on nodes)');
    const nominal = nonBleed[0];
    assert.strictEqual(nominal.getAttribute('fill'), 'none', 'nominal stays fill-invisible');
    assert.strictEqual(nominal.getAttribute('stroke'), DEFAULTS.nodeStroke,
      'nominal carries the resolved node stroke as a visible border');
    assert.ok(parseFloat(nominal.getAttribute('stroke-width')) > 0,
      'border has a positive stroke-width');
  });

  it('honours an explicit node stroke color', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig({ stroke: '#123456' }));
    const { nonBleed } = nominalOf(svg);
    assert.strictEqual(nonBleed[0].getAttribute('stroke'), '#123456');
  });

  it('stroke:"none" keeps the nominal borderless (no outline)', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig({ stroke: 'none' }));
    const { nonBleed } = nominalOf(svg);
    assert.strictEqual(nonBleed.length, 1, 'still exactly one non-bleed path');
    assert.strictEqual(nonBleed[0].getAttribute('stroke'), 'none',
      'no border when the node stroke is none');
  });

  it('the stroked border does not balloon the viewBox', () => {
    const washed = document.createElementNS(SVG_NS, 'svg');
    const crisp = document.createElementNS(SVG_NS, 'svg');
    render(washed, waterConfig({ stroke: '#123456' }));
    render(crisp, {
      seed: 7,
      states: { q0: { position: [0, 0], shape: 'circle', fill: '#cc4444', stroke: '#123456' } },
      edges: [],
    });
    assert.ok(Math.abs(vbWidth(washed) - vbWidth(crisp)) <= 12,
      `bordered wash viewBox ${vbWidth(washed)} should track crisp ${vbWidth(crisp)}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Plan 2 — Fix #5: filter ids are salted per render() so two diagrams sharing one
// document don't both mint `wc-grain-0` / `shadow-0` (a later url(#…) reference
// would otherwise resolve to the first SVG's filter). Within a render, identical
// params still dedup — Fix #5 only changes the cross-render prefix.
// ─────────────────────────────────────────────────────────────────────────────
describe('watercolor — filter ids are render-salted (Fix #5)', () => {
  it('two grained SVGs in one document reference distinct grain filter ids', () => {
    const svgA = document.createElementNS(SVG_NS, 'svg');
    const svgB = document.createElementNS(SVG_NS, 'svg');
    document.body.appendChild(svgA);
    document.body.appendChild(svgB);
    try {
      const cfg = waterConfig({ decoration: { type: 'watercolor', layers: 8, grain: true } });
      render(svgA, cfg);
      render(svgB, cfg);

      const refA = svgA.querySelector('.node-layer g.watercolor').getAttribute('filter');
      const refB = svgB.querySelector('.node-layer g.watercolor').getAttribute('filter');
      assert.ok(refA && refB, 'both washes reference a grain filter');
      assert.notStrictEqual(refA, refB,
        'identical params in two renders must still get distinct filter ids');

      const ids = [...document.querySelectorAll('filter')].map(f => f.id);
      assert.strictEqual(new Set(ids).size, ids.length,
        `no duplicate filter id across the shared document: ${ids.join(',')}`);
    } finally {
      document.body.removeChild(svgA);
      document.body.removeChild(svgB);
    }
  });

  it('two shadowed SVGs in one document mint distinct shadow filter ids', () => {
    const svgA = document.createElementNS(SVG_NS, 'svg');
    const svgB = document.createElementNS(SVG_NS, 'svg');
    const cfg = {
      seed: 7,
      states: { q0: { position: [0, 0], shape: 'circle', fill: '#cc4444', shadow: true } },
      edges: [],
    };
    render(svgA, cfg);
    render(svgB, cfg);
    const idA = svgA.querySelector('defs filter').id;
    const idB = svgB.querySelector('defs filter').id;
    assert.ok(idA.startsWith('shadow-') && idB.startsWith('shadow-'),
      'both are shadow filters');
    assert.notStrictEqual(idA, idB, 'two renders must mint distinct shadow filter ids');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Plan 2 — Fix #1: paper grain must not clobber a drop shadow. When a wash needs
// both, the two effects compose into ONE filter (feTurbulence + feDropShadow),
// since the SVG `filter` attribute holds a single url(). Dedup keys on (grain,
// shadow) identity; geometry (viewBox) is unchanged.
// ─────────────────────────────────────────────────────────────────────────────
describe('watercolor — grain + shadow compose into one filter (Fix #1)', () => {
  const filterById = (svg, id) =>
    [...svg.querySelectorAll('defs filter')].find(f => f.id === id);

  it('a shadowed + grained wash references one filter holding BOTH effects', () => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    render(svg, waterConfig({
      shadow: true,
      decoration: { type: 'watercolor', layers: 8, grain: true },
    }));
    const ref = svg.querySelector('.node-layer g.watercolor').getAttribute('filter');
    assert.match(ref, /^url\(#wc-grain-shadow-/,
      'wash references the composed grain+shadow filter, not a bare grain/shadow one');
    assert.ok(!ref.includes('url(#shadow-'),
      'the bare shadow filter is no longer the referenced one (it was being clobbered)');

    const id = ref.match(/url\(#([^)]+)\)/)[1];
    const filterEl = filterById(svg, id);
    assert.ok(filterEl, 'composed filter def exists');
    assert.strictEqual(filterEl.querySelectorAll('feTurbulence').length, 1,
      'grain primitive present in the composed filter');
    assert.strictEqual(filterEl.querySelectorAll('feDropShadow').length, 1,
      'shadow primitive present in the composed filter');
  });

  it('dedups composed filters by shadow identity', () => {
    // Same grain + same shadow → one shared composed filter.
    const same = document.createElementNS(SVG_NS, 'svg');
    render(same, {
      seed: 7,
      states: {
        q0: { position: [0, 0], shape: 'circle', fill: '#cc4444', shadow: true,
          decoration: { type: 'watercolor', layers: 6, grain: true } },
        q1: { position: [80, 0], shape: 'circle', fill: '#4466aa', shadow: true,
          decoration: { type: 'watercolor', layers: 6, grain: true } },
      },
      edges: [],
    });
    const refsSame = new Set(
      [...same.querySelectorAll('.node-layer g.watercolor')].map(g => g.getAttribute('filter')));
    assert.strictEqual(refsSame.size, 1, 'same grain+shadow share one composed filter');
    assert.strictEqual(same.querySelectorAll('defs filter feTurbulence').length, 1,
      'exactly one composed filter built');

    // Same grain + DIFFERENT shadow → two distinct composed filters.
    const diff = document.createElementNS(SVG_NS, 'svg');
    render(diff, {
      seed: 7,
      states: {
        q0: { position: [0, 0], shape: 'circle', fill: '#cc4444', shadow: true,
          decoration: { type: 'watercolor', layers: 6, grain: true } },
        q1: { position: [80, 0], shape: 'circle', fill: '#4466aa',
          shadow: { dx: 5, dy: 5, blur: 6, color: '#333' },
          decoration: { type: 'watercolor', layers: 6, grain: true } },
      },
      edges: [],
    });
    const refsDiff = new Set(
      [...diff.querySelectorAll('.node-layer g.watercolor')].map(g => g.getAttribute('filter')));
    assert.strictEqual(refsDiff.size, 2, 'distinct shadow params → distinct composed filters');
    assert.strictEqual(diff.querySelectorAll('defs filter feTurbulence').length, 2);
  });

  it('composing grain + shadow does not change the viewBox', () => {
    const plain = document.createElementNS(SVG_NS, 'svg');
    const composed = document.createElementNS(SVG_NS, 'svg');
    render(plain, waterConfig());
    render(composed, waterConfig({
      shadow: true,
      decoration: { type: 'watercolor', layers: 10, grain: true },
    }));
    assert.strictEqual(composed.getAttribute('viewBox'), plain.getAttribute('viewBox'),
      'filters are geometry-invisible — bounds must be identical');
  });
});
