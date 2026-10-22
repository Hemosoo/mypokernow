import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { presets, getPreset } from '../animation/registry';
import { PreviewTable, type PreviewHandle } from '../preview/PreviewTable';
import { cardDataUrl } from '../rendering/cards';
import { loadLibrary, saveLibrary } from '../storage/library';
import { resolveThemeAssets, saveAsset } from '../storage/assets';
import { inspectRuntime, isExtensionStudio, type RuntimeInspection } from '../storage/diagnostics';
import { createDefaultLibrary, createDefaultTheme, builtInThemes } from '../themes/defaults';
import { exportTheme, importTheme } from '../themes/transfer';
import type { Library, Street, Theme } from '../types';

type Section = 'animations' | 'cards' | 'table' | 'board' | 'themes' | 'settings';
type IconName = 'spark' | 'cards' | 'table' | 'board' | 'palette' | 'settings' | 'arrow' | 'play' | 'pause' | 'replay' | 'check' | 'plus' | 'upload' | 'download' | 'copy' | 'trash' | 'chevron' | 'reset' | 'external' | 'volume';
const NAV: { id: Section; label: string; icon: IconName }[] = [
  { id: 'animations', label: 'Animation Studio', icon: 'spark' }, { id: 'cards', label: 'Cards', icon: 'cards' },
  { id: 'table', label: 'Table', icon: 'table' }, { id: 'board', label: 'Board', icon: 'board' },
  { id: 'themes', label: 'Themes', icon: 'palette' }, { id: 'settings', label: 'Settings', icon: 'settings' },
];
const STREETS: Street[] = ['deal', 'flop', 'turn', 'river'];
const TITLES: Record<Section, [string, string, string]> = {
  animations: ['YOUR TABLE. YOUR SIGNATURE.', 'Make every reveal', 'a moment.'],
  cards: ['THE DETAILS MAKE THE DECK.', 'A little character.', 'Every hand.'],
  table: ['SET THE SCENE.', 'Your seat.', 'Your atmosphere.'],
  board: ['A STAGE FOR THE REVEAL.', 'Let the board', 'stand out.'],
  themes: ['COLLECT YOUR FAVORITES.', 'One table.', 'Endless moods.'],
  settings: ['MADE TO STAY OUT OF THE WAY.', 'Make it', 'feel right.'],
};
const prettyStreet = (street: Street) => street === 'deal' ? 'Initial deal' : street[0].toUpperCase() + street.slice(1);
const uid = () => crypto.randomUUID();
const FACE_STYLES: Record<Theme['card']['face'], Partial<Theme['card']>> = {
  native: { face: 'native', faceColor: '#fffdf7', redColor: '#be354a', blackColor: '#24282f', borderColor: '#d7d5cb', borderRadius: 6 },
  classic: { face: 'classic', faceColor: '#fffdf4', redColor: '#b83348', blackColor: '#25332e', borderColor: '#d8d2bf', borderRadius: 5 },
  modern: { face: 'modern', faceColor: '#faf8f2', redColor: '#d35165', blackColor: '#22293a', borderColor: '#dcd9ef', borderRadius: 8 },
  midnight: { face: 'midnight', faceColor: '#181c2c', redColor: '#fd8b9a', blackColor: '#dcdafa', borderColor: '#626a87', borderRadius: 8 },
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    spark: <><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" /><path d="m20 3 .6 1.4L22 5l-1.4.6L20 7l-.6-1.4L18 5l1.4-.6L20 3Z" /></>,
    cards: <><rect x="7" y="4" width="12" height="16" rx="2" /><path d="m6 7-2 .5a2 2 0 0 0-1.4 2.4l2.6 9.6a2 2 0 0 0 2.4 1.4L11 20M11 8h4m-4 3h2" /></>,
    table: <><ellipse cx="12" cy="12" rx="10" ry="7" /><ellipse cx="12" cy="12" rx="7" ry="4" /></>,
    board: <><rect x="2" y="6" width="5" height="12" rx="1.5" /><rect x="9.5" y="6" width="5" height="12" rx="1.5" /><rect x="17" y="6" width="5" height="12" rx="1.5" /></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.8-2.8 2 2 0 0 1 1.8-2.8H18A4 4 0 0 0 22 11a10 10 0 0 0-10-8Z" /><circle cx="7" cy="11" r=".7" /><circle cx="10" cy="7" r=".7" /><circle cx="15" cy="7" r=".7" /><circle cx="18" cy="11" r=".7" /></>,
    settings: <><path d="m10 3-.6 2.2-2 .9L5.3 5.5 3.5 8.6 5 10.3v2.4l-1.5 1.7 1.8 3.1 2.1-.6 2 .9L10 20h4l.6-2.2 2-.9 2.1.6 1.8-3.1-1.5-1.7v-2.4l1.5-1.7-1.8-3.1-2.1.6-2-.9L14 3h-4Z" /><circle cx="12" cy="11.5" r="3" /></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />, play: <path d="m9 5 11 7-11 7V5Z" />,
    pause: <><path d="M8 5v14M16 5v14" /></>, replay: <><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></>,
    check: <path d="m5 12 4 4L19 6" />, plus: <path d="M12 5v14M5 12h14" />,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" /></>,
    download: <><path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></>,
    trash: <><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" /></>,
    chevron: <path d="m9 5 7 7-7 7" />, reset: <><path d="M4 8a8 8 0 1 1-1 8M4 3v5h5" /></>,
    external: <><path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6" /></>,
    volume: <><path d="M4 9v6h4l5 4V5L8 9H4ZM17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button className={`toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}

function Range({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void;
}) {
  return <label className="range-control"><span><span>{label}</span><output>{Number(value.toFixed(2))}{unit}</output></span>
    <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))}
      style={{ '--range-progress': `${((value - min) / (max - min)) * 100}%` } as CSSProperties} />
  </label>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#142b29';
  return <label className="color-control"><span>{label}</span><span className="color-value"><input type="color" value={hex} onChange={(event) => onChange(event.target.value)} /><span>{hex.toUpperCase()}</span></span></label>;
}

function PresetArt({ id }: { id: string }) {
  return <div className={`preset-art art-${id.replaceAll('.', '-')}`} aria-hidden="true">
    <div className="art-orbit" /><div className="art-orbit second" />
    <div className="art-card card-one"><span>A</span><b>♠</b></div>
    <div className="art-card card-two"><span>K</span><b>♥</b></div>
    <div className="art-card card-three"><span>7</span><b>♣</b></div>
    <div className="art-spark a" /><div className="art-spark b" /><div className="art-spark c" />
    <div className="art-impact" />
  </div>;
}

export function App() {
  const [library, setLibrary] = useState<Library>(createDefaultLibrary);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [section, setSection] = useState<Section>('animations');
  const [street, setStreet] = useState<Street>('flop');
  const [players, setPlayers] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [saveStatus, setSaveStatus] = useState('Loading workspace');
  const [notice, setNotice] = useState('');
  const [themeResolution, setThemeResolution] = useState<{ source: Theme; theme: Theme } | null>(null);
  const [pendingPreview, setPendingPreview] = useState<{ street: Street; presetId?: string } | null>(null);
  const [inspection, setInspection] = useState<RuntimeInspection | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const preview = useRef<PreviewHandle>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const uploadBackInput = useRef<HTMLInputElement>(null);
  const uploadTableInput = useRef<HTMLInputElement>(null);
  const activeTheme = library.themes.find((theme) => theme.id === library.settings.activeThemeId) ?? library.themes[0];
  const resolvedTheme = themeResolution?.theme;
  const extensionContext = isExtensionStudio();
  const selectedPreset = getPreset(activeTheme.animations[street].preset) ?? presets[0];
  const currentParameters = activeTheme.animations[street].parameters;
  const previewDuration = Math.min(10000, Math.max(120, (currentParameters.duration ?? selectedPreset.duration)
    / (library.settings.speed * (currentParameters.speed ?? 1) * (slow ? 0.4 : 1))));

  useEffect(() => {
    let disposed = false;
    loadLibrary().then((value) => {
      if (!disposed) { setLibrary(value); setLoaded(true); setSaveStatus('All changes saved'); }
    }).catch(() => {
      if (!disposed) { setLoaded(true); setLoadFailed(true); setSaveStatus('Workspace unavailable'); setNotice('Your saved workspace could not be loaded. Restore defaults below to start a new local workspace.'); }
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!loaded || loadFailed) return;
    if (library.themes.some((theme) => !theme.name.trim())) { setSaveStatus('Add a theme name'); return; }
    let disposed = false;
    setSaveStatus('Saving changes…');
    const timer = window.setTimeout(() => {
      saveLibrary(library).then(() => { if (!disposed) setSaveStatus('All changes saved'); })
        .catch(() => { if (!disposed) { setSaveStatus('Save failed'); setNotice('Changes could not be saved. Please check available browser storage and try again.'); } });
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
    // Asset loading has no fixed latency. Start only after the child has received
    // this exact theme, otherwise its appearance effect would cancel the run.
    if (!pendingPreview || themeResolution?.source !== activeTheme || !preview.current) return;
    setPendingPreview(null);
    setPaused(false);
    void preview.current.play(pendingPreview.street, pendingPreview.presetId);
  }, [pendingPreview, themeResolution, activeTheme]);

  function updateTheme(update: (theme: Theme) => Theme) {
    setLibrary((current) => ({ ...current, themes: current.themes.map((theme) => theme.id === current.settings.activeThemeId
      ? { ...update(theme), updatedAt: new Date().toISOString() } : theme) }));
  }
  function patchCard(patch: Partial<Theme['card']>) { updateTheme((theme) => ({ ...theme, card: { ...theme.card, ...patch } })); }
  function patchTable(patch: Partial<Theme['table']>) { updateTheme((theme) => ({ ...theme, table: { ...theme.table, ...patch } })); }
  function patchBoard(patch: Partial<Theme['board']>) { updateTheme((theme) => ({ ...theme, board: { ...theme.board, ...patch } })); }
  function setting<K extends keyof Library['settings']>(key: K, value: Library['settings'][K]) {
    setLibrary((current) => ({ ...current, settings: { ...current.settings, [key]: value } }));
  }
  function selectPreset(id: string, play = false) {
    const preset = getPreset(id);
    if (!preset) return;
    const nextStreet = preset.supportedEvents.includes(street) ? street : preset.supportedEvents[0];
    const parameters = Object.fromEntries(preset.parameters.map((parameter) => [parameter.key, parameter.default]));
    setStreet(nextStreet);
    updateTheme((theme) => ({ ...theme, animations: { ...theme.animations, [nextStreet]: { preset: id, parameters } } }));
    setPendingPreview(play ? { street: nextStreet, presetId: id } : null);
  }
  function setParameter(key: string, value: number) {
    updateTheme((theme) => ({ ...theme, animations: { ...theme.animations,
      [street]: { ...theme.animations[street], parameters: { ...theme.animations[street].parameters, [key]: value } } } }));
  }
  function createTheme() {
    if (library.themes.length >= 100) { setNotice('Your library can hold 100 themes. Delete a theme before creating another.'); return; }
    const theme = { ...createDefaultTheme(), id: uid(), name: `Untitled theme ${library.themes.length + 1}` };
    setLibrary((current) => ({ ...current, themes: [...current.themes, theme], settings: { ...current.settings, activeThemeId: theme.id } }));
    setEditingName(true);
  }
  function duplicateTheme() {
    if (library.themes.length >= 100) { setNotice('Your library can hold 100 themes. Delete a theme before duplicating another.'); return; }
    const theme = { ...structuredClone(activeTheme), id: uid(), name: `${activeTheme.name} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setLibrary((current) => ({ ...current, themes: [...current.themes, theme], settings: { ...current.settings, activeThemeId: theme.id } }));
  }
  function deleteTheme() {
    const remaining = library.themes.filter((theme) => theme.id !== activeTheme.id);
    if (!remaining.length) remaining.push(createDefaultTheme());
    setLibrary((current) => ({ ...current, themes: remaining, settings: { ...current.settings, activeThemeId: remaining[0].id } }));
  }
  function restoreTheme() {
    updateTheme((theme) => ({ ...createDefaultTheme(), id: theme.id, name: theme.name, createdAt: theme.createdAt }));
    setNotice('The active theme has been restored to its defaults.');
  }
  async function downloadTheme() {
    try {
      const json = await exportTheme(activeTheme);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `${activeTheme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pokernow-theme'}.json`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Theme exported with its uploaded assets.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'This theme could not be exported.'); }
  }
  async function readTheme(file?: File) {
    if (!file) return;
    if (library.themes.length >= 100) { setNotice('Your library can hold 100 themes. Delete a theme before importing another.'); return; }
    try {
      const imported = await importTheme(await file.text());
      const theme = { ...imported, id: uid() };
      setLibrary((current) => ({ ...current, themes: [...current.themes, theme], settings: { ...current.settings, activeThemeId: theme.id } }));
      setNotice(`“${theme.name}” is ready to use.`);
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
  function playStreet(nextStreet: Street) { setStreet(nextStreet); setPaused(false); setPendingPreview({ street: nextStreet }); }
  function togglePlayback() {
    if (!playing) playStreet(street);
    else if (paused) { preview.current?.resume(); setPaused(false); }
    else { preview.current?.pause(); setPaused(true); }
  }

  async function checkConnection() {
    setCheckingConnection(true);
    try { setInspection(await inspectRuntime()); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The PokerNow connection could not be checked. Reload the extension and studio.'); }
    finally { setCheckingConnection(false); }
  }

  const title = TITLES[section];
  return <div className="studio-app">
    <aside className="sidebar">
      <a className="brand" href="#studio" onClick={() => setSection('animations')} aria-label="PokerNow Customizer home"><span className="brand-mark">pn<span>✦</span></span><span className="brand-type">pokernow<small>CUSTOMIZER</small></span></a>
      <div className="workspace-label">YOUR WORKSPACE <span>V1</span></div>
      <nav aria-label="Studio sections">{NAV.map((item) => <button key={item.id} aria-label={item.label} title={item.label} className={`nav-item ${section === item.id ? 'active' : ''}`} onClick={() => setSection(item.id)}>
        <Icon name={item.icon} /><span>{item.label}</span>{section === item.id && <i />}</button>)}</nav>
      <div className="sidebar-divider" />
      <div className="theme-sidebar"><span className="eyebrow">ACTIVE THEME</span><button className="current-theme-button" onClick={() => setSection('themes')}><span className="theme-dot" style={{ background: activeTheme.table.feltColor }} /><span>{activeTheme.name}</span><Icon name="chevron" size={14} /></button></div>
      <div className="sidebar-bottom"><div className="extension-state"><span className={library.settings.enabled ? 'status-light' : 'status-light off'} /><span>Customization {library.settings.enabled ? 'on' : 'off'}</span><Toggle label="Enable customization" checked={library.settings.enabled} onChange={(value) => setting('enabled', value)} /></div>
        <p>All style. Same game.</p><span className="local-note"><Icon name="check" size={12} /> Local & open source</span></div>
    </aside>

    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Workspace <Icon name="chevron" size={12} /><span>{NAV.find((item) => item.id === section)?.label}</span><span className="studio-context">{extensionContext ? 'Extension studio' : 'Browser preview · changes stay here'}</span></div>
        <div className="topbar-actions"><span className={`save-status ${saveStatus === 'Save failed' ? 'failed' : ''}`} role="status"><span />{saveStatus}</span>
          <button className="subtle-button compact" onClick={() => void downloadTheme()}><Icon name="download" size={15} /><span>Export theme</span></button></div></header>

      <div className="workspace-body">
        <main className="main-panel" id="studio">
          {loadFailed && <div className="recovery-banner" role="alert"><div><strong>Your saved workspace could not be opened.</strong><p>Local defaults are available for preview. Restore them to resume saving changes.</p></div><button className="accent-button" onClick={() => { setLibrary(createDefaultLibrary()); setLoadFailed(false); setNotice('A fresh local workspace is ready.'); }}>Restore local defaults</button></div>}
          <div className="page-heading"><div><div className="eyebrow accent">{title[0]}</div><h1>{title[1]}<br /><em>{title[2]}</em></h1><p>{section === 'animations' ? 'Cinematic card animations. Completely your own.' : 'A personal touch, without changing the game.'}</p></div><span className="version-pill"><span /> ANIMATION STUDIO</span></div>

          <div className="preview-shell">
            <div className="preview-topline"><span><Icon name="table" size={15} /> YOUR PREVIEW TABLE</span><label className="player-picker">Players <select aria-label="Preview player count" value={players} onChange={(event) => setPlayers(Number(event.target.value))}>{Array.from({ length: 9 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count}</option>)}</select></label></div>
            {resolvedTheme ? <PreviewTable ref={preview} theme={resolvedTheme} settings={library.settings} street={street} players={players} slow={slow}
              onPlaying={setPlaying} onProgress={setProgress} onError={setNotice} /> : <div className="preview-loading">Preparing your table…</div>}
            <div className="playback-bar"><div className="playback-primary"><button className="play-button" onClick={togglePlayback} aria-label={playing && !paused ? 'Pause animation' : 'Play animation'}><Icon name={playing && !paused ? 'pause' : 'play'} size={17} /></button><button className="icon-button" title="Replay animation" aria-label="Replay animation" onClick={() => { setPendingPreview(null); setPaused(false); void preview.current?.replay(); }}><Icon name="replay" size={17} /></button><button className="icon-button" title="Reset hand" aria-label="Reset hand" onClick={() => { setPendingPreview(null); preview.current?.reset(); setPaused(false); }}><Icon name="reset" size={16} /></button></div>
              <div className="preview-timeline"><span className="timeline-dot" /><div className="timeline-track"><span style={{ width: `${progress * 100}%` }} /></div><span className="timeline-time">{(previewDuration / 1000).toFixed(1)}s</span></div>
              <button className={`slow-button ${slow ? 'active' : ''}`} onClick={() => setSlow(!slow)} aria-pressed={slow}><span>0.4×</span> Slow motion</button></div>
          </div>

          {section === 'animations' && <>
            <div className="event-selector"><span>ANIMATE THE</span><div className="street-tabs" role="tablist" aria-label="Poker event">{STREETS.map((item) => <button role="tab" aria-selected={street === item} key={item} className={street === item ? 'selected' : ''} onClick={() => setStreet(item)}>{prettyStreet(item)}{street === item && <span />}</button>)}</div><button className="text-button event-play" onClick={() => playStreet(street)}>Preview {prettyStreet(street).toLowerCase()}<Icon name="arrow" size={15} /></button></div>
            <div className="section-heading"><div><h2>Find your signature.</h2><p>Eight distinct effects. One unforgettable table.</p></div><span className="count-pill">8 PRESETS</span></div>
            <div className="preset-grid">{presets.map((preset, index) => {
              const assigned = activeTheme.animations[street].preset === preset.id;
              const compatible = preset.supportedEvents.includes(street);
              return <article className={`preset-card ${assigned ? 'selected' : ''} ${!compatible ? 'other-event' : ''}`} key={preset.id}>
                <button className="preset-select" onClick={() => selectPreset(preset.id)} aria-label={`Select ${preset.name}`} aria-pressed={assigned}>
                  <PresetArt id={preset.id} /><span className="preset-number">0{index + 1}</span><span className="preset-category">{preset.supportedEvents[0] === 'deal' ? 'DEAL' : preset.supportedEvents[0] === 'flop' ? 'FLOP' : 'TURN / RIVER'}</span>
                  {assigned && <span className="selected-check"><Icon name="check" size={12} /></span>}
                  <span className="preset-name">{preset.name}</span><span className="preset-description">{preset.description}</span>
                </button><button className="preset-preview-button" aria-label={`Preview ${preset.name}`} onClick={() => selectPreset(preset.id, true)}><Icon name="play" size={12} /><span>Preview</span></button>
              </article>;
            })}</div>
          </>}

          {section === 'cards' && <div className="appearance-section"><div className="section-heading"><div><h2>Build your deck.</h2><p>Artwork shared by every animation and your table.</p></div></div>
            <div className="face-style-grid">{(['native', 'classic', 'modern', 'midnight'] as const).map((face) => <button className={`face-style-card ${activeTheme.card.face === face ? 'selected' : ''}`} key={face} onClick={() => patchCard(FACE_STYLES[face])}><img src={cardDataUrl({ rank: 'A', suit: 'spades' }, { ...(resolvedTheme ?? activeTheme).card, ...FACE_STYLES[face] })} alt={`${face} ace of spades`} /><span>{face === 'native' ? 'PokerNow native' : face[0].toUpperCase() + face.slice(1)}</span>{activeTheme.card.face === face && <Icon name="check" size={14} />}</button>)}</div>
            <p className="helper-text">Native artwork is preserved on supported PokerNow cards. This preview shows a local equivalent.</p>
            <div className="editor-grid"><div className="editor-card"><h3>Card back</h3><div className="choice-row">{(['crosshatch', 'diamonds', 'solid'] as const).map((back) => <button key={back} className={activeTheme.card.back === back ? 'selected' : ''} onClick={() => patchCard({ back })}>{back[0].toUpperCase() + back.slice(1)}</button>)}</div><ColorControl label="Back color" value={activeTheme.card.backColor} onChange={(backColor) => patchCard({ backColor })} /><button className="subtle-button wide" onClick={() => uploadBackInput.current?.click()}><Icon name="upload" size={15} />Upload back image</button>{activeTheme.card.backImage && <button className="text-button" onClick={() => patchCard({ backImage: undefined, back: 'crosshatch' })}>Remove uploaded image</button>}</div>
              <div className="editor-card"><h3>Face & finish</h3><ColorControl label="Card background" value={activeTheme.card.faceColor} onChange={(faceColor) => patchCard({ faceColor })} /><ColorControl label="Hearts & diamonds" value={activeTheme.card.redColor} onChange={(redColor) => patchCard({ redColor })} /><ColorControl label="Spades & clubs" value={activeTheme.card.blackColor} onChange={(blackColor) => patchCard({ blackColor })} /><ColorControl label="Border" value={activeTheme.card.borderColor} onChange={(borderColor) => patchCard({ borderColor })} /><Range label="Corner radius" value={activeTheme.card.borderRadius} min={0} max={14} unit="px" onChange={(borderRadius) => patchCard({ borderRadius })} /><Range label="Card shadow" value={activeTheme.card.shadow} min={0} max={1} step={0.05} onChange={(shadow) => patchCard({ shadow })} /></div></div></div>}

          {section === 'table' && <div className="appearance-section"><div className="section-heading"><div><h2>Choose an atmosphere.</h2><p>From a quiet night game to a signature felt.</p></div></div><div className="table-theme-grid">{builtInThemes.map((theme) => <button className="table-theme-card" key={theme.id} onClick={() => patchTable(theme.table)}><span className="mini-table-scene" style={{ background: theme.table.backgroundColor }}><i style={{ background: theme.table.feltColor, borderColor: theme.table.railColor }} /></span><span>{theme.name}</span><Icon name="arrow" size={14} /></button>)}</div><div className="editor-grid"><div className="editor-card"><h3>Table finish</h3><ColorControl label="Felt" value={activeTheme.table.feltColor} onChange={(feltColor) => patchTable({ feltColor })} /><ColorControl label="Rail" value={activeTheme.table.railColor} onChange={(railColor) => patchTable({ railColor })} /><ColorControl label="Surroundings" value={activeTheme.table.backgroundColor} onChange={(backgroundColor) => patchTable({ backgroundColor })} /></div><div className="editor-card"><h3>Make it personal</h3><p className="helper-text">Use a local image for your table surroundings. Your image stays in this browser and travels with exported themes.</p><button className="subtle-button wide" onClick={() => uploadTableInput.current?.click()}><Icon name="upload" size={15} />Upload background</button>{activeTheme.table.backgroundImage && <button className="text-button" onClick={() => patchTable({ backgroundImage: undefined })}>Remove background image</button>}</div></div></div>}

          {section === 'board' && <div className="appearance-section"><div className="section-heading"><div><h2>Frame the action.</h2><p>Small details that make your reveals feel considered.</p></div></div><div className="editor-grid"><div className="editor-card"><h3>Community board</h3><ColorControl label="Backplate" value={activeTheme.board.color} onChange={(color) => patchBoard({ color })} /><ColorControl label="Highlight" value={activeTheme.board.highlight} onChange={(highlight) => patchBoard({ highlight })} /><Range label="Card spacing" value={activeTheme.board.spacing} min={4} max={24} unit="px" onChange={(spacing) => patchBoard({ spacing })} /><Range label="Card shadows" value={activeTheme.board.shadow} min={0} max={1} step={0.05} onChange={(shadow) => patchBoard({ shadow })} /></div><div className="editor-card quiet-card"><Icon name="board" size={32} /><h3>Always in the right place.</h3><p>Live animations finish at PokerNow’s measured card positions. Preview spacing lets you explore the look without changing the game layout.</p><div className="small-status"><span /> Canonical layout preserved</div></div></div></div>}

          {section === 'themes' && <div className="appearance-section"><div className="section-heading"><div><h2>Your collection.</h2><p>Save a mood. Share your signature.</p></div><button className="accent-button" onClick={createTheme}><Icon name="plus" size={15} />New theme</button></div><div className="theme-library">{library.themes.map((theme) => <button className={`theme-library-card ${theme.id === activeTheme.id ? 'selected' : ''}`} key={theme.id} onClick={() => setting('activeThemeId', theme.id)}><span className="theme-library-art" style={{ background: theme.table.backgroundColor }}><i style={{ background: theme.table.feltColor, borderColor: theme.table.railColor }} /><b style={{ background: theme.card.backColor }} /><b style={{ background: theme.card.faceColor }} /></span><span className="theme-library-info"><strong>{theme.name}</strong><small>{theme.id === activeTheme.id ? 'Active theme' : 'Click to use theme'}</small></span>{theme.id === activeTheme.id && <span className="selected-check"><Icon name="check" size={12} /></span>}</button>)}</div><div className="theme-actions"><button className="subtle-button" onClick={() => importInput.current?.click()}><Icon name="upload" size={15} />Import theme</button><button className="subtle-button" onClick={() => void downloadTheme()}><Icon name="download" size={15} />Export active theme</button><span>Portable JSON · images included</span></div><div className="editor-card theme-details"><div className="details-title"><h3>Active theme details</h3><span className="count-pill">SCHEMA V1</span></div><label className="text-field">Theme name<input key={activeTheme.id} aria-label="Theme name" value={activeTheme.name} autoFocus={editingName} onBlur={() => setEditingName(false)} maxLength={80} onChange={(event) => updateTheme((theme) => ({ ...theme, name: event.target.value }))} /></label><div className="button-row"><button className="subtle-button" onClick={duplicateTheme}><Icon name="copy" size={14} />Duplicate</button><button className="subtle-button" onClick={restoreTheme}><Icon name="reset" size={14} />Restore defaults</button><button className="subtle-button danger" onClick={deleteTheme}><Icon name="trash" size={14} />Delete theme</button></div></div></div>}

          {section === 'settings' && <div className="appearance-section"><div className="section-heading"><div><h2>A few final touches.</h2><p>Keep the experience comfortable and under your control.</p></div></div><div className="editor-card settings-card"><div className="setting-row"><div><h3>Enable customization</h3><p>Apply your visual theme and animations on supported PokerNow tables.</p></div><Toggle label="Enable customization in settings" checked={library.settings.enabled} onChange={(value) => setting('enabled', value)} /></div><div className="setting-row"><div><h3>Reduced motion</h3><p>Skip large movement, fragment flights, shake, and impact effects.</p></div><Toggle label="Reduced motion" checked={library.settings.reducedMotion} onChange={(value) => setting('reducedMotion', value)} /></div><Range label="Playback speed" value={library.settings.speed} min={0.5} max={2} step={0.1} unit="×" onChange={(value) => setting('speed', value)} /><div className="setting-note"><Icon name="check" size={17} /><p>Your settings and images stay local. Themes contain appearance data only. The extension never changes gameplay or accesses hidden cards.</p></div></div><div className="integration-note"><Icon name="external" size={18} /><div><strong>Preview and live support are verified separately.</strong><p>The studio runs all eight effects using sample cards. Live PokerNow compatibility depends on observable page structure; see the included compatibility report.</p></div></div></div>}

          {section === 'settings' && <div className="editor-card connection-card">
            <h3>PokerNow connection</h3>
            {!extensionContext && <p className="helper-text">This browser preview saves changes only on this website. To apply customization to PokerNow, open the installed extension using its Chrome toolbar icon.</p>}
            <button className="subtle-button" onClick={() => void checkConnection()} disabled={checkingConnection}>{checkingConnection ? 'Checking connection…' : 'Check PokerNow connection'}</button>
            {inspection && <div className="connection-results" role="status">
              {inspection.context === 'standalone' ? <p>Browser preview only. Open the extension studio from the Chrome toolbar to connect to PokerNow.</p>
                : !inspection.statuses.length ? <p>No PokerNow content script responded. Open a PokerNow table, refresh its tab after installing or reloading the extension, and check again.</p>
                  : inspection.statuses.map((status, index) => <div className={`connection-result state-${status.state}`} key={status.tabId ?? index}>
                    <strong>{status.state === 'ready' ? 'Connected' : status.state[0].toUpperCase() + status.state.slice(1)}</strong>
                    <p>{status.reason}</p>
                    <small>{status.tableCount} table · {status.seatCount} seats · {status.boardCount} boards · {status.cardCount} card elements</small>
                  </div>)}
            </div>}
          </div>}

          <footer className="main-footer"><span><Icon name="spark" size={13} /> A little more magic. The same game.</span><span>POKERNOW CUSTOMIZER / V1</span></footer>
        </main>

        <aside className="inspector"><div className="inspector-label"><span>{section === 'animations' ? 'ANIMATION PROPERTIES' : 'YOUR WORKSPACE'}</span><Icon name="settings" size={15} /></div>
          {section === 'animations' ? <>
            <div className="inspector-preset"><PresetArt id={selectedPreset.id} /><div className="eyebrow accent">{prettyStreet(street).toUpperCase()} EFFECT</div><h2>{selectedPreset.name}</h2><p>{selectedPreset.description}</p></div>
            <div className="inspector-content"><div className="inspector-section-title">Make it yours<button className="text-button" onClick={() => selectPreset(selectedPreset.id)}>Reset</button></div>
              {selectedPreset.parameters.map((parameter) => <Range key={parameter.key} label={parameter.label} value={currentParameters[parameter.key] ?? parameter.default} min={parameter.min} max={parameter.max} step={parameter.step} unit={parameter.unit} onChange={(value) => setParameter(parameter.key, value)} />)}
              <div className="parameter-divider" /><Range label="Playback speed" value={library.settings.speed} min={0.5} max={2} step={0.1} unit="×" onChange={(value) => setting('speed', value)} />
              <div className="inspector-toggle"><span>Reduced motion</span><Toggle label="Inspector reduced motion" checked={library.settings.reducedMotion} onChange={(value) => setting('reducedMotion', value)} /></div>
              <button className="accent-button wide preview-effect" onClick={() => playStreet(street)}><Icon name="play" size={15} />Preview effect</button>
            </div>
            <div className="assignments"><div className="eyebrow">YOUR HAND, CHOREOGRAPHED</div>{STREETS.map((item) => <button key={item} className={item === street ? 'active' : ''} onClick={() => setStreet(item)}><span className="assignment-dot" /><span>{prettyStreet(item)}<small>{getPreset(activeTheme.animations[item].preset)?.name ?? 'Default'}</small></span><Icon name="chevron" size={13} /></button>)}</div>
          </> : <><div className="workspace-inspector-art"><span className="inspector-monogram">pn<sup>✦</sup></span><span>YOUR TABLE, REIMAGINED.</span></div><div className="inspector-content"><div className="eyebrow accent">ACTIVE THEME</div><h2 className="theme-inspector-title">{activeTheme.name}</h2><p className="helper-text">Every change is saved automatically. Take the whole look with you in a portable theme.</p><button className="subtle-button wide" onClick={() => void downloadTheme()}><Icon name="download" size={15} />Export this theme</button><button className="subtle-button wide" onClick={duplicateTheme}><Icon name="copy" size={15} />Duplicate theme</button><div className="parameter-divider" /><div className="eyebrow">QUICK PREVIEW</div><div className="quick-preview-grid">{STREETS.map((item) => <button key={item} onClick={() => playStreet(item)}><Icon name="play" size={12} />{prettyStreet(item)}</button>)}</div></div><div className="inspector-tip"><Icon name="spark" size={18} /><p>Switch back to Animation Studio to fine-tune each moment of the hand.</p></div></>}
          <div className="inspector-footnote"><span /><p>Presentation only.<br />PokerNow stays in control.</p></div>
        </aside>
      </div>
    </div>
    {notice && <div className="toast" role="status"><Icon name="spark" size={17} /><p>{notice}</p><button onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div>}
    <input hidden ref={importInput} type="file" accept="application/json,.json" onChange={(event) => { void readTheme(event.target.files?.[0]); event.target.value = ''; }} />
    <input hidden ref={uploadBackInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'back'); event.target.value = ''; }} />
    <input hidden ref={uploadTableInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void upload(event.target.files?.[0], 'table'); event.target.value = ''; }} />
  </div>;
}
