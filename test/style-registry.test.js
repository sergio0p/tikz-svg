import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StyleRegistry } from '../src-v2/style/registry.js';

describe('StyleRegistry', () => {
  it('stores and retrieves a named style', () => {
    const reg = new StyleRegistry({ myStyle: { fill: 'red', stroke: 'blue' } });
    assert.deepStrictEqual(reg.get('myStyle'), { fill: 'red', stroke: 'blue' });
  });

  it('returns empty object for unknown style name', () => {
    const reg = new StyleRegistry({});
    assert.deepStrictEqual(reg.get('nope'), {});
  });

  it('expands style ref in a props object', () => {
    const reg = new StyleRegistry({ accent: { fill: 'red', stroke: 'blue' } });
    const props = { style: 'accent', opacity: 0.5 };
    const expanded = reg.expand(props);
    assert.deepStrictEqual(expanded, { fill: 'red', stroke: 'blue', opacity: 0.5 });
  });

  it('per-element props override named style', () => {
    const reg = new StyleRegistry({ accent: { fill: 'red', stroke: 'blue' } });
    const props = { style: 'accent', fill: 'green' };
    const expanded = reg.expand(props);
    assert.strictEqual(expanded.fill, 'green');
    assert.strictEqual(expanded.stroke, 'blue');
  });

  it('passes through props unchanged when no style ref', () => {
    const reg = new StyleRegistry({ accent: { fill: 'red' } });
    const props = { fill: 'green', opacity: 0.5 };
    const expanded = reg.expand(props);
    assert.deepStrictEqual(expanded, { fill: 'green', opacity: 0.5 });
  });

  it('strips the style key from expanded result', () => {
    const reg = new StyleRegistry({ x: { fill: 'red' } });
    const expanded = reg.expand({ style: 'x' });
    assert.strictEqual(expanded.style, undefined);
  });

  it('includes built-in wavy style without user definition', () => {
    const reg = new StyleRegistry({});
    const wavy = reg.get('wavy');
    assert.ok(wavy.decoration, 'wavy should have a decoration property');
    assert.strictEqual(wavy.decoration.type, 'random steps');
    assert.strictEqual(wavy.decoration.roundedCorners, 4);
  });

  it('user-defined style overrides built-in', () => {
    const reg = new StyleRegistry({
      wavy: { decoration: { type: 'random steps', amplitude: 10 } },
    });
    const wavy = reg.get('wavy');
    assert.strictEqual(wavy.decoration.amplitude, 10);
  });
});

import { resolveNodeStyle, resolveEdgeStyle } from '../src-v2/style/style.js';

describe('Named style in cascade', () => {
  it('named style expands in node resolution', () => {
    const config = {
      styles: { accent: { fill: 'red', stroke: 'blue' } },
      stateStyle: { fontSize: 18 },
      states: { q0: { style: 'accent', opacity: 0.8 } },
    };
    const resolved = resolveNodeStyle('q0', config);
    assert.strictEqual(resolved.fill, 'red');
    assert.strictEqual(resolved.stroke, 'blue');
    assert.strictEqual(resolved.opacity, 0.8);
    assert.strictEqual(resolved.fontSize, 18);
  });

  it('per-node prop overrides named style', () => {
    const config = {
      styles: { accent: { fill: 'red' } },
      states: { q0: { style: 'accent', fill: 'green' } },
    };
    const resolved = resolveNodeStyle('q0', config);
    assert.strictEqual(resolved.fill, 'green');
  });

  it('named style expands in edge resolution', () => {
    const config = {
      styles: { warn: { stroke: 'orange', dashed: true } },
      edges: [{ from: 'q0', to: 'q1', style: 'warn', label: 'a' }],
    };
    const resolved = resolveEdgeStyle(0, config);
    assert.strictEqual(resolved.stroke, 'orange');
    assert.strictEqual(resolved.dashed, true);
  });

  it('works with no styles defined', () => {
    const config = { states: { q0: { fill: 'green' } } };
    const resolved = resolveNodeStyle('q0', config);
    assert.strictEqual(resolved.fill, 'green');
  });
});
