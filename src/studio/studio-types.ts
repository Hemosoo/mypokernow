import type { RuntimeInspection } from '../storage/diagnostics';
import type { Library, Street, Theme } from '../types';

export type Step = 'home' | 'moments' | 'deck' | 'felt' | 'board' | 'puppy' | 'library' | 'settings';

/** What is on the stage right now, for the player bar and the track list. */
export interface NowPlaying { street: Street; presetId?: string; hand?: boolean }

/** Everything a step can read or do. The App owns the state; steps only render it. */
export interface Studio {
  library: Library;
  theme: Theme;
  /** The active theme with uploaded images resolved, for artwork previews. */
  display: Theme;
  street: Street;
  setStreet: (street: Street) => void;
  playing: boolean;
  nowPlaying: NowPlaying | null;
  motionAllowed: boolean;
  updateTheme: (update: (theme: Theme) => Theme) => void;
  patchCard: (patch: Partial<Theme['card']>) => void;
  patchTable: (patch: Partial<Theme['table']>) => void;
  patchBoard: (patch: Partial<Theme['board']>) => void;
  patchCompanion: (companion: Theme['companion']) => void;
  setting: <K extends keyof Library['settings']>(key: K, value: Library['settings'][K]) => void;
  /** Assign a preset (or 'random') to the street it suits, preferring the selected street. */
  selectPreset: (id: string, play?: boolean) => void;
  /** Play a preset on the stage without assigning it. */
  previewPreset: (id: string) => void;
  playStreet: (street: Street) => void;
  playHand: () => void;
  toggleFavorite: (id: string) => void;
  setParameter: (key: string, value: number) => void;
  resetParameters: () => void;
  notify: (message: string) => void;
  goTo: (step: Step) => void;
  switchTheme: (id: string) => void;
  createTheme: () => void;
  duplicateTheme: () => void;
  deleteTheme: () => void;
  restoreTheme: () => void;
  downloadTheme: () => void;
  openImport: () => void;
  uploadImage: (target: 'back' | 'table') => void;
  extensionContext: boolean;
  inspection: RuntimeInspection | null;
  checkingConnection: boolean;
  checkConnection: () => void;
  editingName: boolean;
  setEditingName: (editing: boolean) => void;
}
