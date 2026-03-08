/**
 * Path construction module — the "soft path" concept from PGF.
 * Accumulates path segments as a structured list, supports inspection,
 * manipulation, and SVG serialization.
 */

const KAPPA = 0.5522847498;

function round4(v) {
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? 0 : r;
}

export class Path {
  constructor() {
    /** @type {{ type: string, args: number[] }[]} */
    this.segments = [];
    /** @type {{ x: number, y: number } | null} */
    this._lastMove = null;
  }

  // ── Builder methods (all return this) ──────────────────────────

  moveTo(x, y) {
    this.segments.push({ type: 'M', args: [x, y] });
    this._lastMove = { x, y };
    return this;
  }

  lineTo(x, y) {
    this.segments.push({ type: 'L', args: [x, y] });
    return this;
  }

  curveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    this.segments.push({ type: 'C', args: [cp1x, cp1y, cp2x, cp2y, x, y] });
    return this;
  }

  close() {
    this.segments.push({ type: 'Z', args: [] });
    return this;
  }

  rect(x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.close();
    return this;
  }

  circle(cx, cy, r) {
    return this.ellipse(cx, cy, r, r);
  }

  ellipse(cx, cy, rx, ry) {
    const kx = KAPPA * rx;
    const ky = KAPPA * ry;

    this.moveTo(cx + rx, cy);
    this.curveTo(cx + rx, cy - ky, cx + kx, cy - ry, cx, cy - ry);
    this.curveTo(cx - kx, cy - ry, cx - rx, cy - ky, cx - rx, cy);
    this.curveTo(cx - rx, cy + ky, cx - kx, cy + ry, cx, cy + ry);
    this.curveTo(cx + kx, cy + ry, cx + rx, cy + ky, cx + rx, cy);
    this.close();
    return this;
  }

  arc(cx, cy, r, startAngleDeg, endAngleDeg) {
    const toRad = (d) => (d * Math.PI) / 180;

    // Normalize so we sweep from start toward end
    let sweep = endAngleDeg - startAngleDeg;
    // Handle both positive and negative sweeps
    const direction = sweep >= 0 ? 1 : -1;
    sweep = Math.abs(sweep);

    // Split into segments of at most 90°
    const segCount = Math.ceil(sweep / 90);
    if (segCount === 0) {
      const sa = toRad(startAngleDeg);
      this.moveTo(cx + r * Math.cos(sa), cy - r * Math.sin(sa));
      return this;
    }
    const segAngle = (sweep / segCount) * direction;

    let angle = startAngleDeg;
    const sa0 = toRad(angle);
    this.moveTo(cx + r * Math.cos(sa0), cy - r * Math.sin(sa0));

    for (let i = 0; i < segCount; i++) {
      const a1 = toRad(angle);
      const a2 = toRad(angle + segAngle);

      // Standard arc-to-cubic approximation
      const alpha = Math.sin(a2 - a1) * (Math.sqrt(4 + 3 * Math.tan((a2 - a1) / 2) ** 2) - 1) / 3;

      const x1 = cx + r * Math.cos(a1);
      const y1 = cy - r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy - r * Math.sin(a2);

      const cp1x = x1 - alpha * (-r * Math.sin(a1));
      const cp1y = y1 - alpha * (r * Math.cos(a1));
      const cp2x = x2 + alpha * (-r * Math.sin(a2));
      const cp2y = y2 + alpha * (r * Math.cos(a2));

      this.curveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
      angle += segAngle;
    }

    return this;
  }

  // ── Processing methods ─────────────────────────────────────────

  roundCorners(radius) {
    if (radius <= 0 || this.segments.length === 0) {
      return this.clone();
    }

    const segs = this.segments;
    const result = new Path();

    const endpointOf = (seg) => {
      switch (seg.type) {
        case 'M':
        case 'L': return { x: seg.args[0], y: seg.args[1] };
        case 'C': return { x: seg.args[4], y: seg.args[5] };
        default: return null;
      }
    };

    // Find the last moveTo point for close-path handling
    let lastMovePt = null;

    const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

    const roundCorner = (prevPt, cornerPt, nextPt) => {
      const dPrev = dist(cornerPt, prevPt);
      const dNext = dist(nextPt, cornerPt);
      const effectiveR = Math.min(radius, dPrev / 2, dNext / 2);

      if (effectiveR > 1e-10 && dPrev > 1e-10 && dNext > 1e-10) {
        const tPrev = effectiveR / dPrev;
        const backPt = {
          x: cornerPt.x + (prevPt.x - cornerPt.x) * tPrev,
          y: cornerPt.y + (prevPt.y - cornerPt.y) * tPrev,
        };
        const tNext = effectiveR / dNext;
        const fwdPt = {
          x: cornerPt.x + (nextPt.x - cornerPt.x) * tNext,
          y: cornerPt.y + (nextPt.y - cornerPt.y) * tNext,
        };
        const cp1x = backPt.x + (cornerPt.x - backPt.x) * KAPPA;
        const cp1y = backPt.y + (cornerPt.y - backPt.y) * KAPPA;
        const cp2x = fwdPt.x + (cornerPt.x - fwdPt.x) * KAPPA;
        const cp2y = fwdPt.y + (cornerPt.y - fwdPt.y) * KAPPA;
        return { backPt, fwdPt, cp1x, cp1y, cp2x, cp2y };
      }
      return null;
    };

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];

      if (seg.type === 'M') {
        lastMovePt = { x: seg.args[0], y: seg.args[1] };
        result.moveTo(seg.args[0], seg.args[1]);
      } else if (seg.type === 'L') {
        const prevSeg = i > 0 ? segs[i - 1] : null;
        const nextSeg = i + 1 < segs.length ? segs[i + 1] : null;

        const prevPt = prevSeg ? endpointOf(prevSeg) : null;
        const cornerPt = { x: seg.args[0], y: seg.args[1] };

        const prevIsLine = prevSeg && (prevSeg.type === 'L' || prevSeg.type === 'M');
        // Treat Z as a line back to lastMovePt
        const nextIsLine = nextSeg && (nextSeg.type === 'L' || (nextSeg.type === 'Z' && lastMovePt));

        if (prevIsLine && nextIsLine && prevPt) {
          const nextPt = nextSeg.type === 'Z' ? lastMovePt : { x: nextSeg.args[0], y: nextSeg.args[1] };
          const rc = roundCorner(prevPt, cornerPt, nextPt);
          if (rc) {
            result.lineTo(rc.backPt.x, rc.backPt.y);
            result.curveTo(rc.cp1x, rc.cp1y, rc.cp2x, rc.cp2y, rc.fwdPt.x, rc.fwdPt.y);
            continue;
          }
        }

        result.lineTo(seg.args[0], seg.args[1]);
      } else if (seg.type === 'C') {
        result.curveTo(...seg.args);
      } else if (seg.type === 'Z') {
        result.close();
      }
    }

    return result;
  }

  // ── Serialization / query ──────────────────────────────────────

  toSVGPath() {
    if (this.segments.length === 0) return '';

    const parts = [];
    for (const seg of this.segments) {
      if (seg.type === 'Z') {
        parts.push('Z');
      } else {
        parts.push(seg.type + ' ' + seg.args.map(round4).join(' '));
      }
    }
    return parts.join(' ');
  }

  bbox() {
    if (this.segments.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasPoints = false;

    const include = (x, y) => {
      hasPoints = true;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };

    for (const seg of this.segments) {
      if (seg.type === 'M' || seg.type === 'L') {
        include(seg.args[0], seg.args[1]);
      } else if (seg.type === 'C') {
        include(seg.args[0], seg.args[1]);
        include(seg.args[2], seg.args[3]);
        include(seg.args[4], seg.args[5]);
      }
    }

    return hasPoints ? { minX, minY, maxX, maxY } : null;
  }

  clone() {
    const p = new Path();
    p.segments = this.segments.map(s => ({ type: s.type, args: [...s.args] }));
    p._lastMove = this._lastMove ? { ...this._lastMove } : null;
    return p;
  }

  append(otherPath) {
    for (const seg of otherPath.segments) {
      this.segments.push({ type: seg.type, args: [...seg.args] });
    }
    if (otherPath._lastMove) {
      this._lastMove = { ...otherPath._lastMove };
    }
    return this;
  }

  isEmpty() {
    return this.segments.length === 0;
  }

  lastPoint() {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      if (seg.type === 'M' || seg.type === 'L') {
        return { x: seg.args[0], y: seg.args[1] };
      }
      if (seg.type === 'C') {
        return { x: seg.args[4], y: seg.args[5] };
      }
      if (seg.type === 'Z' && this._lastMove) {
        return { ...this._lastMove };
      }
    }
    return null;
  }

  transform(transformObj) {
    const p = new Path();
    for (const seg of this.segments) {
      if (seg.type === 'M') {
        const pt = transformObj.apply({ x: seg.args[0], y: seg.args[1] });
        p.moveTo(pt.x, pt.y);
      } else if (seg.type === 'L') {
        const pt = transformObj.apply({ x: seg.args[0], y: seg.args[1] });
        p.lineTo(pt.x, pt.y);
      } else if (seg.type === 'C') {
        const cp1 = transformObj.apply({ x: seg.args[0], y: seg.args[1] });
        const cp2 = transformObj.apply({ x: seg.args[2], y: seg.args[3] });
        const end = transformObj.apply({ x: seg.args[4], y: seg.args[5] });
        p.curveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
      } else if (seg.type === 'Z') {
        p.close();
      }
    }
    return p;
  }
}
