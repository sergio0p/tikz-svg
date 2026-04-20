/**
 * TikZ `color=NAME` shorthand: sets stroke, fill, and textColor together.
 * Per-field keys (stroke, fill, labelColor) still override.
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

let resolveNodeStyle, resolveEdgeStyle, resolvePlotStyle, resolvePathStyle;
before(async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  ({ resolveNodeStyle, resolveEdgeStyle, resolvePlotStyle, resolvePathStyle }
    = await import('../src-v2/style/style.js'));
});

describe('color shorthand: nodes', () => {
  it('applies color to stroke, fill, and labelColor when unset', () => {
    const s = resolveNodeStyle('q0', {
      states: { q0: { color: '#268bd2' } },
    });
    assert.strictEqual(s.stroke, '#268bd2');
    assert.strictEqual(s.fill, '#268bd2');
    assert.strictEqual(s.labelColor, '#268bd2');
  });

  it('explicit stroke wins over color', () => {
    const s = resolveNodeStyle('q0', {
      states: { q0: { color: '#268bd2', stroke: '#ff0000' } },
    });
    assert.strictEqual(s.stroke, '#ff0000');
    assert.strictEqual(s.fill, '#268bd2');
    assert.strictEqual(s.labelColor, '#268bd2');
  });

  it('explicit fill wins over color', () => {
    const s = resolveNodeStyle('q0', {
      states: { q0: { color: '#268bd2', fill: 'none' } },
    });
    assert.strictEqual(s.stroke, '#268bd2');
    assert.strictEqual(s.fill, 'none');
  });

  it('explicit labelColor wins over color', () => {
    const s = resolveNodeStyle('q0', {
      states: { q0: { color: '#268bd2', labelColor: '#333' } },
    });
    assert.strictEqual(s.labelColor, '#333');
    assert.strictEqual(s.stroke, '#268bd2');
  });

  it('color on stateStyle cascades to all nodes', () => {
    const s = resolveNodeStyle('q0', {
      stateStyle: { color: '#268bd2' },
      states: { q0: {} },
    });
    assert.strictEqual(s.stroke, '#268bd2');
    assert.strictEqual(s.fill, '#268bd2');
  });
});

describe('color shorthand: edges', () => {
  it('applies color to stroke when unset', () => {
    const s = resolveEdgeStyle(0, {
      edges: [{ from: 'a', to: 'b', color: '#268bd2' }],
    });
    assert.strictEqual(s.stroke, '#268bd2');
  });

  it('explicit stroke wins over color', () => {
    const s = resolveEdgeStyle(0, {
      edges: [{ from: 'a', to: 'b', color: '#268bd2', stroke: '#ff0000' }],
    });
    assert.strictEqual(s.stroke, '#ff0000');
  });
});

describe('color shorthand: plots', () => {
  it('applies color to stroke (fill stays none)', () => {
    const s = resolvePlotStyle(0, {
      plots: [{ coordinates: [], color: '#268bd2' }],
    });
    assert.strictEqual(s.stroke, '#268bd2');
    assert.strictEqual(s.fill, 'none');
  });

  it('explicit fill wins over color', () => {
    const s = resolvePlotStyle(0, {
      plots: [{ coordinates: [], color: '#268bd2', fill: '#eee' }],
    });
    assert.strictEqual(s.fill, '#eee');
    assert.strictEqual(s.stroke, '#268bd2');
  });
});

describe('color shorthand: paths', () => {
  it('applies color to stroke', () => {
    const s = resolvePathStyle(0, {
      paths: [{ points: [], color: '#268bd2' }],
    });
    assert.strictEqual(s.stroke, '#268bd2');
  });

  it('explicit stroke wins over color', () => {
    const s = resolvePathStyle(0, {
      paths: [{ points: [], color: '#268bd2', stroke: '#ff0000' }],
    });
    assert.strictEqual(s.stroke, '#ff0000');
  });
});

describe('color shorthand: omitted', () => {
  it('no color → defaults unchanged', () => {
    const s = resolveNodeStyle('q0', { states: { q0: {} } });
    assert.strictEqual(s.stroke, '#000000');
    assert.strictEqual(s.fill, '#ffffff');
    assert.strictEqual(s.labelColor, '#000000');
  });
});
