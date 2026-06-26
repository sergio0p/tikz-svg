/**
 * Regression tests for the KaTeX fonts-ready race (katex-font-collapse-bug.md):
 * a premature `document.fonts.ready` used to (a) permanently disarm the
 * re-render queue and (b) pin fallback measurements forever, collapsing every
 * label to the origin.
 *
 * jsdom does not implement `document.fonts`, so we inject a controllable fake
 * FontFaceSet and drive `loadingdone` deterministically — no real fonts or
 * timers. These tests prove the event WIRING (re-arm + invalidate + re-fit);
 * real cross-browser font convergence can only be verified in a browser.
 */
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  registerPendingReRender,
  __resetFontReadiness,
  createLabelContent,
} from '../src-v2/core/katex-renderer.js';

before(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.document = dom.window.document;
  global.window = dom.window;
});

/** Flush microtasks + one macrotask so face.load() and .then(flush) settle. */
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A fake FontFace whose load() flips it to 'loaded'. */
function makeFace(family, status = 'loading') {
  return {
    family,
    status,
    load() { this.status = 'loaded'; return Promise.resolve(this); },
  };
}

/** A fake FontFaceSet: Set-like + event target, with a manual fire() hook. */
function makeFakeFontFaceSet(faces = []) {
  const listeners = {};
  return {
    _faces: faces.slice(),
    ready: Promise.resolve(),
    add(face) { this._faces.push(face); },
    forEach(cb) { this._faces.forEach((f) => cb(f)); },
    addEventListener(type, cb) { (listeners[type] || (listeners[type] = [])).push(cb); },
    removeEventListener(type, cb) {
      if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== cb);
    },
    fire(type, fontfaces) {
      (listeners[type] || []).forEach((cb) => cb({ fontfaces }));
    },
  };
}

describe('KaTeX font-race correction', () => {
  beforeEach(() => {
    __resetFontReadiness();
    global.document.fonts = makeFakeFontFaceSet();
  });

  it('corrects on a KaTeX loadingdone even after fonts.ready already resolved (P1)', async () => {
    const fonts = global.document.fonts;
    let calls = 0;
    registerPendingReRender({}, {}, () => { calls++; });

    // The fonts.ready hint flushes once on its own (guaranteed second paint).
    await tick();
    const afterReady = calls;
    assert.ok(afterReady >= 1, 'fonts.ready hint should flush at least once');

    // A KaTeX face then finishes loading — must trigger a fresh correction.
    fonts.add(makeFace('KaTeX_Math', 'loading'));
    fonts.fire('loadingdone', [{ family: 'KaTeX_Math' }]);
    await tick();
    assert.ok(calls > afterReady, 'a KaTeX loadingdone must re-render after early ready');
  });

  it('stays armed across multiple loadingdone batches — never permanently disarms (P2a)', async () => {
    const fonts = global.document.fonts;
    let calls = 0;
    registerPendingReRender({}, {}, () => { calls++; });
    await tick();
    const base = calls;

    fonts.add(makeFace('KaTeX_Main', 'loading'));
    fonts.fire('loadingdone', [{ family: 'KaTeX_Main' }]);
    await tick();

    fonts.add(makeFace('KaTeX_AMS', 'loading')); // a later lazy face (\mathbb etc.)
    fonts.fire('loadingdone', [{ family: 'KaTeX_AMS' }]);
    await tick();

    assert.ok(calls >= base + 2, 'each KaTeX batch should re-fit (queue re-armable)');
  });

  it('de-dupes by svgEl so repeated render() calls do not stack', async () => {
    const fonts = global.document.fonts;
    const svgA = {}, svgB = {};
    let a = 0, b = 0;
    registerPendingReRender(svgA, {}, () => { a++; });
    registerPendingReRender(svgA, {}, () => { a++; }); // same el — replaces, not stacks
    registerPendingReRender(svgB, {}, () => { b++; });
    await tick();

    const a0 = a, b0 = b;
    fonts.add(makeFace('KaTeX_Main', 'loading'));
    fonts.fire('loadingdone', [{ family: 'KaTeX_Main' }]);
    await tick();

    assert.strictEqual(a - a0, 1, 'svgA re-renders once per batch, not twice');
    assert.strictEqual(b - b0, 1, 'svgB re-renders once per batch');
  });

  it('ignores loadingdone for non-KaTeX page fonts', async () => {
    const fonts = global.document.fonts;
    let calls = 0;
    registerPendingReRender({}, {}, () => { calls++; });
    await tick();
    const base = calls;

    fonts.add(makeFace('Inter', 'loading'));
    fonts.fire('loadingdone', [{ family: 'Inter' }]);
    await tick();

    assert.strictEqual(calls, base, 'a non-KaTeX font load must not re-render');
  });

  it('is a no-op when document.fonts is unavailable (SSR/jsdom safety)', () => {
    global.document.fonts = undefined;
    let called = false;
    assert.doesNotThrow(() =>
      registerPendingReRender({}, {}, () => { called = true; throw new Error('unreachable'); }));
    assert.strictEqual(called, false, 'no fonts => nothing scheduled, no throw');
  });

  it('does not PIN a measurement taken while a KaTeX face is still loading (P2b)', () => {
    const fonts = global.document.fonts;
    const face = makeFace('KaTeX_Main', 'loading');
    fonts.add(face);

    global.window.katex = { renderToString: (tex) => `<span>${tex}</span>` };
    let rect = { width: 10, height: 8, top: 0, left: 0, right: 10, bottom: 8 };
    const proto = global.window.Element.prototype;
    const origRect = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function () { return rect; };
    const pad = 14 * 0.4; // createLabelContent pads width by fontSize*0.4

    try {
      const w1 = createLabelContent('$x$', { fontSize: 14 }).width;
      assert.ok(Math.abs(w1 - (10 + pad)) < 1e-6, 'first measurement reflects live size');

      rect = { ...rect, width: 20 };
      const w2 = createLabelContent('$x$', { fontSize: 14 }).width;
      assert.ok(Math.abs(w2 - (20 + pad)) < 1e-6,
        'while loading, measurement must NOT be cached (re-measures)');

      // Fonts settle — now measurements may be pinned.
      face.status = 'loaded';
      rect = { ...rect, width: 30 };
      const w3 = createLabelContent('$x$', { fontSize: 14 }).width;
      assert.ok(Math.abs(w3 - (30 + pad)) < 1e-6, 'first settled measurement reflects live size');

      rect = { ...rect, width: 40 };
      const w4 = createLabelContent('$x$', { fontSize: 14 }).width;
      assert.ok(Math.abs(w4 - (30 + pad)) < 1e-6, 'once settled, the measurement is cached');
    } finally {
      proto.getBoundingClientRect = origRect;
      delete global.window.katex;
    }
  });
});
