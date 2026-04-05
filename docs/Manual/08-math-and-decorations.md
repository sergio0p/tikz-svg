# Math and Decorations

## KaTeX Math in Labels

Any label containing `$...$` is rendered as math via KaTeX:

```js
{ label: '$P$' }                            // variable name
{ label: '$\\frac{1}{4}$' }                 // fraction
{ label: '$\\bar{P} = 30$' }                // accent + equation
{ label: 'Payoff: $\\frac{1-p}{p}$' }      // mixed text and math
{ label: '$\\text{Consumer Surplus}$' }     // text inside math mode
```

**Important:** In JavaScript strings, backslashes must be doubled: `\\frac`, `\\bar`, `\\text`.

### How it works

KaTeX renders math into HTML, which is embedded in SVG via `<foreignObject>`. The library measures the rendered output and auto-sizes the node to fit.

### Requirements

KaTeX JS must be loaded **synchronously** (not deferred) before `render()` is called:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
```

### Fallback

If KaTeX is not loaded, labels fall back to plain SVG `<text>` with the `$` delimiters stripped. No error — just plain text.

### Common KaTeX expressions

| Want | Write |
|------|-------|
| Fraction | `$\\frac{a}{b}$` |
| Subscript | `$P_1$` |
| Superscript | `$x^2$` |
| Greek | `$\\alpha$`, `$\\beta$`, `$\\pi$` |
| Bar/hat | `$\\bar{x}$`, `$\\hat{p}$` |
| Set | `$\\{1, 2, 3\\}$` |
| Inequality | `$P \\leq 30$` or `$P \\lt 30$` |
| Text inside math | `$\\text{CS}$` |

**SVG pitfall:** Never use `<` directly in math labels — it's interpreted as HTML. Use `\\lt` instead.

---

## Decorations

Decorations modify the visual appearance of paths — making them wavy, jittery, or rounded.

### The wavy style

The built-in `'wavy'` named style applies random-step decoration with rounded corners:

```js
{ type: 'edge', from: 'A', to: 'B', style: 'wavy' }
```

### Custom decoration

Apply a decoration object for full control:

```js
{
  decoration: {
    type: 'random steps',
    segmentLength: 8,       // distance between steps (default ~10)
    amplitude: 2,           // random offset range (default ~2.5)
  }
}
```

The decoration works on both edges and node borders:

```js
// Wavy node border
{ shape: 'rectangle', decoration: { type: 'random steps', segmentLength: 6, amplitude: 1.5 } }
```

### Deterministic rendering

Decorations use a seeded PRNG. Set `config.seed` for reproducible output:

```js
render(svg, {
  seed: 42,       // same seed = same wavy pattern every render
  draw: [...]
});
```

Without a seed, the pattern is random on each render.

### Rounded corners

`roundedCorners` smooths polygon corners with cubic Bezier arcs:

```js
// On a rectangle node
{ shape: 'rectangle', roundedCorners: 5, halfWidth: 40, halfHeight: 20 }

// On any polygon shape (diamond, trapezium, etc.)
{ shape: 'diamond', roundedCorners: 3 }
```

The value is the corner radius in pixels. Applied via the PGF-faithful Bezier approximation constant (KAPPA = 0.5523).

---

## Next

[Chapter 9: Transforms and Scale](09-transforms-and-scale.md) — coordinate system control.
