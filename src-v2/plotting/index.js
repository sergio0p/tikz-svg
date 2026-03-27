/**
 * Plotting module public API.
 *
 * TikZ Section 22: Plots of Functions
 */
export { plot } from './plot.js';
export { sampleFunction, compileFn } from './evaluator.js';
export { getHandler, applyHandler } from './handlers.js';
export { getMark, getMarkPositions, getMarkFillMode } from './marks.js';
