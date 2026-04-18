# How to Convert TikZ Beamer Animations to tikz-svg src-v3

## Overview

TikZ/Beamer uses `\draw<N->` overlay syntax to progressively reveal diagram elements. The tikz-svg src-v3 library supports this via the `frame` property on draw items, combined with a small sync script that ties chart frame visibility to the existing scroll-based overlay system.

## Step-by-Step Process

### 1. Read the TikZ source

Identify the overlay specs on each `\draw` command:

```tex
\draw<1->[ultra thick,blue] (0,13.8)--(0,9);        % frame 1 onward
\draw<2->[ultra thick,blue] (0,9)--(1,9)--(1,6);     % frame 2 onward
\draw<3->[ultra thick,blue] (1,6)--(2,6)--(2,3);     % frame 3 onward
```

### 2. Split the single path into frame-tagged paths

The original render() config likely has one big path. Split it into N paths matching the TikZ overlays:

```js
// BEFORE: single path (no animation)
{ type: 'path', points: [
  {x:0,y:-13},{x:0,y:-9},{x:1,y:-9},{x:1,y:-6},
  {x:2,y:-6},{x:2,y:-3},{x:3,y:-3},{x:3,y:0},{x:4,y:0}
], stroke: '#268bd2', strokeWidth: 3 },

// AFTER: 5 frame-tagged paths
{ type: 'path', id: 'emma-s1', frame: '1-', points: [{x:0,y:-13},{x:0,y:-9}], stroke: '#268bd2', strokeWidth: 3 },
{ type: 'path', id: 'emma-s2', frame: '2-', points: [{x:0,y:-9},{x:1,y:-9},{x:1,y:-6}], stroke: '#268bd2', strokeWidth: 3 },
{ type: 'path', id: 'emma-s3', frame: '3-', points: [{x:1,y:-6},{x:2,y:-6},{x:2,y:-3}], stroke: '#268bd2', strokeWidth: 3 },
{ type: 'path', id: 'emma-s4', frame: '4-', points: [{x:2,y:-3},{x:3,y:-3},{x:3,y:0}], stroke: '#268bd2', strokeWidth: 3 },
{ type: 'path', id: 'emma-s5', frame: '5-', points: [{x:3,y:0},{x:4,y:0}], stroke: '#268bd2', strokeWidth: 3 },
```

### 3. Frame syntax reference

| TikZ | src-v3 `frame` | Meaning |
|------|----------------|---------|
| `<1->` | `'1-'` | Visible from frame 1 onward |
| `<3>` | `'3'` | Visible on frame 3 only |
| `<2-4>` | `'2-4'` | Visible on frames 2 through 4 |
| `<1,3,5>` | `'1,3,5'` | Visible on frames 1, 3, and 5 |

### 4. Make the section an overlay-frame

The text bullets need `class="overlay"` to reveal progressively:

```html
<section id="emma-frame" class="frame overlay-frame">
  <ul>
    <li class="overlay">When the price is above $9...</li>
    <li class="overlay">When the price is above $6...</li>
    ...
  </ul>
  <svg id="svg-emma" ...></svg>
</section>
```

### 5. Add the sync script

The chart frame visibility must sync with the overlay text reveals. Add this script after the render() module:

```html
<script>
function parseFrameSpec(spec, step) {
  for (const part of spec.split(',')) {
    const trimmed = part.trim();
    const range = trimmed.match(/^(\d+)\s*-\s*(\d*)$/);
    if (range) {
      const start = parseInt(range[1], 10);
      const end = range[2] ? parseInt(range[2], 10) : Infinity;
      if (step >= start && step <= end) return true;
    } else {
      if (parseInt(trimmed, 10) === step) return true;
    }
  }
  return false;
}

function syncOverlayFrames() {
  document.querySelectorAll('.overlay-frame').forEach(frame => {
    const overlays = frame.querySelectorAll('.overlay');
    const frameEls = frame.querySelectorAll('[data-frame]');
    if (frameEls.length === 0) return;

    function sync() {
      let step = 0;
      overlays.forEach((el, i) => {
        if (el.classList.contains('revealed')) step = i + 1;
      });
      frameEls.forEach(el => {
        const spec = el.getAttribute('data-frame');
        el.setAttribute('visibility', parseFrameSpec(spec, step) ? 'visible' : 'hidden');
      });
    }

    const observer = new MutationObserver(sync);
    overlays.forEach(ol => observer.observe(ol, { attributes: true, attributeFilter: ['class'] }));
    sync();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(syncOverlayFrames, 500);
});
</script>
```

This automatically syncs ALL overlay-frames on the page — any frame that has both `.overlay` text items and `[data-frame]` SVG elements will be synchronized.

### 6. Import from src-v3

```js
import { render } from './tikz-svg/src-v3/index.js';
```

The `frame` property only works in src-v3. If you import from src-v2, the `frame` property is silently ignored (no `data-frame` attributes emitted, no visibility toggling).

## Pitfalls

### Path continuity
When splitting a single path into segments, make sure the **end point of segment N equals the start point of segment N+1**. Otherwise there will be visual gaps:

```js
// WRONG: gap between segments
{ frame: '1-', points: [{x:0,y:-13},{x:0,y:-9}] },      // ends at (0,-9)
{ frame: '2-', points: [{x:1,y:-9},{x:1,y:-6}] },        // starts at (1,-9) — gap!

// CORRECT: segments connect
{ frame: '1-', points: [{x:0,y:-13},{x:0,y:-9}] },       // ends at (0,-9)
{ frame: '2-', points: [{x:0,y:-9},{x:1,y:-9},{x:1,y:-6}] }, // starts at (0,-9) ✓
```

### ID prefix
When the `<svg>` element has an `id` (e.g., `id="svg-emma"`), all generated IDs are prefixed: `svg-emma--emma-s1`. The sync script uses `querySelectorAll('[data-frame]')` (attribute-based), so it works regardless of prefix. But if you need to target elements by ID in custom GSAP code, use `refs.byId` from the render() return value, not `document.getElementById()` with the unprefixed ID.

### Overlay count mismatch
The number of `.overlay` text items determines the number of scroll steps. If you have 5 text overlays but 7 chart frames, frames 6-7 will never be reached by scrolling. Make sure the text overlay count matches the max frame number in the chart.

### Static elements
Elements without a `frame` property are always visible — axes, labels, tick marks. Only add `frame` to elements that should progressively reveal. Don't frame-tag the axes.

### fills with `<N>` (single frame only)
For TikZ fills that appear on one frame only (`\fill<3>[green]...`), use `frame: '3'` (no dash). The fill appears on frame 3 and disappears on frame 4. This is how Beamer's `\only<3>` works.

### Scroll distance
The overlay-frame pins for `count * 50%` viewport heights, where count = number of `.overlay` items. With 5 overlays, that's 250% scroll distance. If the page feels too long or too short, adjust the number of overlays or modify the scroll-animations.js `end` formula.
