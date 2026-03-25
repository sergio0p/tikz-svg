import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSVGPath,
  samplePath,
  pointsToPath,
  isClosedPath,
  cumulativeDistances,
} from '../src-v2/decorations/path-utils.js';

describe('parseSVGPath', () => {
  it('parses M L commands', () => {
    const cmds = parseSVGPath('M 10 20 L 30 40');
    assert.deepStrictEqual(cmds, [
      { type: 'M', args: [10, 20] },
      { type: 'L', args: [30, 40] },
    ]);
  });

  it('parses comma-separated args', () => {
    const cmds = parseSVGPath('M10,20L30,40');
    assert.deepStrictEqual(cmds, [
      { type: 'M', args: [10, 20] },
      { type: 'L', args: [30, 40] },
    ]);
  });

  it('parses negative numbers', () => {
    const cmds = parseSVGPath('M -5 -3 L 10 -7');
    assert.strictEqual(cmds[0].args[0], -5);
    assert.strictEqual(cmds[0].args[1], -3);
    assert.strictEqual(cmds[1].args[1], -7);
  });

  it('parses Q (quadratic) commands', () => {
    const cmds = parseSVGPath('M 0 0 Q 5 10 10 0');
    assert.strictEqual(cmds[1].type, 'Q');
    assert.deepStrictEqual(cmds[1].args, [5, 10, 10, 0]);
  });

  it('parses C (cubic) commands', () => {
    const cmds = parseSVGPath('M 0 0 C 3 10 7 10 10 0');
    assert.strictEqual(cmds[1].type, 'C');
    assert.deepStrictEqual(cmds[1].args, [3, 10, 7, 10, 10, 0]);
  });

  it('parses Z (close) command', () => {
    const cmds = parseSVGPath('M 0 0 L 10 0 L 10 10 Z');
    assert.strictEqual(cmds[3].type, 'Z');
    assert.deepStrictEqual(cmds[3].args, []);
  });
});

describe('isClosedPath', () => {
  it('returns true for paths ending with Z', () => {
    assert.ok(isClosedPath(parseSVGPath('M 0 0 L 10 0 Z')));
  });

  it('returns false for open paths', () => {
    assert.ok(!isClosedPath(parseSVGPath('M 0 0 L 10 0')));
  });
});

describe('samplePath', () => {
  it('samples a horizontal line at regular intervals', () => {
    const cmds = parseSVGPath('M 0 0 L 20 0');
    const pts = samplePath(cmds, 10);
    assert.strictEqual(pts.length, 3);
    assert.deepStrictEqual(pts[0], { x: 0, y: 0 });
    assert.deepStrictEqual(pts[1], { x: 10, y: 0 });
    assert.deepStrictEqual(pts[2], { x: 20, y: 0 });
  });

  it('samples a vertical line', () => {
    const cmds = parseSVGPath('M 0 0 L 0 30');
    const pts = samplePath(cmds, 10);
    assert.strictEqual(pts.length, 4);
    assert.ok(Math.abs(pts[3].y - 30) < 0.01);
  });

  it('samples a closed triangle path', () => {
    const cmds = parseSVGPath('M 0 0 L 30 0 L 30 30 Z');
    const pts = samplePath(cmds, 10);
    assert.ok(pts.length >= 10);
    // First and last should be same (closed)
    assert.ok(Math.abs(pts[0].x - pts[pts.length - 1].x) < 0.5);
    assert.ok(Math.abs(pts[0].y - pts[pts.length - 1].y) < 0.5);
  });

  it('samples a quadratic bezier', () => {
    const cmds = parseSVGPath('M 0 0 Q 10 20 20 0');
    const pts = samplePath(cmds, 5);
    assert.ok(pts.length >= 4);
    const mid = pts[Math.floor(pts.length / 2)];
    assert.ok(mid.y > 0);
  });

  it('samples a cubic bezier', () => {
    const cmds = parseSVGPath('M 0 0 C 5 20 15 20 20 0');
    const pts = samplePath(cmds, 5);
    assert.ok(pts.length >= 4);
    const mid = pts[Math.floor(pts.length / 2)];
    assert.ok(mid.y > 0);
  });
});

describe('pointsToPath', () => {
  it('produces M/L path for open polyline', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    assert.strictEqual(pointsToPath(pts, false), 'M 0 0 L 10 0 L 10 10');
  });

  it('appends Z for closed paths', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    assert.ok(pointsToPath(pts, true).endsWith('Z'));
  });
});

describe('cumulativeDistances', () => {
  it('computes cumulative distance array', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 8 }];
    const d = cumulativeDistances(pts);
    assert.strictEqual(d[0], 0);
    assert.ok(Math.abs(d[1] - 5) < 0.01);
    assert.ok(Math.abs(d[2] - 10) < 0.01);
  });
});
