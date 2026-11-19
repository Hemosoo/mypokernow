import type { RuntimeInspection } from '../storage/diagnostics';
import type { CompanionAction, Library, Street, Theme } from '../types';

/** The studio's destinations. Settings sits apart from the creative ones. */
export type Page = 'discover' | 'themes' | 'appearance' | 'effects' | 'companion' | 'settings';
export type AppearanceTab = 'cards' | 'table' | 'room' | 'board';

/** What is on the stage right now, for the player bar and the effect list. */
export interface NowPlaying {
  street: Street;
  presetId?: string;
  hand?: boolean;
  /** A preset tried on the table without being equipped. */
  trial?: boolean;
  /** One step of the win celebration (1–5). */
  win?: 1 | 2 | 3 | 4 | 5;
}

/** Everything a page can read or do. The App owns the state; pages only render it. */
export interface Studio {
  library: Library;
  /** The theme in use: saved, and live on PokerNow when customization is on. */
  theme: Theme;
  /** The active theme with uploaded images resolved, for artwork previews. */
  display: Theme;
  /** A theme being looked at on the stage without being applied. */
  previewing?: Theme;
  page: Page;
  goTo: (page: Page) => void;
  appearanceTab: AppearanceTab;
  setAppearanceTab: (tab: AppearanceTab) => void;
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
  /** The active theme as it was when the studio opened (or its built-in original), for reset buttons. */
  baseline: Theme | undefined;

  /** Assign a preset (or 'random') to a street. */
  equipPreset: (id: string, street: Street) => void;
  /** Play a preset on the stage for a street without assigning it. */
  tryPreset: (id: string, street: Street) => void;
  playStreet: (street: Street) => void;
  playHand: () => void;
  /** Play one step of the win celebration on the stage. */
  playWin: (step: 1 | 2 | 3 | 4 | 5) => void;
  toggleFavorite: (id: string) => void;
  setParameter: (key: string, value: number) => void;
  resetParameters: () => void;

  applyTheme: (id: string) => void;
  previewTheme: (id: string | undefined) => void;
  createTheme: () => void;
  duplicateTheme: (id: string) => void;
  renameTheme: (id: string, name: string) => void;
  deleteTheme: (id: string) => void;
  resetTheme: (id: string) => void;
  exportTheme: (id: string) => void;
  openImport: () => void;
  surpriseTheme: () => void;
  uploadImage: (target: 'back' | 'table') => void;

  /** Ask the table companion to act something out on the stage. */
  companionAct: (action: CompanionAction) => boolean;
  notify: (message: string, action?: { label: string; run: () => void }) => void;
  extensionContext: boolean;
  inspection: RuntimeInspection | null;
  checkingConnection: boolean;
  checkConnection: () => void;
  resetEverything: () => void;
  openShortcuts: () => void;
}
