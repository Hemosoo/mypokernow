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
  id: string; name: string; description: string;
  felt: string; rail: string; trim: string; room: string;
  back: string; backStyle: Theme['card']['back'];
  face: Theme['card']['face']; paper: string; red: string; black: string; edge: string;
  emblem: Theme['table']['emblem']; glow: string;
  motif?: Theme['table']['motif'];
  /** Each room has its own pace; absent means the house choreography. */
  animations?: [deal: string, flop: string, turn: string, river: string];
  radius?: number;
}

function room(spec: RoomSpec): Theme {
  return {
    version: 2, id: spec.id, name: spec.name, description: spec.description, createdAt: timestamp, updatedAt: timestamp,
    card: { aura: { enabled: true, color: spec.trim, strength: 0.4 }, face: spec.face, back: spec.backStyle, backColor: spec.back, faceColor: spec.paper, redColor: spec.red, blackColor: spec.black, borderColor: spec.edge, borderRadius: spec.radius ?? 7, shadow: 0.5 },
    table: { feltColor: spec.felt, railColor: spec.rail, backgroundColor: spec.room, trimColor: spec.trim, inscription: '', emblem: spec.emblem, motif: spec.motif ?? 'classic' },
    board: { color: spec.felt, highlight: spec.glow, spacing: 12, shadow: 0.5 },
    animations: spec.animations ? {
      deal: { preset: spec.animations[0], parameters: {} }, flop: { preset: spec.animations[1], parameters: {} },
      turn: { preset: spec.animations[2], parameters: {} }, river: { preset: spec.animations[3], parameters: {} },
    } : signatureAnimations(),
  };
}

/**
 * The house rooms. Each has its own palette, deck, emblem and pace: Monte Carlo
 * is the signature choreography, Obsidian is restrained, Rouge is theatrical
 * and Riviera is fluid. Neon, Sakura and Puppy add their own felt, deck and
 * ambience as well.
 */
export const builtInThemes: Theme[] = [
  room({ id: 'room-monte-carlo', name: 'Monte Carlo', description: 'Green worsted felt, a gold inlay and classic serif cards.', felt: '#0e5a41', rail: '#1c1613', trim: '#d4b274', room: '#0a0e0c',
    back: '#0c3a2c', backStyle: 'crosshatch', face: 'classic', paper: '#fbf7ec', red: '#b8242f', black: '#16181b', edge: '#e6dcc4', emblem: 'spade', glow: '#f2d08a' }),
  room({ id: 'room-obsidian', name: 'Obsidian', description: 'Charcoal felt and brushed silver, with clean modern cards.', felt: '#20252b', rail: '#0d0e10', trim: '#cfd5dd', room: '#060708',
    back: '#101216', backStyle: 'solid', face: 'modern', paper: '#f7f7f5', red: '#c92b3c', black: '#111316', edge: '#d9dce0', emblem: 'crown', glow: '#e9eef5',
    animations: ['deal.dealer-flick', 'flop.triple-spread', 'reveal.turnover', 'reveal.turnover'], radius: 4 }),
  room({ id: 'room-rouge', name: 'Rouge', description: 'Deep claret felt, warm gold and a laurel emblem.', felt: '#6a1626', rail: '#201210', trim: '#e2bd7c', room: '#0c0607',
    back: '#4b0f1b', backStyle: 'crosshatch', face: 'classic', paper: '#fcf6ea', red: '#a81c2a', black: '#191415', edge: '#ead9bd', emblem: 'laurel', glow: '#ffd995',
    animations: ['deal.orbit', 'flop.triple-orbit', 'reveal.slam', 'reveal.showdown'] }),
  room({ id: 'room-riviera', name: 'Riviera', description: 'Midnight-blue felt with a rose-gold inlay.', felt: '#133a60', rail: '#10171f', trim: '#dea97f', room: '#05080d',
    back: '#0e2d4d', backStyle: 'diamonds', face: 'modern', paper: '#f8f7f3', red: '#c2303d', black: '#101821', edge: '#dcdfe4', emblem: 'spade', glow: '#ffcfa6',
    animations: ['deal.pitch', 'flop.cascade', 'reveal.squeeze', 'reveal.spotlight'], radius: 9 }),
  room({ id: 'room-neon', name: 'Neon', description: 'Night-city felt with a lit grid, glowing cards and digital reveals.', felt: '#121a3a', rail: '#07070d', trim: '#43e3ff', room: '#05040c',
    back: '#140d2e', backStyle: 'circuit', face: 'neon', paper: '#0c0e18', red: '#ff4f9a', black: '#63e6ff', edge: '#313a66', emblem: 'bolt', glow: '#8af4ff',
    motif: 'neon', animations: ['deal.storm', 'flop.crystal-spread', 'reveal.fragment-assembly', 'reveal.crystallization'], radius: 6 }),
  room({ id: 'room-sakura', name: 'Sakura', description: 'Dusk-blue felt, cherry wood, falling petals and gentle reveals.', felt: '#2d3c5a', rail: '#2b1a1c', trim: '#e9b2bf', room: '#110c12',
    back: '#8e3a55', backStyle: 'petals', face: 'sakura', paper: '#fcf5ef', red: '#c23c5c', black: '#2a2a3e', edge: '#ecd8d3', emblem: 'blossom', glow: '#ffd0dc',
    motif: 'sakura', animations: ['deal.pitch', 'flop.cascade', 'reveal.turnover', 'reveal.squeeze'], radius: 10 }),
];

/**
 * Puppy: a whole room built around a 3D puppy who deals, reveals, sweeps the
 * chips and celebrates. Warm caramel leather, soft forest felt with paw prints,
 * bone-and-paw chips and a matching deck.
 */
export const puppyTheme: Theme = {
  ...room({ id: 'room-puppy', name: 'Puppy', description: '', felt: '#2f6b52', rail: '#6b3f24', trim: '#e8b86a', room: '#170f0a',
    back: '#c8794a', backStyle: 'paws', face: 'puppy', paper: '#fffaf0', red: '#c8394a', black: '#2a211c', edge: '#ecd9bc', emblem: 'paw', glow: '#ffd79a' }),
  description: 'A playful 3D puppy brings your poker table to life.',
  animations: { deal: { preset: 'deal.puppy', parameters: {} }, flop: { preset: 'flop.puppy', parameters: {} },
    turn: { preset: 'turn.puppy', parameters: {} }, river: { preset: 'river.puppy', parameters: {} } },
  companion: { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium', coat: 'golden', collar: 'ruby' },
};
puppyTheme.table = { ...puppyTheme.table, motif: 'puppy' };
puppyTheme.card = { ...puppyTheme.card, borderRadius: 9, aura: { enabled: true, color: '#ffd79a', strength: 0.45 } };
builtInThemes.push(puppyTheme);
/** Rooms added after library version 3; existing libraries receive them once. */
export const ROOMS_SINCE_V4: string[] = ['room-puppy'];
/** Rooms added with library version 5. */
export const ROOMS_SINCE_V5: string[] = ['room-neon', 'room-sakura'];
export const isBuiltIn = (id: string): boolean => builtInThemes.some((theme) => theme.id === id);
export const builtInTheme = (id: string): Theme | undefined => builtInThemes.find((theme) => theme.id === id);

export const DEFAULT_THEME_ID = builtInThemes[0]!.id;
export function createDefaultTheme(): Theme { return structuredClone(builtInThemes[0]!); }
export function createDefaultLibrary(): Library {
  return { version: 5, settings: { enabled: true, reducedMotion: false, speed: 1, activeThemeId: DEFAULT_THEME_ID, effects: defaultEffects(), favorites: [], recent: [] }, themes: structuredClone(builtInThemes) };
}

/** Identifiers and timestamp of the three themes shipped before the rooms existed. */
export const LEGACY_BUILT_IN = { ids: ['theme-aurora', 'theme-midnight', 'theme-velvet'], timestamp: '2026-10-22T00:00:00.000Z' } as const;
