import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { presets, getPreset } from '../animation/registry';
import { PreviewTable, type PreviewHandle } from '../preview/PreviewTable';
import { LiveTable, liveTableSupported, type LiveTableHandle } from '../preview/LiveTable';
import { loadLibrary, saveLibrary } from '../storage/library';
import { resolveThemeAssets, saveAsset } from '../storage/assets';
import { inspectRuntime, isExtensionStudio, type RuntimeInspection } from '../storage/diagnostics';
import { createDefaultLibrary, createDefaultTheme } from '../themes/defaults';
import { exportTheme, importTheme } from '../themes/transfer';
import type { Library, Street, Theme } from '../types';
import { STREETS, assignmentLabel, presetName, presetsFor, streetName, streetShort, studioTint } from './catalog';
import { CommandMenu, ShortcutSheet, type Command } from './CommandMenu';
import { Board, Deck, Felt, Puppy } from './steps/Appearance';
import { Moments } from './steps/Moments';
import { LibraryStep, SettingsStep } from './steps/Workspace';
import type { NowPlaying, Step, Studio } from './studio-types';
import { Icon, Kbd, Toggle, type IconName } from './ui';

const STEPS: { id: Step; label: string; icon: IconName; blurb: string }[] = [
  { id: 'moments', label: 'Effects', icon: 'spark', blurb: 'Card animations for each moment of the hand' },
  { id: 'deck', label: 'Deck', icon: 'cards', blurb: 'Card faces, backs and glow' },
  { id: 'felt', label: 'Felt', icon: 'felt', blurb: 'Room, felt colour and trim' },
  { id: 'board', label: 'Board', icon: 'board', blurb: 'Community card plate and spacing' },
  { id: 'puppy', label: 'Puppy', icon: 'paw', blurb: 'The 3D table companion' },
  { id: 'library', label: 'Themes', icon: 'library', blurb: 'Your saved looks' },
  { id: 'settings', label: 'Settings', icon: 'settings', blurb: 'Motion, effects and connection' },
];
const uid = () => crypto.randomUUID();
const defaults = (id: string): Record<string, number> => Object.fromEntries((getPreset(id)?.parameters ?? []).map((parameter) => [parameter.key, parameter.default]));
const prefersReducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function App() {
  const [library, setLibrary] = useState<Library>(createDefaultLibrary);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [step, setStep] = useState<Step>('moments');
  const [street, setStreet] = useState<Street>('flop');
  const [players, setPlayers] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [original, setOriginal] = useState(false);
  const [saveStatus, setSaveStatus] = useState('Loading');
  const [notice, setNotice] = useState('');
  const [themeResolution, setThemeResolution] = useState<{ source: Theme; theme: Theme } | null>(null);
  const [pendingPreview, setPendingPreview] = useState<{ street: Street; presetId?: string } | null>(null);
  const [inspection, setInspection] = useState<RuntimeInspection | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [previewMode, setPreviewMode] = useState<'live' | 'lab'>(() => (liveTableSupported() ? 'live' : 'lab'));
  const preview = useRef<PreviewHandle | LiveTableHandle>(null);
  const handRun = useRef(0);
  const importInput = useRef<HTMLInputElement>(null);
  const uploadBackInput = useRef<HTMLInputElement>(null);
  const uploadTableInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const activeTheme = library.themes.find((theme) => theme.id === library.settings.activeThemeId) ?? library.themes[0]!;
  const resolvedTheme = themeResolution?.theme;
  const extensionContext = isExtensionStudio();
  const motionAllowed = !library.settings.reducedMotion && !prefersReducedMotion();

  /* ---------------------------------------------------------- persistence */
  useEffect(() => {
    let disposed = false;
    loadLibrary().then((value) => {
      if (!disposed) { setLibrary(value); setLoaded(true); setSaveStatus('Saved'); }
    }).catch(() => {
      if (!disposed) { setLoaded(true); setLoadFailed(true); setSaveStatus('Not saving'); setNotice('Your saved workspace could not be loaded. Restore defaults to start a new local workspace.'); }
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!loaded || loadFailed) return;
    if (library.themes.some((theme) => !theme.name.trim())) { setSaveStatus('Name the theme to save'); return; }
    let disposed = false;
    setSaveStatus('Saving…');
    const timer = window.setTimeout(() => {
      saveLibrary(library).then(() => { if (!disposed) setSaveStatus('Saved'); })
        .catch(() => { if (!disposed) { setSaveStatus('Save failed'); setNotice('Changes could not be saved. Check that the browser has storage space, then try again.'); } });
    }, 350);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [library, loaded, loadFailed]);

  useEffect(() => {
    let disposed = false;
    resolveThemeAssets(activeTheme).then((theme) => { if (!disposed) setThemeResolution({ source: activeTheme, theme }); })
      .catch(() => { if (!disposed) {
        setThemeResolution({ source: activeTheme, theme: { ...activeTheme,
          card: { ...activeTheme.card, back: activeTheme.card.back === 'image' ? 'crosshatch' : activeTheme.card.back, backImage: undefined },
          table: { ...activeTheme.table, backgroundImage: undefined } } });
        setNotice('An uploaded image could not be loaded. The rest of your theme is available.');
      } });
    return () => { disposed = true; };
  }, [activeTheme]);

  useEffect(() => {
    // Asset loading has no fixed latency. Start only after the preview has this exact theme,
    // otherwise its appearance effect would cancel the run.
    if (!pendingPreview || themeResolution?.source !== activeTheme || !preview.current) return;
    setPendingPreview(null);
    setPaused(false);
    void preview.current.play(pendingPreview.street, pendingPreview.presetId);
  }, [pendingPreview, themeResolution, activeTheme]);

  useEffect(() => { if (!playing) setPaused(false); }, [playing]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);

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
    handRun.current += 1;
    setStreet(nextStreet);
    setPaused(false);
    setNowPlaying({ street: nextStreet, presetId: presetId ?? activeTheme.animations[nextStreet].preset });
    setPendingPreview({ street: nextStreet, presetId });
  }
  function selectPreset(id: string, andPlay = false) {
    if (id === 'random') {
      updateTheme((theme) => ({ ...theme, animations: { ...theme.animations, [street]: { preset: 'random', parameters: {} } } }));
      if (andPlay) play(street, 'random');
      return;
    }
    const preset = getPreset(id);
    if (!preset) return;
    const target = preset.supportedEvents.includes(street) ? street : preset.supportedEvents[0]!;
    setStreet(target);
    updateTheme((theme) => ({ ...theme, animations: { ...theme.animations, [target]: { preset: id, parameters: defaults(id) } } }));
    if (andPlay) play(target, id);
  }
  function previewPreset(id: string) {
    const preset = getPreset(id);
    if (!preset) return;
    play(preset.supportedEvents.includes(street) ? street : preset.supportedEvents[0]!, id);
  }
  async function playHand() {
    if (playing && nowPlaying?.hand) { stopPlayback(); return; }
    const run = ++handRun.current;
    setPendingPreview(null);
    setPaused(false);
    if (previewMode === 'live' && preview.current && 'playHand' in preview.current) {
      setNowPlaying({ street: 'deal', hand: true });
      await (preview.current as LiveTableHandle).playHand();
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
    else if (nowPlaying?.hand && previewMode === 'live') stopPlayback();
    else if (paused) { preview.current?.resume(); setPaused(false); }
    else { preview.current?.pause(); setPaused(true); }
  }
  function replay() {
    if (nowPlaying?.hand) { void playHand(); return; }
    setPendingPreview(null);
    setPaused(false);
    setNowPlaying({ street, presetId: nowPlaying?.presetId ?? activeTheme.animations[street].preset });
    void preview.current?.replay();
  }
  function cyclePreset(direction: 1 | -1) {
    const options = presetsFor(street);
    const current = options.findIndex((preset) => preset.id === activeTheme.animations[street].preset);
    const next = options[(current + direction + options.length) % options.length];
    if (next) selectPreset(next.id, true);
  }
  function toggleFavorite(id: string) {
    const favorites = library.settings.favorites;
    const on = favorites.includes(id);
    setting('favorites', on ? favorites.filter((item) => item !== id) : [...favorites, id].slice(-64));
    const preset = getPreset(id);
    if (preset) setNotice(on ? `${presetName(preset)} removed from favorites.` : `${presetName(preset)} added to favorites.${preset.companion ? '' : ' Shuffle can now pick it.'}`);
  }
  function setParameter(key: string, value: number) {
    updateTheme((theme) => ({ ...theme, animations: { ...theme.animations,
      [street]: { ...theme.animations[street], parameters: { ...theme.animations[street].parameters, [key]: value } } } }));
  }

  /* ---------------------------------------------------------- library */
  function switchTheme(id: string) { setting('activeThemeId', id); }
  function addTheme(theme: Theme) {
    if (library.themes.length >= 100) { setNotice('Your library can hold 100 themes. Delete one to make room.'); return false; }
    setLibrary((current) => ({ ...current, themes: [...current.themes, theme], settings: { ...current.settings, activeThemeId: theme.id } }));
    return true;
  }
  function createTheme() {
    if (addTheme({ ...createDefaultTheme(), id: uid(), name: `Untitled theme ${library.themes.length + 1}`, description: undefined })) { setStep('library'); setEditingName(true); }
  }
  function duplicateTheme() {
    const now = new Date().toISOString();
    if (addTheme({ ...structuredClone(activeTheme), id: uid(), name: `${activeTheme.name} copy`, createdAt: now, updatedAt: now })) setNotice(`Duplicated as “${activeTheme.name} copy”.`);
  }
  function deleteTheme() {
    const remaining = library.themes.filter((theme) => theme.id !== activeTheme.id);
    if (!remaining.length) remaining.push(createDefaultTheme());
    setLibrary((current) => ({ ...current, themes: remaining, settings: { ...current.settings, activeThemeId: remaining[0]!.id } }));
    setNotice(`Deleted “${activeTheme.name}”.`);
  }
  function restoreTheme() {
    updateTheme((theme) => ({ ...createDefaultTheme(), id: theme.id, name: theme.name, createdAt: theme.createdAt }));
    setNotice('This theme is back to its defaults.');
  }
  async function downloadTheme() {
    try {
      const json = await exportTheme(activeTheme);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${activeTheme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pokernow-theme'}.json`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Theme exported, with its uploaded images.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'This theme could not be exported.'); }
  }
  async function readTheme(file?: File) {
    if (!file) return;
    try {
      const imported = await importTheme(await file.text());
      if (addTheme({ ...imported, id: uid() })) setNotice(`“${imported.name}” is ready to use.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'This file is not a valid theme.'); }
  }
  async function upload(file: File | undefined, target: 'back' | 'table') {
    if (!file) return;
    try {
      const asset = await saveAsset(file);
      if (target === 'back') patchCard({ back: 'image', backImage: asset });
      else patchTable({ backgroundImage: asset });
      setNotice('Image added to your theme.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'This image could not be added.'); }
  }
  async function checkConnection() {
    setCheckingConnection(true);
    try { setInspection(await inspectRuntime()); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The PokerNow connection could not be checked. Reload the extension and the studio.'); }
    finally { setCheckingConnection(false); }
  }
  function goTo(next: Step) { setStep(next); panel.current?.scrollTo?.({ top: 0 }); }

  const studio: Studio = {
    library, theme: activeTheme, display: resolvedTheme ?? activeTheme, street, setStreet, playing, nowPlaying, motionAllowed,
    updateTheme, patchCard, patchTable, patchBoard, patchCompanion, setting, selectPreset, previewPreset, playStreet: (item) => play(item),
    playHand: () => { void playHand(); }, toggleFavorite, setParameter, resetParameters: () => selectPreset(activeTheme.animations[street].preset),
    notify: setNotice, goTo, switchTheme, createTheme, duplicateTheme, deleteTheme, restoreTheme, downloadTheme: () => { void downloadTheme(); },
    openImport: () => importInput.current?.click(), uploadImage: (target) => (target === 'back' ? uploadBackInput : uploadTableInput).current?.click(),
    extensionContext, inspection, checkingConnection, checkConnection: () => { void checkConnection(); }, editingName, setEditingName,
  };

  /* ---------------------------------------------------------- commands and keys */
  const commands = useMemo<Command[]>(() => [
    { id: 'hand', group: 'Actions', title: 'Play a whole hand', icon: 'hand', keys: 'H', run: () => { void playHand(); } },
    ...STREETS.map((item, index): Command => ({ id: `play-${item}`, group: 'Actions', title: `Play the ${item === 'deal' ? 'deal' : item}`, detail: assignmentLabel(activeTheme, item).name, icon: 'play', keys: String(index + 1), run: () => play(item) })),
    { id: 'slow', group: 'Actions', title: slow ? 'Normal speed preview' : 'Slow-motion preview', icon: 'slow', keys: 'S', run: () => setSlow((value) => !value) },
    { id: 'export', group: 'Actions', title: 'Export this theme', icon: 'download', run: () => { void downloadTheme(); } },
    { id: 'new', group: 'Actions', title: 'New theme', icon: 'plus', run: createTheme },
    { id: 'shortcuts', group: 'Actions', title: 'Keyboard shortcuts', icon: 'keyboard', keys: '?', run: () => setSheet(true) },
    ...presets.map((preset): Command => {
      const target = preset.supportedEvents.includes(street) ? street : preset.supportedEvents[0]!;
      return { id: `fx-${preset.id}`, group: 'Effects', title: presetName(preset), detail: `Use on the ${target === 'deal' ? 'deal' : target}`, icon: preset.companion ? 'paw' : 'spark',
        keywords: `${preset.description} ${preset.supportedEvents.join(' ')}`, run: () => { setStep('moments'); selectPreset(preset.id, true); } };
    }),
    { id: 'fx-random', group: 'Effects', title: 'Shuffle', detail: `Use on the ${street === 'deal' ? 'deal' : street}`, icon: 'shuffle', keywords: 'random surprise', run: () => selectPreset('random', true) },
    ...library.themes.map((theme): Command => ({ id: `theme-${theme.id}`, group: 'Themes', title: theme.name, detail: theme.id === activeTheme.id ? 'In use' : 'Switch to this theme',
      swatch: theme.table.feltColor, keywords: theme.description, run: () => switchTheme(theme.id) })),
    ...STEPS.map((item): Command => ({ id: `go-${item.id}`, group: 'Go to', title: item.label, detail: item.blurb, icon: item.icon, run: () => goTo(item.id) })),
    { id: 'set-motion', group: 'Settings', title: library.settings.reducedMotion ? 'Turn off reduced motion' : 'Turn on reduced motion', icon: 'settings', run: () => setting('reducedMotion', !library.settings.reducedMotion) },
    { id: 'set-enabled', group: 'Settings', title: library.settings.enabled ? 'Turn customization off' : 'Turn customization on', detail: 'On PokerNow', icon: 'power', run: () => setting('enabled', !library.settings.enabled) },
    ...(['chips', 'celebrations', 'moments', 'ambience'] as const).map((key): Command => ({ id: `set-${key}`, group: 'Settings',
      title: `${library.settings.effects[key] ? 'Turn off' : 'Turn on'} ${({ chips: 'moving chips', celebrations: 'winner celebrations', moments: 'table moments', ambience: 'ambient light' })[key]}`, icon: 'settings',
      run: () => setting('effects', { ...library.settings.effects, [key]: !library.settings.effects[key] }) })),
    { id: 'puppy', group: 'Settings', title: activeTheme.companion ? 'Remove the table puppy' : 'Add the table puppy', icon: 'paw',
      run: () => patchCompanion(activeTheme.companion ? undefined : { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium' }) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [library, activeTheme, street, slow, previewMode, playing, nowPlaying]);

  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setMenu((value) => !value); return; }
    if (menu || sheet || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
    const key = event.key;
    if (key === '/') { event.preventDefault(); setMenu(true); }
    else if (key === '?') { event.preventDefault(); setSheet(true); }
    else if (key === ' ') { if (target?.closest?.('button, a, summary')) return; event.preventDefault(); togglePlayback(); }
    else if (/^[1-4]$/.test(key)) play(STREETS[Number(key) - 1]!);
    else if (key === ']') cyclePreset(1);
    else if (key === '[') cyclePreset(-1);
    else if (key.toLowerCase() === 'h') void playHand();
    else if (key.toLowerCase() === 's') setSlow((value) => !value);
    else if (key.toLowerCase() === 'r') replay();
    else if (key.toLowerCase() === 'f') { const id = activeTheme.animations[street].preset; if (id !== 'random') toggleFavorite(id); }
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

  /* ---------------------------------------------------------- render */
  const label = nowPlaying ? (nowPlaying.hand ? 'A whole hand' : nowPlaying.presetId && nowPlaying.presetId !== 'random'
    ? presetName(getPreset(nowPlaying.presetId) ?? presets[0]!) : assignmentLabel(activeTheme, nowPlaying.street).name) : assignmentLabel(activeTheme, street).name;
  const labelStreet = nowPlaying ? (nowPlaying.hand ? `Now: ${streetName(nowPlaying.street)}` : streetName(nowPlaying.street)) : streetName(street);
  const currentStep = STEPS.find((item) => item.id === step)!;
  const tint = studioTint(activeTheme) as CSSProperties;

  return <div className="studio" style={tint}>
    <header className="topbar">
      <a className="brand" href="#studio" onClick={() => goTo('moments')} aria-label="PokerNow Customizer, effects"><span className="brand-mark">pn</span><span className="brand-name">Customizer</span></a>
      <nav className="theme-dots" aria-label="Themes">
        {library.themes.slice(0, 8).map((theme) => <button type="button" key={theme.id} className={`theme-dot ${theme.id === activeTheme.id ? 'on' : ''}`} aria-pressed={theme.id === activeTheme.id}
          aria-label={`Use theme ${theme.name}`} title={theme.name} onClick={() => switchTheme(theme.id)}
          style={{ '--felt': theme.table.feltColor, '--rail': theme.table.railColor, '--trim': theme.table.trimColor } as CSSProperties} />)}
        {library.themes.length > 8 && <button type="button" className="theme-more" onClick={() => goTo('library')}>+{library.themes.length - 8}</button>}
        <button type="button" className="theme-add" aria-label="New theme" title="New theme" onClick={createTheme}><Icon name="plus" size={14} /></button>
      </nav>
      <button type="button" className="search" onClick={() => setMenu(true)} aria-label="Search the studio" aria-keyshortcuts="Meta+K Control+K /"><Icon name="search" size={16} /><span>Search effects, themes, settings</span><Kbd>⌘K</Kbd></button>
      <div className="topbar-end">
        {!extensionContext && <span className="studio-context" title="Open the studio from the extension’s toolbar icon to apply changes to PokerNow">Browser preview · changes stay here</span>}
        <span className={`save-status ${saveStatus === 'Save failed' ? 'failed' : ''}`} role="status"><i />{saveStatus}</span>
        <label className="power" title="Apply your theme on PokerNow tables"><span>On PokerNow</span><Toggle label="Enable customization" checked={library.settings.enabled} onChange={(value) => setting('enabled', value)} /></label>
      </div>
    </header>

    <div className="layout">
      <section className="stage" aria-label="Table preview" id="studio">
        <div className="stage-head">
          <div className="stage-title"><h1>{activeTheme.name}</h1><p>{activeTheme.description || (activeTheme.companion ? 'With the table puppy' : 'Your theme')}</p></div>
          <div className="stage-tools">
            {liveTableSupported() && <div className="segmented small" role="tablist" aria-label="Preview mode">
              <button type="button" role="tab" aria-selected={previewMode === 'live'} className={previewMode === 'live' ? 'on' : ''} onClick={() => { stopPlayback(); setPreviewMode('live'); }}>Live table</button>
              <button type="button" role="tab" aria-selected={previewMode === 'lab'} className={previewMode === 'lab' ? 'on' : ''} onClick={() => { stopPlayback(); setOriginal(false); setPreviewMode('lab'); }}>Effect lab</button></div>}
            <label className="players">Players<select aria-label="Preview player count" value={players} onChange={(event) => setPlayers(Number(event.target.value))}>
              {Array.from({ length: 9 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
          </div>
        </div>
        <div className={`stage-frame ${original ? 'original' : ''}`}>
          {resolvedTheme ? previewMode === 'live'
            ? <LiveTable key="live" ref={preview as React.RefObject<LiveTableHandle>} theme={resolvedTheme} settings={library.settings} players={players} slow={slow} original={original}
              onMoment={(moment) => { if (moment) setNowPlaying({ street: moment, hand: true }); }} onPlaying={setPlaying} onProgress={setProgress} onError={setNotice} />
            : <PreviewTable key="lab" ref={preview as React.RefObject<PreviewHandle>} theme={resolvedTheme} settings={library.settings} street={street} players={players} slow={slow}
              onPlaying={setPlaying} onProgress={setProgress} onError={setNotice} /> : <div className="stage-loading">Setting the table…</div>}
          {previewMode === 'live' && <button type="button" className={`compare ${original ? 'on' : ''}`} aria-pressed={original} aria-keyshortcuts="C" title="Hold to see the table without your theme"
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setOriginal(true); }} onPointerUp={() => setOriginal(false)} onPointerCancel={() => setOriginal(false)}
            onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); setOriginal(true); } }}
            onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') setOriginal(false); }} onBlur={() => setOriginal(false)}>
            <Icon name="eye" size={15} />{original ? 'Without your theme' : 'Hold to compare'}<Kbd>C</Kbd></button>}
        </div>
        <div className="player" aria-label="Playback">
          <div className="player-buttons">
            <button type="button" className="play" onClick={togglePlayback} aria-label={playing && !paused ? 'Pause animation' : 'Play animation'} aria-keyshortcuts="Space"><Icon name={playing && !paused ? 'pause' : 'play'} size={18} /></button>
            <button type="button" className="icon-button" title="Replay (R)" aria-label="Replay animation" onClick={replay}><Icon name="replay" size={18} /></button>
            <button type="button" className="icon-button" title="Reset the table" aria-label="Reset hand" onClick={stopPlayback}><Icon name="reset" size={18} /></button>
          </div>
          <div className="player-now"><b>{label}</b><small>{labelStreet}</small></div>
          <div className="player-track" aria-hidden="true"><span style={{ transform: `scaleX(${playing || progress === 1 ? progress : 0})` }} /></div>
          <div className="player-streets" role="group" aria-label="Play a street">
            {STREETS.map((item, index) => <button type="button" key={item} className={`${street === item ? 'on' : ''} ${playing && nowPlaying?.street === item ? 'live' : ''}`} aria-keyshortcuts={String(index + 1)} title={`${streetName(item)} (${index + 1})`} onClick={() => play(item)}>{streetShort(item)}</button>)}
            <button type="button" className={`${nowPlaying?.hand && playing ? 'live' : ''}`} title="A whole hand (H)" onClick={() => { void playHand(); }}>Hand</button>
          </div>
          <button type="button" className={`slow ${slow ? 'on' : ''}`} onClick={() => setSlow(!slow)} aria-pressed={slow} title="Slow motion (S)"><Icon name="slow" size={16} />0.4×</button>
        </div>
      </section>

      <section className="panel" ref={panel} aria-label="Customize">
        <nav className="steps" aria-label="Studio sections">
          {STEPS.map((item) => <button type="button" key={item.id} aria-current={step === item.id ? 'page' : undefined} className={`step-tab ${step === item.id ? 'on' : ''}`} onClick={() => goTo(item.id)}>
            <Icon name={item.icon} size={16} /><span>{item.label}</span></button>)}
        </nav>
        <div className="panel-body">
          {loadFailed && <div className="recovery-banner" role="alert"><div><strong>Your saved workspace could not be opened.</strong><p>Defaults are shown for preview. Restore them to start saving again.</p></div>
            <button type="button" className="accent-button primary-button" onClick={() => { setLibrary(createDefaultLibrary()); setLoadFailed(false); setNotice('A fresh local workspace is ready.'); }}>Restore defaults</button></div>}
          <header className="panel-head"><h2>{currentStep.label}</h2><p>{currentStep.blurb}</p></header>
          {step === 'moments' && <Moments studio={studio} />}
          {step === 'deck' && <Deck studio={studio} />}
          {step === 'felt' && <Felt studio={studio} />}
          {step === 'board' && <Board studio={studio} />}
          {step === 'puppy' && <Puppy studio={studio} />}
          {step === 'library' && <LibraryStep studio={studio} />}
          {step === 'settings' && <SettingsStep studio={studio} />}
          <footer className="panel-foot"><button type="button" className="text-button" onClick={() => setSheet(true)}><Icon name="keyboard" size={15} />Keyboard shortcuts</button><span>Presentation only. PokerNow stays in control of the game.</span></footer>
        </div>
      </section>
    </div>

    {menu && <CommandMenu commands={commands} onClose={() => setMenu(false)} />}
    {sheet && <ShortcutSheet onClose={() => setSheet(false)} />}
    {notice && <div className="toast" role="status"><p>{notice}</p><button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><Icon name="close" size={15} /></button></div>}
    <input hidden ref={importInput} type="file" accept="application/json,.json" onChange={(event) => { void readTheme(event.target.files?.[0]); event.target.value = ''; }} />
    <input hidden ref={uploadBackInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'back'); event.target.value = ''; }} />
    <input hidden ref={uploadTableInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'table'); event.target.value = ''; }} />
  </div>;
}
