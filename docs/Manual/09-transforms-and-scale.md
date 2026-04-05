# Transforms and Scale

## The Coordinate System

The library maps your math coordinates to SVG pixels using three parameters:

```js
render(svg, {
  scale: 200,        // 1 math unit = 200 SVG pixels
  originX: 100,      // SVG x-pixel of the math origin
  originY: 90,       // SVG y-pixel of the math origin
});
```

The conversion:
```
SVG_x = originX + math_x × scale
SVG_y = originY + math_y × scale    (for nodes/paths — y-down)
SVG_y = originY - math_y × scale    (for plots — auto-flipped)
```

### Choosing scale

- `scale: 200` — 1 unit = 200px. Good for graphs where x ranges 0 to 1.5.
- `scale: 4` — 1 unit = 4px. Good for economics graphs where Q ranges 0 to 120.
- `scale: 1` — raw SVG pixels. No transformation.

### Choosing origin

`originX`/`originY` places the (0, 0) point of your coordinate system. For a graph with axes:

```js
originX: 55,     // 55px from left edge — room for y-axis labels
originY: 325,    // 325px from top — room for title, space for the graph
```

## Per-Axis Scale

For different x and y scales:

```js
render(svg, {
  scaleX: 200,     // 1 x-unit = 200px
  scaleY: 100,     // 1 y-unit = 100px
  originX: 50, originY: 300,
});
```

`scaleX`/`scaleY` override `scale` when set.

## config.scale vs transformCanvas

Two ways to scale the entire diagram:

**`config.scale`** — scales coordinates before rendering. Nodes, paths, and plots all use scaled positions. This is the standard approach.

**`config.transformCanvas`** — applies an SVG `transform` attribute to the entire output group. This is a post-render visual scaling (like CSS zoom). Use it for quick size adjustments without changing coordinate math.

```js
render(svg, {
  transformCanvas: { scale: 0.8 },  // shrink entire output by 20%
});
```

## ViewBox

The library auto-computes the SVG `viewBox` to fit all content. You don't need to set it manually. The SVG element should have `width: 100%` in CSS to fill its container, and the viewBox handles aspect ratio.

If the auto-computed viewBox is wrong (content clipped), check that all elements have correct positions — elements at unexpected coordinates can inflate the viewBox.

## Node-Level Transforms

Individual nodes can be shifted, rotated, and scaled:

```js
{
  xshift: 10,           // move 10px right after positioning
  yshift: -5,           // move 5px up
  rotate: 45,           // rotate 45 degrees clockwise
  nodeScale: 1.5,       // scale up 150%
}
```

These are applied after position resolution — they're offsets on top of the computed position, not changes to the coordinate system.

## The Y Convention

The library has two y conventions that coexist:

| Context | Y direction | Example |
|---------|------------|---------|
| Node positions, path points | **y-down** (SVG native) | `{x: 5, y: 3}` → 3px below origin |
| Plot expr return values | **y-up** (math) | `x => 2*x` → line going up |

For economics where price (P) increases upward:
- **Nodes/paths:** negate y manually: `position: { x: Q, y: -P }`
- **Plots:** return P directly: `expr: Q => 60 - Q/2` (auto-flipped)

This dual convention avoids both: (a) forcing economists to think in SVG y-down for plots, and (b) adding overhead to the common case of SVG-native node positioning.

## Next

[Appendix: Reference Tables](appendix-reference.md) — all shapes, all properties, all arrow tips.
