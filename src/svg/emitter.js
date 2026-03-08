/**
 * SVG emitter for the TikZ-SVG library.
 *
 * Takes a fully resolved model (nodes, edges, arrow/shadow defs) and
 * constructs SVG DOM elements.  All elements are created via
 * document.createElementNS — no innerHTML.
 */

import { DEFAULTS, DIRECTIONS } from '../core/constants.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────

/**
 * Create an SVG element with the given attributes.
 * Null / undefined attribute values are silently skipped.
 * @param {string} tag
 * @param {Object} [attrs]
 * @returns {SVGElement}
 */
function createSVGElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) el.setAttribute(k, String(v));
  }
  return el;
}

/**
 * Compute the direction vector for an initial arrow approach.
 * Accepts 'left', 'right', 'above', 'below', or a DIRECTIONS key.
 * Returns an SVG-coordinate direction vector pointing *toward* the node
 * (the approach direction).
 * @param {string|boolean} initial
 * @returns {{ x: number, y: number }}
 */
function initialApproachVector(initial) {
  if (initial === true || initial === 'left') {
    return { x: 1, y: 0 };
  }
  const dirEntry = DIRECTIONS[initial];
  return dirEntry ? { x: dirEntry.vector.x, y: dirEntry.vector.y } : { x: 1, y: 0 };
}

/**
 * Expand the bounding box to include a point.
 * @param {Object} bbox - { minX, minY, maxX, maxY }
 * @param {number} x
 * @param {number} y
 */
function expandBBox(bbox, x, y) {
  if (x < bbox.minX) bbox.minX = x;
  if (y < bbox.minY) bbox.minY = y;
  if (x > bbox.maxX) bbox.maxX = x;
  if (y > bbox.maxY) bbox.maxY = y;
}

/**
 * Expand the bounding box to include an SVG element's visual extent.
 * Falls back to transform-based center ± estimated radius for node groups.
 * @param {Object} bbox
 * @param {SVGElement} el
 */
function expandBBoxFromElement(bbox, el) {
  // For <g> with a translate transform, parse center and scan children
  const transform = el.getAttribute('transform');
  if (transform) {
    const match = transform.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/);
    if (match) {
      const cx = parseFloat(match[1]);
      const cy = parseFloat(match[2]);
      // Scan immediate children for radius/size hints
      for (const child of el.children) {
        const tag = child.tagName;
        if (tag === 'circle') {
          const r = parseFloat(child.getAttribute('r')) || 0;
          expandBBox(bbox, cx - r, cy - r);
          expandBBox(bbox, cx + r, cy + r);
        } else if (tag === 'ellipse') {
          const rx = parseFloat(child.getAttribute('rx')) || 0;
          const ry = parseFloat(child.getAttribute('ry')) || 0;
          expandBBox(bbox, cx - rx, cy - ry);
          expandBBox(bbox, cx + rx, cy + ry);
        } else if (tag === 'rect') {
          const x = parseFloat(child.getAttribute('x')) || 0;
          const y = parseFloat(child.getAttribute('y')) || 0;
          const w = parseFloat(child.getAttribute('width')) || 0;
          const h = parseFloat(child.getAttribute('height')) || 0;
          expandBBox(bbox, cx + x, cy + y);
          expandBBox(bbox, cx + x + w, cy + y + h);
        }
      }
      return;
    }
  }

  // For <path> elements, parse the d-attribute start point as a rough estimate
  const d = el.getAttribute('d');
  if (d) {
    // Extract all numeric coordinate pairs from the path
    const nums = d.match(/-?[\d.]+/g);
    if (nums && nums.length >= 2) {
      for (let i = 0; i < nums.length - 1; i += 2) {
        expandBBox(bbox, parseFloat(nums[i]), parseFloat(nums[i + 1]));
      }
    }
    return;
  }

  // For <text> elements, use x/y and estimate width
  if (el.tagName === 'text') {
    const tx = parseFloat(el.getAttribute('x')) || 0;
    const ty = parseFloat(el.getAttribute('y')) || 0;
    const fontSize = parseFloat(el.getAttribute('font-size')) || DEFAULTS.fontSize;
    const textLen = (el.textContent || '').length;
    const estWidth = textLen * fontSize * 0.6;
    expandBBox(bbox, tx - estWidth / 2, ty - fontSize / 2);
    expandBBox(bbox, tx + estWidth / 2, ty + fontSize / 2);
  }
}

// ────────────────────────────────────────────
// Defs: arrow markers and shadow filters
// ────────────────────────────────────────────

/**
 * Build the <defs> element containing arrow markers and shadow filters.
 * @param {Array} arrowDefs
 * @param {Array} shadowFilters
 * @returns {SVGDefsElement}
 */
function buildDefs(arrowDefs, shadowFilters) {
  const defs = createSVGElement('defs');

  // Arrow markers
  for (const def of arrowDefs) {
    const marker = createSVGElement('marker', {
      id: def.id,
      viewBox: def.viewBox,
      refX: def.refX,
      refY: def.refY,
      markerWidth: def.markerWidth,
      markerHeight: def.markerHeight,
      orient: def.orient ?? 'auto',
      markerUnits: 'userSpaceOnUse',
    });
    const path = createSVGElement('path', {
      d: def.path,
      fill: def.color,
    });
    marker.appendChild(path);
    defs.appendChild(marker);
  }

  // Shadow filters
  for (const sf of shadowFilters) {
    const filter = createSVGElement('filter', {
      id: sf.id,
      x: '-50%',
      y: '-50%',
      width: '200%',
      height: '200%',
    });

    // Use feDropShadow where available; it's the most concise.
    const drop = createSVGElement('feDropShadow', {
      dx: sf.dx,
      dy: sf.dy,
      stdDeviation: sf.blur,
      'flood-color': sf.color,
      'flood-opacity': 1,
    });
    filter.appendChild(drop);
    defs.appendChild(filter);
  }

  return defs;
}

// ────────────────────────────────────────────
// Edge emission
// ────────────────────────────────────────────

/**
 * Emit a single edge <path> element.
 * @param {Object} edge
 * @returns {SVGPathElement}
 */
function emitEdgePath(edge) {
  const { path, style } = edge;

  const attrs = {
    d: path,
    fill: 'none',
    stroke: style.stroke ?? DEFAULTS.edgeColor,
    'stroke-width': style.strokeWidth ?? DEFAULTS.edgeStrokeWidth,
  };

  // Arrow marker
  if (style.arrowId) {
    attrs['marker-end'] = `url(#${style.arrowId})`;
  }

  // Dashed
  if (style.dashed) {
    attrs['stroke-dasharray'] = typeof style.dashed === 'string'
      ? style.dashed
      : '6 4';
  }

  // Opacity
  if (style.opacity != null && style.opacity < 1) {
    attrs.opacity = style.opacity;
  }

  const pathEl = createSVGElement('path', attrs);

  if (style.className) {
    pathEl.classList.add(style.className);
  }

  return pathEl;
}

// ────────────────────────────────────────────
// Edge label emission
// ────────────────────────────────────────────

/**
 * Emit a <text> element for an edge label.
 * @param {Object} edge
 * @returns {SVGTextElement|null}
 */
function emitEdgeLabel(edge) {
  const { label, labelPosition, style } = edge;
  if (!label) return null;

  const attrs = {
    x: labelPosition.x,
    y: labelPosition.y,
    'text-anchor': 'middle',
    'dominant-baseline': 'central',
    'font-size': style.fontSize ?? DEFAULTS.fontSize,
    'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
    fill: style.labelColor ?? '#000000',
  };

  if (labelPosition.angle != null) {
    attrs.transform = `rotate(${labelPosition.angle}, ${labelPosition.x}, ${labelPosition.y})`;
  }

  const text = createSVGElement('text', attrs);
  text.textContent = label;
  return text;
}

// ────────────────────────────────────────────
// Node emission
// ────────────────────────────────────────────

/**
 * Emit a <g> for a single node, containing its shape element(s) and label.
 * @param {string} id
 * @param {Object} node - { center, geom, style, label }
 * @returns {SVGGElement}
 */
function emitNode(id, node) {
  const { center, geom, style, label } = node;

  const g = createSVGElement('g', {
    class: 'node',
    id: `node-${id}`,
    transform: `translate(${center.x}, ${center.y})`,
  });

  if (style.className) {
    g.classList.add(style.className);
  }

  // Determine shape and create element
  const shapeEl = createShapeElement(geom, style);
  if (style.shadow && style._shadowFilterId) {
    shapeEl.setAttribute('filter', `url(#${style._shadowFilterId})`);
  }
  g.appendChild(shapeEl);

  // Accepting (double border) — inner shape with inset
  if (style.accepting) {
    const inset = style.acceptingInset ?? DEFAULTS.acceptingInset;
    const innerEl = createShapeElement(geom, style, { inset, fillOverride: 'none' });
    g.appendChild(innerEl);
  }

  // Label
  if (label != null && label !== '') {
    const text = createSVGElement('text', {
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': style.fontSize ?? DEFAULTS.fontSize,
      'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
      fill: style.labelColor ?? '#000000',
    });
    text.textContent = String(label);
    g.appendChild(text);
  }

  return g;
}

/**
 * Create a shape SVG element for a node.
 * Coordinates are relative to the node center (the <g> is translated).
 * @param {Object} geom
 * @param {Object} style
 * @param {Object} [opts] - { inset: number, fillOverride: string }
 * @returns {SVGElement}
 */
function createShapeElement(geom, style, opts = {}) {
  const inset = opts.inset ?? 0;
  const fill = opts.fillOverride ?? style.fill ?? DEFAULTS.nodeFill;
  const stroke = style.stroke ?? DEFAULTS.nodeStroke;
  const strokeWidth = style.strokeWidth ?? DEFAULTS.nodeStrokeWidth;
  const shape = style.shape ?? 'circle';

  switch (shape) {
    case 'rectangle': {
      const hw = Math.max(0, geom.halfWidth - inset);
      const hh = Math.max(0, geom.halfHeight - inset);
      return createSVGElement('rect', {
        x: -hw, y: -hh, width: hw * 2, height: hh * 2,
        fill, stroke, 'stroke-width': strokeWidth,
      });
    }

    case 'ellipse': {
      const rx = Math.max(0, geom.rx - inset);
      const ry = Math.max(0, geom.ry - inset);
      return createSVGElement('ellipse', {
        cx: 0, cy: 0, rx, ry, fill, stroke, 'stroke-width': strokeWidth,
      });
    }

    case 'circle':
    default: {
      const r = Math.max(0, (geom.radius ?? DEFAULTS.nodeRadius) - inset);
      return createSVGElement('circle', {
        cx: 0, cy: 0, r, fill, stroke, 'stroke-width': strokeWidth,
      });
    }
  }
}

// ────────────────────────────────────────────
// Initial arrows
// ────────────────────────────────────────────

/**
 * Emit an initial-state arrow for a node.
 * The arrow points toward the node from outside, along the approach direction.
 * @param {Object} node - { center, geom, style, shape }
 * @param {string} arrowMarkerId - marker id to use for the arrowhead
 * @returns {SVGPathElement}
 */
function emitInitialArrow(node, arrowMarkerId) {
  const { geom, style, shape } = node;
  const initial = style.initial;
  const length = DEFAULTS.initialArrowLength;

  // Determine approach direction (vector pointing toward the node center)
  const approach = initialApproachVector(initial);
  // Reverse direction: where the arrow starts (away from node)
  const reverseApproach = { x: -approach.x, y: -approach.y };

  // Arrow tip: use shape's borderPoint for correct geometry on any shape
  const tip = shape.borderPoint(geom, reverseApproach);

  // Arrow start: tip displaced by length in the reverse direction
  const startX = tip.x + reverseApproach.x * length;
  const startY = tip.y + reverseApproach.y * length;

  const attrs = {
    d: `M ${startX} ${startY} L ${tip.x} ${tip.y}`,
    fill: 'none',
    stroke: style.stroke ?? DEFAULTS.nodeStroke,
    'stroke-width': style.strokeWidth ?? DEFAULTS.nodeStrokeWidth,
    class: 'initial-arrow',
  };

  if (arrowMarkerId) {
    attrs['marker-end'] = `url(#${arrowMarkerId})`;
  }

  return createSVGElement('path', attrs);
}

// ────────────────────────────────────────────
// ViewBox computation
// ────────────────────────────────────────────

/**
 * Compute a viewBox string from all rendered elements.
 * Adds padding on each side.
 * @param {SVGElement} svgEl
 * @param {number} [padding=40]
 * @returns {string}
 */
function computeViewBox(svgEl, padding = 40) {
  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  // Walk all direct children of layers (initial arrows are in edge-layer)
  for (const layer of svgEl.querySelectorAll('.edge-layer, .label-layer, .node-layer')) {
    for (const child of layer.children) {
      expandBBoxFromElement(bbox, child);
    }
  }

  // Guard against empty scenes
  if (!isFinite(bbox.minX)) {
    return '0 0 100 100';
  }

  const x = bbox.minX - padding;
  const y = bbox.minY - padding;
  const w = bbox.maxX - bbox.minX + padding * 2;
  const h = bbox.maxY - bbox.minY + padding * 2;

  return `${x} ${y} ${w} ${h}`;
}

// ────────────────────────────────────────────
// Main public API
// ────────────────────────────────────────────

/**
 * Render a fully resolved model into an SVG element.
 *
 * @param {SVGElement} svgEl - Target `<svg>` element (will be cleared).
 * @param {Object} resolved - Fully resolved model:
 *   ```
 *   {
 *     nodes: { [id]: { center, geom, style, label } },
 *     edges: [{ from, to, path, style, label, labelPosition, edgeGeometry }],
 *     shadowFilters: [{ id, dx, dy, blur, color }],
 *     arrowDefs: [{ id, viewBox, refX, refY, markerWidth, markerHeight, path, color }],
 *   }
 *   ```
 * @returns {Object} refs - `{ nodes: { [id]: gElement }, edges: [pathElement], labels: [textElement] }`
 */
export function emitSVG(svgEl, resolved) {
  const {
    nodes = {},
    edges = [],
    shadowFilters = [],
    arrowDefs = [],
  } = resolved;

  // 1. Clear existing content
  while (svgEl.firstChild) {
    svgEl.removeChild(svgEl.firstChild);
  }

  // 2. Build and append <defs>
  const defs = buildDefs(arrowDefs, shadowFilters);
  svgEl.appendChild(defs);

  // 3. Create layer groups (paint order: edges behind nodes)
  const edgeLayer = createSVGElement('g', { class: 'edge-layer' });
  const labelLayer = createSVGElement('g', { class: 'label-layer' });
  const nodeLayer = createSVGElement('g', { class: 'node-layer' });

  svgEl.appendChild(edgeLayer);
  svgEl.appendChild(labelLayer);
  svgEl.appendChild(nodeLayer);

  // Collect refs for caller
  const refs = {
    nodes: {},
    edges: [],
    labels: [],
  };

  // 4. Emit edges
  for (const edge of edges) {
    const pathEl = emitEdgePath(edge);
    edgeLayer.appendChild(pathEl);
    refs.edges.push(pathEl);

    // 5. Emit edge labels
    const labelEl = emitEdgeLabel(edge);
    if (labelEl) {
      labelLayer.appendChild(labelEl);
      refs.labels.push(labelEl);
    }
  }

  // 6. Emit nodes
  // Find the first arrow def to reuse for initial arrows (stealth marker)
  const defaultArrowId = arrowDefs.length > 0 ? arrowDefs[0].id : null;

  for (const [id, node] of Object.entries(nodes)) {
    const g = emitNode(id, node);
    nodeLayer.appendChild(g);
    refs.nodes[id] = g;

    // 7. Emit initial arrow if node is an initial state
    if (node.style.initial) {
      const arrowPath = emitInitialArrow(node, defaultArrowId);
      edgeLayer.appendChild(arrowPath);
    }
  }

  // 8. Compute and set viewBox
  const viewBox = computeViewBox(svgEl);
  svgEl.setAttribute('viewBox', viewBox);

  // 9. Return refs
  return refs;
}
