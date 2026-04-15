/**
 * Browser shim for 'mathjs' bare import.
 * The UMD bundle exposes window.math; this re-exports it as ES module.
 * Gracefully exports null stubs when mathjs is not loaded (e.g. pages
 * that use tikz-svg for node/edge diagrams but don't need plotting).
 */
const m = (typeof window !== 'undefined' && window.math) || null;
const compile = m ? m.compile : null;
const evaluate = m ? m.evaluate : null;
const parse = m ? m.parse : null;
const pi = m ? m.pi : Math.PI;
const e = m ? m.e : Math.E;
export { compile, evaluate, parse, pi, e };
export default m;
