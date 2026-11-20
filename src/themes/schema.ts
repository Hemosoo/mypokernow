import { z } from 'zod';
import type { Library, Street, Theme } from '../types';
import { getPreset } from '../animation/registry';
import { SHOWPIECE_UPGRADES } from '../animation/presets/showpiece';
import { builtInThemes, DEFAULT_THEME_ID, defaultEffects, LEGACY_BUILT_IN, ROOMS_SINCE_V4, ROOMS_SINCE_V5, ROOMS_SINCE_V6, RETIRED_ROOMS, BUILT_IN_TIMESTAMP, CLASSIC_COLOURWAYS, builtInTheme, colourwayOf } from './defaults';

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
    face: z.enum(['classic', 'modern', 'midnight', 'native', 'puppy', 'neon', 'sakura', 'pixel', 'holo', 'cipher', 'cat']),
    back: z.enum(['crosshatch', 'diamonds', 'solid', 'image', 'paws', 'circuit', 'petals', 'pixel', 'holo', 'glyph', 'yarn']),
    backColor: hex, backImage: asset, faceColor: hex, redColor: hex, blackColor: hex, borderColor: hex,
    borderRadius: finite(0, 14), shadow: finite(0, 1),
  }).strict(),
  table: z.object({
    feltColor: hex, railColor: hex, backgroundColor: hex, backgroundImage: asset,
    trimColor: hex, inscription, emblem: z.enum(['spade', 'crown', 'laurel', 'paw', 'blossom', 'bolt', 'coin', 'sigil', 'chip', 'yarn', 'none']),
    motif: z.enum(['classic', 'puppy', 'neon', 'sakura', 'arcade', 'rain', 'breach', 'cat']).default('classic'),
  }).strict(),
  board: z.object({ color: hex, highlight: hex, spacing: finite(0, 32), shadow: finite(0, 1) }).strict(),
  animations: z.object({ deal: assignment, flop: assignment, turn: assignment, river: assignment }).strict(),
  description: z.string().trim().max(140).optional(),
  companion: z.object({
    kind: z.enum(['puppy', 'cat']), animations: z.boolean(),
    intensity: z.enum(['subtle', 'normal', 'playful']), scale: z.enum(['small', 'medium', 'large']),
    coat: z.enum(['golden', 'chocolate', 'cream', 'midnight', 'silver']).optional(), collar: z.enum(['ruby', 'sapphire', 'emerald', 'violet']).optional(),
    catCoat: z.enum(['grey', 'black', 'tabby', 'tuxedo', 'calico', 'bluegrey']).optional(), eyes: z.enum(['green', 'amber', 'blue']).optional(),
  }).strict().optional(),
}).strict();

const effectsSchema = z.object({ chips: z.boolean(), celebrations: z.boolean(), moments: z.boolean(), ambience: z.boolean(),
  winSize: z.enum(['quiet', 'balanced', 'loud']).default('balanced'), othersWins: z.boolean().default(true) }).strict();
export const librarySchema = z.object({
  version: z.literal(7),
  settings: z.object({ enabled: z.boolean(), reducedMotion: z.boolean(), speed: finite(0.25, 3), activeThemeId: z.string().min(1).max(100), effects: effectsSchema,
    favorites: z.array(z.string().regex(/^[a-z0-9.-]{1,80}$/)).max(64).default([]),
    recent: z.array(z.string().regex(/^[a-zA-Z0-9-]{1,100}$/)).max(12).default([]),
    mode: z.enum(['simple', 'studio']).optional() }).strict(),
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
    if (assigned.preset === 'random') {
      if (Object.keys(assigned.parameters).length) throw new Error('Random mode uses each animation’s default parameters');
      continue;
    }
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
function migrateLibraryV1(value: unknown): unknown {
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

/**
 * Version 3 makes the showpiece animations the house defaults. A street still
 * on the quieter house preset it replaces, at that preset's default tuning, is
 * moved to the showpiece; any other choice or tuning is left exactly as it was.
 * Runs once, as part of the version change.
 */
function upgradeAssignments(theme: unknown): unknown {
  if (!isObject(theme) || !isObject(theme.animations)) return theme;
  const animations: Loose = { ...theme.animations };
  for (const [street, assigned] of Object.entries(animations)) {
    if (!isObject(assigned) || typeof assigned.preset !== 'string' || !isObject(assigned.parameters)) continue;
    const replacement = SHOWPIECE_UPGRADES[assigned.preset], previous = getPreset(assigned.preset);
    if (!replacement || !previous) continue;
    const untuned = Object.entries(assigned.parameters).every(([key, value]) => previous.parameters.find((schema) => schema.key === key)?.default === value);
    if (untuned) animations[street] = { preset: replacement, parameters: {} };
  }
  return { ...theme, animations };
}

/**
 * Versions 4, 5 and 6 each add the rooms introduced with them (Puppy; Neon and
 * Sakura; Arcade, Rain District, Breach and Cat Café), once, after the owner's
 * own themes are kept. Nothing is replaced. The two win settings arrive with
 * version 6 through their schema defaults, so earlier effect choices stay as they were.
 */
function addNewRooms(library: Loose, rooms: string[], version: number): Loose {
  const themes = Array.isArray(library.themes) ? library.themes : [];
  const ids = new Set(themes.map((theme) => (isObject(theme) ? theme.id : undefined)));
  const added = structuredClone(builtInThemes).filter((theme) => rooms.includes(theme.id) && !ids.has(theme.id));
  return { ...library, version, themes: [...themes, ...added].slice(0, 100) };
}

/**
 * Version 7 folds Obsidian, Rouge, Riviera and Sakura into Classic (Monte Carlo)
 * as colourways. Only untouched copies go; a room its owner changed stays as their
 * own theme. If one of them was in use, Classic takes over wearing that room's
 * colourway, so the table looks exactly as before. Untouched Classic and Cat Café
 * are refreshed to their new versions (the Cat Café's cat is now a grey tabby).
 */
function foldClassicRooms(library: Loose): Loose {
  const themes = Array.isArray(library.themes) ? library.themes : [];
  const settings: Loose = isObject(library.settings) ? library.settings : {};
  // Untouched means never saved since it shipped and still exactly its shipped look; anything else is the owner's.
  const shipped = (theme: Loose): string | undefined => {
    if (theme.id === 'room-cat') { const cat = builtInTheme('room-cat')!; return JSON.stringify([theme.card, theme.table, theme.board, theme.animations]) === JSON.stringify([cat.card, cat.table, cat.board, cat.animations]) ? 'cat' : undefined; }
    return colourwayOf(theme as unknown as Theme)?.id;
  };
  const expected: Record<string, string> = { ...RETIRED_ROOMS, 'room-monte-carlo': 'emerald', 'room-cat': 'cat' };
  const untouched = (theme: unknown): theme is Loose => isObject(theme) && theme.updatedAt === BUILT_IN_TIMESTAMP && shipped(theme) === expected[String(theme.id)];
  const classicTheme = themes.find((theme) => isObject(theme) && theme.id === 'room-monte-carlo');
  const classicFree = classicTheme ? untouched(classicTheme) : themes.length < 100;
  let active = settings.activeThemeId, colourway: string | undefined;
  const kept: unknown[] = [];
  for (const theme of themes) {
    const id = isObject(theme) ? String(theme.id) : '';
    const retired = RETIRED_ROOMS[id];
    if (retired && untouched(theme)) {
      // The room in use only goes if Classic can take its look without losing the owner's own edits.
      if (id !== active) continue;
      if (classicFree) { colourway = retired; active = 'room-monte-carlo'; continue; }
    }
    if ((id === 'room-monte-carlo' || id === 'room-cat') && untouched(theme)) { kept.push(structuredClone(builtInTheme(id))); continue; }
    kept.push(theme);
  }
  // Classic is always there, unless the library is already full of the owner's own themes.
  if (!kept.some((theme) => isObject(theme) && theme.id === 'room-monte-carlo') && kept.length < 100) kept.unshift(structuredClone(builtInTheme('room-monte-carlo')));
  if (colourway) {
    const look = CLASSIC_COLOURWAYS.find((item) => item.id === colourway)?.look;
    const index = kept.findIndex((theme) => isObject(theme) && theme.id === 'room-monte-carlo');
    if (look && index >= 0) kept[index] = { ...(kept[index] as Loose), ...structuredClone(look) };
  }
  const ids = new Set(kept.map((theme) => (isObject(theme) ? theme.id : undefined)));
  const recent = Array.isArray(settings.recent) ? settings.recent.filter((id) => ids.has(id)) : settings.recent;
  return { ...library, version: 7, themes: kept, settings: { ...settings, activeThemeId: active, ...(recent ? { recent } : {}) } };
}

export function migrateLibrary(value: unknown): unknown {
  let library = migrateLibraryV1(value);
  if (isObject(library) && library.version === 2 && Array.isArray(library.themes)) library = { ...library, version: 3, themes: library.themes.map(upgradeAssignments) };
  if (isObject(library) && library.version === 3 && Array.isArray(library.themes)) library = addNewRooms(library, ROOMS_SINCE_V4, 4);
  if (isObject(library) && library.version === 4 && Array.isArray(library.themes)) library = addNewRooms(library, ROOMS_SINCE_V5, 5);
  if (isObject(library) && library.version === 5 && Array.isArray(library.themes)) library = addNewRooms(library, ROOMS_SINCE_V6, 6);
  if (isObject(library) && library.version === 6 && Array.isArray(library.themes)) library = foldClassicRooms(library);
  return library;
}

export function validateLibrary(value: unknown): Library {
  const library = librarySchema.parse(migrateLibrary(value)) as Library;
  library.themes = library.themes.map(validateTheme);
  if (new Set(library.themes.map((theme) => theme.id)).size !== library.themes.length) throw new Error('Duplicate theme IDs');
  if (!library.themes.some((theme) => theme.id === library.settings.activeThemeId)) library.settings.activeThemeId = library.themes[0]!.id;
  return library;
}
