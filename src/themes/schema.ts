import { z } from 'zod';
import type { Library, Street, Theme } from '../types';
import { getPreset } from '../animation/registry';
import { builtInThemes, DEFAULT_THEME_ID, defaultEffects, LEGACY_BUILT_IN } from './defaults';

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const asset = z.string().regex(/^asset:[a-zA-Z0-9-]{1,80}$/).optional();
const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
// Felt lettering is drawn into an SVG; keep it to plain words and light punctuation.
const inscription = z.string().max(28).regex(/^[\p{L}\p{N} .,'’&·+\-]*$/u, 'Use letters, numbers and simple punctuation');
const assignment = z.object({
  preset: z.string().min(1).max(80),
  parameters: z.record(z.string().min(1).max(60), finite(-10000, 10000)).refine((value) => Object.keys(value).length <= 40, 'Too many parameters'),
}).strict();

export const themeSchema = z.object({
  version: z.literal(2), id: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/), name: z.string().trim().min(1).max(80),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  card: z.object({
    aura: z.object({enabled:z.boolean(),color:hex,strength:finite(0,1)}).strict().default({enabled:true,color:'#d4b274',strength:0.4}),
    face: z.enum(['classic', 'modern', 'midnight', 'native']), back: z.enum(['crosshatch', 'diamonds', 'solid', 'image']),
    backColor: hex, backImage: asset, faceColor: hex, redColor: hex, blackColor: hex, borderColor: hex,
    borderRadius: finite(0, 14), shadow: finite(0, 1),
  }).strict(),
  table: z.object({
    feltColor: hex, railColor: hex, backgroundColor: hex, backgroundImage: asset,
    trimColor: hex, inscription, emblem: z.enum(['spade', 'crown', 'laurel', 'none']),
  }).strict(),
  board: z.object({ color: hex, highlight: hex, spacing: finite(0, 32), shadow: finite(0, 1) }).strict(),
  animations: z.object({ deal: assignment, flop: assignment, turn: assignment, river: assignment }).strict(),
}).strict();

const effectsSchema = z.object({ chips: z.boolean(), celebrations: z.boolean(), moments: z.boolean(), ambience: z.boolean() }).strict();
export const librarySchema = z.object({
  version: z.literal(2),
  settings: z.object({ enabled: z.boolean(), reducedMotion: z.boolean(), speed: finite(0.25, 3), activeThemeId: z.string().min(1).max(100), effects: effectsSchema }).strict(),
  themes: z.array(themeSchema).min(1).max(100),
}).strict();

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Earlier themes carry the same appearance fields. Version 0 had no timestamps;
 * version 1 predates the table inlay, felt inscription and emblem. Never accept code.
 */
export function migrateTheme(value: unknown): unknown {
  if (!isObject(value)) return value;
  let theme: Loose = value;
  if (theme.version === 0) {
    const now = new Date().toISOString();
    theme = { ...theme, version: 1, createdAt: theme.createdAt ?? now, updatedAt: theme.updatedAt ?? now };
  }
  if (theme.version === 1) {
    const table = isObject(theme.table) ? theme.table : {};
    theme = { ...theme, version: 2, table: { trimColor: '#d4b274', inscription: '', emblem: 'spade', ...table } };
  }
  return theme;
}

export function validateTheme(value: unknown): Theme {
  const theme = themeSchema.parse(migrateTheme(value));
  for (const street of ['deal', 'flop', 'turn', 'river'] as Street[]) {
    const assigned = theme.animations[street];
    const preset = getPreset(assigned.preset);
    if (!preset || !preset.supportedEvents.includes(street)) throw new Error(`Unknown or incompatible preset for ${street}`);
    for (const [key, parameter] of Object.entries(assigned.parameters)) {
      const schema = preset.parameters.find((candidate) => candidate.key === key);
      if (!schema || parameter < schema.min || parameter > schema.max) throw new Error(`Invalid ${preset.name} parameter: ${key}`);
    }
  }
  return theme;
}

/**
 * A version 1 library keeps every theme its owner made. The rooms are added in
 * front, and become active only when the previous choice was an untouched
 * built-in, so a customised table is never replaced behind its owner's back.
 */
export function migrateLibrary(value: unknown): unknown {
  if (!isObject(value) || value.version !== 1 || !isObject(value.settings) || !Array.isArray(value.themes)) return value;
  const existing = value.themes.map(migrateTheme);
  const ids = new Set(existing.map((theme) => (isObject(theme) ? theme.id : undefined)));
  const rooms = structuredClone(builtInThemes).filter((theme) => !ids.has(theme.id));
  const themes = [...rooms, ...existing].slice(0, 100);
  const settings = value.settings;
  const active = existing.find((theme) => isObject(theme) && theme.id === settings.activeThemeId);
  const untouched = !isObject(active) || ((LEGACY_BUILT_IN.ids as readonly string[]).includes(String(active.id)) && active.updatedAt === LEGACY_BUILT_IN.timestamp);
  return {
    version: 2, themes,
    settings: { ...settings, effects: defaultEffects(), activeThemeId: untouched && rooms.length ? DEFAULT_THEME_ID : settings.activeThemeId },
  };
}

export function validateLibrary(value: unknown): Library {
  const library = librarySchema.parse(migrateLibrary(value)) as Library;
  library.themes = library.themes.map(validateTheme);
  if (new Set(library.themes.map((theme) => theme.id)).size !== library.themes.length) throw new Error('Duplicate theme IDs');
  if (!library.themes.some((theme) => theme.id === library.settings.activeThemeId)) library.settings.activeThemeId = library.themes[0]!.id;
  return library;
}
