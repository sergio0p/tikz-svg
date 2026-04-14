# Bug Report: Empty string label falls through to node ID

## Summary

Setting `label: ''` (empty string) on a node does not suppress the label — the node ID is displayed instead. The workaround is `label: ' '` (space), but this is unintuitive.

## Expected behavior

`label: ''` should mean "no label" — the node should render with no visible text.

## Actual behavior

Empty string is falsy in JavaScript, so the label resolution logic treats it as "no label provided" and falls back to displaying the node ID as the label text.

## How to reproduce

```js
render(svg, {
  states: {
    myDot: { position: {x: 100, y: 100}, shape: 'circle', radius: 5, label: '' }
  }
});
```

The node renders with "myDot" as visible text instead of being blank.

## Workaround

Use `label: ' '` (single space) instead of empty string.

## Suggested fix

In the label resolution code, check for `=== ''` explicitly rather than relying on truthiness:

```js
// Instead of:
const label = config.label || id;

// Use:
const label = (config.label != null && config.label !== undefined) ? config.label : id;
// or simply:
const label = 'label' in config ? config.label : id;
```

This also applies when `label: ''` is set via a named style — the style's empty string should propagate and suppress the ID fallback.

## Impact

High for decorative/marker nodes (dots, bullets, shape markers) where the ID is an internal reference, not user-facing text. Current behavior leaks implementation details into the visual output.

## Found in

Session using `src-v2/index.js` via GitHub Pages, 2026-04-13.

---

# Bug Report: Relative positioning in config.draw causes viewBox blowup

## Summary

Using relative positioning (e.g., `position: { 'below left': 'c00' }`) in `config.draw` nodes causes the diagram to shrink dramatically. The default `nodeDistance: 90` (pixels) doesn't account for `scale`, placing nodes far from the referenced node in scaled coordinates. The auto-computed viewBox expands to fit, shrinking all existing content.

## Expected behavior

Relative positioning in `config.draw` should respect the `scale` factor, or at least produce reasonable results with default `nodeDistance`.

## Actual behavior

With `scale: 65`, `nodeDistance: 90` translates to ~1.4 scaled units of offset. Combined with auto viewBox expansion, the diagram shrinks to a fraction of the screen. Even with explicit `distance` values, the viewBox auto-sizing means any node outside the existing bounding box reshapes the entire diagram.

## Additional complication

KaTeX label rendering appears to be async. Attempts to freeze the viewBox after `render()` are overwritten when KaTeX finishes and triggers a viewBox recalculation. A `setTimeout` workaround (500ms delay) can restore the viewBox, but this is fragile.

## Suggested improvements

1. `nodeDistance` should be in scaled units when `scale` is set, or a separate `nodeDistanceScaled` option should exist.
2. Consider a `viewBox` config option to let users fix the viewBox and opt out of auto-sizing.
3. Ensure viewBox is not recalculated after async KaTeX rendering.

## Found in

Session using `src-v2/index.js` via GitHub Pages, 2026-04-13.

---

# Bug Report: viewBox clips rightmost nodes (expandBBoxFromElement ignores stroke width)

## Summary

In the positioning blind audition demo (page 3, diamond layout), node D is clipped on its right edge. The right margin is visibly tighter than the left margin. A `padding: 60` workaround avoids clipping but the asymmetry remains.

## Root cause

`expandBBoxFromElement` in `src-v2/svg/emitter.js` (lines 86–89) reads the `<circle>` element's `r` attribute to compute the bounding box, but does not add half the stroke width. The visual extent of a stroked circle is `r + strokeWidth/2`, not `r`. With default `strokeWidth: 1.5`, that's 0.75px missing per side — small but cumulative with tight padding.

## How to reproduce

```js
render(svg, {
  onGrid: false, nodeDistance: 40,
  states: {
    a: { label: 'A', radius: 20 },
    b: { label: 'B', radius: 20, position: { 'above right': 'a' } },
    c: { label: 'C', radius: 20, position: { 'below right': 'a' } },
    d: { label: 'D', radius: 20, position: { 'below right': 'b' } },
  },
  edges: [],
});
```

Node D (rightmost) is clipped with default padding (40). Left margin around A is visibly larger than right margin around D.

## Suggested fix

In `expandBBoxFromElement`, when processing `<circle>`, `<ellipse>`, `<rect>`, and `<path>` children inside `<g>` groups, read the `stroke-width` attribute and expand the bbox by half that value in each direction.

## Found in

Session using `src-v2/index.js`, positioning blind audition demo, 2026-04-14.
