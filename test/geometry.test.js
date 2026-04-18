import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import circleShape from '../src-v2/shapes/circle.js';
import {
  computeStraightEdge,
  computeBentEdge,
  computeLoopEdge,
} from '../src-v2/geometry/edges.js';
import { computeLabelNode } from '../src-v2/geometry/labels.js';
import { getArrowDef } from '../src-v2/geometry/arrows.js';

const near = (a, b, eps = 0.5) => Math.abs(a - b) < eps;

function makeCircleNode(x, y, r = 20) {
  const geom = circleShape.savedGeometry({ center: { x, y }, radius: r });
  return { center: { x, y }, shape: circleShape, geom };
}

describe('Straight edge', () => {
  it('endpoints are on borders, not centers', () => {
    const a = makeCircleNode(0, 0, 20);
    const b = makeCircleNode(100, 0, 20);
    const edge = computeStraightEdge(a, b);

    // Start should be at east border of a (x=20, y=0)
    assert.ok(near(edge.startPoint.x, 20));
    assert.ok(near(edge.startPoint.y, 0));
    // End should be at west border of b (x=80, y=0)
    assert.ok(near(edge.endPoint.x, 80));
    assert.ok(near(edge.endPoint.y, 0));
  });

  it('path starts with M and contains L', () => {
    const a = makeCircleNode(0, 0);
    const b = makeCircleNode(100, 0);
    const edge = computeStraightEdge(a, b);
    assert.ok(edge.path.startsWith('M'));
    assert.ok(edge.path.includes('L'));
    assert.strictEqual(edge.type, 'straight');
  });
});

describe('Bent edge', () => {
  it('control point is on correct side for bend left', () => {
    const a = makeCircleNode(0, 0, 20);
    const b = makeCircleNode(100, 0, 20);
    const edge = computeBentEdge(a, b, 'left');

    // For bend left on a rightward edge, the control point should be above (negative y)
    assert.ok(edge.controlPoint.y < 0, `control point y=${edge.controlPoint.y} should be < 0`);
    assert.strictEqual(edge.type, 'quadratic');
  });

  it('control point is on correct side for bend right', () => {
    const a = makeCircleNode(0, 0, 20);
    const b = makeCircleNode(100, 0, 20);
    const edge = computeBentEdge(a, b, 'right');

    // For bend right on a rightward edge, the control point should be below (positive y)
    assert.ok(edge.controlPoint.y > 0, `control point y=${edge.controlPoint.y} should be > 0`);
  });

  it('path contains Q for quadratic', () => {
    const a = makeCircleNode(0, 0);
    const b = makeCircleNode(100, 0);
    const edge = computeBentEdge(a, b, 30);
    assert.ok(edge.path.includes('Q'));
  });
});

describe('Self-loop', () => {
  it('departure and arrival points are distinct', () => {
    const node = makeCircleNode(50, 50, 20);
    const edge = computeLoopEdge(node, 'above');

    assert.ok(
      edge.startPoint.x !== edge.endPoint.x || edge.startPoint.y !== edge.endPoint.y,
      'start and end should differ'
    );
    assert.strictEqual(edge.type, 'cubic');
  });

  it('loop above: control points are above the node', () => {
    const node = makeCircleNode(50, 50, 20);
    const edge = computeLoopEdge(node, 'above');

    assert.ok(edge.cp1.y < 50, 'cp1 should be above center');
    assert.ok(edge.cp2.y < 50, 'cp2 should be above center');
  });

  it('loop below: control points are below the node', () => {
    const node = makeCircleNode(50, 50, 20);
    const edge = computeLoopEdge(node, 'below');

    assert.ok(edge.cp1.y > 50, 'cp1 should be below center');
    assert.ok(edge.cp2.y > 50, 'cp2 should be below center');
  });

  it('path contains C for cubic', () => {
    const node = makeCircleNode(50, 50);
    const edge = computeLoopEdge(node, 'above');
    assert.ok(edge.path.includes('C'));
  });
});

describe('Label position', () => {
  it('midpoint of straight edge', () => {
    const a = makeCircleNode(0, 0, 20);
    const b = makeCircleNode(100, 0, 20);
    const edge = computeStraightEdge(a, b);
    const label = computeLabelNode(edge, '', { pos: 0.5, distance: 0 });
    // Label x is at edge midpoint; y is offset above the edge by the anchor.
    assert.ok(near(label.center.x, 50, 1));
    assert.ok(label.center.y <= 0, `label y=${label.center.y} should be at or above the edge`);
  });

  it('label on curved edge is on the curve, not the chord', () => {
    const a = makeCircleNode(0, 0, 20);
    const b = makeCircleNode(100, 0, 20);
    const edge = computeBentEdge(a, b, 'left');
    const label = computeLabelNode(edge, '', { pos: 0.5, distance: 0 });
    // On a bend-left rightward edge, the midpoint should be above the chord (y < 0)
    assert.ok(label.center.y < 0, `label y=${label.center.y} should be < 0 (on the curve)`);
  });
});

describe('Arrow definitions', () => {
  it('stealth arrow returns valid def', () => {
    const def = getArrowDef({ type: 'stealth', size: 8, color: '#000' });
    assert.ok(def);
    assert.ok(def.id);
    assert.ok(def.path);
    assert.ok(def.viewBox);
    assert.strictEqual(def.orient, 'auto');
  });

  it('none arrow returns null', () => {
    assert.strictEqual(getArrowDef({ type: 'none' }), null);
  });
});
