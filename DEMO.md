# Demo Policy: Blind Audition Format

All visual demos for the tikz-svg library follow a **blind audition** format — a side-by-side comparison where the viewer cannot tell which output comes from TikZ/LaTeX and which comes from our JavaScript library until the very end.

## Structure

Each demo HTML file has multiple pages/sections:

1. **Comparison pages** — Each page shows two renderings side by side:
   - One is the TikZ/LaTeX PDF output (converted to PNG)
   - The other is our tikz-svg library's SVG output
   - Labeled only as **"A"** and **"B"** (or **"Left"** and **"Right"**)
   - **No labels, hints, or spoilers** about which is which
   - The assignment of library vs TikZ to left/right may vary between pages

2. **Reveal page** (last page only) — States which side is the tikz-svg library output. Contains no demo content, only the reveal.

## How to Build a Demo

### 1. Create separate TikZ source files

Write one `.tex` file per example in `tex/`, each as a `standalone` document:

```tex
\documentclass[border=10pt]{standalone}
\usepackage{tikz}
\usetikzlibrary{shapes.callouts, shapes.symbols}
\begin{document}
\begin{tikzpicture}
\node[rectangle callout, draw, thick, fill=blue!10,
      callout absolute pointer={(3,-1)},
      callout pointer width=0.25cm,
      minimum width=2.5cm, minimum height=1cm]
  {Hello!};
\fill[red] (3,-1) circle (2pt);
\end{tikzpicture}
\end{document}
```

Use separate files (not multi-page) because `sips` only converts page 1.

### 2. Compile and convert to PNG

**Always use ImageMagick** (`magick`) for PDF-to-PNG conversion. It renders at native DPI, producing sharp PNGs that match SVG quality in the blind audition. `sips` rasterizes at 72 DPI then upscales, which makes the TikZ side visibly blurrier — a dead giveaway.

```bash
cd tex
for f in callout-1-rect-right callout-2-ellipse callout-3-cloud; do
  pdflatex -interaction=nonstopmode "$f.tex"
  magick -density 300 "$f.pdf" -background white -alpha remove "$f.png"
done
```

### 3. Create the HTML demo

In `examples-v2/`, create an HTML file that:
- Imports and renders using `src-v2/index.js`
- Shows PNG images from `tex/` alongside the SVG output
- Uses the blind audition layout (A vs B, no spoilers)
- **Randomizes** which side (A or B) is the library on each page
- Ends with a reveal page listing which side was the library per page

See `examples-v2/callout-blind-audition.html` as the reference implementation.

### 4. Serve and compare

```bash
npx http-server /path/to/tikz-svg -p 8080 -c-1
open http://localhost:8080/examples-v2/callout-blind-audition.html
```

## Randomization Rules

Randomization **must** happen at runtime in JavaScript, never hardcoded in HTML:

1. **Per-example independence.** Each comparison page flips its own coin (`Math.random() < 0.5`). One page may show the library on the left while another shows it on the right — they are independent.
2. **Re-randomize on every page load.** Refreshing the browser must produce a new random assignment. Do not bake side assignments into the HTML source.
3. **Dynamic reveal.** The reveal page must be built from the same random assignments, not a static list.

### Implementation pattern

Each `.comparison` contains two `.side` children. One wraps an `<svg>` (library), the other wraps an `<img>` (TikZ PNG). On `DOMContentLoaded`, a script iterates every `.comparison`, flips a coin, and swaps the two `.side` elements if true. The reveal page reads the resulting order to report which side was which.

The HTML should not assign A/B labels to specific content — the script assigns them after shuffling.

## Other Rules

- **No spoilers.** Never label outputs as "TikZ" or "tikz-svg" on comparison pages.
- **No bias.** Don't style one side differently to make it look better.
- **Identical parameters.** Both sides must use the same dimensions, colors, fonts, and layout as closely as possible.
- **Reveal only on the last page.**
