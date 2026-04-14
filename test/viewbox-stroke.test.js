/**
 * Tests for viewBox computation in the emitter.
 *
 * Covers:
 * 1. Stroke-width inclusion in bounding box
 * 2. Scientific notation in translate() coordinates (the actual root cause
 *    of node clipping: e.g. translate(113, -3.55e-15) was not parsed)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildTestSVG(nodes) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const nodeLayer = document.createElementNS(SVG_NS, 'g');
  nodeLayer.setAttribute('class', 'node-layer');
  svg.appendChild(nodeLayer);

  for (const { cx, cy, r, strokeWidth } of nodes) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${cx}, ${cy})`);
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', String(r));
    circle.setAttribute('stroke-width', String(strokeWidth));
    g.appendChild(circle);
    nodeLayer.appendChild(g);
  }
  return svg;
}

// Extract expandBBoxFromElement from the real emitter source
function expandBBox(bbox, x, y) {
  if (x < bbox.minX) bbox.minX = x;
  if (y < bbox.minY) bbox.minY = y;
  if (x > bbox.maxX) bbox.maxX = x;
  if (y > bbox.maxY) bbox.maxY = y;
}

const emitterSrc = readFileSync(new URL('../src-v2/svg/emitter.js', import.meta.url), 'utf-8');
const fnMatch = emitterSrc.match(/function expandBBoxFromElement\(bbox, el\) \{[\s\S]*?\n\}/);
if (!fnMatch) throw new Error('Could not extract expandBBoxFromElement from emitter.js');

const expandBBoxFromElement = new Function('expandBBox', 'bbox', 'el',
  fnMatch[0].replace('function expandBBoxFromElement(bbox, el) {', '').replace(/\}$/, '')
);

function getBBox(svg) {
  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const layer of svg.querySelectorAll('.node-layer')) {
    for (const child of layer.children) {
      expandBBoxFromElement(expandBBox, bbox, child);
    }
  }
  return bbox;
}

describe('viewBox computation', () => {
  it('includes stroke extent for circles', () => {
    const r = 19.25;
    const sw = 1.5;
    const svg = buildTestSVG([{ cx: 0, cy: 0, r, strokeWidth: sw }]);
    const bbox = getBBox(svg);

    const expected = r + sw / 2;
    assert.ok(Math.abs(bbox.maxX - expected) < 0.01,
      `bbox.maxX should be ${expected}, got ${bbox.maxX}`);
  });

  it('parses translate with scientific notation in y', () => {
    // This is the actual bug: node D at (113.14, ~0) where 0 is
    // represented as -3.552713678800501e-15 due to floating point
    const svg = buildTestSVG([
      { cx: 113.13712, cy: -3.552713678800501e-15, r: 20, strokeWidth: 1.5 },
    ]);
    const bbox = getBBox(svg);

    assert.ok(isFinite(bbox.maxX), 'bbox.maxX should be finite (node was parsed)');
    assert.ok(bbox.maxX > 130,
      `bbox.maxX should include node at x=113 + r=20, got ${bbox.maxX}`);
  });

  it('parses translate with scientific notation in x', () => {
    const svg = buildTestSVG([
      { cx: 1.5e2, cy: 0, r: 20, strokeWidth: 1.5 },
    ]);
    const bbox = getBBox(svg);

    assert.ok(bbox.maxX > 160,
      `bbox.maxX should include node at x=150 + r=20, got ${bbox.maxX}`);
  });

  it('diamond layout includes all four nodes', () => {
    const r = 20;
    const sw = 1.5;
    const half = sw / 2;
    const nodes = [
      { cx: 0, cy: 0, r, strokeWidth: sw },
      { cx: 56.57, cy: -56.57, r, strokeWidth: sw },
      { cx: 56.57, cy: 56.57, r, strokeWidth: sw },
      { cx: 113.14, cy: -3.55e-15, r, strokeWidth: sw }, // scientific notation!
    ];
    const svg = buildTestSVG(nodes);
    const bbox = getBBox(svg);

    assert.ok(Math.abs(bbox.minX - (0 - r - half)) < 0.01,
      `bbox.minX: expected ${0 - r - half}, got ${bbox.minX}`);
    assert.ok(Math.abs(bbox.maxX - (113.14 + r + half)) < 0.01,
      `bbox.maxX: expected ${113.14 + r + half}, got ${bbox.maxX}`);
    assert.ok(Math.abs(bbox.minY - (-56.57 - r - half)) < 0.01,
      `bbox.minY: expected ${-56.57 - r - half}, got ${bbox.minY}`);
    assert.ok(Math.abs(bbox.maxY - (56.57 + r + half)) < 0.01,
      `bbox.maxY: expected ${56.57 + r + half}, got ${bbox.maxY}`);
  });
});
