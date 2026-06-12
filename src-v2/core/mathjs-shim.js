/**
 * Shim for 'mathjs' bare import.
 *
 * In browsers: prefers `window.math` set by the UMD bundle (loaded via
 * <script>); avoids a bare-specifier resolve that browsers can't satisfy.
 *
 * In Node (tests): dynamically imports the real `mathjs` package, which is
 * listed as a dependency in package.json.
 *
 * Gracefully exports null stubs when neither source is available, so pages
 * that use tikz-svg for diagrams-only don't need mathjs at all.
 */
let m = (typeof window !== 'undefined' && window.math) || null;
if (!m && typeof window === 'undefined') {
  try {
    m = await import('mathjs');
  } catch {
    m = null;
  }
}
const compile = m ? m.compile : null;
const evaluate = m ? m.evaluate : null;
const parse = m ? m.parse : null;
const pi = m ? m.pi : Math.PI;
const e = m ? m.e : Math.E;
export { compile, evaluate, parse, pi, e };
export default m;
