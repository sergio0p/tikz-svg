/**
 * TikZ-SVG main render pipeline.
 * Orchestrates all phases: parse, position, geometry, style, emit.
 */

// Side-effect imports: shapes register themselves in the shape registry
import './shapes/circle.js';
import './shapes/rectangle.js';
import './shapes/ellipse.js';

import { getShape } from './shapes/shape.js';
import { resolvePositions } from './positioning/positioning.js';
import { computeEdgePath } from './geometry/edges.js';
import { getArrowDef } from './geometry/arrows.js';
import { computeLabelPosition } from './geometry/labels.js';
import { resolveNodeStyle, resolveEdgeStyle, collectShadowFilters } from './style/style.js';
import { emitSVG } from './svg/emitter.js';
import { DEFAULTS } from './core/constants.js';

/**
 * Main render function. Orchestrates the full pipeline.
 *
 * @param {SVGElement} svgEl - Target SVG element
 * @param {Object} config - Full configuration object:
 *   {
 *     states: { id: { position?, initial?, accepting?, radius?, ... }, ... },
 *     edges: [{ from, to, label?, bend?, loop?, ... }, ...],
 *     stateStyle?: { ... },
 *     edgeStyle?: { ... },
 *     nodeDistance?: number,
 *     onGrid?: boolean,
 *   }
 * @returns {Object} Element references { nodes, edges, labels }
 */
export function render(svgEl, config) {
  // ── PHASE 1: PARSE ──────────────────────────────────────────────────
  // Validate and normalise the incoming configuration.

  const states = config.states || {};
  const edges = config.edges || [];

  const stateIds = Object.keys(states);
  if (stateIds.length === 0) {
    return { nodes: {}, edges: [], labels: [] };
  }

  // ── PHASE 2: RESOLVE POSITIONS ──────────────────────────────────────
  // Topological sort + direction table → absolute { x, y } for every node.

  const resolvedStates = resolvePositions({
    states,
    nodeDistance: config.nodeDistance,
    onGrid: config.onGrid,
  });

  // ── PHASE 3: COMPUTE NODE GEOMETRY ──────────────────────────────────
  // Create shape instances, cache their saved geometry and anchors.

  const nodeRegistry = {};   // id → { center, shape, geom, style }

  for (const id of stateIds) {
    const style = resolveNodeStyle(id, config);
    const shapeName = style.shape || 'circle';
    const shape = getShape(shapeName);
    const center = resolvedStates[id].position;

    // Build the config object expected by each shape's savedGeometry()
    const geomConfig = { center };
    switch (shapeName) {
      case 'rectangle':
        geomConfig.halfWidth = style.halfWidth ?? style.radius ?? DEFAULTS.nodeRadius;
        geomConfig.halfHeight = style.halfHeight ?? style.radius ?? DEFAULTS.nodeRadius;
        break;
      case 'ellipse':
        geomConfig.rx = style.rx ?? style.radius ?? DEFAULTS.nodeRadius;
        geomConfig.ry = style.ry ?? style.radius ?? DEFAULTS.nodeRadius;
        break;
      case 'circle':
      default:
        geomConfig.radius = style.radius ?? DEFAULTS.nodeRadius;
        break;
    }

    const geom = shape.savedGeometry(geomConfig);

    nodeRegistry[id] = { center, shape, geom, style };
  }

  // ── PHASE 4: COMPUTE EDGE GEOMETRY ──────────────────────────────────
  // Paths, control points, and label positions for every edge.

  // Resolve edge styles once for use in both geometry and emission phases
  const resolvedEdgeStyles = [];
  const arrowDefsMap = new Map();

  for (let i = 0; i < edges.length; i++) {
    const style = resolveEdgeStyle(i, config);
    const arrowDef = getArrowDef({
      type: style.arrow,
      size: style.arrowSize,
      color: style.stroke,
    });
    if (arrowDef && !arrowDefsMap.has(arrowDef.id)) {
      arrowDefsMap.set(arrowDef.id, arrowDef);
    }
    style.arrowId = arrowDef ? arrowDef.id : null;
    resolvedEdgeStyles.push(style);
  }

  const arrowDefs = Array.from(arrowDefsMap.values());

  const edgeGeometries = [];
  const edgeLabelPositions = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const edgeStyle = resolvedEdgeStyles[i];
    const fromId = edge.from;
    const toId = edge.to;

    const sourceNode = nodeRegistry[fromId];
    if (!sourceNode) {
      throw new Error(`Edge ${i}: unknown source state "${fromId}"`);
    }

    const isSelfLoop = fromId === toId || edge.loop != null;
    const targetNode = isSelfLoop ? sourceNode : nodeRegistry[toId];

    if (!targetNode) {
      throw new Error(`Edge ${i}: unknown target state "${toId}"`);
    }

    const edgeConfig = {
      bend: edge.bend ?? edgeStyle.bend,
      loop: edge.loop ?? edgeStyle.loop,
      out: edge.out,
      in: edge.in,
      looseness: edge.looseness,
    };

    const geom = computeEdgePath(sourceNode, targetNode, edgeConfig);
    edgeGeometries.push(geom);

    if (edge.label != null) {
      const labelPos = computeLabelPosition(geom, {
        pos: edge.labelPos ?? edgeStyle.labelPos,
        side: edge.labelSide ?? edgeStyle.labelSide,
        distance: edge.labelDistance ?? edgeStyle.labelDistance,
        sloped: edge.sloped,
      });
      edgeLabelPositions.push(labelPos);
    } else {
      edgeLabelPositions.push(null);
    }
  }

  // ── PHASE 5: RESOLVE STYLES ─────────────────────────────────────────

  const resolvedNodeStyles = Object.fromEntries(
    stateIds.map(id => [id, nodeRegistry[id].style])
  );
  const shadowFilters = collectShadowFilters(resolvedNodeStyles);

  // ── PHASE 6: EMIT SVG ──────────────────────────────────────────────
  // Build the resolved model and hand it off to the SVG emitter.

  const model = {
    nodes: {},
    edges: [],
    arrowDefs,
    shadowFilters,
  };

  for (const id of stateIds) {
    const entry = nodeRegistry[id];
    model.nodes[id] = {
      id,
      center: entry.center,
      geom: entry.geom,
      shape: entry.shape,
      style: entry.style,
      label: states[id].label ?? id,
    };
  }

  for (let i = 0; i < edges.length; i++) {
    model.edges.push({
      index: i,
      from: edges[i].from,
      to: edges[i].to,
      label: edges[i].label ?? null,
      path: edgeGeometries[i].path,
      edgeGeometry: edgeGeometries[i],
      labelPosition: edgeLabelPositions[i],
      style: resolvedEdgeStyles[i],
    });
  }

  return emitSVG(svgEl, model);
}

export { renderAutomaton } from './automata/automata.js';
