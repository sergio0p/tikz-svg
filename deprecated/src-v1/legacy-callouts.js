/**
 * SVG Callouts Library
 * 
 * Ported from TikZ shapes.callouts library by Mark Wibrow
 * Provides rectangle and ellipse callout shapes for SVG graphics
 * 
 * Usage:
 *   const callout = rectangleCallout({x: 100, y: 50}, {x: 200, y: 150}, "Hello", options);
 *   svg.appendChild(callout);
 *   
 *   // With economics coordinate system
 *   const callout = rectangleCallout({Q: 80, P: 110}, {Q: 46, P: 97}, "Equilibrium", {
 *     coordSystem: { toX: Q => 20 + Q * 3.133, toY: P => 350 - P * 2.46 }
 *   });
 *   
 *   // Pointer to DOM element
 *   const callout = rectangleCallout({x: 100, y: 50}, '#my-dot', "Label");
 */

(function(global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Default styling (Solarized Light palette)
  const DEFAULTS = {
    fill: '#fdf6e3',
    stroke: '#586e75',
    strokeWidth: 2,
    pointerWidth: 14,
    pointerShorten: 0,
    cornerRadius: 4,        // rectangle only
    pointerArc: 20,         // ellipse only (degrees)
    padding: { x: 12, y: 8 },
    fontSize: 18,
    lineHeight: 1.3,        // line height multiplier for multi-line text
    fontFamily: "'Times New Roman', serif",
    fontStyle: 'italic',
    textFill: '#586e75',
    // Angle/distance mode (alternative to specifying center)
    angle: null,            // degrees: 0=right, 90=down, 180=left, -90=up
    distance: null,         // distance from target to callout center
    pointerGap: 0           // distance from target to pointer tip
  };

  /**
   * Resolve a point from various input formats
   * @param {Object|string} point - {x,y}, {Q,P}, or element selector
   * @param {Object} options - may contain coordSystem
   * @returns {{x: number, y: number}}
   */
  function resolvePoint(point, options) {
    // DOM element selector
    if (typeof point === 'string') {
      const el = document.querySelector(point);
      if (!el) throw new Error(`Element not found: ${point}`);
      
      // Get center of element's bounding box in SVG coordinates
      const bbox = el.getBBox();
      return {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2
      };
    }
    
    // Already in SVG coords
    if ('x' in point && 'y' in point) {
      return { x: point.x, y: point.y };
    }
    
    // Economics coordinates (Q, P)
    if ('Q' in point && 'P' in point) {
      const cs = options.coordSystem;
      if (!cs) throw new Error('coordSystem required for Q,P coordinates');
      return {
        x: cs.toX(point.Q),
        y: cs.toY(point.P)
      };
    }
    
    throw new Error('Invalid point format');
  }

  /**
   * Measure text dimensions (supports array of lines)
   */
  function measureText(text, options) {
    const opts = { ...DEFAULTS, ...options };
    const lines = Array.isArray(text) ? text : [text];

    // Create temporary SVG to measure
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.style.position = 'absolute';
    svg.style.visibility = 'hidden';
    document.body.appendChild(svg);

    let maxWidth = 0;
    const lineHeightPx = opts.fontSize * opts.lineHeight;

    lines.forEach(line => {
      const textEl = document.createElementNS(SVG_NS, 'text');
      textEl.setAttribute('font-size', opts.fontSize);
      textEl.setAttribute('font-family', opts.fontFamily);
      textEl.setAttribute('font-style', opts.fontStyle);
      textEl.textContent = line;
      svg.appendChild(textEl);

      const bbox = textEl.getBBox();
      maxWidth = Math.max(maxWidth, bbox.width);
    });

    document.body.removeChild(svg);

    return {
      width: maxWidth,
      height: lineHeightPx * lines.length
    };
  }

  /**
   * Calculate callout dimensions from text
   */
  function calcDimensions(text, options) {
    const opts = { ...DEFAULTS, ...options };
    
    if (opts.width && opts.height) {
      return { width: opts.width, height: opts.height };
    }
    
    const textSize = measureText(text, opts);
    return {
      width: opts.width || (textSize.width + opts.padding.x * 2),
      height: opts.height || (textSize.height + opts.padding.y * 2)
    };
  }

  /**
   * Determine which edge of a rectangle the pointer should exit from
   * @returns {'top'|'bottom'|'left'|'right'}
   */
  function getPointerEdge(center, target, halfW, halfH) {
    const dx = target.x - center.x;
    const dy = target.y - center.y;
    
    if (dx === 0 && dy === 0) return 'bottom';
    
    // Calculate angle to target
    const angle = Math.atan2(dy, dx);
    
    // Calculate corner angles
    const cornerAngle = Math.atan2(halfH, halfW);
    
    // Determine quadrant
    if (angle >= -cornerAngle && angle < cornerAngle) {
      return 'right';
    } else if (angle >= cornerAngle && angle < Math.PI - cornerAngle) {
      return 'bottom';  // SVG y-axis is inverted
    } else if (angle >= Math.PI - cornerAngle || angle < -Math.PI + cornerAngle) {
      return 'left';
    } else {
      return 'top';
    }
  }

  /**
   * Shorten pointer tip by pulling it back toward center
   */
  function shortenPointer(tip, center, amount) {
    if (amount === 0) return tip;
    
    const dx = center.x - tip.x;
    const dy = center.y - tip.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) return tip;
    
    return {
      x: tip.x + (dx / dist) * amount,
      y: tip.y + (dy / dist) * amount
    };
  }

  /**
   * Build rectangle callout path with integrated pointer
   * The pointer emerges FROM the edge, not stuck on top
   * Path traces: corner -> edge -> pointer base -> tip -> pointer base -> edge continues -> next corner...
   */
  function buildRectCalloutPath(center, target, halfW, halfH, pointerWidth, cornerRadius) {
    const r = Math.min(cornerRadius, halfW / 2, halfH / 2);
    const hw = pointerWidth / 2;
    
    // Corner positions
    const TL = { x: center.x - halfW, y: center.y - halfH };
    const TR = { x: center.x + halfW, y: center.y - halfH };
    const BR = { x: center.x + halfW, y: center.y + halfH };
    const BL = { x: center.x - halfW, y: center.y + halfH };
    
    // Determine which edge the pointer exits from
    const edge = getPointerEdge(center, target, halfW, halfH);
    
    // Calculate where on the edge the pointer attaches
    // This is the point on the edge closest to the target (clamped away from corners)
    let pointerBaseCenter;
    const margin = r + hw + 2; // Keep pointer away from corners
    
    switch (edge) {
      case 'top':
        pointerBaseCenter = {
          x: Math.max(TL.x + margin, Math.min(TR.x - margin, target.x)),
          y: TL.y
        };
        break;
      case 'bottom':
        pointerBaseCenter = {
          x: Math.max(BL.x + margin, Math.min(BR.x - margin, target.x)),
          y: BL.y
        };
        break;
      case 'left':
        pointerBaseCenter = {
          x: TL.x,
          y: Math.max(TL.y + margin, Math.min(BL.y - margin, target.y))
        };
        break;
      case 'right':
        pointerBaseCenter = {
          x: TR.x,
          y: Math.max(TR.y + margin, Math.min(BR.y - margin, target.y))
        };
        break;
    }
    
    // The two points where pointer meets the edge
    let pointerBase1, pointerBase2;
    
    if (edge === 'top' || edge === 'bottom') {
      pointerBase1 = { x: pointerBaseCenter.x - hw, y: pointerBaseCenter.y };
      pointerBase2 = { x: pointerBaseCenter.x + hw, y: pointerBaseCenter.y };
    } else {
      pointerBase1 = { x: pointerBaseCenter.x, y: pointerBaseCenter.y - hw };
      pointerBase2 = { x: pointerBaseCenter.x, y: pointerBaseCenter.y + hw };
    }
    
    // Build the path clockwise starting from top-left
    // Insert pointer when we reach the appropriate edge
    let path = '';
    
    // Helper: rounded corner as quadratic bezier
    const corner = (from, c, to) => {
      return ` L ${from.x} ${from.y} Q ${c.x} ${c.y} ${to.x} ${to.y}`;
    };
    
    // Start at top-left (after the corner radius)
    path = `M ${TL.x + r} ${TL.y}`;
    
    // Top edge (TL to TR)
    if (edge === 'top') {
      // Go to first pointer base point, then to tip, then to second base point
      path += ` L ${pointerBase1.x} ${pointerBase1.y}`;
      path += ` L ${target.x} ${target.y}`;
      path += ` L ${pointerBase2.x} ${pointerBase2.y}`;
    }
    path += ` L ${TR.x - r} ${TR.y}`;
    
    // TR corner
    path += ` Q ${TR.x} ${TR.y} ${TR.x} ${TR.y + r}`;
    
    // Right edge (TR to BR)
    if (edge === 'right') {
      path += ` L ${pointerBase1.x} ${pointerBase1.y}`;
      path += ` L ${target.x} ${target.y}`;
      path += ` L ${pointerBase2.x} ${pointerBase2.y}`;
    }
    path += ` L ${BR.x} ${BR.y - r}`;
    
    // BR corner
    path += ` Q ${BR.x} ${BR.y} ${BR.x - r} ${BR.y}`;
    
    // Bottom edge (BR to BL) - note: going right to left
    if (edge === 'bottom') {
      path += ` L ${pointerBase2.x} ${pointerBase2.y}`;
      path += ` L ${target.x} ${target.y}`;
      path += ` L ${pointerBase1.x} ${pointerBase1.y}`;
    }
    path += ` L ${BL.x + r} ${BL.y}`;
    
    // BL corner
    path += ` Q ${BL.x} ${BL.y} ${BL.x} ${BL.y - r}`;
    
    // Left edge (BL to TL) - note: going bottom to top
    if (edge === 'left') {
      path += ` L ${pointerBase2.x} ${pointerBase2.y}`;
      path += ` L ${target.x} ${target.y}`;
      path += ` L ${pointerBase1.x} ${pointerBase1.y}`;
    }
    path += ` L ${TL.x} ${TL.y + r}`;
    
    // TL corner (back to start)
    path += ` Q ${TL.x} ${TL.y} ${TL.x + r} ${TL.y}`;
    
    path += ' Z';
    return path;
  }

  /**
   * Get point on ellipse at given angle
   */
  function ellipsePoint(cx, cy, rx, ry, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return {
      x: cx + rx * Math.cos(rad),
      y: cy + ry * Math.sin(rad)
    };
  }

  /**
   * Calculate angle from center to point
   */
  function angleToPoint(cx, cy, px, py) {
    return Math.atan2(py - cy, px - cx) * 180 / Math.PI;
  }

  /**
   * Generate ellipse callout SVG path
   */
  function buildEllipseCalloutPath(center, target, rx, ry, pointerArc) {
    // Angle from center to target
    const targetAngle = angleToPoint(center.x, center.y, target.x, target.y);
    
    // Pointer base spans pointerArc degrees centered on target angle
    const halfArc = pointerArc / 2;
    const beforeAngle = targetAngle - halfArc;
    const afterAngle = targetAngle + halfArc;
    
    // Points where pointer meets ellipse
    const beforePt = ellipsePoint(center.x, center.y, rx, ry, beforeAngle);
    const afterPt = ellipsePoint(center.x, center.y, rx, ry, afterAngle);
    
    // Build path: pointer tip -> afterPt -> arc around ellipse -> beforePt -> close
    let path = `M ${target.x} ${target.y}`;
    path += ` L ${afterPt.x} ${afterPt.y}`;
    
    // SVG arc from afterPt around to beforePt (the long way, excluding pointer)
    // We need to go from afterAngle around to beforeAngle, the long way
    // This is (360 - pointerArc) degrees
    
    // For SVG arc: A rx ry x-axis-rotation large-arc-flag sweep-flag x y
    // large-arc-flag: 1 if arc > 180°
    // sweep-flag: 1 for clockwise (positive angle direction in SVG)
    
    const arcSpan = 360 - pointerArc;
    const largeArc = arcSpan > 180 ? 1 : 0;
    const sweep = 1;  // clockwise in SVG coords
    
    path += ` A ${rx} ${ry} 0 ${largeArc} ${sweep} ${beforePt.x} ${beforePt.y}`;
    path += ' Z';
    
    return path;
  }

  /**
   * Create a rectangle callout
   *
   * Two calling conventions:
   *   rectangleCallout(center, target, text, options)           // explicit positions
   *   rectangleCallout(target, text, { angle, distance, ... })  // polar from target
   *
   * @param {Object|string} centerOrTarget - Center position, or target if using angle/distance
   * @param {Object|string|string|string[]} pointerOrText - Pointer target, or text if using angle/distance  
   * @param {string|string[]|Object} textOrOptions - Text, or options with angle/distance
   * @param {Object} [options] - Options (only when using explicit positions)
   * @returns {SVGGElement} SVG group element with .anchors property
   */
  function rectangleCallout(centerOrTarget, pointerOrText, textOrOptions, options = {}) {
    let center, tip, text, opts;
    
    // Detect calling convention: if textOrOptions has angle/distance, it's polar mode
    const isPolarMode = typeof textOrOptions === 'object' && 
                        !Array.isArray(textOrOptions) && 
                        textOrOptions !== null &&
                        (textOrOptions.angle !== undefined || textOrOptions.distance !== undefined);
    
    if (isPolarMode) {
      // Polar mode: rectangleCallout(target, text, { angle, distance, pointerGap, ... })
      opts = { ...DEFAULTS, ...textOrOptions };
      const target = resolvePoint(centerOrTarget, opts);
      text = pointerOrText;
      
      const angleRad = (opts.angle || 0) * Math.PI / 180;
      const pointerGap = opts.pointerGap || 0;
      const dist = opts.distance || 60;
      
      // Pointer tip is pointerGap away from target
      tip = {
        x: target.x + pointerGap * Math.cos(angleRad),
        y: target.y + pointerGap * Math.sin(angleRad)
      };
      
      // Center is distance away from target
      center = {
        x: target.x + dist * Math.cos(angleRad),
        y: target.y + dist * Math.sin(angleRad)
      };
    } else {
      // Explicit mode: rectangleCallout(center, target, text, options)
      opts = { ...DEFAULTS, ...options };
      center = resolvePoint(centerOrTarget, opts);
      const rawTarget = resolvePoint(pointerOrText, opts);
      tip = shortenPointer(rawTarget, center, opts.pointerShorten);
      text = textOrOptions;
    }
    
    const dims = calcDimensions(text, opts);
    const halfW = dims.width / 2;
    const halfH = dims.height / 2;
    
    // Create group
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('callout', 'callout-rectangle');
    
    // Create path
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', buildRectCalloutPath(center, tip, halfW, halfH, opts.pointerWidth, opts.cornerRadius));
    path.setAttribute('fill', opts.fill);
    path.setAttribute('stroke', opts.stroke);
    path.setAttribute('stroke-width', opts.strokeWidth);
    g.appendChild(path);
    
    // Create text (supports array of lines)
    const textEl = document.createElementNS(SVG_NS, 'text');
    textEl.setAttribute('x', center.x);
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('font-size', opts.fontSize);
    textEl.setAttribute('font-family', opts.fontFamily);
    textEl.setAttribute('font-style', opts.fontStyle);
    textEl.setAttribute('fill', opts.textFill);

    const lines = Array.isArray(text) ? text : [text];
    const lineHeightPx = opts.fontSize * opts.lineHeight;
    const totalTextHeight = lineHeightPx * lines.length;
    const startY = center.y - totalTextHeight / 2 + lineHeightPx / 2;

    lines.forEach((line, i) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan');
      tspan.setAttribute('x', center.x);
      tspan.setAttribute('y', startY + i * lineHeightPx);
      tspan.setAttribute('dominant-baseline', 'central');
      tspan.textContent = line;
      textEl.appendChild(tspan);
    });
    g.appendChild(textEl);

    // Attach anchors
    g.anchors = {
      center: center,
      pointer: tip,
      north: { x: center.x, y: center.y - halfH },
      south: { x: center.x, y: center.y + halfH },
      east: { x: center.x + halfW, y: center.y },
      west: { x: center.x - halfW, y: center.y }
    };

    return g;
  }

  /**
   * Create an ellipse callout
   *
   * Two calling conventions:
   *   ellipseCallout(center, target, text, options)           // explicit positions
   *   ellipseCallout(target, text, { angle, distance, ... })  // polar from target
   *
   * @param {Object|string} centerOrTarget - Center position, or target if using angle/distance
   * @param {Object|string|string|string[]} pointerOrText - Pointer target, or text if using angle/distance  
   * @param {string|string[]|Object} textOrOptions - Text, or options with angle/distance
   * @param {Object} [options] - Options (only when using explicit positions)
   * @returns {SVGGElement} SVG group element with .anchors property
   */
  function ellipseCallout(centerOrTarget, pointerOrText, textOrOptions, options = {}) {
    let center, tip, text, opts;
    
    // Detect calling convention: if textOrOptions has angle/distance, it's polar mode
    const isPolarMode = typeof textOrOptions === 'object' && 
                        !Array.isArray(textOrOptions) && 
                        textOrOptions !== null &&
                        (textOrOptions.angle !== undefined || textOrOptions.distance !== undefined);
    
    if (isPolarMode) {
      // Polar mode: ellipseCallout(target, text, { angle, distance, pointerGap, ... })
      opts = { ...DEFAULTS, ...textOrOptions };
      const target = resolvePoint(centerOrTarget, opts);
      text = pointerOrText;
      
      const angleRad = (opts.angle || 0) * Math.PI / 180;
      const pointerGap = opts.pointerGap || 0;
      const dist = opts.distance || 60;
      
      // Pointer tip is pointerGap away from target
      tip = {
        x: target.x + pointerGap * Math.cos(angleRad),
        y: target.y + pointerGap * Math.sin(angleRad)
      };
      
      // Center is distance away from target
      center = {
        x: target.x + dist * Math.cos(angleRad),
        y: target.y + dist * Math.sin(angleRad)
      };
    } else {
      // Explicit mode: ellipseCallout(center, target, text, options)
      opts = { ...DEFAULTS, ...options };
      center = resolvePoint(centerOrTarget, opts);
      const rawTarget = resolvePoint(pointerOrText, opts);
      tip = shortenPointer(rawTarget, center, opts.pointerShorten);
      text = textOrOptions;
    }
    
    const dims = calcDimensions(text, opts);
    // Ellipse needs to be larger than rectangle to fit same text (sqrt(2) factor)
    const rx = dims.width / 2 * 1.2;
    const ry = dims.height / 2 * 1.3;
    
    // Create group
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('callout', 'callout-ellipse');
    
    // Create path
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', buildEllipseCalloutPath(center, tip, rx, ry, opts.pointerArc));
    path.setAttribute('fill', opts.fill);
    path.setAttribute('stroke', opts.stroke);
    path.setAttribute('stroke-width', opts.strokeWidth);
    g.appendChild(path);
    
    // Create text (supports array of lines)
    const textEl = document.createElementNS(SVG_NS, 'text');
    textEl.setAttribute('x', center.x);
    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('font-size', opts.fontSize);
    textEl.setAttribute('font-family', opts.fontFamily);
    textEl.setAttribute('font-style', opts.fontStyle);
    textEl.setAttribute('fill', opts.textFill);

    const lines = Array.isArray(text) ? text : [text];
    const lineHeightPx = opts.fontSize * opts.lineHeight;
    const totalTextHeight = lineHeightPx * lines.length;
    const startY = center.y - totalTextHeight / 2 + lineHeightPx / 2;

    lines.forEach((line, i) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan');
      tspan.setAttribute('x', center.x);
      tspan.setAttribute('y', startY + i * lineHeightPx);
      tspan.setAttribute('dominant-baseline', 'central');
      tspan.textContent = line;
      textEl.appendChild(tspan);
    });
    g.appendChild(textEl);

    // Attach anchors
    g.anchors = {
      center: center,
      pointer: tip,
      north: { x: center.x, y: center.y - ry },
      south: { x: center.x, y: center.y + ry },
      east: { x: center.x + rx, y: center.y },
      west: { x: center.x - rx, y: center.y }
    };

    return g;
  }

  // Export
  global.rectangleCallout = rectangleCallout;
  global.ellipseCallout = ellipseCallout;
  
  // Also export as module if available
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { rectangleCallout, ellipseCallout };
  }

})(typeof window !== 'undefined' ? window : this);
