/** Small colour toolkit shared by every piece of generated artwork. */
export interface Rgb { r: number; g: number; b: number }

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

export function safeHex(value: string, fallback = '#7f7f7f'): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

export function parseHex(value: string): Rgb {
  const hex = safeHex(value);
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Linear blend in sRGB; `amount` 0 → a, 1 → b. */
export function mix(a: string, b: string, amount: number): string {
  const x = parseHex(a), y = parseHex(b), t = clamp(amount);
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export const lighten = (color: string, amount: number): string => mix(color, '#ffffff', amount);
export const darken = (color: string, amount: number): string => mix(color, '#000000', amount);

export function rgba(color: string, alpha: number): string {
  const { r, g, b } = parseHex(color);
  return `rgba(${r},${g},${b},${Number(clamp(alpha).toFixed(3))})`;
}

/** Relative luminance, 0 (black) to 1 (white). */
export function luminance(color: string): number {
  const { r, g, b } = parseHex(color);
  const linear = (value: number) => { const c = value / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function toHsl(color: string): { h: number; s: number; l: number } {
  const { r, g, b } = parseHex(color);
  const x = r / 255, y = g / 255, z = b / 255, max = Math.max(x, y, z), min = Math.min(x, y, z), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === x ? (y - z) / d + (y < z ? 6 : 0) : max === y ? (z - x) / d + 2 : (x - y) / d + 4;
  return { h: h * 60, s, l };
}

export function fromHsl(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360 / 360, sat = clamp(s), light = clamp(l);
  if (sat === 0) return toHex({ r: light * 255, g: light * 255, b: light * 255 });
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat, p = 2 * light - q;
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    return u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p;
  };
  return toHex({ r: channel(hue + 1 / 3) * 255, g: channel(hue) * 255, b: channel(hue - 1 / 3) * 255 });
}

/** Shift lightness while keeping hue and saturation, for material shading. */
export function shade(color: string, lightness: number): string {
  const { h, s, l } = toHsl(color);
  return fromHsl(h, s, clamp(l + lightness));
}

/**
 * Five stops of a polished metal built from one accent colour: deep shadow,
 * body, bright body, specular highlight and warm reflection.
 */
export function metal(color: string): { deep: string; low: string; mid: string; high: string; spec: string } {
  return { deep: shade(color, -0.36), low: shade(color, -0.18), mid: safeHex(color), high: shade(color, 0.14), spec: mix(shade(color, 0.26), '#ffffff', 0.45) };
}

export const svgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
