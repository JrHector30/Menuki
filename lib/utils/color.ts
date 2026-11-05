/**
 * Converts a hex color (#RRGGBB or #RGB) into an RGB space-separated string "R G B"
 * suitable for Tailwind's `rgb(var(--accent-rgb) / <alpha-value>)`.
 */
export function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r} ${g} ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r} ${g} ${b}`;
  }
  return '225 29 72'; // fallback rose-600
}

/**
 * Calculates WCAG relative luminance of a color.
 */
function getLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    const norm = v / 255;
    return norm <= 0.03928 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/**
 * Calculates the contrast ratio against white (#FFFFFF).
 * Returns a value between 1 and 21.
 * WCAG AA requires at least 4.5:1 for normal body text.
 */
export function getWhiteContrastRatio(hex: string): number {
  const rgbStr = hexToRgb(hex);
  const [r, g, b] = rgbStr.split(' ').map(Number);
  const luminance = getLuminance(r, g, b);
  const whiteLuminance = 1.0;

  return (whiteLuminance + 0.05) / (luminance + 0.05);
}
