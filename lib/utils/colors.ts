/**
 * Converts a hex color (#RRGGBB or #RGB) into space-separated RGB channel values (e.g. "146 64 14")
 * for use in Tailwind CSS alpha-value variables: rgb(var(--accent-rgb) / <alpha-value>).
 */
export function hexToRgb(hex: string): string {
  if (!hex) return '15 23 42';

  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }

  if (clean.length !== 6) {
    return '15 23 42';
  }

  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return '15 23 42';
  }

  return `${r} ${g} ${b}`;
}
