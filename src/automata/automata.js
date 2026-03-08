/**
 * Automata domain library — thin convenience layer for finite state machines.
 * Sets automata-specific defaults and validates the configuration before
 * delegating to the main render pipeline.
 */

import { render } from '../index.js';

/** Automata-specific defaults (only values not already in DEFAULTS). */
const AUTOMATA_STATE_DEFAULTS = {
  shape: 'circle',
};

const AUTOMATA_EDGE_DEFAULTS = {
  arrow: 'stealth',
};

/**
 * Render a finite automaton as SVG.
 *
 * Accepts a domain-friendly configuration with `states` and `edges`, applies
 * automata-specific default styling, validates that every edge references
 * existing states, then delegates to `render()`.
 *
 * @param {SVGElement} svgEl - Target SVG element.
 * @param {Object} config - Automaton configuration:
 *   {
 *     stateStyle?: { radius?, fill?, stroke?, ... },
 *     edgeStyle?:  { stroke?, strokeWidth?, arrow?, ... },
 *     nodeDistance?: number,
 *     onGrid?: boolean,
 *     states: {
 *       q0: { initial?: boolean, accepting?: boolean, position?, label?, ... },
 *       q1: { position: { right: 'q0' }, ... },
 *       ...
 *     },
 *     edges: [
 *       { from: 'q0', to: 'q1', label?: string, bend?, loop?, ... },
 *       ...
 *     ]
 *   }
 * @returns {Object} Element references from the render pipeline.
 * @throws {Error} If states is missing/empty or an edge references an unknown state.
 */
export function renderAutomaton(svgEl, config) {
  // ── 1. Validate required fields ────────────────────────────────────

  if (!config.states || Object.keys(config.states).length === 0) {
    throw new Error('renderAutomaton: config.states must be a non-empty object');
  }

  const stateIds = new Set(Object.keys(config.states));
  const edges = config.edges || [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (!edge.from || !stateIds.has(edge.from)) {
      throw new Error(
        `renderAutomaton: edge[${i}].from references unknown state "${edge.from}"`
      );
    }
    if (!edge.to || !stateIds.has(edge.to)) {
      throw new Error(
        `renderAutomaton: edge[${i}].to references unknown state "${edge.to}"`
      );
    }
  }

  // ── 2. Merge automata defaults with user config ────────────────────

  const mergedConfig = {
    ...config,
    stateStyle: { ...AUTOMATA_STATE_DEFAULTS, ...config.stateStyle },
    edgeStyle:  { ...AUTOMATA_EDGE_DEFAULTS,  ...config.edgeStyle },
  };

  // ── 3. Delegate to the main render pipeline ────────────────────────

  return render(svgEl, mergedConfig);
}
