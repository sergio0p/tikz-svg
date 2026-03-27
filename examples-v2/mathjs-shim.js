/**
 * Browser shim for 'mathjs' bare import.
 * The UMD bundle exposes window.math; this re-exports it as ES module.
 */
const { compile, evaluate, parse, pi, e } = window.math;
export { compile, evaluate, parse, pi, e };
export default window.math;
