/**
 * TikZ named line widths (§15.3.1): ultra thin (0.1) ... ultra thick (1.6) pt.
 * Accepted wherever strokeWidth is accepted.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let resolveNodeStyle, resolveEdgeStyle, resolvePlotStyle, resolvePathStyle,
    resolveLineWidth, LINE_WIDTHS;
before(async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  ({ resolveNodeStyle, resolveEdgeStyle, resolvePlotStyle, resolvePathStyle,
     resolveLineWidth }
    = await import('../src-v2/style/style.js'));
  ({ LINE_WIDTHS } = await import('../src-v2/core/constants.js'));
});

describe('LINE_WIDTHS constant', () => {
  it('has all seven TikZ names with correct pt values', () => {
    assert.strictEqual(LINE_WIDTHS['ultra thin'], 0.1);
    assert.strictEqual(LINE_WIDTHS['very thin'], 0.2);
    assert.strictEqual(LINE_WIDTHS['thin'], 0.4);
    assert.strictEqual(LINE_WIDTHS['semithick'], 0.6);
    assert.strictEqual(LINE_WIDTHS['thick'], 0.8);
    assert.strictEqual(LINE_WIDTHS['very thick'], 1.2);
    assert.strictEqual(LINE_WIDTHS['ultra thick'], 1.6);
  });
});

describe('resolveLineWidth helper', () => {
  it('maps each name to its pt value', () => {
    assert.strictEqual(resolveLineWidth('ultra thin'), 0.1);
    assert.strictEqual(resolveLineWidth('thick'), 0.8);
    assert.strictEqual(resolveLineWidth('ultra thick'), 1.6);
  });

  it('passes numeric values through unchanged', () => {
    assert.strictEqual(resolveLineWidth(1.5), 1.5);
    assert.strictEqual(resolveLineWidth(0), 0);
  });

  it('passes null/undefined through', () => {
    assert.strictEqual(resolveLineWidth(undefined), undefined);
    assert.strictEqual(resolveLineWidth(null), null);
  });

  it('passes unknown strings through unchanged', () => {
    assert.strictEqual(resolveLineWidth('mystery'), 'mystery');
  });
});

describe('named strokeWidth: nodes', () => {
  it('resolves strokeWidth: "thick" to 0.8', () => {
    const s = resolveNodeStyle('q0', {
      states: { q0: { strokeWidth: 'thick' } },
    });
    assert.strictEqual(s.strokeWidth, 0.8);
  });

  it('resolves on stateStyle cascade', () => {
    const s = resolveNodeStyle('q0', {
      stateStyle: { strokeWidth: 'ultra thick' },
      states: { q0: {} },
    });
    assert.strictEqual(s.strokeWidth, 1.6);
  });

  it('per-node overrides stateStyle', () => {
    const s = resolveNodeStyle('q0', {
      stateStyle: { strokeWidth: 'thin' },
      states: { q0: { strokeWidth: 'very thick' } },
    });
    assert.strictEqual(s.strokeWidth, 1.2);
  });

  it('numeric strokeWidth still works', () => {
    const s = resolveNodeStyle('q0', { states: { q0: { strokeWidth: 3 } } });
    assert.strictEqual(s.strokeWidth, 3);
  });
});

describe('named strokeWidth: edges', () => {
  it('resolves "semithick" on edge', () => {
    const s = resolveEdgeStyle(0, {
      edges: [{ from: 'a', to: 'b', strokeWidth: 'semithick' }],
    });
    assert.strictEqual(s.strokeWidth, 0.6);
  });

  it('numeric still works', () => {
    const s = resolveEdgeStyle(0, {
      edges: [{ from: 'a', to: 'b', strokeWidth: 2 }],
    });
    assert.strictEqual(s.strokeWidth, 2);
  });
});

describe('named strokeWidth: plots', () => {
  it('resolves "very thin" on plot', () => {
    const s = resolvePlotStyle(0, {
      plots: [{ coordinates: [], strokeWidth: 'very thin' }],
    });
    assert.strictEqual(s.strokeWidth, 0.2);
  });
});

describe('named strokeWidth: paths', () => {
  it('resolves "ultra thick" on path', () => {
    const s = resolvePathStyle(0, {
      paths: [{ points: [], strokeWidth: 'ultra thick' }],
    });
    assert.strictEqual(s.strokeWidth, 1.6);
  });

  it('legacy `thick: true` still maps to 2.4 (existing behavior preserved)', () => {
    const s = resolvePathStyle(0, {
      paths: [{ points: [], thick: true }],
    });
    assert.strictEqual(s.strokeWidth, 2.4);
  });
});
