/**
 * Text dimension estimation for auto-sizing nodes.
 *
 * TikZ uses TeX's typesetting engine to measure exact text dimensions.
 * We use a character-width heuristic: 0.6 × fontSize per character.
 * This is sufficient for layout — exact glyph metrics require KaTeX (future).
 *
 * Source: pgfmoduleshapes.code.tex lines 938–972
 *   x = max(\wd\pgfnodeparttextbox + 2*innerSep, minimumWidth)
 */

/**
 * Estimate the pixel dimensions of a text label.
 *
 * @param {string|null} label - text content (supports '\\\\' line breaks)
 * @param {number} fontSize - font size in px
 * @param {number} [textWidth=0] - if > 0, wrap text at this width
 * @returns {{ width: number, height: number }}
 */
export function estimateTextDimensions(label, fontSize, textWidth = 0) {
  if (label == null || label === '') {
    return { width: 0, height: 0 };
  }

  const str = String(label);
  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize * 1.2;

  // Split on explicit line breaks
  const explicitLines = str.split('\\\\');

  if (textWidth > 0) {
    // With textWidth: wrap lines and use textWidth as the box width
    const maxChars = Math.max(1, Math.floor(textWidth / charWidth));
    let totalLines = 0;
    for (const line of explicitLines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        totalLines += 1;
        continue;
      }
      totalLines += Math.max(1, Math.ceil(trimmed.length / maxChars));
    }
    return {
      width: textWidth,
      height: totalLines * lineHeight,
    };
  }

  // Without textWidth: measure natural width of each line
  let maxWidth = 0;
  for (const line of explicitLines) {
    const w = line.trim().length * charWidth;
    if (w > maxWidth) maxWidth = w;
  }

  return {
    width: maxWidth,
    height: explicitLines.length * lineHeight,
  };
}
