import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTextSize, mirrorAnchor, computeAnchor, computeLabelNode } from '../src-v2/geometry/labels.js';

describe('estimateTextSize', () => {
  it('single character at fontSize 14', () => {
    const size = estimateTextSize('0', 14);
    assert.strictEqual(size.width, 14 * 0.6);  // 8.4
    assert.strictEqual(size.height, 14);
  });

  it('multi-character label', () => {
    const size = estimateTextSize('0,1,L', 14);
    assert.strictEqual(size.width, 5 * 14 * 0.6);  // 42
    assert.strictEqual(size.height, 14);
  });

  it('empty string returns zero width', () => {
    const size = estimateTextSize('', 14);
    assert.strictEqual(size.width, 0);
    assert.strictEqual(size.height, 14);
  });
});

describe('mirrorAnchor', () => {
  it('south east <-> north west', () => {
    assert.strictEqual(mirrorAnchor('south east'), 'north west');
    assert.strictEqual(mirrorAnchor('north west'), 'south east');
  });

  it('south west <-> north east', () => {
    assert.strictEqual(mirrorAnchor('south west'), 'north east');
    assert.strictEqual(mirrorAnchor('north east'), 'south west');
  });

  it('south <-> north', () => {
    assert.strictEqual(mirrorAnchor('south'), 'north');
    assert.strictEqual(mirrorAnchor('north'), 'south');
  });

  it('east <-> west', () => {
    assert.strictEqual(mirrorAnchor('east'), 'west');
    assert.strictEqual(mirrorAnchor('west'), 'east');
  });

  it('center stays center', () => {
    assert.strictEqual(mirrorAnchor('center'), 'center');
  });
});

describe('computeAnchor', () => {
  // Tangent vectors are in SVG coords (y-down).
  // computeAnchor negates y internally to convert to TikZ y-up.
  // SVG (1,1) = right-down on screen → TikZ (1,-1) = right-down in TikZ y-up space.

  // Edge right-down on screen → TikZ right-down → south west
  it('right-down SVG → south west', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: 1 }, 'left'), 'south west');
  });

  // Edge right-up on screen → TikZ right-up → south east
  it('right-up SVG → south east', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: -1 }, 'left'), 'south east');
  });

  it('pure right → south', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: 0 }, 'left'), 'south');
  });

  // Edge left-down on screen → TikZ left-down → north west
  it('left-down SVG → north west', () => {
    assert.strictEqual(computeAnchor({ x: -1, y: 1 }, 'left'), 'north west');
  });

  // Edge left-up on screen → TikZ left-up → north east
  it('left-up SVG → north east', () => {
    assert.strictEqual(computeAnchor({ x: -1, y: -1 }, 'left'), 'north east');
  });

  it('pure left → north', () => {
    assert.strictEqual(computeAnchor({ x: -1, y: 0 }, 'left'), 'north');
  });

  // Pure down in SVG → TikZ pure down → west
  it('pure down SVG → west', () => {
    assert.strictEqual(computeAnchor({ x: 0, y: 1 }, 'left'), 'west');
  });

  // Pure up in SVG → TikZ pure up → east
  it('pure up SVG → east', () => {
    assert.strictEqual(computeAnchor({ x: 0, y: -1 }, 'left'), 'east');
  });

  it('zero tangent → west', () => {
    assert.strictEqual(computeAnchor({ x: 0, y: 0 }, 'left'), 'west');
  });

  // Swap: right-down SVG → south west → mirror → north east
  it('swap: right-down SVG → north east', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: 1 }, 'right'), 'north east');
  });

  it('swap: pure right → north', () => {
    assert.strictEqual(computeAnchor({ x: 1, y: 0 }, 'right'), 'north');
  });
});

describe('computeLabelNode', () => {
  // Helper: straight edge going right. After border clipping: (20,0) → (80,0)
  function straightRightEdge() {
    return {
      type: 'straight',
      startPoint: { x: 20, y: 0 },
      endPoint: { x: 80, y: 0 },
    };
  }

  it('label node center is shifted so anchor sits at edge point', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'left', distance: 0, innerSep: 3, fontSize: 14,
    });

    // Edge midpoint is (50, 0). Tangent is pure right → anchor 'south'.
    assert.strictEqual(result.anchor, 'south');

    // 'south' anchor on a rectangle is at (center.x, center.y + halfHeight).
    // halfHeight = fontSize/2 + innerSep = 7 + 3 = 10.
    // For south anchor to land at (50, 0): center.y = 0 - 10 = -10
    assert.strictEqual(result.center.x, 50);
    assert.strictEqual(result.center.y, -10);
  });

  it('swap side mirrors the anchor', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'right', distance: 0, innerSep: 3, fontSize: 14,
    });

    // Swap: south → north. north anchor at (center.x, center.y - halfHeight).
    // For north anchor at (50, 0): center.y = 0 + 10 = 10
    assert.strictEqual(result.anchor, 'north');
    assert.strictEqual(result.center.x, 50);
    assert.strictEqual(result.center.y, 10);
  });

  it('geom has correct halfWidth and halfHeight', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0,1,L', {
      pos: 0.5, side: 'left', distance: 0, innerSep: 3, fontSize: 14,
    });

    // textWidth = 5 * 14 * 0.6 = 42, halfWidth = 42/2 + 3 = 24
    // textHeight = 14, halfHeight = 14/2 + 3 = 10
    assert.strictEqual(result.geom.halfWidth, 24);
    assert.strictEqual(result.geom.halfHeight, 10);
  });

  it('distance offsets the edge point before anchor positioning', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'left', distance: 5, innerSep: 3, fontSize: 14,
    });

    // perpendicularOffset with tangent (1,0) and distance 5:
    //   x = 50 + 0*5 = 50, y = 0 - 1*5 = -5 (up in SVG = visual LEFT of rightward travel)
    // Anchor is still 'south'. halfHeight = 10.
    // center.y = -5 - 10 = -15
    assert.strictEqual(result.anchor, 'south');
    assert.strictEqual(result.center.x, 50);
    assert.strictEqual(result.center.y, -15);
  });

  it('returns null angle when sloped is false', () => {
    const edge = straightRightEdge();
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'left', distance: 0, innerSep: 3, fontSize: 14,
    });
    assert.strictEqual(result.angle, null);
  });

  it('returns angle and forces south anchor when sloped is true', () => {
    // Diagonal edge: tangent is (1, -1) → ~-45° up-right in SVG
    const edge = {
      type: 'straight',
      startPoint: { x: 0, y: 100 },
      endPoint: { x: 100, y: 0 },
    };
    const result = computeLabelNode(edge, '0', {
      pos: 0.5, side: 'left', distance: 0, innerSep: 3, fontSize: 14,
      sloped: true,
    });

    // Sloped forces anchor to 'south' or 'north' depending on flip
    assert.ok(result.anchor === 'south' || result.anchor === 'north');
    assert.ok(typeof result.angle === 'number');
  });
});
