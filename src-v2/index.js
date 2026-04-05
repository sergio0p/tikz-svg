/**
 * TikZ-SVG main render pipeline.
 * Orchestrates all phases: parse, position, geometry, style, emit.
 */

// Side-effect imports: shapes register themselves in the shape registry
import './shapes/circle.js';
import './shapes/rectangle.js';
import './shapes/ellipse.js';
import './shapes/diamond.js';
import './shapes/star.js';
import './shapes/regular-polygon.js';
import './shapes/trapezium.js';
import './shapes/semicircle.js';
import './shapes/isosceles-triangle.js';
import './shapes/kite.js';
import './shapes/dart.js';
import './shapes/circular-sector.js';
import './shapes/cylinder.js';
import './shapes/rectangle-split.js';
import './shapes/circle-split.js';
import './shapes/ellipse-split.js';
import './shapes/cloud.js';
import './shapes/rectangle-callout.js';
import './shapes/ellipse-callout.js';
import './shapes/cloud-callout.js';
import './shapes/parallelogram.js';
import './shapes/document.js';

import { getShape } from './shapes/shape.js';
import { resolvePositions } from './positioning/positioning.js';
import { computeEdgePath } from './geometry/edges.js';
import { getArrowDef } from './geometry/arrows.js';
import { computeLabelNode } from './geometry/labels.js';
import { resolveNodeStyle, resolveEdgeStyle, resolvePlotStyle, resolvePathStyle, collectShadowFilters } from './style/style.js';
import { emitSVG } from './svg/emitter.js';
import { DEFAULTS } from './core/constants.js';
import { estimateTextDimensions } from './core/text-measure.js';
import { plot as computePlot } from './plotting/index.js';
import { getMarkFillMode } from './plotting/marks.js';
import { buildPathGeometry, computePathLabelPosition } from './geometry/paths.js';
import { registerPendingReRender } from './core/katex-renderer.js';

function round4(v) {
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * Transform a Path's coordinates from math (y-up) to SVG (y-down) with scale+offset.
 */
function transformPlotPath(path, sx, sy, ox, oy) {
  if (!path || path.isEmpty()) return '';
  const parts = [];
  for (const seg of path.segments) {
    if (seg.type === 'Z') {
      parts.push('Z');
    } else if (seg.type === 'M' || seg.type === 'L') {
      parts.push(`${seg.type} ${round4(seg.args[0] * sx + ox)} ${round4(-seg.args[1] * sy + oy)}`);
    } else if (seg.type === 'C') {
      const x1 = round4(seg.args[0] * sx + ox), y1 = round4(-seg.args[1] * sy + oy);
      const x2 = round4(seg.args[2] * sx + ox), y2 = round4(-seg.args[3] * sy + oy);
      const x3 = round4(seg.args[4] * sx + ox), y3 = round4(-seg.args[5] * sy + oy);
      parts.push(`C ${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`);
    }
  }
  return parts.join(' ');
}

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

  // Global scale: TikZ [scale=3.5] equivalent.
  // Multiplies all path/plot coordinates. origin shifts the coordinate system.
  const globalScaleX = config.scaleX ?? config.scale ?? 1;
  const globalScaleY = config.scaleY ?? config.scale ?? 1;
  const globalOriginX = config.originX ?? 0;
  const globalOriginY = config.originY ?? 0;

  // TikZ [transform canvas={scale=N}] equivalent.
  // Low-level graphics transform: scales everything (fonts, strokes, arrows).
  const transformCanvas = config.transformCanvas ?? null;

  // ── DRAW-ORDER MODE ──────────────────────────────────────────────────
  // When config.draw is present, split entries by type and recurse with _drawOrder.
  if (config.draw && !config._drawOrder) {
    const drawStates = {};
    const drawEdges = [];
    const drawPlots = [];
    const drawPaths = [];
    const drawOrderSpec = [];

    for (const entry of config.draw) {
      switch (entry.type) {
        case 'node': {
          const id = entry.id;
          const props = { ...entry };
          delete props.type;
          delete props.id;
          drawStates[id] = props;
          drawOrderSpec.push({ type: 'node', id, layer: entry.layer });
          break;
        }
        case 'edge': {
          const idx = drawEdges.length;
          const props = { ...entry };
          delete props.type;
          drawEdges.push(props);
          drawOrderSpec.push({ type: 'edge', index: idx, layer: entry.layer });
          break;
        }
        case 'plot': {
          const idx = drawPlots.length;
          const props = { ...entry };
          delete props.type;
          drawPlots.push(props);
          drawOrderSpec.push({ type: 'plot', index: idx, layer: entry.layer });
          break;
        }
        case 'path': {
          const idx = drawPaths.length;
          const props = { ...entry };
          delete props.type;
          drawPaths.push(props);
          drawOrderSpec.push({ type: 'drawPath', index: idx, layer: entry.layer });
          break;
        }
      }
    }

    const subConfig = {
      ...config,
      states: drawStates,
      edges: drawEdges,
      plots: drawPlots,
      paths: drawPaths,
      _drawOrder: drawOrderSpec,
      _layers: config.layers,
    };
    delete subConfig.draw;
    return render(svgEl, subConfig);
  }

  const states = { ...(config.states || {}) };
  const edges = config.edges || [];
  const plots = config.plots || [];

  const paths = config.paths || [];

  const stateIds = Object.keys(states);
  if (stateIds.length === 0 && plots.length === 0 && paths.length === 0 && !config._drawOrder) {
    return { nodes: {}, edges: [], labels: [], plots: [] };
  }

  // Pre-resolve plot-based positions: nodes with at: { plot, point }
  if (plots.length > 0) {
    const quickPlotPoints = [];
    for (const plotDef of plots) {
      const result = computePlot(plotDef.expr ?? null, {
        domain: plotDef.domain,
        samples: plotDef.samples,
        samplesAt: plotDef.samplesAt,
        variable: plotDef.variable,
        yExpr: plotDef.yExpr,
        yRange: plotDef.yRange,
        coordinates: plotDef.coordinates,
        handler: plotDef.handler ?? 'lineto',
      });
      const sx = (plotDef.scaleX ?? 1) * globalScaleX;
      const sy = (plotDef.scaleY ?? 1) * globalScaleY;
      const ox = (plotDef.offsetX ?? 0) * globalScaleX + globalOriginX;
      const oy = (plotDef.offsetY ?? 0) * globalScaleY + globalOriginY;
      quickPlotPoints.push(
        result.points
          .filter(p => !p.undefined && p.y !== undefined)
          .map(p => ({ x: p.x * sx + ox, y: -p.y * sy + oy }))
      );
    }

    for (const id of stateIds) {
      const at = states[id].at;
      if (at && typeof at === 'object' && 'plot' in at && 'point' in at) {
        const pts = quickPlotPoints[at.plot];
        if (pts && pts[at.point] != null) {
          const pos = { ...pts[at.point] };
          // Directional offsets: above/below shift y, left/right shift x
          if (at.above) pos.y -= at.above;
          if (at.below) pos.y += at.below;
          if (at.left) pos.x -= at.left;
          if (at.right) pos.x += at.right;
          states[id] = { ...states[id], position: pos };
        }
      }
    }
  }

  // ── PHASE 2: RESOLVE POSITIONS ──────────────────────────────────────
  // Topological sort + direction table → absolute { x, y } for every node.

  const resolvedStates = resolvePositions({
    states,
    nodeDistance: config.nodeDistance,
    onGrid: config.onGrid,
  });

  // ── PHASE 2.5: APPLY TRANSFORMS ────────────────────────────────────
  // Apply global and per-group coordinate transforms to resolved positions.
  // This is a coordinate transform (TikZ-preferred): positions are remapped,
  // not wrapped in SVG transform attributes.

  if (config.transform || config.groups) {
    for (const id of stateIds) {
      const pos = resolvedStates[id].position;
      let transformed = { x: pos.x, y: pos.y };

      // Apply group transforms (in declaration order)
      if (config.groups) {
        for (const group of config.groups) {
          if (!group.transform) continue;
          if (!group.nodes || !Array.isArray(group.nodes)) continue;
          if (!group.nodes.includes(id)) continue;
          transformed = group.transform.apply(transformed);
        }
      }

      // Apply global transform last (so it wraps group transforms)
      if (config.transform) {
        transformed = config.transform.apply(transformed);
      }

      resolvedStates[id].position = transformed;
    }
  }

  // ── PHASE 2.6: APPLY GLOBAL SCALE ────────────────────────────────
  // TikZ [scale=N] equivalent — scale all node positions.
  if (globalScaleX !== 1 || globalScaleY !== 1 || globalOriginX !== 0 || globalOriginY !== 0) {
    for (const id of stateIds) {
      if (!resolvedStates[id]) continue;
      const pos = resolvedStates[id].position;
      resolvedStates[id].position = {
        x: pos.x * globalScaleX + globalOriginX,
        y: pos.y * globalScaleY + globalOriginY,
      };
    }
  }

  // ── PHASE 3: COMPUTE NODE GEOMETRY ──────────────────────────────────
  // Create shape instances, cache their saved geometry and anchors.

  const nodeRegistry = {};   // id → { center, shape, geom, style }

  for (const id of stateIds) {
    const style = resolveNodeStyle(id, config);
    const shapeName = style.shape || 'circle';
    const shape = getShape(shapeName);
    const center = resolvedStates[id].position;

    // Build the config object expected by each shape's savedGeometry()
    // outerSep: TikZ default is 0.5 × linewidth (pgfmoduleshapes.code.tex line 891)
    const outerSep = style.outerSep ?? 0.5 * (style.strokeWidth ?? DEFAULTS.nodeStrokeWidth);

    // Spread all style properties so any shape can pick what it needs.
    const geomConfig = { ...style, center, outerSep };

    // Compute text dimensions for auto-sizing / overflow prevention
    const label = states[id].label ?? id;
    const fontSize = style.fontSize ?? DEFAULTS.fontSize;
    let textHalfW, textHalfH;

    if (Array.isArray(label)) {
      // Multipart: width = widest part, height = sum of part heights
      const parts = label.length;
      let maxW = 0;
      let totalH = 0;
      for (const partLabel of label) {
        const dim = estimateTextDimensions(String(partLabel), fontSize, style.textWidth ?? 0);
        if (dim.width > maxW) maxW = dim.width;
        totalH += dim.height;
      }
      textHalfW = maxW / 2;
      textHalfH = totalH / 2;
    } else {
      const textDim = estimateTextDimensions(
        String(label),
        fontSize,
        style.textWidth ?? 0
      );
      textHalfW = textDim.width / 2;
      textHalfH = textDim.height / 2;
    }

    // Check if user explicitly set any dimension
    const nodeProps = states[id] || {};
    const stateStyleProps = config.stateStyle || {};
    const hasExplicitSize = nodeProps.halfWidth != null || nodeProps.halfHeight != null
      || nodeProps.rx != null || nodeProps.ry != null || nodeProps.radius != null
      || stateStyleProps.halfWidth != null || stateStyleProps.halfHeight != null
      || stateStyleProps.rx != null || stateStyleProps.ry != null || stateStyleProps.radius != null;

    // Set base dimensions: explicit or text-based
    switch (shapeName) {
      case 'rectangle':
      case 'rectangle split':
      case 'rectangle callout':
      case 'kite':
      case 'isosceles triangle':
      case 'trapezium':
      case 'parallelogram':
      case 'document':
        geomConfig.halfWidth = hasExplicitSize
          ? Math.max(style.halfWidth ?? style.radius ?? DEFAULTS.nodeRadius, textHalfW)
          : textHalfW;
        geomConfig.halfHeight = hasExplicitSize
          ? Math.max(style.halfHeight ?? style.radius ?? DEFAULTS.nodeRadius, textHalfH)
          : textHalfH;
        break;
      case 'diamond':
        // Diamond applies aspect-ratio transform and minimumWidth internally.
        // Pass text dims via rx/ry; pipeline adds innerSep, shape handles the rest.
        geomConfig.rx = hasExplicitSize
          ? Math.max(style.rx ?? style.halfWidth ?? style.radius ?? DEFAULTS.nodeRadius, textHalfW)
          : textHalfW;
        geomConfig.ry = hasExplicitSize
          ? Math.max(style.ry ?? style.halfHeight ?? style.radius ?? DEFAULTS.nodeRadius, textHalfH)
          : textHalfH;
        break;
      case 'ellipse':
      case 'ellipse split':
      case 'ellipse callout':
        geomConfig.rx = hasExplicitSize
          ? Math.max(style.rx ?? style.radius ?? DEFAULTS.nodeRadius, textHalfW)
          : textHalfW;
        geomConfig.ry = hasExplicitSize
          ? Math.max(style.ry ?? style.radius ?? DEFAULTS.nodeRadius, textHalfH)
          : textHalfH;
        break;
      case 'cloud':
      case 'cloud callout':
        // Cloud's savedGeometry handles the √2 scaling and inner/outer ellipse
        // computation internally — we just pass text half-dimensions.
        geomConfig.rx = hasExplicitSize
          ? Math.max(style.rx ?? style.radius ?? DEFAULTS.nodeRadius, textHalfW)
          : textHalfW;
        geomConfig.ry = hasExplicitSize
          ? Math.max(style.ry ?? style.radius ?? DEFAULTS.nodeRadius, textHalfH)
          : textHalfH;
        break;
      case 'circle':
      case 'circle split':
      case 'semicircle':
      case 'regular polygon':
      case 'circular sector':
      default: {
        const textR = Math.max(textHalfW, textHalfH);
        geomConfig.radius = hasExplicitSize
          ? Math.max(style.radius ?? DEFAULTS.nodeRadius, textR)
          : textR;
        break;
      }
    }

    // Apply minimum dimensions and innerSep.
    // TikZ: innerSep is padding between text and border. Explicit dimensions
    // (radius, halfWidth, etc.) act as a floor — innerSep only grows the node
    // if text + innerSep exceeds the explicit size.
    const innerSep = style.innerSep ?? DEFAULTS.innerSep;
    const minHalfW = (style.minimumWidth ?? 0) / 2;
    const minHalfH = (style.minimumHeight ?? 0) / 2;

    if (shapeName === 'cloud' || shapeName === 'cloud callout' || shapeName === 'diamond') {
      // These shapes apply an internal geometric transform (√2 scaling, aspect
      // ratio, cross-coupling) between innerSep and minimumWidth application.
      // Pipeline only adds innerSep; shape handles minimumWidth at the correct level.
      geomConfig.rx = Math.max(geomConfig.rx, textHalfW + innerSep);
      geomConfig.ry = Math.max(geomConfig.ry, textHalfH + innerSep);
    } else if (geomConfig.halfWidth != null) {
      geomConfig.halfWidth = Math.max(geomConfig.halfWidth, textHalfW + innerSep, minHalfW);
      geomConfig.halfHeight = Math.max(geomConfig.halfHeight, textHalfH + innerSep, minHalfH);
    } else if (geomConfig.rx != null) {
      geomConfig.rx = Math.max(geomConfig.rx, textHalfW + innerSep, minHalfW);
      geomConfig.ry = Math.max(geomConfig.ry, textHalfH + innerSep, minHalfH);
    } else if (geomConfig.radius != null) {
      const textR = Math.max(textHalfW, textHalfH);
      const minR = Math.max(minHalfW, minHalfH);
      geomConfig.radius = Math.max(geomConfig.radius, textR + innerSep, minR);
    }

    // Resolve callout pointer for callout shapes
    if (shapeName.endsWith('callout') && style.calloutPointer) {
      let ptr = style.calloutPointer;
      // If pointer is a node reference string, resolve to its position
      if (typeof ptr === 'string' && resolvedStates[ptr]) {
        ptr = resolvedStates[ptr].position;
      }
      // Store as offset from center (for emitter re-call compatibility)
      if (ptr && ptr.x != null && ptr.y != null) {
        geomConfig.calloutPointerOffset = { x: ptr.x - center.x, y: ptr.y - center.y };
      }
    }

    const geom = shape.savedGeometry(geomConfig);

    nodeRegistry[id] = { center, shape, geom, style };
  }

  // ── PHASE 3.5: APPLY xshift, yshift, AND anchor ────────────────────
  for (const id of stateIds) {
    const entry = nodeRegistry[id];
    const style = entry.style;
    let { x, y } = entry.center;

    // anchor: shift center so named anchor lands at original position
    if (style.anchor) {
      try {
        const anchorPt = entry.shape.anchor(style.anchor, {
          ...entry.geom,
          center: { x: 0, y: 0 },
        });
        x -= anchorPt.x;
        y -= anchorPt.y;
      } catch {
        // Unknown anchor — ignore
      }
    }

    // xshift/yshift
    x += (style.xshift ?? 0);
    y += (style.yshift ?? 0);

    if (x !== entry.center.x || y !== entry.center.y) {
      entry.center = { x, y };
      entry.geom = entry.shape.savedGeometry({
        ...entry.geom,
        center: { x, y },
        outerSep: entry.geom.outerSep,
      });
    }
  }

  // ── PHASE 4: COMPUTE EDGE GEOMETRY ──────────────────────────────────
  // Paths, control points, and label positions for every edge.

  // Resolve edge styles once for use in both geometry and emission phases
  const resolvedEdgeStyles = [];
  const arrowDefsMap = new Map();

  const resolvedArrowDefs = [];  // per-edge arrow def (or null)

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
    resolvedArrowDefs.push(arrowDef);
  }

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

    // Compute total path shortening: auto (from arrow tip) + user shorten
    // TikZ: total = (tipEnd - lineEnd) + user_shorten
    // (pgfcorearrows.code.tex lines 788-820)
    const arrowDef = resolvedArrowDefs[i];
    const autoShortenEnd = arrowDef ? (arrowDef.tipEnd - arrowDef.lineEnd) : 0;
    const userShortenEnd = edge.shortenEnd ?? edgeStyle.shortenEnd ?? 0;
    const userShortenStart = edge.shortenStart ?? edgeStyle.shortenStart ?? 0;

    const edgeConfig = {
      bend: edge.bend ?? edgeStyle.bend,
      loop: edge.loop ?? edgeStyle.loop,
      out: edge.out,
      in: edge.in,
      looseness: edge.looseness,
      shortenStart: userShortenStart,
      shortenEnd: autoShortenEnd + userShortenEnd,
    };

    const geom = computeEdgePath(sourceNode, targetNode, edgeConfig);
    edgeGeometries.push(geom);

    if (edge.label != null) {
      const labelNode = computeLabelNode(geom, String(edge.label), {
        pos: edge.labelPos ?? edgeStyle.labelPos,
        side: edge.labelSide ?? edgeStyle.labelSide,
        distance: edge.labelDistance ?? edgeStyle.labelDistance,
        innerSep: edge.innerSep ?? edgeStyle.innerSep,
        fontSize: edgeStyle.fontSize ?? DEFAULTS.fontSize,
        sloped: edge.sloped,
      });
      edgeLabelPositions.push(labelNode);
    } else {
      edgeLabelPositions.push(null);
    }
  }

  // ── PHASE 4.5: PROCESS PLOTS ──────────────────────────────────────
  // Evaluate plot expressions, apply handlers, transform to SVG coords.

  const plotModels = [];

  for (let i = 0; i < plots.length; i++) {
    const plotDef = plots[i];
    const style = resolvePlotStyle(i, config);

    const result = computePlot(plotDef.expr ?? null, {
      domain: plotDef.domain,
      samples: plotDef.samples,
      samplesAt: plotDef.samplesAt,
      variable: plotDef.variable,
      yExpr: plotDef.yExpr,
      yRange: plotDef.yRange,
      coordinates: plotDef.coordinates,
      handler: style.handler,
      tension: style.tension,
      barWidth: style.barWidth ?? plotDef.barWidth,
      barShift: style.barShift ?? plotDef.barShift,
      baseline: style.baseline ?? plotDef.baseline,
      mark: style.mark,
      markSize: style.markSize,
      markRepeat: style.markRepeat,
      markPhase: style.markPhase,
      markIndices: style.markIndices,
    });

    const sx = (plotDef.scaleX ?? 1) * globalScaleX;
    const sy = (plotDef.scaleY ?? 1) * globalScaleY;
    const ox = (plotDef.offsetX ?? 0) * globalScaleX + globalOriginX;
    const oy = (plotDef.offsetY ?? 0) * globalScaleY + globalOriginY;

    const transformedPath = transformPlotPath(result.path, sx, sy, ox, oy);

    let svgMarks = null;
    if (result.marks) {
      svgMarks = result.marks.map(pt => ({
        x: pt.x * sx + ox,
        y: -pt.y * sy + oy,
      }));
    }

    plotModels.push({
      path: transformedPath,
      style,
      marks: svgMarks,
      markPath: result.markPath ? result.markPath.toSVGPath() : null,
      markFillMode: style.mark ? getMarkFillMode(style.mark) : 'stroke',
    });
  }

  // ── PHASE 4.6: PROCESS FREE-FORM PATHS (\draw) ───────────────────
  // Build path geometry, resolve arrows, compute inline label positions.

  const drawPathModels = [];

  for (let i = 0; i < paths.length; i++) {
    const pathDef = paths[i];
    const style = resolvePathStyle(i, config);

    // Apply global scale to path points (TikZ scale= equivalent)
    const rawPoints = pathDef.points || [];
    const scaledPoints = (globalScaleX === 1 && globalScaleY === 1 && globalOriginX === 0 && globalOriginY === 0)
      ? rawPoints
      : rawPoints.map(p => ({
          x: p.x * globalScaleX + globalOriginX,
          y: p.y * globalScaleY + globalOriginY,
        }));

    const geom = buildPathGeometry(scaledPoints, {
      cycle: pathDef.cycle ?? style.cycle,
    });

    let arrowStartId = null;
    let arrowEndId = null;

    if (style.arrowEnd) {
      const def = getArrowDef({
        type: style.arrowEnd,
        size: style.arrowSize ?? DEFAULTS.arrowSize,
        color: style.stroke ?? DEFAULTS.pathColor,
      });
      if (def) {
        if (!arrowDefsMap.has(def.id)) arrowDefsMap.set(def.id, def);
        arrowEndId = def.id;
      }
    }

    if (style.arrowStart) {
      const def = getArrowDef({
        type: style.arrowStart,
        size: style.arrowSize ?? DEFAULTS.arrowSize,
        color: style.stroke ?? DEFAULTS.pathColor,
        id: `arrow-start-${style.arrowStart}-${style.arrowSize ?? DEFAULTS.arrowSize}-${(style.stroke ?? DEFAULTS.pathColor).replace('#', '')}`,
      });
      if (def) {
        // SVG marker-start needs auto-start-reverse to point backward
        def.orient = 'auto-start-reverse';
        if (!arrowDefsMap.has(def.id)) arrowDefsMap.set(def.id, def);
        arrowStartId = def.id;
      }
    }

    const labelNodes = [];
    if (pathDef.nodes && geom.segments.length > 0) {
      for (const nodeDef of pathDef.nodes) {
        const t = nodeDef.at ?? 0.5;
        const pos = computePathLabelPosition(geom.segments, geom.totalLength, t);
        labelNodes.push({
          x: pos.x,
          y: pos.y,
          label: nodeDef.label,
          anchor: nodeDef.anchor ?? 'right',
          fontSize: nodeDef.fontSize ?? style.fontSize ?? DEFAULTS.fontSize,
          fontFamily: nodeDef.fontFamily ?? style.fontFamily ?? DEFAULTS.fontFamily,
          color: nodeDef.color ?? style.labelColor,
        });
      }
    }

    drawPathModels.push({
      d: geom.d,
      style,
      arrowStartId,
      arrowEndId,
      labelNodes,
    });
  }

  // Rebuild arrowDefs after all phases that may add markers (edges + paths)
  const arrowDefs = Array.from(arrowDefsMap.values());

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
    plots: plotModels,
    drawPaths: drawPathModels,
    drawOrder: config._drawOrder,
    layers: config._layers,
    seed: config.seed,
    padding: config.padding,
    globalScaleX,
    globalScaleY,
    transformCanvas,
    background: config.background,
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
      labelNode: edgeLabelPositions[i],
      style: resolvedEdgeStyles[i],
    });
  }

  const refs = emitSVG(svgEl, model);

  // Schedule a re-render after fonts load to fix KaTeX measurement
  registerPendingReRender(svgEl, config, render);

  return refs;
}

export { renderAutomaton } from './automata/automata.js';
