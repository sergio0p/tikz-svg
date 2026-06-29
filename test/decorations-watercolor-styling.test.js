import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

import { render } from '../src-v2/index.js';
import { __testables } from '../src-v2/svg/emitter.js';

const { expandBBoxFromElement, buildMarkerExtentMap } = __testables;
const SVG_NS = 'http://www.w3.org/2000/svg';

const vbWidth = (svg) => {
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  return vb[2];
};

const make = () => document.createElementNS(SVG_NS, 'svg');

// A horizontal washed edge a→b. `extra` overrides per-edge config keys.
const edgeConfig = (extra = {}) => ({
  seed: 7,
  states: {
    a: { position: [0, 0], shape: 'circle', radius: 14 },
    b: { position: [140, 0], shape: 'circle', radius: 14 },
  },
  edges: [{
    from: 'a', to: 'b', stroke: '#aa3322',
    decoration: { type: 'watercolor', layers: 8 },
    ...extra,
  }],
});

// A washed draw path (L-shape). `extra` overrides per-path config keys.
const pathConfig = (extra = {}) => ({
  seed: 7,
  states: {},
  paths: [{
    points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 90 }],
    stroke: '#2244aa',
    decoration: { type: 'watercolor', layers: 8 },
    ...extra,
  }],
});

// ───────────────────────────────────────────────────────────────
// Edges — arrow overlay + per-element parity (§8b.1-6)
// ───────────────────────────────────────────────────────────────

describe('watercolor edge — arrow overlay + per-element parity', () => {
  it('overlays exactly one invisible spine carrying the end arrow tip', () => {
    const svg = make();
    render(svg, edgeConfig()); // inherits default arrow:'stealth' → directed

    const g = svg.querySelector('.edge-layer g.watercolor');
    const spines = g.querySelectorAll('path[data-wash-spine]');
    assert.strictEqual(spines.length, 1, 'exactly one spine path');

    const spine = spines[0];
    assert.match(spine.getAttribute('marker-end') || '', /^url\(#.+\)$/,
      'spine carries the edge arrow marker');
    assert.strictEqual(spine.getAttribute('fill'), 'none', 'spine is unfilled');
    assert.strictEqual(spine.getAttribute('stroke'), 'none', 'spine is unstroked');

    // The spine must be the arrow-shortened STRAIGHT centerline (a single M…L
    // on the y=0 axis for this horizontal edge), not the deformed ribbon band —
    // that is what lands the tip on the centerline tangent. `/^M/` alone is
    // vacuous: the nominal band and every bleed layer also start with 'M'.
    const spineD = (spine.getAttribute('d') || '').trim();
    assert.match(spineD, /^M [\d.]+ 0 L [\d.]+ 0$/, 'spine d is the straight shortened centerline');
    const nominalD = g.querySelector('path:not([data-bleed]):not([data-wash-spine])').getAttribute('d');
    assert.notStrictEqual(spineD, nominalD, 'spine is the centerline, not the ribbon nominal');
  });

  it('adds no spine for an undirected (arrow:none) edge', () => {
    const svg = make();
    render(svg, edgeConfig({ arrow: 'none' }));
    const g = svg.querySelector('.edge-layer g.watercolor');
    assert.strictEqual(g.querySelectorAll('path[data-wash-spine]').length, 0,
      'no arrow → no spine');
  });

  it('puts the edge id on the wash group (single refs hook)', () => {
    const svg = make();
    render(svg, edgeConfig({ id: 'e1' }));
    const hits = svg.querySelectorAll('.edge-layer g.watercolor#e1');
    assert.strictEqual(hits.length, 1, 'exactly one g.watercolor#e1');
  });

  it('puts the edge className on the wash group', () => {
    const svg = make();
    render(svg, edgeConfig({ className: 'hot' }));
    const g = svg.querySelector('.edge-layer g.watercolor');
    assert.ok(g.classList.contains('hot'), 'className applied to wash group');
  });

  it('puts opacity on the wash group (dims ribbon + tip together)', () => {
    const washed = make();
    render(washed, edgeConfig({ opacity: 0.4 }));
    const g = washed.querySelector('.edge-layer g.watercolor');
    assert.strictEqual(g.getAttribute('opacity'), '0.4', 'wash group carries opacity');

    // Crisp control: a non-washed edge with the same opacity also surfaces it,
    // so washed/crisp stay consistent (parity, not structural equality).
    const crisp = make();
    render(crisp, {
      seed: 7,
      states: {
        a: { position: [0, 0], shape: 'circle', radius: 14 },
        b: { position: [140, 0], shape: 'circle', radius: 14 },
      },
      edges: [{ from: 'a', to: 'b', stroke: '#aa3322', opacity: 0.4 }],
    });
    const cp = crisp.querySelector('.edge-layer path');
    assert.strictEqual(cp.getAttribute('opacity'), '0.4', 'crisp edge also carries opacity');
  });

  it('counts the spine arrow disc in the wash extent (bbox walker)', () => {
    // Measured against the actual emitter bbox walker. A directed edge's spine
    // carries a marker; the marker disc must grow the wash's measured maxX past
    // the bare spine endpoint. (A full-viewBox compare would be vacuous here —
    // the flanking circle nodes dominate the global bounds.)
    const svg = make();
    render(svg, edgeConfig()); // directed (default arrow:'stealth')
    const g = svg.querySelector('.edge-layer g.watercolor');
    const markers = buildMarkerExtentMap(svg);
    const maxXof = (el, m) => {
      const bb = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      expandBBoxFromElement(bb, el, m);
      return bb.maxX;
    };
    assert.ok(maxXof(g, markers) - maxXof(g, undefined) > 1,
      `arrow disc should grow the wash extent (got +${(maxXof(g, markers) - maxXof(g, undefined)).toFixed(2)})`);

    // An undirected edge has no spine → no disc → marker extents change nothing.
    const u = make();
    render(u, edgeConfig({ arrow: 'none' }));
    const gu = u.querySelector('.edge-layer g.watercolor');
    assert.strictEqual(maxXof(gu, buildMarkerExtentMap(u)), maxXof(gu, undefined),
      'no arrow → marker extents do not change the wash bounds');
  });
});

// ───────────────────────────────────────────────────────────────
// Draw paths — wrapper + per-element parity (§8b.7-11)
// ───────────────────────────────────────────────────────────────

describe('watercolor draw path — wrapper + per-element parity', () => {
  it('wraps the wash in one id-bearing g.draw-path with a two-tip spine', () => {
    const svg = make();
    render(svg, pathConfig({ id: 'p1', arrow: '<->' }));

    const wrappers = svg.querySelectorAll('.edge-layer g.draw-path#p1');
    assert.strictEqual(wrappers.length, 1, 'exactly one g.draw-path#p1 wrapper');

    const spine = wrappers[0].querySelector('path[data-wash-spine]');
    assert.ok(spine, 'spine path present');
    assert.match(spine.getAttribute('marker-start') || '', /^url\(#.+\)$/, 'marker-start present');
    assert.match(spine.getAttribute('marker-end') || '', /^url\(#.+\)$/, 'marker-end present');
  });

  it('filldraw: one id-bearing wrapper over both fill + stroke washes', () => {
    const svg = make();
    render(svg, pathConfig({
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 90 }],
      cycle: true, fill: '#66aa44', stroke: '#224422', id: 'fd',
    }));
    const wrappers = svg.querySelectorAll('.edge-layer g.draw-path#fd');
    assert.strictEqual(wrappers.length, 1, 'exactly one wrapper with the id (id-on-fill-group bug gone)');
    const washes = wrappers[0].querySelectorAll('g.watercolor');
    assert.strictEqual(washes.length, 2, 'two washes (fill + stroke) under the one wrapper');
  });

  it('puts opacity on the wrapper', () => {
    const svg = make();
    render(svg, pathConfig({ opacity: 0.5 }));
    const wrapper = svg.querySelector('.edge-layer g.draw-path');
    assert.strictEqual(wrapper.getAttribute('opacity'), '0.5');
  });

  it('useAsBoundingBox tags the wrapper and tracks the crisp bounds', () => {
    const washed = make();
    render(washed, pathConfig({ useAsBoundingBox: true }));
    const wrapper = washed.querySelector('.edge-layer g.draw-path');
    assert.ok(wrapper.hasAttribute('data-use-as-bbox'), 'wrapper carries the bbox flag');

    const crisp = make();
    render(crisp, {
      seed: 7, states: {},
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 90 }],
        stroke: '#2244aa', useAsBoundingBox: true,
      }],
    });
    const dw = vbWidth(washed);
    const dc = vbWidth(crisp);
    assert.ok(Math.abs(dw - dc) <= 20,
      `washed useAsBbox width ${dw} should track crisp ${dc} within a brush half-width`);
  });

  it('adds no spine for an arrowless washed path', () => {
    const svg = make();
    render(svg, pathConfig());
    assert.strictEqual(svg.querySelectorAll('.edge-layer path[data-wash-spine]').length, 0,
      'no arrow → no spine');
  });
});

// ───────────────────────────────────────────────────────────────
// Shapes — regression: shared step deliberately not applied (§8b.12)
// ───────────────────────────────────────────────────────────────

describe('watercolor shape fill — shared step intentionally skipped', () => {
  it('wash group stays bare; id/className live on the node wrapper', () => {
    const svg = make();
    render(svg, {
      seed: 7,
      states: {
        q0: {
          position: [0, 0], shape: 'circle', fill: '#cc4444', className: 'token',
          decoration: { type: 'watercolor', layers: 8 },
        },
      },
      edges: [],
    });

    const wash = svg.querySelector('.node-layer g.watercolor');
    assert.ok(wash, 'wash group exists');
    assert.strictEqual(wash.hasAttribute('id'), false, 'no id on the wash group');
    assert.strictEqual(wash.hasAttribute('opacity'), false, 'no opacity on the wash group');
    assert.deepStrictEqual([...wash.classList], ['watercolor'], 'no extra class on the wash group');

    const node = svg.querySelector('.node-layer g.node#node-q0');
    assert.ok(node, 'node wrapper keeps its id');
    assert.ok(node.classList.contains('token'), 'node wrapper keeps its className');
  });
});

// ───────────────────────────────────────────────────────────────
// Determinism + grain unaffected by the spine (§8b.13-14)
// ───────────────────────────────────────────────────────────────

describe('watercolor styling — determinism & grain', () => {
  it('directed washed edge is byte-identical across renders (spine + bleed)', () => {
    const a = make();
    const b = make();
    render(a, edgeConfig());
    render(b, edgeConfig());

    const spineD = (svg) => svg.querySelector('.edge-layer path[data-wash-spine]').getAttribute('d');
    assert.strictEqual(spineD(a), spineD(b), 'spine d is deterministic');

    const bleed = (svg) =>
      [...svg.querySelectorAll('.edge-layer g.watercolor path[data-bleed]')].map(p => p.getAttribute('d'));
    assert.deepStrictEqual(bleed(a), bleed(b), 'bleed layer d-list is deterministic');
  });

  it('the spine does not trigger paper grain on a directed edge (grain off)', () => {
    const svg = make();
    render(svg, edgeConfig()); // grain not requested
    assert.strictEqual(svg.querySelectorAll('defs filter feTurbulence').length, 0,
      'no grain filter without opt-in');
    const g = svg.querySelector('.edge-layer g.watercolor');
    assert.strictEqual(g.hasAttribute('filter'), false, 'no filter attr on the wash group');
    assert.strictEqual(g.hasAttribute('data-grain'), false, 'no leftover data-grain tag');
  });
});
