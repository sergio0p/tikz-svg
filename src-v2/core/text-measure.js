/**
 * Text dimension estimation for auto-sizing nodes.
 *
 * Uses KaTeX rendered dimensions when available, otherwise falls back
 * to character-width heuristic (0.6 × fontSize per character).
 *
 * Source: pgfmoduleshapes.code.tex lines 938–972
 *   x = max(\wd\pgfnodeparttextbox + 2*innerSep, minimumWidth)
 */

import { isMathLabel, stripMath, isKaTeXAvailable, createLabelContent } from './katex-renderer.js';

/**
 * Estimate the pixel dimensions of a text label.
 *
 * @param {string|null} label - text content (supports '\\\\' line breaks and $...$ math)
 * @param {number} fontSize - font size in px
 * @param {number} [textWidth=0] - if > 0, wrap text at this width
 * @returns {{ width: number, height: number }}
 */
export function estimateTextDimensions(label, fontSize, textWidth = 0) {
  if (label == null || label === '') {
    return { width: 0, height: 0 };
  }

  const str = String(label);

  // If math label and KaTeX available, use actual rendered dimensions
  if (isMathLabel(str) && isKaTeXAvailable()) {
    const content = createLabelContent(str, { fontSize, fontFamily: 'serif', color: '#000' });
    return { width: content.width, height: content.height };
  }

  // Strip $ delimiters for character-count estimation
  const measured = isMathLabel(str) ? stripMath(str) : str;
  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize * 1.2;

  // Split on explicit line breaks
  const explicitLines = measured.split('\\\\');

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
