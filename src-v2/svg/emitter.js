/**
 * SVG emitter for the TikZ-SVG library.
 *
 * Takes a fully resolved model (nodes, edges, arrow/shadow defs) and
 * constructs SVG DOM elements.  All elements are created via
 * document.createElementNS — no innerHTML.
 */

import { DEFAULTS, DIRECTIONS } from '../core/constants.js';
import { Transform } from '../core/transform.js';
import { morphPath, shapeToSVGPath } from '../decorations/index.js';
import { SeededRandom } from '../core/random.js';
import { createLabelContent, createMathForeignObject } from '../core/katex-renderer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Module-level counter for unique clip/def IDs across multiple render() calls
let _nextClipId = 0;

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
        } else if (tag === 'path') {
          // Generic shape rendered as <path> — parse d-attribute coordinates
          const d = child.getAttribute('d');
          if (d) {
            const nums = d.match(/-?[\d.]+/g);
            if (nums && nums.length >= 2) {
              for (let j = 0; j < nums.length - 1; j += 2) {
                expandBBox(bbox, cx + parseFloat(nums[j]), cy + parseFloat(nums[j + 1]));
              }
            }
          }
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
    const pathAttrs = { d: def.path };
    // Support both legacy (color only) and new (pathFill/pathStroke) formats
    if (def.pathFill != null) {
      pathAttrs.fill = def.pathFill;
      if (def.pathStroke && def.pathStroke !== 'none') {
        pathAttrs.stroke = def.pathStroke;
        if (def.pathStrokeWidth) pathAttrs['stroke-width'] = def.pathStrokeWidth;
      } else {
        pathAttrs.stroke = 'none';
      }
    } else {
      pathAttrs.fill = def.color;
    }
    const path = createSVGElement('path', pathAttrs);
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
function emitEdgePath(edge, prng) {
  let { path, style } = edge;

  // Apply decoration if configured
  if (style.decoration) {
    path = morphPath(path, { ...style.decoration, prng });
  }

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
// Edge label node emission
// ────────────────────────────────────────────

/**
 * Emit a <g> for an edge label node containing <rect> + <text>.
 * @param {Object} edge
 * @returns {SVGGElement|null}
 */
function emitLabelNode(edge) {
  const { label, labelNode, style } = edge;
  if (!label || !labelNode) return null;

  const { center, geom, angle } = labelNode;

  // Build transform
  let transformStr;
  if (angle != null) {
    const t = new Transform();
    t.translate(center.x, center.y);
    t.rotate(angle);
    transformStr = t.toSVG();
  } else {
    transformStr = `translate(${center.x}, ${center.y})`;
  }

  const g = createSVGElement('g', {
    class: 'label-node',
    transform: transformStr,
  });

  // Background rect (invisible by default)
  const rect = createSVGElement('rect', {
    x: -geom.halfWidth,
    y: -geom.halfHeight,
    width: geom.halfWidth * 2,
    height: geom.halfHeight * 2,
    fill: 'none',
    stroke: 'none',
  });
  g.appendChild(rect);

  // Text or math centered in rect
  const edgeFontSize = style.fontSize ?? DEFAULTS.fontSize;
  const edgeLabelContent = createLabelContent(String(label), {
    fontSize: edgeFontSize,
    fontFamily: style.fontFamily ?? DEFAULTS.fontFamily,
    color: style.labelColor ?? '#000000',
  });

  if (edgeLabelContent.type === 'math') {
    g.appendChild(createMathForeignObject(edgeLabelContent.html, edgeLabelContent.width, edgeLabelContent.height, {
      fontSize: edgeFontSize,
      color: style.labelColor ?? '#000000',
    }));
  } else {
    const textEl = createSVGElement('text', {
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': edgeFontSize,
      'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
      fill: style.labelColor ?? '#000000',
    });
    textEl.textContent = edgeLabelContent.content;
    g.appendChild(textEl);
  }

  return g;
}

// ────────────────────────────────────────────
// Plot emission
// ────────────────────────────────────────────

/**
 * Emit SVG elements for a single plot (path + marks).
 * @param {Object} plotModel - { path, style, marks, markPath, markFillMode }
 * @param {SVGGElement} layer - target layer to append to
 */
function emitPlot(plotModel, layer) {
  const { path, style, marks, markPath, markFillMode } = plotModel;

  // Plot path
  if (path) {
    const attrs = {
      d: path,
      fill: style.fill ?? 'none',
      stroke: style.stroke ?? '#2563eb',
      'stroke-width': style.strokeWidth ?? 2,
      class: 'plot-path',
      'stroke-linejoin': 'round',
    };
    if (style.dashed) {
      attrs['stroke-dasharray'] = typeof style.dashed === 'string' ? style.dashed : '6 4';
    }
    if (style.opacity != null && style.opacity < 1) {
      attrs.opacity = style.opacity;
    }
    layer.appendChild(createSVGElement('path', attrs));
  }

  // Plot marks
  if (marks && markPath) {
    const markStroke = style.markStroke ?? style.stroke ?? '#2563eb';
    const markFill = markFillMode === 'filled'
      ? (style.markFill ?? style.stroke ?? '#2563eb')
      : 'none';

    for (const pt of marks) {
      const g = createSVGElement('g', {
        class: 'plot-mark',
        transform: `translate(${pt.x},${pt.y})`,
      });
      g.appendChild(createSVGElement('path', {
        d: markPath,
        stroke: markStroke,
        'stroke-width': 1.5,
        fill: markFill,
      }));
      layer.appendChild(g);
    }
  }
}

// ────────────────────────────────────────────
// Free-form path (\draw) emission
// ────────────────────────────────────────────

/** Anchor offsets in px for inline path labels. */
const ANCHOR_OFFSETS = {
  right:  { dx: 5,  dy: 0,  textAnchor: 'start',  baseline: 'central' },
  left:   { dx: -5, dy: 0,  textAnchor: 'end',    baseline: 'central' },
  above:  { dx: 0,  dy: -5, textAnchor: 'middle', baseline: 'auto' },
  below:  { dx: 0,  dy: 5,  textAnchor: 'middle', baseline: 'hanging' },
};

/**
 * Emit SVG elements for a single free-form path (\draw).
 * @param {Object} pathModel - { d, style, arrowStartId, arrowEndId, labelNodes }
 * @param {SVGGElement} edgeLayer
 * @param {SVGGElement} labelLayer
 */
function emitDrawPath(pathModel, edgeLayer, labelLayer) {
  const { d, style, arrowStartId, arrowEndId, labelNodes } = pathModel;

  if (!d) return;

  const attrs = {
    d,
    fill: style.fill ?? 'none',
    stroke: style.stroke ?? '#000',
    'stroke-width': style.strokeWidth ?? 1.5,
    class: 'draw-path',
  };

  if (style.dotted) {
    attrs['stroke-dasharray'] = '2 3';
  } else if (style.dashed) {
    attrs['stroke-dasharray'] = typeof style.dashed === 'string' ? style.dashed : '6 4';
  }

  if (style.opacity != null && style.opacity < 1) {
    attrs.opacity = style.opacity;
  }

  if (arrowStartId) {
    attrs['marker-start'] = `url(#${arrowStartId})`;
  }
  if (arrowEndId) {
    attrs['marker-end'] = `url(#${arrowEndId})`;
  }

  edgeLayer.appendChild(createSVGElement('path', attrs));

  if (labelNodes) {
    for (const ln of labelNodes) {
      const anchorInfo = ANCHOR_OFFSETS[ln.anchor] ?? ANCHOR_OFFSETS.right;
      const lnFontSize = ln.fontSize ?? DEFAULTS.fontSize;
      const lnLabelContent = createLabelContent(String(ln.label), {
        fontSize: lnFontSize,
        fontFamily: ln.fontFamily ?? DEFAULTS.fontFamily,
        color: ln.color ?? '#000',
      });

      if (lnLabelContent.type === 'math') {
        const mathG = createSVGElement('g', {
          class: 'draw-label',
          transform: `translate(${ln.x + anchorInfo.dx},${ln.y + anchorInfo.dy})`,
        });
        mathG.appendChild(createMathForeignObject(lnLabelContent.html, lnLabelContent.width, lnLabelContent.height, {
          fontSize: lnFontSize,
          color: ln.color ?? '#000',
        }));
        labelLayer.appendChild(mathG);
      } else {
        const text = createSVGElement('text', {
          x: ln.x + anchorInfo.dx,
          y: ln.y + anchorInfo.dy,
          'text-anchor': anchorInfo.textAnchor,
          'dominant-baseline': anchorInfo.baseline,
          'font-size': lnFontSize,
          'font-family': ln.fontFamily ?? DEFAULTS.fontFamily,
          fill: ln.color ?? '#000',
          class: 'draw-label',
        });
        text.textContent = lnLabelContent.content;
        labelLayer.appendChild(text);
      }
    }
  }
}

// ────────────────────────────────────────────
// Node emission
// ────────────────────────────────────────────

/**
 * Break a label string into lines for SVG rendering.
 * Handles explicit '\\\\' breaks and word-wrap at textWidth.
 * @param {string} label
 * @param {number} textWidth - max width in px (0 = no wrapping)
 * @param {number} fontSize
 * @returns {string[]} lines
 */
function wrapText(label, textWidth, fontSize) {
  const explicitLines = String(label).split('\\\\');
  if (!textWidth || textWidth <= 0) return explicitLines;

  const charWidth = fontSize * 0.6;
  const maxChars = Math.max(1, Math.floor(textWidth / charWidth));

  const result = [];
  for (const line of explicitLines) {
    const trimmed = line.trim();
    if (trimmed.length <= maxChars) {
      result.push(trimmed);
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      if (current.length === 0) {
        current = word;
      } else if ((current + ' ' + word).length <= maxChars) {
        current += ' ' + word;
      } else {
        result.push(current);
        current = word;
      }
    }
    if (current.length > 0) result.push(current);
  }
  return result;
}

/**
 * Emit a <g> for a single node, containing its shape element(s) and label.
 * Supports multipart shapes: per-part fills (partFills), per-part labels
 * (label as array), and part alignment (partAlign).
 * @param {string} id
 * @param {Object} node - { center, geom, style, label, shape }
 * @returns {SVGGElement}
 */
function emitNode(id, node, prng) {
  const { center, geom, style, label, shape } = node;

  let transformStr = `translate(${center.x}, ${center.y})`;
  if (style.rotate) {
    transformStr += ` rotate(${style.rotate})`;
  }
  if (style.nodeScale && style.nodeScale !== 1) {
    transformStr += ` scale(${style.nodeScale})`;
  }

  const g = createSVGElement('g', {
    class: 'node',
    id: `node-${id}`,
    transform: transformStr,
  });

  if (style.className) {
    g.classList.add(style.className);
  }

  const isMultipart = shape && shape.partRegions && style.partFills;
  // Compute localGeom and regions once for both fills and labels
  const localGeom = isMultipart ? { ...geom, center: { x: 0, y: 0 } } : null;
  const regions = isMultipart ? shape.partRegions(localGeom) : null;

  if (isMultipart) {
    const os = localGeom.outerSep ?? 0;

    // Build clipPath using native SVG elements — more robust than path-based clips
    const clipId = `clip-${id}-${_nextClipId++}`;
    const localDefs = createSVGElement('defs');
    const clipPathEl = createSVGElement('clipPath', { id: clipId });

    // Check ellipse (rx/ry) BEFORE circle (radius) — ellipse is more specific,
    // and style cascade may leak a `radius` property into the geom.
    if (localGeom.rx != null && localGeom.ry != null) {
      clipPathEl.appendChild(createSVGElement('ellipse', {
        cx: 0, cy: 0, rx: localGeom.rx - os, ry: localGeom.ry - os,
      }));
    } else if (localGeom.halfWidth != null && localGeom.halfHeight != null) {
      const hw = localGeom.halfWidth - os;
      const hh = localGeom.halfHeight - os;
      clipPathEl.appendChild(createSVGElement('rect', {
        x: -hw, y: -hh, width: hw * 2, height: hh * 2,
      }));
    } else if (localGeom.radius != null) {
      clipPathEl.appendChild(createSVGElement('circle', {
        cx: 0, cy: 0, r: localGeom.radius - os,
      }));
    }

    localDefs.appendChild(clipPathEl);
    g.appendChild(localDefs);

    // Draw filled rectangles for each part, clipped to the shape
    const fillGroup = createSVGElement('g', { 'clip-path': `url(#${clipId})` });
    for (let i = 0; i < regions.length; i++) {
      const fillColor = style.partFills[i] ?? style.fill ?? DEFAULTS.nodeFill;
      const r = regions[i].clipRect;
      fillGroup.appendChild(createSVGElement('rect', {
        x: r.x, y: r.y, width: r.width, height: r.height,
        fill: fillColor, stroke: 'none',
      }));
    }
    g.appendChild(fillGroup);

    // Draw outline + split lines (stroke only, no fill) using the same localGeom
    const stroke = style.stroke ?? DEFAULTS.nodeStroke;
    const strokeWidth = style.strokeWidth ?? DEFAULTS.nodeStrokeWidth;
    const outlineEl = createSVGElement('path', {
      d: shape.backgroundPath(localGeom),
      fill: 'none', stroke, 'stroke-width': strokeWidth,
    });
    if (style.shadow && style._shadowFilterId) {
      outlineEl.setAttribute('filter', `url(#${style._shadowFilterId})`);
    }
    g.appendChild(outlineEl);
  } else {
    // ── Standard single-fill rendering ──
    const shapeEl = createShapeElement(geom, style, { shape, prng });
    if (style.shadow && style._shadowFilterId) {
      shapeEl.setAttribute('filter', `url(#${style._shadowFilterId})`);
    }
    g.appendChild(shapeEl);
  }

  // Accepting (double border) — inner shape with inset
  if (style.accepting) {
    const inset = style.acceptingInset ?? DEFAULTS.acceptingInset;
    const innerEl = createShapeElement(geom, style, { inset, fillOverride: 'none', shape, prng });
    g.appendChild(innerEl);
  }

  if (Array.isArray(label) && regions) {
    // Multipart labels: one <text> per part, aligned to the shape boundary
    const partAlign = style.partAlign ?? 'center';
    const innerPad = 4;

    for (let i = 0; i < label.length && i < regions.length; i++) {
      if (label[i] == null || label[i] === '') continue;
      const lc = regions[i].labelCenter;

      let textAnchor, tx;
      if (partAlign === 'left') {
        textAnchor = 'start';
        tx = regions[i].leftEdge + innerPad;
      } else if (partAlign === 'right') {
        textAnchor = 'end';
        tx = regions[i].rightEdge - innerPad;
      } else {
        textAnchor = 'middle';
        tx = lc.x;
      }

      const text = createSVGElement('text', {
        x: tx, y: lc.y,
        'text-anchor': textAnchor,
        'dominant-baseline': 'central',
        'font-size': style.fontSize ?? DEFAULTS.fontSize,
        'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
        fill: style.labelColor ?? '#000000',
      });
      text.textContent = String(label[i]);
      g.appendChild(text);
    }
  } else if (label != null && label !== '') {
    const fontSize = style.fontSize ?? DEFAULTS.fontSize;
    const textWidth = style.textWidth ?? 0;
    const labelStr = String(label);
    const nodeLabelContent = createLabelContent(labelStr, {
      fontSize,
      fontFamily: style.fontFamily ?? DEFAULTS.fontFamily,
      color: style.labelColor ?? '#000000',
    });

    if (nodeLabelContent.type === 'math') {
      g.appendChild(createMathForeignObject(nodeLabelContent.html, nodeLabelContent.width, nodeLabelContent.height, {
        fontSize,
        color: style.labelColor ?? '#000000',
      }));
    } else {
      const plainText = nodeLabelContent.content;
      const lines = wrapText(plainText, textWidth, fontSize);

      if (lines.length > 1 || textWidth > 0) {
        const align = style.align ?? 'center';
        const textAnchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
        const xOffset = align === 'left' ? -(textWidth / 2) : align === 'right' ? (textWidth / 2) : 0;

        const text = createSVGElement('text', {
          'text-anchor': textAnchor,
          'font-size': fontSize,
          'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
          fill: style.labelColor ?? '#000000',
        });

        const lineHeight = fontSize * 1.3;
        const totalHeight = lines.length * lineHeight;
        const startY = -(totalHeight / 2) + lineHeight / 2;

        for (let i = 0; i < lines.length; i++) {
          const tspan = createSVGElement('tspan', {
            x: xOffset,
            dy: i === 0 ? startY : lineHeight,
          });
          tspan.textContent = lines[i];
          text.appendChild(tspan);
        }
        g.appendChild(text);
      } else {
        const text = createSVGElement('text', {
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-size': fontSize,
          'font-family': style.fontFamily ?? DEFAULTS.fontFamily,
          fill: style.labelColor ?? '#000000',
        });
        text.textContent = plainText;
        g.appendChild(text);
      }
    }
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
  const outerSep = geom.outerSep ?? 0;
  const fill = opts.fillOverride ?? style.fill ?? DEFAULTS.nodeFill;
  const stroke = style.stroke ?? DEFAULTS.nodeStroke;
  const strokeWidth = style.strokeWidth ?? DEFAULTS.nodeStrokeWidth;
  const shapeName = style.shape ?? 'circle';

  // Decoration: convert shape to path string, morph, emit as <path>
  if (style.decoration && opts.prng) {
    let pathStr = '';
    if (['circle', 'ellipse', 'rectangle'].includes(shapeName)) {
      pathStr = shapeToSVGPath(shapeName, geom, { inset });
    } else {
      const shapeImpl = opts.shape;
      if (shapeImpl && shapeImpl.backgroundPath) {
        const localGeom = shapeImpl.savedGeometry({ ...geom, center: { x: 0, y: 0 } });
        if (inset > 0) localGeom.outerSep = (localGeom.outerSep ?? 0) + inset;
        pathStr = shapeImpl.backgroundPath(localGeom);
      }
    }
    if (pathStr) {
      const decorated = morphPath(pathStr, { ...style.decoration, prng: opts.prng });
      return createSVGElement('path', {
        d: decorated, fill, stroke, 'stroke-width': strokeWidth,
      });
    }
  }

  // Drawn dimensions use visual size (subtract outerSep from anchor dimensions)
  switch (shapeName) {
    case 'rectangle': {
      const hw = Math.max(0, geom.halfWidth - outerSep - inset);
      const hh = Math.max(0, geom.halfHeight - outerSep - inset);
      return createSVGElement('rect', {
        x: -hw, y: -hh, width: hw * 2, height: hh * 2,
        fill, stroke, 'stroke-width': strokeWidth,
      });
    }

    case 'ellipse': {
      const rx = Math.max(0, geom.rx - outerSep - inset);
      const ry = Math.max(0, geom.ry - outerSep - inset);
      return createSVGElement('ellipse', {
        cx: 0, cy: 0, rx, ry, fill, stroke, 'stroke-width': strokeWidth,
      });
    }

    case 'circle': {
      const r = Math.max(0, (geom.radius ?? DEFAULTS.nodeRadius) - outerSep - inset);
      return createSVGElement('circle', {
        cx: 0, cy: 0, r, fill, stroke, 'stroke-width': strokeWidth,
      });
    }

    default: {
      // Generic fallback: use shape.backgroundPath() for any registered shape.
      // backgroundPath already subtracts outerSep internally.
      const shapeImpl = opts.shape;
      if (shapeImpl && shapeImpl.backgroundPath) {
        // backgroundPath returns absolute coordinates; we need center-relative.
        // Create a temp geom centered at origin for local path coordinates.
        const localGeom = shapeImpl.savedGeometry({
          ...geom,
          center: { x: 0, y: 0 },
        });
        // Apply inset by reducing dimensions (approximate: shrink outerSep further)
        if (inset > 0) {
          localGeom.outerSep = (localGeom.outerSep ?? 0) + inset;
        }
        const d = shapeImpl.backgroundPath(localGeom);
        return createSVGElement('path', {
          d, fill, stroke, 'stroke-width': strokeWidth,
        });
      }
      // Final fallback: circle
      const r = Math.max(0, (geom.radius ?? DEFAULTS.nodeRadius) - outerSep - inset);
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
function emitInitialArrow(node, arrowMarkerId, arrowDef) {
  const { geom, style, shape } = node;
  const initial = style.initial;
  const length = DEFAULTS.initialArrowLength;

  // Determine approach direction (vector pointing toward the node center)
  const approach = initialApproachVector(initial);
  // Reverse direction: where the arrow starts (away from node)
  const reverseApproach = { x: -approach.x, y: -approach.y };

  // Arrow tip: use shape's borderPoint for correct geometry on any shape
  const borderTip = shape.borderPoint(geom, reverseApproach);

  // Pull endpoint back by auto-shorten amount so arrow tip lands at the border
  // (refX = lineEnd means the marker extends forward by tipEnd - lineEnd)
  const autoShorten = arrowDef ? (arrowDef.tipEnd - arrowDef.lineEnd) : 0;
  const tip = {
    x: borderTip.x + reverseApproach.x * autoShorten,
    y: borderTip.y + reverseApproach.y * autoShorten,
  };

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
  for (const layer of svgEl.querySelectorAll('.edge-layer, .label-layer, .node-layer, .draw-layer, g[class^="layer-"]')) {
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
 *     edges: [{ from, to, path, style, label, labelNode, edgeGeometry }],
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
    plots = [],
    drawPaths = [],
    drawOrder,
    layers,
    seed,
  } = resolved;

  // PRNG for deterministic decoration rendering
  const prng = new SeededRandom(seed ?? 42);

  // 1. Clear existing content
  while (svgEl.firstChild) {
    svgEl.removeChild(svgEl.firstChild);
  }

  // 2. Build and append <defs>
  const defs = buildDefs(arrowDefs, shadowFilters);
  svgEl.appendChild(defs);

  // ── ORDERED RENDERING (TikZ-faithful paint order) ──────────
  if (drawOrder) {
    const refs = { nodes: {}, edges: [], labels: [], plots: [] };
    const defaultArrowDef = arrowDefs.length > 0 ? arrowDefs[0] : null;
    const defaultArrowId = defaultArrowDef ? defaultArrowDef.id : null;

    /** Emit a single draw-order item into a target group. */
    const emitItem = (item, target) => {
      switch (item.type) {
        case 'node': {
          const node = nodes[item.id];
          if (!node) break;
          const g = emitNode(item.id, node, prng);
          target.appendChild(g);
          refs.nodes[item.id] = g;
          if (node.style.initial) {
            target.appendChild(emitInitialArrow(node, defaultArrowId, defaultArrowDef));
          }
          break;
        }
        case 'edge': {
          const edge = edges[item.index];
          if (!edge) break;
          const pathEl = emitEdgePath(edge, prng);
          target.appendChild(pathEl);
          refs.edges.push(pathEl);
          const labelEl = emitLabelNode(edge);
          if (labelEl) {
            target.appendChild(labelEl);
            refs.labels.push(labelEl);
          }
          break;
        }
        case 'plot': {
          const plotModel = plots[item.index];
          if (!plotModel) break;
          emitPlot(plotModel, target);
          break;
        }
        case 'drawPath': {
          const pathModel = drawPaths[item.index];
          if (!pathModel) break;
          emitDrawPath(pathModel, target, target);
          break;
        }
      }
    };

    if (layers && layers.length > 0) {
      // ── NAMED LAYERS: per-layer <g> groups in declared order ──
      const layerGroups = {};
      for (const name of layers) {
        const g = createSVGElement('g', { class: `layer-${name}` });
        svgEl.appendChild(g);
        layerGroups[name] = g;
      }
      for (const item of drawOrder) {
        const target = layerGroups[item.layer ?? 'main'] ?? layerGroups[layers[0]];
        emitItem(item, target);
      }
    } else {
      // ── SINGLE DRAW-LAYER: declaration order, no named layers ──
      const drawLayer = createSVGElement('g', { class: 'draw-layer' });
      svgEl.appendChild(drawLayer);
      for (const item of drawOrder) {
        emitItem(item, drawLayer);
      }
    }

    const viewBox = computeViewBox(svgEl);
    svgEl.setAttribute('viewBox', viewBox);
    return refs;
  }

  // ── LAYER-BASED RENDERING (backward compat) ──────────

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
    plots: [],
  };

  // 4. Emit edges
  for (const edge of edges) {
    const pathEl = emitEdgePath(edge, prng);
    edgeLayer.appendChild(pathEl);
    refs.edges.push(pathEl);

    // 5. Emit edge label nodes
    const labelEl = emitLabelNode(edge);
    if (labelEl) {
      labelLayer.appendChild(labelEl);
      refs.labels.push(labelEl);
    }
  }

  // 5.5. Emit plots (in edge layer, behind nodes)
  for (const plotModel of plots) {
    emitPlot(plotModel, edgeLayer);
  }

  // 5.6. Emit free-form paths (\draw)
  for (const pathModel of drawPaths) {
    emitDrawPath(pathModel, edgeLayer, labelLayer);
  }

  // 6. Emit nodes
  // Find the first arrow def to reuse for initial arrows (stealth marker)
  const defaultArrowDef = arrowDefs.length > 0 ? arrowDefs[0] : null;
  const defaultArrowId = defaultArrowDef ? defaultArrowDef.id : null;

  for (const [id, node] of Object.entries(nodes)) {
    const g = emitNode(id, node, prng);
    nodeLayer.appendChild(g);
    refs.nodes[id] = g;

    // 7. Emit initial arrow if node is an initial state
    if (node.style.initial) {
      const arrowPath = emitInitialArrow(node, defaultArrowId, defaultArrowDef);
      edgeLayer.appendChild(arrowPath);
    }
  }

  // 8. Compute and set viewBox
  const viewBox = computeViewBox(svgEl);
  svgEl.setAttribute('viewBox', viewBox);

  // 9. Return refs
  return refs;
}
