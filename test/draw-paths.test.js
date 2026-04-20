import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildPathGeometry, computePathLabelPosition } from '../src-v2/geometry/paths.js';
import { resolvePathStyle } from '../src-v2/style/style.js';
import { emitSVG } from '../src-v2/svg/emitter.js';
import { render } from '../src-v2/index.js';

let document;
before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  document = dom.window.document;
});

function makeSVG() {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
}

describe('buildPathGeometry', () => {
  it('builds SVG path string from two points', () => {
    const result = buildPathGeometry([{ x: 0, y: 0 }, { x: 100, y: 50 }]);
    assert.strictEqual(result.d, 'M 0 0 L 100 50');
  });

  it('builds SVG path string from multiple points', () => {
    const result = buildPathGeometry([
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 },
    ]);
    assert.strictEqual(result.d, 'M 0 0 L 50 0 L 50 50');
  });

  it('closes path when cycle is true', () => {
    const result = buildPathGeometry(
      [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }],
      { cycle: true }
    );
    assert.ok(result.d.endsWith('Z'));
  });

  it('returns total path length', () => {
    const result = buildPathGeometry([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    assert.ok(Math.abs(result.totalLength - 100) < 0.01);
  });

  it('handles single point gracefully', () => {
    const result = buildPathGeometry([{ x: 10, y: 20 }]);
    assert.strictEqual(result.d, 'M 10 20');
    assert.strictEqual(result.totalLength, 0);
  });

  it('handles empty array', () => {
    const result = buildPathGeometry([]);
    assert.strictEqual(result.d, '');
    assert.strictEqual(result.totalLength, 0);
  });
});

describe('computePathLabelPosition', () => {
  const segments = [
    { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, length: 100, cumLength: 100 },
  ];
  const totalLength = 100;

  it('returns start point at t=0', () => {
    const pos = computePathLabelPosition(segments, totalLength, 0);
    assert.strictEqual(pos.x, 0);
    assert.strictEqual(pos.y, 0);
  });

  it('returns end point at t=1', () => {
    const pos = computePathLabelPosition(segments, totalLength, 1);
    assert.strictEqual(pos.x, 100);
    assert.strictEqual(pos.y, 0);
  });

  it('returns midpoint at t=0.5', () => {
    const pos = computePathLabelPosition(segments, totalLength, 0.5);
    assert.strictEqual(pos.x, 50);
    assert.strictEqual(pos.y, 0);
  });

  it('works on multi-segment path', () => {
    const segs = [
      { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, length: 100, cumLength: 100 },
      { from: { x: 100, y: 0 }, to: { x: 100, y: 100 }, length: 100, cumLength: 200 },
    ];
    const pos = computePathLabelPosition(segs, 200, 0.5);
    assert.strictEqual(pos.x, 100);
    assert.strictEqual(pos.y, 0);

    const pos2 = computePathLabelPosition(segs, 200, 0.75);
    assert.strictEqual(pos2.x, 100);
    assert.strictEqual(pos2.y, 50);
  });

  it('returns angle of segment at position', () => {
    const segs = [
      { from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, length: 100, cumLength: 100 },
    ];
    const pos = computePathLabelPosition(segs, 100, 0.5);
    assert.strictEqual(pos.angle, 0);
  });
});

describe('resolvePathStyle', () => {
  it('returns defaults when no overrides', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }],
    });
    assert.strictEqual(style.stroke, '#000000');
    assert.strictEqual(style.strokeWidth, 1.5);
    assert.strictEqual(style.fill, 'none');
    assert.strictEqual(style.arrowStart, null);
    assert.strictEqual(style.arrowEnd, null);
    assert.strictEqual(style.dashed, false);
    assert.strictEqual(style.dotted, false);
  });

  it('parses arrow: "->" to arrowEnd only', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [], arrow: '->' }],
    });
    assert.strictEqual(style.arrowStart, null);
    assert.strictEqual(style.arrowEnd, 'stealth');
  });

  it('parses arrow: "<->" to both ends', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [], arrow: '<->' }],
    });
    assert.strictEqual(style.arrowStart, 'stealth');
    assert.strictEqual(style.arrowEnd, 'stealth');
  });

  it('parses arrow: "<-" to arrowStart only', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [], arrow: '<-' }],
    });
    assert.strictEqual(style.arrowStart, 'stealth');
    assert.strictEqual(style.arrowEnd, null);
  });

  it('merges config.pathStyle as base', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [] }],
      pathStyle: { stroke: 'red', strokeWidth: 3 },
    });
    assert.strictEqual(style.stroke, '#ff0000');
    assert.strictEqual(style.strokeWidth, 3);
  });

  it('per-path overrides beat pathStyle', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [], stroke: 'green' }],
      pathStyle: { stroke: 'red' },
    });
    assert.strictEqual(style.stroke, '#00ff00');
  });

  it('thick sets strokeWidth to 2.4', () => {
    const style = resolvePathStyle(0, {
      paths: [{ points: [], thick: true }],
    });
    assert.strictEqual(style.strokeWidth, 2.4);
  });
});

describe('emitDrawPath', () => {
  it('renders a path in the edge layer', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {}, edges: [], arrowDefs: [], shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 50',
        style: { stroke: '#000', strokeWidth: 1.5, fill: 'none' },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
    });
    const paths = svg.querySelectorAll('.edge-layer path.draw-path');
    assert.strictEqual(paths.length, 1);
    assert.strictEqual(paths[0].getAttribute('d'), 'M 0 0 L 100 50');
  });

  it('renders arrow markers on both ends', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {}, edges: [],
      arrowDefs: [{ id: 'arr-s', viewBox: '0 0 10 10', refX: 5, refY: 0,
        markerWidth: 10, markerHeight: 10, path: 'M 0 0 L 5 0', color: '#000',
        pathFill: '#000', pathStroke: 'none', lineEnd: 3, tipEnd: 5 }],
      shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 0',
        style: { stroke: '#000', strokeWidth: 1.5, fill: 'none' },
        arrowStartId: 'arr-s', arrowEndId: 'arr-s', labelNodes: [],
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('marker-start'));
    assert.ok(path.getAttribute('marker-end'));
  });

  it('applies dotted style', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {}, edges: [], arrowDefs: [], shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 100 0',
        style: { stroke: '#000', strokeWidth: 1, fill: 'none', dotted: true },
        arrowStartId: null, arrowEndId: null, labelNodes: [],
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('stroke-dasharray'));
  });

  it('renders inline label nodes', () => {
    const svg = makeSVG();
    emitSVG(svg, {
      nodes: {}, edges: [], arrowDefs: [], shadowFilters: [],
      drawPaths: [{
        d: 'M 0 0 L 200 0',
        style: { stroke: '#000', strokeWidth: 1, fill: 'none' },
        arrowStartId: null, arrowEndId: null,
        labelNodes: [{ x: 200, y: 0, label: 'e₁', anchor: 'right', fontSize: 12, fontFamily: 'serif' }],
      }],
    });
    const labels = svg.querySelectorAll('.label-layer .draw-label');
    assert.strictEqual(labels.length, 1);
    assert.strictEqual(labels[0].textContent, 'e₁');
  });
});

describe('render() with config.paths', () => {
  it('renders a simple line', () => {
    const svg = makeSVG();
    render(svg, {
      states: {}, edges: [],
      paths: [{ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path);
    assert.strictEqual(path.getAttribute('d'), 'M 0 0 L 100 0');
  });

  it('renders a path with <-> arrows', () => {
    const svg = makeSVG();
    render(svg, {
      states: {}, edges: [],
      paths: [{ points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], arrow: '<->' }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('marker-start'));
    assert.ok(path.getAttribute('marker-end'));
  });

  it('renders a dotted line', () => {
    const svg = makeSVG();
    render(svg, {
      states: {}, edges: [],
      paths: [{ points: [{ x: 10, y: 0 }, { x: 10, y: 100 }], dotted: true }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('stroke-dasharray'));
  });

  it('renders inline node labels', () => {
    const svg = makeSVG();
    render(svg, {
      states: {}, edges: [],
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
        arrow: '->',
        nodes: [{ at: 1, label: 'x-axis', anchor: 'right' }],
      }],
    });
    const label = svg.querySelector('.draw-label');
    assert.ok(label);
    assert.strictEqual(label.textContent, 'x-axis');
  });

  it('renders a thick red line segment', () => {
    const svg = makeSVG();
    render(svg, {
      states: {}, edges: [],
      paths: [{ points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], stroke: 'red', thick: true }],
    });
    const path = svg.querySelector('.draw-path');
    assert.strictEqual(path.getAttribute('stroke'), '#ff0000');
    assert.strictEqual(path.getAttribute('stroke-width'), '2.4');
  });

  it('coexists with nodes, edges, and plots', () => {
    const svg = makeSVG();
    render(svg, {
      states: { q0: { position: { x: 50, y: 50 }, label: 'A' } },
      edges: [],
      plots: [{
        expr: 'x', domain: [0, 1], samples: 3,
        scaleX: 100, scaleY: 100, offsetX: 0, offsetY: 0,
      }],
      paths: [{ points: [{ x: 0, y: 0 }, { x: 200, y: 0 }], arrow: '<->' }],
    });
    assert.ok(svg.querySelector('#node-q0'));
    assert.ok(svg.querySelector('.plot-path'));
    assert.ok(svg.querySelector('.draw-path'));
  });

  it('applies config.scale to path coordinates', () => {
    const svg = makeSVG();
    render(svg, {
      scale: 100,
      states: {}, edges: [],
      paths: [{ points: [{ x: 0, y: 0 }, { x: 2, y: 0 }] }],
    });
    const path = svg.querySelector('.draw-path');
    // 2 * 100 = 200
    assert.strictEqual(path.getAttribute('d'), 'M 0 0 L 200 0');
  });

  it('applies config.scale to plots', () => {
    const svg = makeSVG();
    render(svg, {
      scale: 50,
      states: { origin: { position: { x: 0, y: 0 }, label: '' } },
      edges: [],
      plots: [{
        expr: 'x',
        domain: [0, 1],
        samples: 2,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
      }],
    });
    const plotPath = svg.querySelector('.plot-path');
    const d = plotPath.getAttribute('d');
    // x=1, y=1 with plotScale 1*globalScale 50 → SVG x=50, y=-50
    assert.ok(d.includes('50'), 'scaled x should be 50');
  });

  it('renders a closed path (cycle)', () => {
    const svg = makeSVG();
    render(svg, {
      states: {}, edges: [],
      paths: [{
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }],
        cycle: true,
        fill: 'rgba(0,0,255,0.1)',
      }],
    });
    const path = svg.querySelector('.draw-path');
    assert.ok(path.getAttribute('d').includes('Z'));
    assert.ok(path.getAttribute('fill').includes('rgba'));
  });
});
