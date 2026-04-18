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
}
