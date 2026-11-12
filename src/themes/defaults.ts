import type { AnimationAssignment, EffectSettings, Library, Street, Theme } from '../types';

const timestamp = '2026-11-11T00:00:00.000Z';

/** The house choreography: quick where the game is quick, slow where it matters. */
export const signatureAnimations = (): Record<Street, AnimationAssignment> => ({
  deal: { preset: 'deal.storm', parameters: {} },
  flop: { preset: 'flop.grand', parameters: {} },
  turn: { preset: 'reveal.spotlight', parameters: {} },
  river: { preset: 'reveal.showdown', parameters: {} },
});

export const defaultEffects = (): EffectSettings => ({ chips: true, celebrations: true, moments: true, ambience: true });

interface RoomSpec {
  id: string; name: string;
  felt: string; rail: string; trim: string; room: string;
  back: string; backStyle: Theme['card']['back'];
  face: Theme['card']['face']; paper: string; red: string; black: string; edge: string;
  emblem: Theme['table']['emblem']; glow: string;
}

function room(spec: RoomSpec): Theme {
  return {
    version: 2, id: spec.id, name: spec.name, createdAt: timestamp, updatedAt: timestamp,
    card: { aura: { enabled: true, color: spec.trim, strength: 0.4 }, face: spec.face, back: spec.backStyle, backColor: spec.back, faceColor: spec.paper, redColor: spec.red, blackColor: spec.black, borderColor: spec.edge, borderRadius: 7, shadow: 0.5 },
    table: { feltColor: spec.felt, railColor: spec.rail, backgroundColor: spec.room, trimColor: spec.trim, inscription: '', emblem: spec.emblem, motif: 'classic' },
    board: { color: spec.felt, highlight: spec.glow, spacing: 12, shadow: 0.5 },
    animations: signatureAnimations(),
  };
}

/**
 * Four rooms, one house. Every room shares the same materials (padded leather,
 * polished inlay, worsted felt) and differs in palette and temperature.
 */
export const builtInThemes: Theme[] = [
  room({ id: 'room-monte-carlo', name: 'Monte Carlo', felt: '#0e5a41', rail: '#1c1613', trim: '#d4b274', room: '#0a0e0c',
    back: '#0c3a2c', backStyle: 'crosshatch', face: 'classic', paper: '#fbf7ec', red: '#b8242f', black: '#16181b', edge: '#e6dcc4', emblem: 'spade', glow: '#f2d08a' }),
  room({ id: 'room-obsidian', name: 'Obsidian', felt: '#20252b', rail: '#0d0e10', trim: '#cfd5dd', room: '#060708',
    back: '#101216', backStyle: 'diamonds', face: 'modern', paper: '#f7f7f5', red: '#c92b3c', black: '#111316', edge: '#d9dce0', emblem: 'crown', glow: '#e9eef5' }),
  room({ id: 'room-rouge', name: 'Rouge', felt: '#6a1626', rail: '#201210', trim: '#e2bd7c', room: '#0c0607',
    back: '#4b0f1b', backStyle: 'crosshatch', face: 'classic', paper: '#fcf6ea', red: '#a81c2a', black: '#191415', edge: '#ead9bd', emblem: 'laurel', glow: '#ffd995' }),
  room({ id: 'room-riviera', name: 'Riviera', felt: '#133a60', rail: '#10171f', trim: '#dea97f', room: '#05080d',
    back: '#0e2d4d', backStyle: 'diamonds', face: 'modern', paper: '#f8f7f3', red: '#c2303d', black: '#101821', edge: '#dcdfe4', emblem: 'spade', glow: '#ffcfa6' }),
];

/**
 * Puppy: a whole room built around a 3D puppy who deals, reveals, sweeps the
 * chips and celebrates. Warm caramel leather, soft forest felt with paw prints,
 * bone-and-paw chips and a matching deck.
 */
export const puppyTheme: Theme = {
  ...room({ id: 'room-puppy', name: 'Puppy', felt: '#2f6b52', rail: '#6b3f24', trim: '#e8b86a', room: '#170f0a',
    back: '#c8794a', backStyle: 'paws', face: 'puppy', paper: '#fffaf0', red: '#c8394a', black: '#2a211c', edge: '#ecd9bc', emblem: 'paw', glow: '#ffd79a' }),
  description: 'A playful 3D puppy brings your poker table to life.',
  animations: { deal: { preset: 'deal.puppy', parameters: {} }, flop: { preset: 'flop.puppy', parameters: {} },
    turn: { preset: 'turn.puppy', parameters: {} }, river: { preset: 'river.puppy', parameters: {} } },
  companion: { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium' },
};
puppyTheme.table = { ...puppyTheme.table, motif: 'puppy' };
puppyTheme.card = { ...puppyTheme.card, borderRadius: 9, aura: { enabled: true, color: '#ffd79a', strength: 0.45 } };
builtInThemes.push(puppyTheme);
/** Rooms added after library version 3; existing libraries receive them once. */
export const ROOMS_SINCE_V4: string[] = ['room-puppy'];

export const DEFAULT_THEME_ID = builtInThemes[0]!.id;
export function createDefaultTheme(): Theme { return structuredClone(builtInThemes[0]!); }
export function createDefaultLibrary(): Library {
  return { version: 4, settings: { enabled: true, reducedMotion: false, speed: 1, activeThemeId: DEFAULT_THEME_ID, effects: defaultEffects() }, themes: structuredClone(builtInThemes) };
}

/** Identifiers and timestamp of the three themes shipped before the rooms existed. */
export const LEGACY_BUILT_IN = { ids: ['theme-aurora', 'theme-midnight', 'theme-velvet'], timestamp: '2026-10-22T00:00:00.000Z' } as const;
