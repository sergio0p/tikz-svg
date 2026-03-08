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

export const DEFAULTS = {
  nodeDistance: 60,
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
  loopSize: 25,
  loopAngle: 15,
  shadow: false,
  shadowDefaults: { dx: 2, dy: 2, blur: 3, color: 'rgba(0,0,0,0.25)' },
  acceptingInset: 3,
  initialArrowLength: 25,
};
