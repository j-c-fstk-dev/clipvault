/** Small helpers for deriving theme colors from the accent color. */

const parseHex = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map(c => c + c).join('') : value.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (rgb: number[]) =>
  `#${rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** `hex` with `alpha` (0–1) as an 8-digit hex color. */
export const withAlpha = (hex: string, alpha: number) =>
  toHex(parseHex(hex)) + Math.round(alpha * 255).toString(16).padStart(2, '0');

/** `hex` mixed with white by `amount` (0–1). */
export const lighten = (hex: string, amount: number) =>
  toHex(parseHex(hex).map(v => v + (255 - v) * amount));

/** `hex` with its hue turned by `degrees`. */
export const rotateHue = (hex: string, degrees: number) => {
  const [r, g, b] = parseHex(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return hex;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + degrees + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([r1, g1, b1].map(v => (v + m) * 255));
};
