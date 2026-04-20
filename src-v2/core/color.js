/**
 * TikZ / xcolor color specifications — resolve to `#RRGGBB` hex.
 *
 * Supports:
 *   - `#rgb` / `#rrggbb` hex (pass through, lowercased).
 *   - Named colors from the curated TikZ set below.
 *   - TikZ mix syntax `X!p!Y` → p% of X + (100-p)% of Y, blended in 8-bit RGB.
 *   - Shorthand `X!p` → `X!p!white` (xcolor default).
 *
 * Unknown inputs (including multi-step mixes like `red!50!blue!25!black`,
 * CSS names not in the curated map, or malformed input) are returned
 * unchanged so the browser's CSS parser can handle them downstream.
 */

// TikZ / xcolor `base` and commonly used names. Keep this small and obvious.
// Add on demand — fail-graceful pass-through means we don't need to be complete.
const NAMED_COLORS = {
  red:       '#ff0000',
  green:     '#00ff00',
  blue:      '#0000ff',
  cyan:      '#00ffff',
  magenta:   '#ff00ff',
  yellow:    '#ffff00',
  black:     '#000000',
  white:     '#ffffff',
  gray:      '#808080',
  grey:      '#808080',
  darkgray:  '#404040',
  lightgray: '#bfbfbf',
  orange:    '#ff8000',
  purple:    '#bf0080',
  violet:    '#800080',
  brown:     '#bf8040',
  olive:     '#808000',
  lime:      '#bfff00',
  teal:      '#008080',
  pink:      '#ffbfbf',
};

/** Parse `#rgb` or `#rrggbb` into [r, g, b] 0-255. Returns null on miss. */
function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const h = m[1].length === 3
    ? m[1].split('').map(c => c + c).join('')
    : m[1];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Convert [r, g, b] back to `#rrggbb`, clamping and rounding. */
function rgbToHex(rgb) {
  const h = v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
}

/**
 * Resolve a color spec to a hex string when possible.
 * Non-strings and unrecognised syntax pass through.
 * @param {*} spec
 * @returns {*} resolved spec (hex on success; original value otherwise)
 */
export function resolveColor(spec) {
  if (spec == null || typeof spec !== 'string') return spec;
  const s = spec.trim();
  if (s === '') return spec;

  // Already hex.
  if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();

  // No mix operator: named lookup, otherwise pass-through.
  if (!s.includes('!')) {
    return NAMED_COLORS[s.toLowerCase()] ?? spec;
  }

  // Parse TikZ mix: X!p[!Y]  (exactly one bang means Y = white)
  const parts = s.split('!');
  if (parts.length === 2) parts.push('white');
  if (parts.length !== 3) return spec;  // multi-step chains — defer to browser

  const [xStr, pStr, yStr] = parts;
  const p = parseFloat(pStr);
  if (!Number.isFinite(p) || p < 0 || p > 100) return spec;

  const xHex = resolveColor(xStr);
  const yHex = resolveColor(yStr);
  const xRgb = hexToRgb(xHex);
  const yRgb = hexToRgb(yHex);
  if (!xRgb || !yRgb) return spec;

  const t = p / 100;
  return rgbToHex([
    xRgb[0] * t + yRgb[0] * (1 - t),
    xRgb[1] * t + yRgb[1] * (1 - t),
    xRgb[2] * t + yRgb[2] * (1 - t),
  ]);
}
