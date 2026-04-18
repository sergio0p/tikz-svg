/**
 * Position resolver — converts relative position specs into absolute { x, y }.
 *
 * Builds a dependency graph from the config's states, topologically sorts it,
 * then resolves each node in order using the DIRECTIONS table.
 */

import { DIRECTIONS, DEFAULTS } from '../core/constants.js';
import { vec, vecAdd, vecScale } from '../core/math.js';

// Direction names recognized in position specs
const DIRECTION_KEYS = Object.keys(DIRECTIONS);

/**
 * Extract the direction, reference node, and distance from a position spec.
 *
 * @param {Object} position - A position object from the config
 * @returns {{ direction: string, refNode: string, distance: number|[number,number] } | null}
 *   null when the position is already absolute ({ x, y }) or missing.
 */
export function parsePositionSpec(position) {
  if (!position) return null;

  // Already absolute
  if (typeof position.x === 'number' && typeof position.y === 'number') {
    return null;
  }

  for (const dir of DIRECTION_KEYS) {
    if (typeof position[dir] === 'string') {
      return {
        direction: dir,
        refNode: position[dir],
        distance: position.distance ?? null,
      };
    }
  }

  return null;
}

/**
 * Build an adjacency list mapping each node to the node it depends on (if any).
 * @param {Object} parsedSpecs - Map of nodeId → parsed position spec (or null)
 * @param {string[]} ids - Node IDs
 * @returns {Map<string, string|null>} nodeId → dependency nodeId (or null)
 */
function buildDependencyGraph(parsedSpecs, ids) {
  const deps = new Map();
  for (const id of ids) {
    const spec = parsedSpecs[id];
    deps.set(id, spec ? spec.refNode : null);
  }
  return deps;
}

/**
 * Kahn's algorithm for topological sort.
 *
 * @param {Map<string, string|null>} deps - nodeId → dependency nodeId
 * @returns {string[]} node IDs in resolved order
 * @throws {Error} on cycles or missing references
 */
function topologicalSort(deps) {
  // in-degree: how many nodes depend on this node
  const inDegree = new Map();
  for (const id of deps.keys()) {
    if (!inDegree.has(id)) inDegree.set(id, 0);
  }

  // Build reverse edges and compute in-degrees
  // An edge from A → B means "A depends on B", so B must come first.
  // In Kahn's terms: B → A is the direction of the DAG edge.
  const dependents = new Map(); // refNode → [nodes that depend on it]
  for (const [id, dep] of deps) {
    if (dep !== null) {
      if (!deps.has(dep)) {
        throw new Error(`Node "${id}" references unknown node "${dep}"`);
      }
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep).push(id);
      inDegree.set(id, (inDegree.get(id) || 0) + 1);
    }
  }

  // Seed queue with nodes that have no dependencies
  const queue = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);

    const children = dependents.get(current);
    if (children) {
      for (const child of children) {
        const newDeg = inDegree.get(child) - 1;
        inDegree.set(child, newDeg);
        if (newDeg === 0) queue.push(child);
      }
    }
  }

  if (sorted.length !== deps.size) {
    const remaining = [...deps.keys()].filter(id => !sorted.includes(id));
    throw new Error(`Cycle detected among nodes: ${remaining.join(', ')}`);
  }

  return sorted;
}

/**
 * Compute the absolute distance vector for a relative placement.
 *
 * @param {Object} dirEntry  - Row from DIRECTIONS table
 * @param {number|[number,number]|null} distSpec - Explicit distance override
 * @param {number} nodeDistance - Default distance from config
 * @returns {{ x: number, y: number }}
 */
function computeOffset(dirEntry, distSpec, nodeDistance) {
  const { vector, factor } = dirEntry;

  if (Array.isArray(distSpec)) {
    // Separate x and y distances — apply sign from the direction vector
    return vec(
      Math.sign(vector.x) * distSpec[0],
      Math.sign(vector.y) * distSpec[1],
    );
  }

  const d = distSpec ?? nodeDistance;
  return vecScale(vector, d * factor);
}

/** Unit direction vectors for each anchor (SVG y-down). */
const ANCHOR_UNIT_OFFSETS = {
  center:       vec(0, 0),
  east:         vec(1, 0),
  west:         vec(-1, 0),
  north:        vec(0, -1),
  south:        vec(0, 1),
  'north east': vec(0.707107, -0.707107),
  'north west': vec(-0.707107, -0.707107),
  'south east': vec(0.707107, 0.707107),
  'south west': vec(-0.707107, 0.707107),
};

/**
 * Compute the anchor point for a node at a given anchor name.
 * Used in off-grid (anchor-to-anchor) positioning.
 * @param {{ x: number, y: number }} center
 * @param {number} radius
 * @param {string} anchor
 * @returns {{ x: number, y: number }}
 */
function anchorPoint(center, radius, anchor) {
  const unit = ANCHOR_UNIT_OFFSETS[anchor];
  if (!unit) {
    throw new Error(`Unknown anchor "${anchor}"`);
  }
  return vecAdd(center, vecScale(unit, radius));
}

/**
 * Resolve all node positions from a config object.
 *
 * Nodes with absolute `{ x, y }` positions are used as-is.
 * Nodes with relative positions (e.g. `{ right: 'q0' }`) are resolved
 * via topological sort using the DIRECTIONS table.
 * The first node without any position defaults to `{ x: 0, y: 0 }`.
 *
 * @param {Object} config - { states, nodeDistance?, onGrid? }
 * @param {Object} config.states - Map of nodeId → node config with position specs
 * @param {number} [config.nodeDistance] - Default spacing between nodes
 * @param {boolean} [config.onGrid] - Whether to use grid-based (center-to-center) placement
 * @returns {Object} states with resolved `{ x, y }` positions
 */
export function resolvePositions(config) {
  const { states } = config;
  const nodeDistance = config.nodeDistance ?? DEFAULTS.nodeDistance;
  const onGrid = config.onGrid ?? DEFAULTS.onGrid;

  // Clone states so we don't mutate the input
  const resolved = {};
  // Parse position specs once and reuse
  const parsedSpecs = {};
  for (const id of Object.keys(states)) {
    resolved[id] = { ...states[id] };
    parsedSpecs[id] = parsePositionSpec(states[id].position);
  }

  const ids = Object.keys(states);
  const deps = buildDependencyGraph(parsedSpecs, ids);
  const order = topologicalSort(deps);

  for (const id of order) {
    const node = resolved[id];
    const spec = parsedSpecs[id];

    if (spec === null) {
      // Absolute or missing position — default unpositioned nodes to origin
      if (node.position && typeof node.position.x === 'number') {
        node.position = { x: node.position.x, y: node.position.y };
      } else {
        node.position = { x: 0, y: 0 };
      }
      continue;
    }
    const { direction, refNode, distance } = spec;
    const dirEntry = DIRECTIONS[direction];
    const refCenter = resolved[refNode].position;

    if (onGrid) {
      // On-grid: new center = ref center + offset
      const offset = computeOffset(dirEntry, distance, nodeDistance);
      node.position = vecAdd(refCenter, offset);
    } else {
      // Off-grid: anchor-to-anchor spacing
      const radius = node.radius ?? DEFAULTS.nodeRadius;
      const refRadius = resolved[refNode].radius ?? DEFAULTS.nodeRadius;

      // Reference anchor point on the reference node
      const refAnchorPt = anchorPoint(refCenter, refRadius, dirEntry.refAnchor);

      // The offset goes from refAnchor to newAnchor edge
      const offset = computeOffset(dirEntry, distance, nodeDistance);

      // The new node's anchor should land at refAnchorPt + offset
      const newAnchorPt = vecAdd(refAnchorPt, offset);

      // Reverse the anchor offset to get the center
      const anchorOffset = anchorPoint(vec(0, 0), radius, dirEntry.newAnchor);
      node.position = vecAdd(newAnchorPt, vecScale(anchorOffset, -1));
    }
  }

  return resolved;
}
