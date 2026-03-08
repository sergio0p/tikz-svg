import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrowTipRegistry,
  defaultRegistry,
  createMarker,
} from '../src/core/arrow-tips.js';

// ────────────────────────────────────────────
// Registry basics
// ────────────────────────────────────────────

describe('ArrowTipRegistry', () => {
  it('register / get / has / names round-trip', () => {
    const reg = new ArrowTipRegistry();
    const fakeDef = {
      defaults: { length: 1, width: 1, inset: 0, lineWidth: 0.5 },
      path() { return { d: 'M 0 0', lineEnd: 1, tipEnd: 1, fillMode: 'filled' }; },
    };
    reg.register('Test', fakeDef);
    assert.ok(reg.has('Test'));
    assert.strictEqual(reg.get('Test'), fakeDef);
    assert.ok(reg.names().includes('Test'));
  });

  it('get returns undefined for unknown name', () => {
    const reg = new ArrowTipRegistry();
    assert.strictEqual(reg.get('NoSuchTip'), undefined);
    assert.ok(!reg.has('NoSuchTip'));
  });
});

// ────────────────────────────────────────────
// Built-in tips existence
// ────────────────────────────────────────────

const builtInNames = ['Stealth', 'Latex', 'To', 'Bar', 'Circle', 'Bracket'];

describe('Built-in tips registered in defaultRegistry', () => {
  for (const name of builtInNames) {
    it(`has "${name}"`, () => {
      assert.ok(defaultRegistry.has(name), `Missing built-in tip: ${name}`);
    });
  }
});

// ────────────────────────────────────────────
// path() output shape
// ────────────────────────────────────────────

describe('Built-in tip path() returns correct shape', () => {
  for (const name of builtInNames) {
    it(`${name} path() has { d, lineEnd, tipEnd, fillMode }`, () => {
      const def = defaultRegistry.get(name);
      const result = def.path({});
      assert.ok(typeof result.d === 'string', 'd should be a string');
      assert.ok(typeof result.lineEnd === 'number', 'lineEnd should be a number');
      assert.ok(typeof result.tipEnd === 'number', 'tipEnd should be a number');
      assert.ok(
        ['filled', 'stroke', 'both'].includes(result.fillMode),
        `fillMode should be filled|stroke|both, got: ${result.fillMode}`,
      );
    });

    it(`${name} d starts with 'M' and is non-empty`, () => {
      const def = defaultRegistry.get(name);
      const result = def.path({});
      assert.ok(result.d.length > 0, 'd should be non-empty');
      assert.ok(result.d.startsWith('M'), `d should start with M, got: ${result.d.slice(0, 10)}`);
    });
  }
});

// ────────────────────────────────────────────
// lineEnd positive
// ────────────────────────────────────────────

describe('lineEnd values', () => {
  // Bar and Bracket have lineEnd = 0 (they sit at the line end, not covering it)
  const tipsWithPositiveLineEnd = ['Stealth', 'Latex', 'To', 'Circle'];

  for (const name of tipsWithPositiveLineEnd) {
    it(`${name} lineEnd is a positive number`, () => {
      const def = defaultRegistry.get(name);
      const result = def.path({});
      assert.ok(result.lineEnd > 0, `lineEnd should be > 0, got: ${result.lineEnd}`);
    });
  }
});

// ────────────────────────────────────────────
// fillMode specifics
// ────────────────────────────────────────────

describe('fillMode specifics', () => {
  it('Stealth with open: true returns fillMode "stroke"', () => {
    const def = defaultRegistry.get('Stealth');
    const result = def.path({ open: true });
    assert.strictEqual(result.fillMode, 'stroke');
  });

  it('Stealth default (open: false) returns fillMode "filled"', () => {
    const def = defaultRegistry.get('Stealth');
    const result = def.path({});
    assert.strictEqual(result.fillMode, 'filled');
  });

  it('Bar tip has fillMode "stroke"', () => {
    const def = defaultRegistry.get('Bar');
    const result = def.path({});
    assert.strictEqual(result.fillMode, 'stroke');
  });

  it('To tip has fillMode "stroke"', () => {
    const def = defaultRegistry.get('To');
    const result = def.path({});
    assert.strictEqual(result.fillMode, 'stroke');
  });
});

// ────────────────────────────────────────────
// Scaling: larger length → different path data
// ────────────────────────────────────────────

describe('Scaling', () => {
  it('passing larger length produces different path data', () => {
    const def = defaultRegistry.get('Stealth');
    const small = def.path({ length: 4, width: 3 });
    const large = def.path({ length: 12, width: 9 });
    assert.notStrictEqual(small.d, large.d, 'Paths should differ for different sizes');
    // The larger path should have a larger tipEnd
    assert.ok(large.tipEnd > small.tipEnd, 'Larger length should produce larger tipEnd');
  });

  it('Latex tip scales with length', () => {
    const def = defaultRegistry.get('Latex');
    const small = def.path({ length: 3 });
    const large = def.path({ length: 10 });
    assert.notStrictEqual(small.d, large.d);
    assert.ok(large.tipEnd > small.tipEnd);
  });
});

// ────────────────────────────────────────────
// createMarker (DOM-based — uses jsdom if available)
// ────────────────────────────────────────────

describe('createMarker', async () => {
  let doc;
  try {
    const { JSDOM } = await import('jsdom');
    doc = new JSDOM('<!DOCTYPE html><html><body></body></html>').window.document;
  } catch {
    // jsdom not available — skip DOM tests silently
  }

  if (doc) {
    it('creates a marker element with correct id', () => {
      const result = createMarker(doc, 'Stealth', {}, { color: '#ff0000' });
      assert.ok(result, 'createMarker should return a result');
      assert.ok(result.id.startsWith('arrow-tip-Stealth-'));
      assert.strictEqual(result.element.tagName, 'marker');
    });

    it('marker contains a path child', () => {
      const result = createMarker(doc, 'Latex');
      assert.ok(result);
      const paths = result.element.getElementsByTagName('path');
      assert.strictEqual(paths.length, 1);
      assert.ok(paths[0].getAttribute('d').startsWith('M'));
    });

    it('returns null for unknown tip name', () => {
      const result = createMarker(doc, 'NonExistent');
      assert.strictEqual(result, null);
    });

    it('filled tip sets fill attribute on path', () => {
      const result = createMarker(doc, 'Stealth', {}, { color: '#333' });
      const path = result.element.getElementsByTagName('path')[0];
      assert.strictEqual(path.getAttribute('stroke'), 'none');
      assert.ok(path.getAttribute('fill'));
    });

    it('stroke-only tip sets stroke attribute on path', () => {
      const result = createMarker(doc, 'Bar', {}, { color: '#000' });
      const path = result.element.getElementsByTagName('path')[0];
      assert.strictEqual(path.getAttribute('fill'), 'none');
      assert.strictEqual(path.getAttribute('stroke'), '#000');
    });
  } else {
    it('skipped — jsdom not available (testing path generation only)', () => {
      assert.ok(true);
    });
  }
});
