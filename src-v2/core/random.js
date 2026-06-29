/**
 * Seeded pseudo-random number generator (mulberry32 variant).
 * Matches PGF's rand semantics: returns values in [-1, 1].
 */
export class SeededRandom {
  constructor(seed = 42) {
    this._state = seed | 0;
    if (this._state === 0) this._state = 1;
  }

  /** Returns a float in [-1, 1]. Two instances with same seed produce identical sequences. */
  rand() {
    let t = this._state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 2147483648 - 1;
  }

  /**
   * Returns a standard-normal (mean 0, stdev 1) sample via Box–Muller.
   * Consumes exactly two rand() draws per pair of Gaussians (the spare is
   * cached), keeping the PRNG stream position predictable for deterministic
   * tests. Used by the watercolor decoration's midpoint displacement.
   */
  gauss() {
    if (this._spare !== undefined) {
      const v = this._spare;
      this._spare = undefined;
      return v;
    }
    // rand() is [-1, 1); map to (0, 1] so log(0) can never occur.
    let u = (this.rand() + 1) / 2;   // [0, 1)
    u = 1 - u;                       // (0, 1]
    const v = (this.rand() + 1) / 2; // [0, 1)
    const r = Math.sqrt(-2 * Math.log(u));
    this._spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
}
