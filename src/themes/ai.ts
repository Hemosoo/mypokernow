import { ZodError } from 'zod';
import { presets } from '../animation/registry';
import type { Street, Theme } from '../types';
import { signatureAnimations } from './defaults';
import { importTheme } from './transfer';
import { validateTheme } from './schema';

/**
 * Themes made outside the studio: by a friend (an exported file) or by an AI
 * assistant (a theme written from the prompt below). Imports stay strict about
 * what a theme may contain (colours, choices from fixed lists, known effects; no
 * code, no links, no images), but forgiving about how the answer arrives: wrapped
 * in prose or a code block, missing optional fields, or a colour in short form.
 */

const STREETS: Street[] = ['deal', 'flop', 'turn', 'river'];
const FACES = ['classic', 'modern', 'midnight', 'neon', 'sakura', 'pixel', 'holo', 'cipher', 'puppy', 'cat'];
const BACKS = ['crosshatch', 'diamonds', 'solid', 'paws', 'circuit', 'petals', 'pixel', 'holo', 'glyph', 'yarn'];
const EMBLEMS = ['spade', 'crown', 'laurel', 'paw', 'blossom', 'bolt', 'coin', 'sigil', 'chip', 'yarn', 'none'];
const MOTIFS = ['classic', 'puppy', 'cat', 'neon', 'sakura', 'arcade', 'rain', 'breach'];
const effectsFor = (street: Street): string => presets.filter((preset) => preset.supportedEvents.includes(street) && !preset.companion).map((preset) => preset.id).join(', ');

/** A prompt to paste into an AI assistant, followed by what you would like. Built from the real lists, so it never drifts. */
export function aiPrompt(): string {
  return `Design a theme for the "PokerNow Customizer" browser extension, which restyles the online poker table at pokernow.com.
Reply with ONE JSON object and nothing else. Use exactly these fields:

{
  "name": "Short theme name (max 80 characters)",
  "description": "One line about the look (max 140 characters)",
  "card": {
    "face": one of ${FACES.map((x) => `"${x}"`).join(', ')},
    "back": one of ${BACKS.map((x) => `"${x}"`).join(', ')},
    "backColor": "#rrggbb", "faceColor": "#rrggbb" (the card paper), "redColor": "#rrggbb" (hearts and diamonds),
    "blackColor": "#rrggbb" (spades and clubs), "borderColor": "#rrggbb",
    "borderRadius": 0 to 14, "shadow": 0 to 1,
    "aura": { "enabled": true or false, "color": "#rrggbb", "strength": 0 to 1 }
  },
  "table": {
    "feltColor": "#rrggbb", "railColor": "#rrggbb", "backgroundColor": "#rrggbb" (the room around the table),
    "trimColor": "#rrggbb" (the metal inlay, chips and accents),
    "inscription": "Up to 28 letters, numbers and simple punctuation written on the felt, or empty",
    "emblem": one of ${EMBLEMS.map((x) => `"${x}"`).join(', ')},
    "motif": one of ${MOTIFS.map((x) => `"${x}"`).join(', ')} (the felt pattern, chip marks and room particles)
  },
  "board": { "color": "#rrggbb", "highlight": "#rrggbb", "spacing": 0 to 32, "shadow": 0 to 1 },
  "animations": {
    "deal": { "preset": one of ${effectsFor('deal')} },
    "flop": { "preset": one of ${effectsFor('flop')} },
    "turn": { "preset": one of ${effectsFor('turn')} },
    "river": { "preset": one of ${effectsFor('river')} }
  }
}

Rules: every colour is a 6-digit hex code. Keep text on cards readable: the paper and the ink colours need strong contrast,
and red and black suits must look clearly different. Pick colours that belong together. "puppy" and "cat" faces and motifs
belong to rooms with a companion; prefer the others.

The theme I would like: `;
}

const hex = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value.trim());
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const long = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return long ? `#${long[1]!.toLowerCase()}` : value;
};
type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const pick = (source: unknown, keys: string[], colours: string[] = []): Loose => {
  const out: Loose = {};
  if (!isObject(source)) return out;
  for (const key of keys) if (key in source) out[key] = colours.includes(key) ? hex(source[key]) : source[key];
  return out;
};

/**
 * A bare theme (as an AI writes it) made whole: identifiers and dates added,
 * optional parts filled from the house defaults, unknown fields dropped, and any
 * effect that does not exist for its moment replaced by the house one.
 */
export function completeTheme(value: unknown): Theme {
  if (!isObject(value)) throw new Error('This is not a theme: expected an object with card, table and board.');
  const now = new Date().toISOString();
  const card = pick(value.card, ['face', 'back', 'backColor', 'faceColor', 'redColor', 'blackColor', 'borderColor', 'borderRadius', 'shadow', 'aura'], ['backColor', 'faceColor', 'redColor', 'blackColor', 'borderColor']);
  if (isObject(card.aura)) card.aura = { enabled: card.aura.enabled !== false, color: hex(card.aura.color ?? '#d4b274'), strength: card.aura.strength ?? 0.4 };
  const table = pick(value.table, ['feltColor', 'railColor', 'backgroundColor', 'trimColor', 'inscription', 'emblem', 'motif'], ['feltColor', 'railColor', 'backgroundColor', 'trimColor']);
  const board = pick(value.board, ['color', 'highlight', 'spacing', 'shadow'], ['color', 'highlight']);
  const house = signatureAnimations();
  const given = isObject(value.animations) ? value.animations : {};
  const animations = Object.fromEntries(STREETS.map((street) => {
    const id = isObject(given[street]) ? (given[street] as Loose).preset : given[street];
    const preset = typeof id === 'string' ? presets.find((item) => item.id === id && item.supportedEvents.includes(street)) : undefined;
    return [street, preset ? { preset: preset.id, parameters: {} } : house[street]];
  }));
  const theme = {
    version: 2, id: `theme-${crypto.randomUUID()}`, createdAt: now, updatedAt: now,
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 80) : 'Imported theme',
    ...(typeof value.description === 'string' && value.description.trim() ? { description: value.description.trim().slice(0, 140) } : {}),
    card: { borderRadius: 7, shadow: 0.5, ...card },
    table: { inscription: '', emblem: 'spade', motif: 'classic', ...table },
    board: { color: table.feltColor ?? '#0e5a41', highlight: table.trimColor ?? '#f2d08a', spacing: 12, shadow: 0.5, ...board },
    animations,
  };
  return validateTheme(theme);
}

/** Readable reasons a theme was refused, field by field. */
export function explain(error: unknown): string {
  if (error instanceof ZodError) {
    const issues = error.issues.slice(0, 3).map((issue) => `${issue.path.join('.') || 'theme'}: ${issue.message}`);
    return `This theme could not be used. ${issues.join('; ')}${error.issues.length > 3 ? `; and ${error.issues.length - 3} more` : ''}.`;
  }
  if (error instanceof SyntaxError) return 'This is not valid theme code. Paste the whole answer, from the first { to the last }.';
  return error instanceof Error ? error.message : 'This theme could not be used.';
}

/**
 * Import from text: an exported theme file, or a theme written by hand or by an
 * AI, possibly wrapped in prose or a code block.
 */
export async function importThemeText(text: string): Promise<Theme> {
  if (text.length > 6 * 1024 * 1024) throw new Error('Theme file exceeds 6 MB');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new SyntaxError('No theme found');
  const json = text.slice(start, end + 1);
  const parsed: unknown = JSON.parse(json);
  if (isObject(parsed) && parsed.format === 'pokernow-customizer') return importTheme(json);
  return completeTheme(isObject(parsed) && isObject(parsed.theme) ? parsed.theme : parsed);
}
