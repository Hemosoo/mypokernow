import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { presets, getPreset } from '../animation/registry';
import type { PreviewHandle } from '../preview/PreviewTable';
import { liveTableSupported, type LiveTableHandle } from '../preview/LiveTable';
import { loadLibrary, saveLibrary } from '../storage/library';
import { resolveThemeAssets, saveAsset } from '../storage/assets';
import { inspectRuntime, isExtensionStudio, type RuntimeInspection } from '../storage/diagnostics';
import { CLASSIC_COLOURWAYS, builtInTheme, builtInThemes, createDefaultLibrary, createDefaultTheme, isBuiltIn, withColourway } from '../themes/defaults';

const CLASSIC_ID = 'room-monte-carlo';
import { exportTheme } from '../themes/transfer';
import { explain, importThemeText } from '../themes/ai';
import { ImportDialog, SimpleHome, Welcome } from './Simple';
import type { CompanionAction, Library, Street, Theme } from '../types';
import { PALETTES, STREETS, assignmentLabel, presetName, presetsFor, streetLower } from './catalog';
import { CommandMenu, ShortcutSheet, type Command } from './CommandMenu';
import { Rail, PAGES, TopBar } from './shell';
import { Stage } from './Stage';
import { Discover } from './pages/Discover';
import { ThemesPage } from './pages/Themes';
import { AppearancePage } from './pages/Appearance';
import { EffectsPage } from './pages/Effects';
import { CompanionPage } from './pages/Companion';
import { SettingsPage } from './pages/Settings';
import type { AppearanceTab, NowPlaying, Page, Studio } from './studio-types';
import { Icon } from './ui';

const uid = () => crypto.randomUUID();
const defaults = (id: string): Record<string, number> => Object.fromEntries((getPreset(id)?.parameters ?? []).map((parameter) => [parameter.key, parameter.default]));
const prefersReducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Pages that work beside the table, and how wide their panel starts. */
const PANEL: Partial<Record<Page, number>> = { themes: 660, appearance: 400, effects: 500, companion: 400 };
const PANEL_KEY = 'pnc.studio.panels';
const store = {
  read<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } },
  write(key: string, value: unknown): void { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Per-viewer convenience only. */ } },
};

export function App() {
  const [library, setLibrary] = useState<Library>(createDefaultLibrary);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [page, setPage] = useState<Page>('discover');
  const [appearanceTab, setAppearanceTab] = useState<AppearanceTab>('cards');
  const [street, setStreet] = useState<Street>('flop');
  const [players, setPlayers] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [original, setOriginal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'loading' | 'saving' | 'saved' | 'failed' | 'blocked'>('loading');
  const [notice, setNotice] = useState<{ message: string; action?: { label: string; run: () => void }; at: number } | null>(null);
  const [previewId, setPreviewId] = useState<string | undefined>();
  const [themeResolution, setThemeResolution] = useState<{ source: Theme; theme: Theme } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingPreview, setPendingPreview] = useState<{ street: Street; presetId?: string } | null>(null);
  const [inspection, setInspection] = useState<RuntimeInspection | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [panelWidths, setPanelWidths] = useState<Partial<Record<Page, number>>>(() => store.read(PANEL_KEY, {}));
  const [collapsed, setCollapsed] = useState(false);
  const [previewMode] = useState<'live' | 'lab'>(() => (liveTableSupported() ? 'live' : 'lab'));
  const [tableReady, setTableReady] = useState(false);
  const preview = useRef<PreviewHandle | LiveTableHandle>(null);
  const handRun = useRef(0);
  const importInput = useRef<HTMLInputElement>(null);
  const uploadBackInput = useRef<HTMLInputElement>(null);
  const uploadTableInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /** Each theme as it was when the studio opened, for "revert" on themes the owner made. */
  const baselines = useRef(new Map<string, Theme>());

  const activeTheme = library.themes.find((theme) => theme.id === library.settings.activeThemeId) ?? library.themes[0]!;
  const previewing = previewId && previewId !== activeTheme.id ? library.themes.find((theme) => theme.id === previewId) : undefined;
  const shown = previewing ?? activeTheme;
  const resolvedTheme = themeResolution?.source === shown ? themeResolution.theme : themeResolution?.theme;
  const extensionContext = isExtensionStudio();
  const motionAllowed = !library.settings.reducedMotion && !prefersReducedMotion();
  const withStage = page !== 'discover' && page !== 'settings';
  // Read by playback started from a timer, after a page change has mounted the stage.
  const stageOn = useRef(withStage);
  stageOn.current = withStage;

  /* ---------------------------------------------------------- persistence */
  useEffect(() => {
    let disposed = false;
    loadLibrary().then((value) => {
      if (disposed) return;
      for (const theme of value.themes) baselines.current.set(theme.id, structuredClone(theme));
      setLibrary(value); setLoaded(true); setSaveStatus('saved');
    }).catch(() => {
      if (!disposed) { setLoaded(true); setLoadFailed(true); setSaveStatus('failed'); notify('Your saved workspace could not be loaded. Restore defaults to start a new local workspace.'); }
    });
    return () => { disposed = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded || loadFailed) return;
    if (library.themes.some((theme) => !theme.name.trim())) { setSaveStatus('blocked'); return; }
    let disposed = false;
    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      saveLibrary(library).then(() => { if (!disposed) setSaveStatus('saved'); })
        .catch(() => { if (!disposed) { setSaveStatus('failed'); notify('Changes could not be saved. Check that the browser has storage space, then try again.'); } });
    }, 350);
    return () => { disposed = true; window.clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, loaded, loadFailed]);

  /* ---------------------------------------------------------- undo and redo */
  const history = useRef<{ past: Library[]; future: Library[]; last: Library | null; at: number; restoring: boolean }>({ past: [], future: [], last: null, at: 0, restoring: false });
  const [, setHistoryTick] = useState(0);
  useEffect(() => {
    const h = history.current;
    if (!loaded) return;
    if (h.last === null || h.restoring) { h.last = library; h.restoring = false; setHistoryTick((tick) => tick + 1); return; }
    if (h.last === library) return;
    const now = performance.now();
    // A drag or a run of keystrokes is one step: changes within half a second merge.
    if (now - h.at > 500 || !h.past.length) { h.past.push(h.last); if (h.past.length > 80) h.past.shift(); }
    h.at = now;
    h.future = [];
    h.last = library;
    setHistoryTick((tick) => tick + 1);
  }, [library, loaded]);
  // Undo can be called from a toast created several renders ago; always read the latest library.
  const latest = useRef(library);
  latest.current = library;
  function undo() {
    const h = history.current, previous = h.past.pop();
    if (!previous) return;
    h.future.push(latest.current); h.restoring = true; h.at = 0;
    setLibrary(previous);
  }
  function redo() {
    const h = history.current, next = h.future.pop();
    if (!next) return;
    h.past.push(latest.current); h.restoring = true; h.at = 0;
    setLibrary(next);
  }

  /* ---------------------------------------------------------- theme assets and pending previews */
  useEffect(() => {
    let disposed = false;
    resolveThemeAssets(shown).then((theme) => { if (!disposed) setThemeResolution({ source: shown, theme }); })
      .catch(() => { if (!disposed) {
        setThemeResolution({ source: shown, theme: { ...shown,
          card: { ...shown.card, back: shown.card.back === 'image' ? 'crosshatch' : shown.card.back, backImage: undefined },
          table: { ...shown.table, backgroundImage: undefined } } });
        notify('An uploaded image could not be loaded. The rest of your theme is available.');
      } });
    return () => { disposed = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  useEffect(() => {
    // Asset loading has no fixed latency. Start only after the preview has this exact theme,
    // otherwise its appearance effect would cancel the run.
    if (!pendingPreview || themeResolution?.source !== shown || !preview.current || (previewMode === 'live' && !tableReady)) return;
    setPendingPreview(null);
    setPaused(false);
    void preview.current.play(pendingPreview.street, pendingPreview.presetId);
  }, [pendingPreview, themeResolution, shown, tableReady, previewMode]);

  useEffect(() => { if (!playing) setPaused(false); }, [playing]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), notice.action ? 8000 : 5000); return () => clearTimeout(timer); }, [notice]);
  // A theme preview belongs to the theme gallery and Discover; anywhere else, the applied theme shows.
  useEffect(() => { if (page !== 'themes' && page !== 'discover') setPreviewId(undefined); }, [page]);
  // A new theme brings its own effects: forget what the last one played, unless it is still playing.
  useEffect(() => { if (!playing) setNowPlaying(null); }, [activeTheme.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // An effect tried on the table is offered for equipping on the page it was tried from, not elsewhere.
  useEffect(() => { setNowPlaying((current) => current?.trial && page !== 'effects' && page !== 'companion' ? null : current); }, [page]);
  useEffect(() => { if (!withStage) { handRun.current += 1; setPendingPreview(null); setPlaying(false); setNowPlaying(null); setTableReady(false); } }, [withStage]);

  function notify(message: string, action?: { label: string; run: () => void }) { setNotice({ message, action, at: Date.now() }); }

  /* ---------------------------------------------------------- theme edits */
  function updateTheme(update: (theme: Theme) => Theme) {
    setLibrary((current) => ({ ...current, themes: current.themes.map((theme) => theme.id === current.settings.activeThemeId
      ? { ...update(theme), updatedAt: new Date().toISOString() } : theme) }));
  }
  const patchCard = (patch: Partial<Theme['card']>) => updateTheme((theme) => ({ ...theme, card: { ...theme.card, ...patch } }));
  const patchTable = (patch: Partial<Theme['table']>) => updateTheme((theme) => ({ ...theme, table: { ...theme.table, ...patch } }));
  const patchBoard = (patch: Partial<Theme['board']>) => updateTheme((theme) => ({ ...theme, board: { ...theme.board, ...patch } }));
  const patchCompanion = (companion: Theme['companion']) => updateTheme((theme) => { const next = { ...theme }; if (companion) next.companion = companion; else delete next.companion; return next; });
  function setting<K extends keyof Library['settings']>(key: K, value: Library['settings'][K]) {
    setLibrary((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }

  /* ---------------------------------------------------------- playback */
  function play(nextStreet: Street, presetId?: string) {
    if (!stageOn.current) return;
    handRun.current += 1;
    setStreet(nextStreet);
    setPaused(false);
    const assigned = activeTheme.animations[nextStreet].preset;
    setNowPlaying({ street: nextStreet, presetId: presetId ?? assigned, trial: Boolean(presetId && presetId !== assigned) });
    setPendingPreview({ street: nextStreet, presetId });
  }
  function equipPreset(id: string, target: Street) {
    if (id !== 'random') { const preset = getPreset(id); if (!preset || !preset.supportedEvents.includes(target)) return; }
    updateTheme((theme) => ({ ...theme, animations: { ...theme.animations, [target]: { preset: id, parameters: id === 'random' ? {} : defaults(id) } } }));
    setNowPlaying((current) => current && current.presetId === id ? { ...current, trial: false } : current);
  }
  async function playHand() {
    if (playing && nowPlaying?.hand) { stopPlayback(); return; }
    if (!stageOn.current) return;
    const run = ++handRun.current;
    setPendingPreview(null);
    setPaused(false);
    if (previewMode === 'live' && 'playHand' in (preview.current ?? {})) {
      if (!tableReady) return;
      setNowPlaying({ street: 'deal', hand: true });
      await (preview.current as unknown as LiveTableHandle).playHand();
      if (run === handRun.current) setNowPlaying(null);
      return;
    }
    // The effect lab plays the four moments back to back.
    for (const item of STREETS) {
      if (run !== handRun.current || !preview.current) return;
      setStreet(item);
      setNowPlaying({ street: item, hand: true });
      await preview.current.play(item);
    }
    if (run === handRun.current) setNowPlaying(null);
  }
  /** One step of the win celebration on the live table. */
  async function playWin(step: 1 | 2 | 3 | 4 | 5) {
    if (!stageOn.current || previewMode !== 'live' || !tableReady) return;
    const run = ++handRun.current;
    setPendingPreview(null);
    setPaused(false);
    setNowPlaying({ street: 'river', win: step });
    await (preview.current as unknown as LiveTableHandle).win(step);
    if (run === handRun.current) setNowPlaying(null);
  }
  function stopPlayback() {
    handRun.current += 1;
    setPendingPreview(null);
    preview.current?.reset();
    setPaused(false);
    setPlaying(false);
    setNowPlaying(null);
  }
  function togglePlayback() {
    if (!playing) play(street);
    else if ((nowPlaying?.hand || nowPlaying?.win) && previewMode === 'live') stopPlayback();
    else if (paused) { preview.current?.resume(); setPaused(false); }
    else { preview.current?.pause(); setPaused(true); }
  }
  function replay() {
    if (nowPlaying?.hand) { void playHand(); return; }
    if (nowPlaying?.win) { void playWin(nowPlaying.win); return; }
    play(nowPlaying?.street ?? street, nowPlaying?.trial ? nowPlaying.presetId : undefined);
  }
  function cyclePreset(direction: 1 | -1) {
    const options = presetsFor(street);
    const current = options.findIndex((preset) => preset.id === (nowPlaying?.trial ? nowPlaying.presetId : activeTheme.animations[street].preset));
    const next = options[(current + direction + options.length) % options.length];
    if (next) play(street, next.id);
  }
  function toggleFavorite(id: string) {
    const favorites = library.settings.favorites;
    const on = favorites.includes(id);
    setting('favorites', on ? favorites.filter((item) => item !== id) : [...favorites, id].slice(-64));
  }
  function setParameter(key: string, value: number) {
    updateTheme((theme) => ({ ...theme, animations: { ...theme.animations,
      [street]: { ...theme.animations[street], parameters: { ...theme.animations[street].parameters, [key]: value } } } }));
  }
  function companionAct(action: CompanionAction): boolean {
    const handle = preview.current;
    if (!handle || !('companion' in handle)) return false;
    return (handle as LiveTableHandle).companion(action);
  }

  /* ---------------------------------------------------------- theme library */
  function applyTheme(id: string) {
    setPreviewId(undefined);
    setLibrary((current) => ({ ...current, settings: { ...current.settings, activeThemeId: id,
      recent: [id, ...current.settings.recent.filter((item) => item !== id)].slice(0, 6) } }));
  }
  /** Dress Classic in one of its colourways and put it in use. */
  function useColourway(colourwayId: string) {
    const colourway = CLASSIC_COLOURWAYS.find((item) => item.id === colourwayId);
    if (!colourway) return;
    setPreviewId(undefined);
    setLibrary((current) => ({ ...current,
      themes: current.themes.map((theme) => theme.id === CLASSIC_ID ? { ...withColourway(theme, colourway), updatedAt: new Date().toISOString() } : theme),
      settings: { ...current.settings, activeThemeId: CLASSIC_ID, recent: [CLASSIC_ID, ...current.settings.recent.filter((item) => item !== CLASSIC_ID)].slice(0, 6) } }));
  }
  function addTheme(theme: Theme): boolean {
    if (library.themes.length >= 100) { notify('Your library can hold 100 themes. Delete one to make room.'); return false; }
    baselines.current.set(theme.id, structuredClone(theme));
    setPreviewId(undefined);
    setLibrary((current) => ({ ...current, themes: [...current.themes, theme], settings: { ...current.settings, activeThemeId: theme.id,
      recent: [theme.id, ...current.settings.recent.filter((item) => item !== theme.id)].slice(0, 6) } }));
    return true;
  }
  const nextName = (base: string): string => {
    const names = new Set(library.themes.map((theme) => theme.name));
    if (!names.has(base)) return base;
    for (let index = 2; ; index++) if (!names.has(`${base} ${index}`)) return `${base} ${index}`;
  };
  function createTheme() {
    const now = new Date().toISOString();
    if (addTheme({ ...createDefaultTheme(), id: uid(), name: nextName('My theme'), description: undefined, createdAt: now, updatedAt: now })) {
      setPage('appearance');
      notify('New theme created from Classic. Every change saves to it.');
    }
  }
  function duplicateTheme(id: string) {
    const source = library.themes.find((theme) => theme.id === id);
    if (!source) return;
    const now = new Date().toISOString(), name = nextName(`${source.name} copy`);
    if (addTheme({ ...structuredClone(source), id: uid(), name, createdAt: now, updatedAt: now })) notify(`Duplicated as “${name}”. It’s now your theme.`);
  }
  function renameTheme(id: string, name: string) {
    setLibrary((current) => ({ ...current, themes: current.themes.map((theme) => theme.id === id ? { ...theme, name, updatedAt: new Date().toISOString() } : theme) }));
  }
  function deleteTheme(id: string) {
    if (isBuiltIn(id)) return;
    const target = library.themes.find((theme) => theme.id === id);
    if (!target) return;
    const remaining = library.themes.filter((theme) => theme.id !== id);
    if (!remaining.length) remaining.push(createDefaultTheme());
    setLibrary((current) => ({ ...current, themes: remaining, settings: { ...current.settings,
      activeThemeId: current.settings.activeThemeId === id ? remaining[0]!.id : current.settings.activeThemeId,
      recent: current.settings.recent.filter((item) => item !== id) } }));
    notify(`Deleted “${target.name}”.`, { label: 'Undo', run: undo });
  }
  function resetTheme(id: string) {
    const target = library.themes.find((theme) => theme.id === id);
    const source = builtInTheme(id) ?? baselines.current.get(id);
    if (!target || !source) return;
    setLibrary((current) => ({ ...current, themes: current.themes.map((theme) => theme.id === id
      ? { ...structuredClone(source), id, name: theme.name, createdAt: theme.createdAt, updatedAt: new Date().toISOString() } : theme) }));
    notify(isBuiltIn(id) ? `“${target.name}” is back to its original look.` : `“${target.name}” is back to how it was when you opened the studio.`, { label: 'Undo', run: undo });
  }
  async function downloadTheme(id: string) {
    const target = library.themes.find((theme) => theme.id === id);
    if (!target) return;
    try {
      const json = await exportTheme(target);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${target.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pokernow-theme'}.json`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(`Exported “${target.name}”, with its uploaded images.`);
    } catch (error) { notify(error instanceof Error ? error.message : 'This theme could not be exported.'); }
  }
  async function readTheme(file?: File) {
    if (!file) return;
    const problem = await importText(await file.text());
    if (problem) notify(problem);
  }
  /** Import from text: an exported file, or a theme an AI or a person wrote. Returns why it failed, if it did. */
  async function importText(text: string): Promise<string | undefined> {
    try {
      const imported = await importThemeText(text);
      if (!addTheme({ ...imported, id: uid(), name: nextName(imported.name) })) return 'Your library is full. Delete a theme to make room.';
      setImportOpen(false);
      notify(`“${imported.name}” is imported and in use.`);
      return undefined;
    } catch (error) { return explain(error); }
  }
  /** A new theme with a coordinated palette and a random deck, pattern and set of effects. */
  function surpriseTheme() {
    const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;
    const palette = pick(PALETTES);
    const look = pick(builtInThemes.filter((theme) => !theme.companion));
    const now = new Date().toISOString();
    const effect = (item: Street) => { const options = presetsFor(item).filter((preset) => !preset.companion); return { preset: pick(options).id, parameters: {} }; };
    const theme: Theme = { ...structuredClone(look), id: uid(), name: nextName(`${palette.name} ${pick(['Lounge', 'Club', 'Room', 'Salon', 'Parlour'])}`), description: undefined, createdAt: now, updatedAt: now,
      table: { ...look.table, feltColor: palette.felt, railColor: palette.rail, trimColor: palette.trim, backgroundColor: palette.room, motif: look.table.motif },
      card: { ...look.card, backColor: palette.back, aura: { ...look.card.aura, color: palette.trim } },
      board: { ...look.board, color: palette.felt },
      animations: { deal: effect('deal'), flop: effect('flop'), turn: effect('turn'), river: effect('river') } };
    if (addTheme(theme)) notify(`Made “${theme.name}”: ${palette.name.toLowerCase()} colours with the ${look.name} deck.`, { label: 'Undo', run: undo });
  }
  async function upload(file: File | undefined, target: 'back' | 'table') {
    if (!file) return;
    try {
      const asset = await saveAsset(file);
      if (target === 'back') patchCard({ back: 'image', backImage: asset });
      else patchTable({ backgroundImage: asset });
      notify('Image added to your theme.');
    } catch (error) { notify(error instanceof Error ? error.message : 'This image could not be added.'); }
  }
  async function checkConnection() {
    setCheckingConnection(true);
    try { setInspection(await inspectRuntime()); }
    catch (error) { notify(error instanceof Error ? error.message : 'The PokerNow connection could not be checked. Reload the extension and the studio.'); }
    finally { setCheckingConnection(false); }
  }
  function goTo(next: Page) { setPage(next); panel.current?.scrollTo?.({ top: 0 }); }
  function resetEverything() {
    const fresh = createDefaultLibrary();
    // Themes the owner made are kept; built-in rooms and every setting return to the defaults.
    const own = library.themes.filter((theme) => !isBuiltIn(theme.id));
    setLibrary({ ...fresh, themes: [...fresh.themes, ...own].slice(0, 100) });
    setLoadFailed(false);
    notify('Settings and built-in themes are back to their defaults. Your own themes were kept.', { label: 'Undo', run: undo });
  }

  const baseline = builtInTheme(activeTheme.id) ?? baselines.current.get(activeTheme.id);
  const studio: Studio = {
    library, theme: activeTheme, display: (previewing ? undefined : resolvedTheme) ?? activeTheme, previewing, page, goTo, appearanceTab, setAppearanceTab,
    street, setStreet, playing, nowPlaying, motionAllowed,
    updateTheme, patchCard, patchTable, patchBoard, patchCompanion, setting, baseline,
    equipPreset, tryPreset: (id, item) => play(item, id), playStreet: (item) => play(item), playHand: () => { void playHand(); }, playWin: (step) => { void playWin(step); },
    toggleFavorite, setParameter, resetParameters: () => equipPreset(activeTheme.animations[street].preset, street),
    applyTheme, previewTheme: setPreviewId, createTheme, duplicateTheme, renameTheme, deleteTheme, resetTheme,
    useColourway, exportTheme: (id) => { void downloadTheme(id); }, openImport: () => setImportOpen(true), surpriseTheme,
    uploadImage: (target) => (target === 'back' ? uploadBackInput : uploadTableInput).current?.click(),
    companionAct, notify, extensionContext, inspection, checkingConnection, checkConnection: () => { void checkConnection(); },
    resetEverything, openShortcuts: () => setSheet(true),
  };

  /* ---------------------------------------------------------- commands and keys */
  const commands = useMemo<Command[]>(() => [
    { id: 'hand', group: 'Actions', title: 'Play a whole hand', icon: 'hand', keys: 'H', run: () => { if (!withStage) setPage('effects'); window.setTimeout(() => { void playHand(); }, 0); } },
    ...STREETS.map((item, index): Command => ({ id: `play-${item}`, group: 'Actions', title: `Play the ${streetLower(item)}`, detail: assignmentLabel(activeTheme, item).name, icon: 'play', keys: String(index + 1),
      run: () => { if (!withStage) setPage('effects'); window.setTimeout(() => play(item), 0); } })),
    { id: 'undo', group: 'Actions', title: 'Undo', icon: 'undo', keys: '⌘Z', run: undo },
    { id: 'redo', group: 'Actions', title: 'Redo', icon: 'redo', keys: '⇧⌘Z', run: redo },
    { id: 'new', group: 'Actions', title: 'New theme', icon: 'plus', run: createTheme },
    { id: 'surprise', group: 'Actions', title: 'Surprise me: a random new theme', icon: 'dice', run: surpriseTheme },
    { id: 'export', group: 'Actions', title: `Export “${activeTheme.name}”`, icon: 'download', run: () => { void downloadTheme(activeTheme.id); } },
    { id: 'import', group: 'Actions', title: 'Import a theme', icon: 'upload', run: () => importInput.current?.click() },
    { id: 'shortcuts', group: 'Actions', title: 'Keyboard shortcuts', icon: 'keyboard', keys: '?', run: () => setSheet(true) },
    ...presets.map((preset): Command => {
      const target = preset.supportedEvents.includes(street) ? street : preset.supportedEvents[0]!;
      return { id: `fx-${preset.id}`, group: 'Effects', title: presetName(preset), detail: `Try on the ${streetLower(target)}`, icon: preset.companion ? 'paw' : 'spark',
        keywords: `${preset.description} ${preset.supportedEvents.join(' ')}`, run: () => { setPage('effects'); setStreet(target); window.setTimeout(() => play(target, preset.id), 0); } };
    }),
    ...library.themes.map((theme): Command => ({ id: `theme-${theme.id}`, group: 'Themes', title: theme.name, detail: theme.id === activeTheme.id ? 'In use' : 'Use this theme',
      swatch: theme.table.feltColor, keywords: theme.description, run: () => applyTheme(theme.id) })),
    ...PAGES.map((item): Command => ({ id: `go-${item.id}`, group: 'Go to', title: item.label, detail: item.blurb, icon: item.icon, run: () => goTo(item.id) })),
    { id: 'set-motion', group: 'Settings', title: library.settings.reducedMotion ? 'Turn off reduced motion' : 'Turn on reduced motion', icon: 'settings', run: () => setting('reducedMotion', !library.settings.reducedMotion) },
    { id: 'set-enabled', group: 'Settings', title: library.settings.enabled ? 'Turn customization off on PokerNow' : 'Turn customization on for PokerNow', icon: 'power', run: () => setting('enabled', !library.settings.enabled) },
    ...(['chips', 'celebrations', 'moments', 'ambience'] as const).map((key): Command => ({ id: `set-${key}`, group: 'Settings',
      title: `${library.settings.effects[key] ? 'Turn off' : 'Turn on'} ${({ chips: 'moving chips', celebrations: 'winner celebrations', moments: 'table moments', ambience: 'ambient particles' })[key]}`, icon: 'settings',
      run: () => setting('effects', { ...library.settings.effects, [key]: !library.settings.effects[key] }) })),
    { id: 'puppy', group: 'Settings', title: activeTheme.companion ? 'Remove the table puppy' : 'Add the table puppy', icon: 'paw',
      run: () => patchCompanion(activeTheme.companion ? undefined : { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium', coat: 'golden', collar: 'ruby' }) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [library, activeTheme, street, previewMode, playing, nowPlaying, withStage]);

  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const typing = Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'k') { event.preventDefault(); setMenu((value) => !value); return; }
    if (mod && !typing && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return; }
    if (mod && !typing && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if (menu || sheet || mod || event.altKey || typing || target?.closest?.('[role="slider"], [role="menu"]')) return;
    const key = event.key;
    if (key === '/') { event.preventDefault(); setMenu(true); }
    else if (key === '?') { event.preventDefault(); setSheet(true); }
    else if (key === 'Escape' && previewing) setPreviewId(undefined);
    else if (!withStage) return;
    else if (key === ' ') { if (target?.closest?.('button, a, summary')) return; event.preventDefault(); togglePlayback(); }
    else if (/^[1-4]$/.test(key)) play(STREETS[Number(key) - 1]!);
    else if (key === ']') cyclePreset(1);
    else if (key === '[') cyclePreset(-1);
    else if (key.toLowerCase() === 'h') void playHand();
    else if (key.toLowerCase() === 'r') replay();
    else if (key.toLowerCase() === 'f') { const id = nowPlaying?.trial ? nowPlaying.presetId : activeTheme.animations[street].preset; if (id && id !== 'random') toggleFavorite(id); }
    else if (key.toLowerCase() === 'c' && !event.repeat && previewMode === 'live') setOriginal(true);
  };
  useEffect(() => {
    const down = (event: KeyboardEvent) => keys.current(event);
    const up = (event: KeyboardEvent) => { if (event.key.toLowerCase() === 'c') setOriginal(false); };
    const blur = () => setOriginal(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  /* ---------------------------------------------------------- panel size */
  const defaultWidth = PANEL[page] ?? 420;
  const panelWidth = panelWidths[page] ?? defaultWidth;
  function resizePanel(width: number | undefined) {
    setPanelWidths((current) => {
      const next = { ...current };
      if (width === undefined) delete next[page]; else next[page] = Math.round(Math.max(320, Math.min(width, 820)));
      store.write(PANEL_KEY, next);
      return next;
    });
  }

  /* ---------------------------------------------------------- render */
  const pageContent = <>
    {page === 'discover' && <Discover studio={studio} />}
    {page === 'themes' && <ThemesPage studio={studio} />}
    {page === 'appearance' && <AppearancePage studio={studio} />}
    {page === 'effects' && <EffectsPage studio={studio} />}
    {page === 'companion' && <CompanionPage studio={studio} />}
    {page === 'settings' && <SettingsPage studio={studio} />}
  </>;

  const mode = library.settings.mode;
  const overlays = <>
    {mode === undefined && !loadFailed && <Welcome studio={studio} onChoose={(choice) => setting('mode', choice)} />}
    {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onFile={() => importInput.current?.click()} onText={importText} />}
    {notice && <div className="toast" role="status" key={notice.at}><p>{notice.message}</p>
      {notice.action && <button type="button" className="toast-action" onClick={() => { notice.action!.run(); setNotice(null); }}>{notice.action.label}</button>}
      <button type="button" className="icon-button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><Icon name="close" size={15} /></button></div>}
    <input hidden ref={importInput} type="file" accept="application/json,.json,.txt" onChange={(event) => { void readTheme(event.target.files?.[0]); event.target.value = ''; }} />
  </>;
  if (mode === 'simple') return <><SimpleHome studio={studio} />{overlays}</>;

  return <div className={`studio page-${page}`}>
    <TopBar studio={studio} saveStatus={saveStatus} canUndo={history.current.past.length > 0} canRedo={history.current.future.length > 0}
      onUndo={undo} onRedo={redo} onSearch={() => setMenu(true)} />
    <div className="workspace">
      <Rail page={page} onGo={goTo} onShortcuts={() => setSheet(true)} />
      {loadFailed && <div className="recovery-banner" role="alert"><div><strong>Your saved workspace could not be opened.</strong><p>Defaults are shown. Restore them to start saving again.</p></div>
        <button type="button" className="primary-button" onClick={() => { setLibrary(createDefaultLibrary()); setLoadFailed(false); notify('A fresh local workspace is ready.'); }}>Restore defaults</button></div>}
      {withStage ? <main className={`split ${collapsed ? 'collapsed' : ''}`} style={{ '--panel-w': `${panelWidth}px` } as CSSProperties}>
        <Stage studio={studio} preview={preview} previewMode={previewMode} resolvedTheme={resolvedTheme} shown={shown} players={players} setPlayers={setPlayers}
          rate={rate} setRate={setRate} playing={playing} paused={paused} progress={progress} nowPlaying={nowPlaying} original={original} setOriginal={setOriginal}
          onPlaying={setPlaying} onProgress={setProgress} onMoment={(moment) => { if (moment) setNowPlaying({ street: moment, hand: true }); }}
          onToggle={togglePlayback} onReplay={replay} onReset={stopPlayback} onPlay={(item) => play(item)} onHand={() => { void playHand(); }}
          onError={(message) => notify(message)} onReady={() => setTableReady(true)} collapsed={collapsed} onExpandPanel={() => setCollapsed(false)} onEquipTrial={() => { if (nowPlaying?.presetId) equipPreset(nowPlaying.presetId, nowPlaying.street); }} />
        {!collapsed && <div className="resizer" role="separator" aria-orientation="vertical" aria-label="Resize the panel" tabIndex={0}
          aria-valuemin={320} aria-valuemax={820} aria-valuenow={panelWidth}
          onDoubleClick={() => resizePanel(undefined)}
          onKeyDown={(event) => { if (event.key === 'ArrowLeft') resizePanel(panelWidth + 24); else if (event.key === 'ArrowRight') resizePanel(panelWidth - 24); }}
          onPointerDown={(event) => {
            const start = event.clientX, from = panelWidth, element = event.currentTarget;
            element.setPointerCapture(event.pointerId);
            const move = (moved: PointerEvent) => resizePanel(from + (start - moved.clientX));
            const up = () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerup', up); };
            element.addEventListener('pointermove', move); element.addEventListener('pointerup', up);
          }} />}
        {!collapsed && <section className="panel" ref={panel} aria-label={PAGES.find((item) => item.id === page)?.label}>
          <button type="button" className="icon-button panel-hide" onClick={() => setCollapsed(true)} aria-label="Hide the panel" title="Hide the panel"><Icon name="panel" size={17} /></button>
          {pageContent}
        </section>}
      </main> : <main className="full" ref={panel}>{pageContent}</main>}
    </div>

    {menu && <CommandMenu commands={commands} onClose={() => setMenu(false)} />}
    {sheet && <ShortcutSheet onClose={() => setSheet(false)} />}
    {overlays}
    <input hidden ref={uploadBackInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'back'); event.target.value = ''; }} />
    <input hidden ref={uploadTableInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'table'); event.target.value = ''; }} />
  </div>;
}
