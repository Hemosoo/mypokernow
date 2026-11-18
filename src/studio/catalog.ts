import { presets } from '../animation/registry';
import type { AnimationPreset } from '../animation/registry';
import type { Street, Theme } from '../types';

export const STREETS: Street[] = ['deal', 'flop', 'turn', 'river'];
export const streetName = (street: Street): string => street === 'deal' ? 'Initial deal' : street[0]!.toUpperCase() + street.slice(1);
export const streetShort = (street: Street): string => street === 'deal' ? 'Deal' : street[0]!.toUpperCase() + street.slice(1);

/** How an effect feels, which is how the shelves group them. */
export type Mood = 'showstopper' | 'clean' | 'puppy';
const MOODS: Record<string, Mood> = {
  'deal.dealer-flick': 'clean', 'deal.orbit': 'showstopper', 'deal.pitch': 'clean', 'deal.storm': 'showstopper', 'deal.puppy': 'puppy',
  'flop.triple-spread': 'clean', 'flop.triple-orbit': 'showstopper', 'flop.crystal-spread': 'showstopper', 'flop.cascade': 'clean',
  'flop.grand': 'showstopper', 'flop.puppy': 'puppy',
  'reveal.slam': 'showstopper', 'reveal.fragment-assembly': 'showstopper', 'reveal.crystallization': 'showstopper',
  'reveal.turnover': 'clean', 'reveal.squeeze': 'clean', 'reveal.spotlight': 'showstopper', 'reveal.showdown': 'showstopper',
  'turn.puppy': 'puppy', 'river.puppy': 'puppy',
};
export const moodOf = (preset: AnimationPreset): Mood => preset.companion ? 'puppy' : MOODS[preset.id] ?? 'clean';
export const SHELVES: { mood: Mood; title: string; note: string }[] = [
  { mood: 'showstopper', title: 'Showstoppers', note: 'Big, cinematic moments.' },
  { mood: 'clean', title: 'Clean and quick', note: 'Elegant, out of the way, fast.' },
  { mood: 'puppy', title: 'With the puppy', note: 'The puppy performs it. In other rooms it drops in just for this.' },
];

/** Short display names; a few registry names carry their technique in the title. */
export const presetName = (preset: AnimationPreset): string =>
  preset.id === 'reveal.slam' ? 'Slam' : preset.id === 'reveal.crystallization' ? 'Crystallization' : preset.name;

/** Recorded on the replica table by scripts/capture-media.mjs. */
export const posterUrl = (id: string): string => `./media/${id}.webp`;
export const clipUrl = (id: string): string => `./media/${id}.webm`;

export const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
export const presetsFor = (street: Street): AnimationPreset[] => presets.filter((preset) => preset.supportedEvents.includes(street));

/** The effect a street will run, for display. Random shows as Shuffle. */
export function assignmentLabel(theme: Theme, street: Street): { name: string; preset?: AnimationPreset; shuffle: boolean } {
  const id = theme.animations[street].preset;
  if (id === 'random') return { name: 'Shuffle', shuffle: true };
  const preset = presets.find((item) => item.id === id);
  return { name: preset ? presetName(preset) : 'Default', preset, shuffle: false };
}

/* ------------------------------------------------------------------ colour */

export interface Hsl { h: number; s: number; l: number }
export function hexToHsl(hex: string): Hsl {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '1c6a4e';
  const r = parseInt(value.slice(0, 2), 16) / 255, g = parseInt(value.slice(2, 4), 16) / 255, b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}
export function hslToHex({ h, s, l }: Hsl): string {
  const sat = Math.max(0, Math.min(100, s)) / 100, light = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + ((h % 360) + 360) % 360 / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * One point on the mood pad: hue across, depth down. Everything else about the
 * table's colour is worked out from it so the pieces always belong together.
 */
export interface Mood2D { hue: number; depth: number }
export const moodFromFelt = (felt: string): Mood2D => {
  const { h, l } = hexToHsl(felt);
  return { hue: h, depth: Math.max(0, Math.min(1, (40 - l) / 28)) };
};
export function paletteFromMood({ hue, depth }: Mood2D): { felt: string; rail: string; surroundings: string; back: string; board: string } {
  const lightness = 40 - depth * 28; // 40% (bright felt) to 12% (near black)
  const saturation = 64 - depth * 30;
  return {
    felt: hslToHex({ h: hue, s: saturation, l: lightness }),
    rail: hslToHex({ h: hue + 8, s: 22, l: 8 + (1 - depth) * 3 }),
    surroundings: hslToHex({ h: hue, s: 18, l: 5 }),
    back: hslToHex({ h: hue, s: saturation + 4, l: Math.max(9, lightness - 10) }),
    board: hslToHex({ h: hue, s: saturation * 0.6, l: Math.max(6, lightness - 9) }),
  };
}
export const METALS: { name: string; trim: string; aura: string }[] = [
  { name: 'Gold', trim: '#d4b274', aura: '#e8c98a' },
  { name: 'Silver', trim: '#c9ccd2', aura: '#dfe6f2' },
  { name: 'Rose gold', trim: '#d8a291', aura: '#f0b9a6' },
  { name: 'Bronze', trim: '#b98a5a', aura: '#d9a46a' },
];

/** Studio chrome takes its hue from the felt and its accent from the table's metal. */
export function studioTint(theme: Theme): Record<string, string> {
  const felt = hexToHsl(theme.table.feltColor);
  const trim = hexToHsl(theme.table.trimColor);
  const accent = hslToHex({ h: trim.h, s: Math.min(70, Math.max(trim.s, 28)), l: Math.max(66, Math.min(78, trim.l)) });
  return { '--hue': String(Math.round(felt.h)), '--tint': String(felt.s < 8 ? 4 : 12), '--accent': accent };
}
