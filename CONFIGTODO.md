# Config TODO

## Project-Level Defaults

Right now every `render()` call repeats shared config (`transformCanvas`, `padding`, `stateStyle`, `edgeStyle`). Two approaches:

1. **Library feature: `setDefaults()`** — a `setDefaults({ padding: 10, transformCanvas: { scale: 1.2 } })` call at the top that merges into every subsequent `render()`. Per-call config overrides as needed.

2. **User-side workaround: spread operator** — no library change needed:
   ```js
   const base = { padding: 10, transformCanvas: { scale: 1.2 }, stateStyle: style(), edgeStyle: edge };
   render(el, { ...base, nodeDistance: 90, states: { ... }, edges: [...] });
   ```

Option 1 is cleaner long-term. Option 2 works today with zero library changes.
