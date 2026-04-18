
**Pipeline: TikZ → SVG animation conversion**

1. Check if a PDF exists for the source `.tex` file. If not, compile it with `xelatex` to produce one.
2. Read the PDF using `pymupdf` or `pdf2image` to see the reference animation frames.
3. Read the source `.tex` to understand the TikZ code producing those frames.
4. Implement the animation in the target HTML file using SVG/CSS/JS (`src-3`). Start with just ONE step/frame — get that right before moving on.
5. Open the localhost page in Chrome via Selenium, take screenshots, and compare against the PDF reference. Iterate until they match.
6. Work autonomously. When you think you've nailed it, stop.
7. If we're running low on session limits, stop at a clean checkpoint and summarize where you left off so we can resume.
8. Only if you hit significant stumbling blocks, write a brief `.md` summary of what went wrong and how you solved it (or didn't), so we can learn from it for future conversions.

---