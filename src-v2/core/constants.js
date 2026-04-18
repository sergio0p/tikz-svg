/**
 * Direction table and default configuration values.
 * Directions follow SVG coordinate system (y-down).
 */

export const DIRECTIONS = {
  right:         { newAnchor: 'west',       refAnchor: 'east',       vector: { x:  1, y:  0 }, factor: 1.0 },
  left:          { newAnchor: 'east',       refAnchor: 'west',       vector: { x: -1, y:  0 }, factor: 1.0 },
  above:         { newAnchor: 'south',      refAnchor: 'north',      vector: { x:  0, y: -1 }, factor: 1.0 },
  below:         { newAnchor: 'north',      refAnchor: 'south',      vector: { x:  0, y:  1 }, factor: 1.0 },
  'above right': { newAnchor: 'south west', refAnchor: 'north east', vector: { x:  1, y: -1 }, factor: 0.707107 },
  'above left':  { newAnchor: 'south east', refAnchor: 'north west', vector: { x: -1, y: -1 }, factor: 0.707107 },
  'below right': { newAnchor: 'north west', refAnchor: 'south east', vector: { x:  1, y:  1 }, factor: 0.707107 },
  'below left':  { newAnchor: 'north east', refAnchor: 'south west', vector: { x: -1, y:  1 }, factor: 0.707107 },
};

/**
 * TikZ named line widths (§15.3.1). Values in pt, used directly as SVG stroke-width.
 */
/**
 * TikZ named dash patterns (§15.3.2). Values from tikz.code.tex using
 * \pgflinewidth = 0.4pt as the reference dot width. Emitted as SVG stroke-dasharray.
 */
export const DASH_PATTERNS = {
  'dotted':              '0.4 2',
  'densely dotted':      '0.4 1',
  'loosely dotted':      '0.4 4',
  'dashed':              '3 3',
  'densely dashed':      '3 2',
  'loosely dashed':      '3 6',
  'dash dot':            '3 2 0.4 2',
  'densely dash dot':    '3 1 0.4 1',
  'loosely dash dot':    '3 4 0.4 4',
  'dash dot dot':        '3 2 0.4 2 0.4 2',
  'densely dash dot dot':'3 1 0.4 1 0.4 1',
  'loosely dash dot dot':'3 4 0.4 4 0.4 4',
};

export const LINE_WIDTHS = {
  'ultra thin': 0.1,
  'very thin':  0.2,
  'thin':       0.4,
  'semithick':  0.6,
  'thick':      0.8,
  'very thick': 1.2,
  'ultra thick': 1.6,
};

export const DEFAULTS = {
  nodeDistance: 90,   // TikZ: 2cm with radius ~12.5pt ≈ 22% ratio; 20/90 ≈ 22%
  onGrid: true,
  nodeRadius: 20,
  fontSize: 14,
  fontFamily: 'serif',
  edgeStrokeWidth: 1.5,
  edgeColor: '#000000',
  nodeFill: '#FFFFFF',
  nodeStroke: '#000000',
  nodeStrokeWidth: 1.5,
  arrowSize: 8,
  bendAngle: 30,
  loopLooseness: 8,
  loopMinDistance: 20,
  shadow: false,
  shadowDefaults: { dx: 2, dy: 2, blur: 3, color: 'rgba(0,0,0,0.25)' },
  acceptingInset: 3,
  initialArrowLength: 25,
  innerSep: 3,
  labelDistance: 0,
  shortenStart: 0,
  shortenEnd: 0,
  // Plot defaults
  plotColor: '#2563eb',
  plotStrokeWidth: 2,
  plotFill: 'none',
  plotHandler: 'lineto',
  markSize: 3,
  // Path defaults (free-form \draw)
  pathColor: '#000000',
  pathStrokeWidth: 1.5,
};
