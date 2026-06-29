import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

import { render } from '../src-v2/index.js';

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
