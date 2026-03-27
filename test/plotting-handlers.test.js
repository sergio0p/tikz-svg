import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHandler, applyHandler } from '../src-v2/plotting/handlers.js';

const SQUARE = [
  { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
];
const SINE_3PT = [
  { x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 0 },
];
const WITH_UNDEF = [
  { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: undefined, undefined: true }, { x: 3, y: 3 }, { x: 4, y: 4 },
];

describe('lineto handler', () => {
  it('connects points with straight lines', () => {
    const path = applyHandler('lineto', SINE_3PT);
    const d = path.toSVGPath();
    assert.ok(d.startsWith('M'), 'should start with moveTo');
    assert.ok(d.includes('L'), 'should contain lineTo');
    // 1 moveTo + 2 lineTo
    assert.strictEqual((d.match(/M/g) || []).length, 1);
    assert.strictEqual((d.match(/L/g) || []).length, 2);
  });

  it('jumps over undefined points', () => {
    const path = applyHandler('lineto', WITH_UNDEF);
    const d = path.toSVGPath();
    // Should have 2 subpaths: M...L (0,1) then M...L (3,4)
    assert.strictEqual((d.match(/M/g) || []).length, 2);
  });

  it('handles empty input', () => {
    const path = applyHandler('lineto', []);
    assert.ok(path.isEmpty());
  });

  it('handles all-undefined input', () => {
    const path = applyHandler('lineto', [
      { x: 0, y: undefined, undefined: true },
      { x: 1, y: undefined, undefined: true },
    ]);
    assert.ok(path.isEmpty());
  });
});

describe('curveto handler (smooth)', () => {
  it('produces cubic Bezier curves', () => {
    const points = [
      { x: 0, y: 0 }, { x: 3, y: 5 }, { x: 6, y: 3 }, { x: 9, y: 8 }, { x: 12, y: 0 },
    ];
    const path = applyHandler('curveto', points);
    const d = path.toSVGPath();
    assert.ok(d.includes('C'), 'should contain curveTo segments');
  });

  it('accepts tension option', () => {
    const points = [
      { x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 0 },
    ];
    const pathLow = applyHandler('curveto', points, { tension: 0.2 });
    const pathHigh = applyHandler('curveto', points, { tension: 1.0 });
    // Different tension should produce different paths
    assert.notStrictEqual(pathLow.toSVGPath(), pathHigh.toSVGPath());
  });

  it('falls back to lineTo for 2 points', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    const path = applyHandler('curveto', points);
    const d = path.toSVGPath();
    assert.ok(d.includes('L'));
    assert.ok(!d.includes('C'));
  });
});

describe('closedcurve handler (smooth cycle)', () => {
  it('produces a closed smooth path', () => {
    const path = applyHandler('closedcurve', SQUARE);
    const d = path.toSVGPath();
    assert.ok(d.includes('C'), 'should contain curves');
    assert.ok(d.includes('Z'), 'should be closed');
  });
});

describe('polygon handler (sharp cycle)', () => {
  it('produces a closed straight-line path', () => {
    const path = applyHandler('polygon', SQUARE);
    const d = path.toSVGPath();
    assert.ok(d.includes('L'));
    assert.ok(d.includes('Z'));
    assert.ok(!d.includes('C'), 'no curves in polygon');
  });
});

describe('constlineto handler (const plot)', () => {
  it('produces staircase path', () => {
    const points = [{ x: 0, y: 0 }, { x: 5, y: 10 }, { x: 10, y: 3 }];
    const path = applyHandler('constlineto', points);
    const d = path.toSVGPath();
    // Staircase: for each new point, first horizontal to new x, then vertical to new y
    // Should have more L segments than input points
    const lineCount = (d.match(/L/g) || []).length;
    assert.ok(lineCount >= 4, `expected >=4 lineTo, got ${lineCount}`);
  });
});

describe('ycomb handler', () => {
  it('produces vertical lines from baseline', () => {
    const points = [{ x: 2, y: 5 }, { x: 4, y: 8 }, { x: 6, y: 3 }];
    const path = applyHandler('ycomb', points);
    const d = path.toSVGPath();
    // 3 combs = 3 moveTo + 3 lineTo
    assert.strictEqual((d.match(/M/g) || []).length, 3);
    assert.strictEqual((d.match(/L/g) || []).length, 3);
  });
});

describe('ybar handler', () => {
  it('produces rectangles', () => {
    const points = [{ x: 2, y: 5 }, { x: 5, y: 8 }];
    const path = applyHandler('ybar', points, { barWidth: 4 });
    const d = path.toSVGPath();
    // Each bar is a rectangle: M + 3L + Z
    assert.ok(d.includes('Z'), 'bars should be closed paths');
  });
});

describe('handler registry', () => {
  it('retrieves built-in handlers by name', () => {
    assert.ok(getHandler('lineto'));
    assert.ok(getHandler('curveto'));
    assert.ok(getHandler('closedcurve'));
    assert.ok(getHandler('polygon'));
    assert.ok(getHandler('constlineto'));
    assert.ok(getHandler('constlinetoright'));
    assert.ok(getHandler('constlinetomid'));
    assert.ok(getHandler('jumpmarkleft'));
    assert.ok(getHandler('jumpmarkright'));
    assert.ok(getHandler('jumpmarkmid'));
    assert.ok(getHandler('xcomb'));
    assert.ok(getHandler('ycomb'));
    assert.ok(getHandler('ybar'));
    assert.ok(getHandler('xbar'));
  });

  it('resolves TikZ alias names', () => {
    assert.ok(getHandler('sharp plot'));
    assert.ok(getHandler('smooth'));
    assert.ok(getHandler('smooth cycle'));
    assert.ok(getHandler('const plot'));
  });

  it('returns null for unknown handler', () => {
    assert.strictEqual(getHandler('nonexistent'), null);
  });
});
