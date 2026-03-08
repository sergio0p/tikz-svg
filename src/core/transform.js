/**
 * Coordinate transformation system mirroring PGF's affine transforms.
 *
 * Matrix layout (column-major style, matching SVG's matrix(a,b,c,d,e,f)):
 *
 *   ┌ a  c  tx ┐
 *   │ b  d  ty │
 *   └ 0  0   1 ┘
 *
 * Point transform:  newX = a*x + c*y + tx
 *                   newY = b*x + d*y + ty
 */

const DEG2RAD = Math.PI / 180;

export class Transform {
  constructor() {
    // identity: [a, b, c, d, tx, ty]
    this._m = [1, 0, 0, 1, 0, 0];
  }

  // ── Mutating operations (pre-multiply onto current matrix) ──────────

  /**
   * Pre-multiply the current matrix by another affine matrix.
   * PGF's \pgftransformcm
   */
  concat(a, b, c, d, tx, ty) {
    const [A, B, C, D, TX, TY] = this._m;
    this._m = [
      A * a + C * b,
      B * a + D * b,
      A * c + C * d,
      B * c + D * d,
      A * tx + C * ty + TX,
      B * tx + D * ty + TY,
    ];
    return this;
  }

  translate(dx, dy) {
    return this.concat(1, 0, 0, 1, dx, dy);
  }

  scale(sx, sy) {
    if (sy === undefined) sy = sx;
    return this.concat(sx, 0, 0, sy, 0, 0);
  }

  /** Rotation in degrees, math-standard (positive = counterclockwise). */
  rotate(angleDeg) {
    const rad = angleDeg * DEG2RAD;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return this.concat(cos, sin, -sin, cos, 0, 0);
  }

  /** PGF's \pgftransformxslant{s}: x' = x + s*y, y' = y */
  slantX(s) {
    return this.concat(1, 0, s, 1, 0, 0);
  }

  /** PGF's \pgftransformyslant{s}: x' = x, y' = s*x + y */
  slantY(s) {
    return this.concat(1, s, 0, 1, 0, 0);
  }

  // ── Query / utility ─────────────────────────────────────────────────

  /** Apply the current transform to a point. */
  apply({ x, y }) {
    const [a, b, c, d, tx, ty] = this._m;
    return {
      x: a * x + c * y + tx,
      y: b * x + d * y + ty,
    };
  }

  /** Return a NEW Transform that is the inverse of this one. */
  invert() {
    const [a, b, c, d, tx, ty] = this._m;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-15) {
      throw new Error('Transform is singular and cannot be inverted');
    }
    const inv = new Transform();
    inv._m = [
      d / det,
      -b / det,
      -c / det,
      a / det,
      (c * ty - d * tx) / det,
      (b * tx - a * ty) / det,
    ];
    return inv;
  }

  /** Deep copy. */
  clone() {
    const t = new Transform();
    t._m = this._m.slice();
    return t;
  }

  /** Snapshot the matrix values. */
  get() {
    return this._m.slice();
  }

  /** Restore from a snapshot. */
  set(m) {
    this._m = m.slice();
    return this;
  }

  /** Reset to identity. */
  reset() {
    this._m = [1, 0, 0, 1, 0, 0];
    return this;
  }

  /** Fast identity check (PGF's \ifpgf@pt@identity). */
  isIdentity() {
    const [a, b, c, d, tx, ty] = this._m;
    return a === 1 && b === 0 && c === 0 && d === 1 && tx === 0 && ty === 0;
  }

  /** Emit SVG transform attribute value: matrix(a,b,c,d,tx,ty). */
  toSVG() {
    return `matrix(${this._m.join(',')})`;
  }
}

/**
 * Stack-based transform scope, mirroring PGF's group-scoped transforms.
 */
export class TransformStack {
  constructor() {
    this._transform = new Transform();
    this._stack = [];
  }

  /** Getter for the current Transform instance. */
  get current() {
    return this._transform;
  }

  /** Save current matrix state. */
  push() {
    this._stack.push(this._transform.get());
  }

  /** Restore most recently pushed state. */
  pop() {
    const saved = this._stack.pop();
    if (!saved) {
      throw new Error('TransformStack underflow: pop() called with empty stack');
    }
    this._transform.set(saved);
  }
}
