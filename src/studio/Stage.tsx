import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { getPreset, presets } from '../animation/registry';
import { LiveTable, type LiveTableHandle } from '../preview/LiveTable';
import { PreviewTable, type PreviewHandle } from '../preview/PreviewTable';
import type { CompanionAction, Street, Theme } from '../types';
import { STREETS, assignmentLabel, presetName, streetName, streetShort } from './catalog';
import type { NowPlaying, Studio } from './studio-types';
import { Icon, Kbd } from './ui';

interface Props {
  studio: Studio;
  preview: RefObject<PreviewHandle | LiveTableHandle | null>;
  previewMode: 'live' | 'lab';
  resolvedTheme: Theme | undefined;
  shown: Theme;
  players: number;
  setPlayers: (count: number) => void;
  rate: number;
  setRate: (rate: number) => void;
  playing: boolean;
  paused: boolean;
  progress: number;
  nowPlaying: NowPlaying | null;
  original: boolean;
  setOriginal: (on: boolean) => void;
  onPlaying: (playing: boolean) => void;
  onProgress: (progress: number) => void;
  onMoment: (street: Street | undefined) => void;
  onToggle: () => void;
  onReplay: () => void;
  onReset: () => void;
  onPlay: (street: Street) => void;
  onHand: () => void;
  onError: (message: string) => void;
  onReady: () => void;
  collapsed: boolean;
  onExpandPanel: () => void;
  onEquipTrial: () => void;
}

const RATES: [number, string][] = [[0.25, '¼×'], [0.5, '½×'], [1, '1×']];
const WIN_NAMES = ['', 'Small pot', 'Medium pot', 'Big pot', 'All-in won', 'You won'];
/** How much the stage enlarges around the companion on the Companion page (see .stage-zoom.zoomed). */
const ZOOM = 1.6;
const PETS: CompanionAction[] = ['tilt', 'bark', 'scratch', 'stretch'];

export function Stage(props: Props) {
  const { studio, preview, previewMode, resolvedTheme, shown, players, rate, playing, paused, progress, nowPlaying, original } = props;
  const frame = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ width: number; height: number } | undefined>();
  const zoomBox = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [closeUp, setCloseUp] = useState(true);
  const [focus, setFocus] = useState<{ x: number; y: number } | undefined>();
  const companionPage = studio.page === 'companion';
  const hasCompanion = Boolean(shown.companion);
  const zoomed = companionPage && closeUp && hasCompanion && Boolean(focus) && previewMode === 'live';

  // The replica table is 16:9. Fit the largest such box into the space the stage has.
  useEffect(() => {
    const element = area.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const w = Math.min(width, height * 16 / 9);
      setFit({ width: Math.floor(w), height: Math.floor(w * 9 / 16) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);

  // On the Companion page the stage follows the puppy so it can be seen up close.
  useEffect(() => {
    if (!companionPage || !hasCompanion || previewMode !== 'live') { setFocus(undefined); return; }
    const read = () => {
      const at = (preview.current as LiveTableHandle | null)?.companionAt?.();
      setFocus((current) => !at ? current : current && Math.abs(current.x - at.x) < 0.01 && Math.abs(current.y - at.y) < 0.01 ? current : at);
    };
    read();
    const timer = window.setInterval(read, 350);
    return () => window.clearInterval(timer);
  }, [companionPage, hasCompanion, previewMode, preview]);

  // Render the companion sharper while the close-up enlarges it.
  useEffect(() => { (preview.current as LiveTableHandle | null)?.zoom?.(zoomed ? ZOOM : 1); }, [zoomed, preview]);
  const scrubbing = useRef(false);
  // Only once the effect is under way: before its first frame there is nothing to hold.
  const canScrub = playing && !nowPlaying?.win && previewMode === 'live' && progress > 0 && progress < 1;
  const seek = (value: number): void => { (preview.current as LiveTableHandle | null)?.seek?.(value); };

  const assigned = nowPlaying ? assignmentLabel(studio.theme, nowPlaying.street) : assignmentLabel(studio.theme, studio.street);
  const trialPreset = nowPlaying?.trial && nowPlaying.presetId ? getPreset(nowPlaying.presetId) : undefined;
  const effectName = nowPlaying?.win ? WIN_NAMES[nowPlaying.win]! : nowPlaying?.hand ? 'Your whole hand' : trialPreset ? presetName(trialPreset)
    : nowPlaying?.presetId && nowPlaying.presetId !== 'random' ? presetName(getPreset(nowPlaying.presetId) ?? presets[0]!) : assigned.name;
  const eventName = nowPlaying?.win ? 'Win' : nowPlaying ? (nowPlaying.hand ? `Now: ${streetName(nowPlaying.street)}` : streetName(nowPlaying.street)) : streetName(studio.street);

  const pet = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = zoomBox.current?.getBoundingClientRect();
    const at = (preview.current as LiveTableHandle | null)?.companionAt?.();
    if (!box || !at) return;
    const x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height;
    if (Math.abs(x - at.x) < 0.07 && y > at.y - 0.2 && y < at.y + 0.06) studio.companionAct(PETS[Math.floor(Math.random() * PETS.length)]!);
  };

  return <section className="stage" aria-label="Table preview">
    <div className="stage-head">
      <span className="sim-tag" title="A sample hand on a replica table. Nothing here touches a real game."><i aria-hidden="true" />Simulated table</span>
      <div className="stage-tools">
        {companionPage && hasCompanion && previewMode === 'live' && <button type="button" className={`chip-button ${closeUp ? 'on' : ''}`} aria-pressed={closeUp} onClick={() => setCloseUp(!closeUp)}>
          <Icon name="eye" size={15} />Close-up</button>}
        <label className="players" title="Players at the preview table">
          <span>Players</span>
          <select aria-label="Preview player count" value={players} onChange={(event) => props.setPlayers(Number(event.target.value))}>
            {Array.from({ length: 9 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
        <button type="button" className="icon-button" onClick={() => { if (fullscreen) void document.exitFullscreen?.(); else void frame.current?.requestFullscreen?.(); }}
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen preview'} title={fullscreen ? 'Exit full screen' : 'Full screen'}><Icon name="expand" size={17} /></button>
        {props.collapsed && <button type="button" className="icon-button" onClick={props.onExpandPanel} aria-label="Show the panel" title="Show the panel"><Icon name="panel" size={17} /></button>}
      </div>
    </div>

    <div ref={area} className="stage-area">
    <div ref={frame} className={`stage-frame ${original ? 'original' : ''} ${fit && fit.width < 780 ? 'narrow' : ''}`} style={{ backgroundColor: original ? '#191a1a' : `color-mix(in srgb, ${shown.table.backgroundColor} 30%, #000)`,
      ...(fit && !fullscreen ? { width: fit.width, height: fit.height } : {}) }}>
      <div ref={zoomBox} className={`stage-zoom ${zoomed ? 'zoomed' : ''}`} style={zoomed && focus ? { transformOrigin: `${(focus.x * 100).toFixed(1)}% ${(focus.y * 100 - 6).toFixed(1)}%` } as CSSProperties : undefined}>
        {resolvedTheme ? previewMode === 'live'
          ? <LiveTable key="live" ref={preview as React.RefObject<LiveTableHandle>} theme={resolvedTheme} settings={studio.library.settings} players={players} rate={rate} original={original}
            onMoment={props.onMoment} onPlaying={props.onPlaying} onProgress={props.onProgress} onError={props.onError} onReady={props.onReady} />
          : <PreviewTable key="lab" ref={preview as React.RefObject<PreviewHandle>} theme={resolvedTheme} settings={studio.library.settings} street={studio.street} players={players} rate={rate}
            onPlaying={props.onPlaying} onProgress={props.onProgress} onError={props.onError} /> : <div className="stage-loading">Setting the table…</div>}
        {companionPage && hasCompanion && previewMode === 'live' && <div className="pet-layer" onPointerDown={pet} aria-hidden="true" />}
      </div>

      {studio.previewing && <div className="stage-banner" role="status">
        <span><small>Previewing</small><b>{studio.previewing.name}</b></span>
        <span className="banner-note">Not applied. {studio.theme.name} is still in use on PokerNow.</span>
        <button type="button" className="primary-button" onClick={() => studio.applyTheme(studio.previewing!.id)}>Use this theme</button>
        <button type="button" className="ghost-button" onClick={() => studio.previewTheme(undefined)}>Back to {studio.theme.name}<Kbd>Esc</Kbd></button>
      </div>}
      {!studio.previewing && trialPreset && nowPlaying && <div className="stage-banner trial" role="status">
        <span><small>Trying on the {streetShort(nowPlaying.street).toLowerCase()}</small><b>{presetName(trialPreset)}</b></span>
        <span className="banner-note">Not equipped. The {streetShort(nowPlaying.street).toLowerCase()} still uses {assignmentLabel(studio.theme, nowPlaying.street).name}.</span>
        <button type="button" className="primary-button" onClick={props.onEquipTrial}>Equip</button>
      </div>}
      {original && <span className="compare-tag">Without your theme</span>}

      {previewMode === 'live' && <button type="button" className={`compare ${original ? 'on' : ''}`} aria-pressed={original} aria-keyshortcuts="C" title="Hold to see the table without your theme"
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); props.setOriginal(true); }} onPointerUp={() => props.setOriginal(false)} onPointerCancel={() => props.setOriginal(false)}
        onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); props.setOriginal(true); } }}
        onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') props.setOriginal(false); }} onBlur={() => props.setOriginal(false)}>
        <Icon name="eye" size={15} />Hold to compare<Kbd>C</Kbd></button>}
    </div>
    </div>

    <div className="player" aria-label="Playback">
      <div className="player-buttons">
        <button type="button" className="play" onClick={props.onToggle} aria-label={playing && !paused ? 'Pause animation' : 'Play animation'} aria-keyshortcuts="Space" title="Play or pause (Space)"><Icon name={playing && !paused ? 'pause' : 'play'} size={18} /></button>
        <button type="button" className="icon-button" title="Replay (R)" aria-label="Replay animation" onClick={props.onReplay}><Icon name="replay" size={17} /></button>
        <button type="button" className="icon-button" title="Reset the table" aria-label="Reset the table" onClick={props.onReset}><Icon name="reset" size={17} /></button>
      </div>
      <div className="player-now"><small>{eventName}</small><b>{effectName}</b>
        <span className="player-track" aria-hidden="true"><span style={{ transform: `scaleX(${playing || progress === 1 ? progress : 0})` }} /></span>
        {/* Drag to hold the effect on any moment; let go and it carries on. */}
        <input type="range" className="scrub" min={0} max={1000} step={1} value={Math.round((playing ? progress : 0) * 1000)} disabled={!canScrub}
          aria-label="Scrub through the effect" title={canScrub ? 'Drag to see any moment of the effect' : 'Play an effect to scrub through it'}
          onPointerDown={() => { scrubbing.current = true; preview.current?.pause(); }}
          onPointerUp={() => { scrubbing.current = false; if (!paused) preview.current?.resume(); }}
          onPointerCancel={() => { scrubbing.current = false; if (!paused) preview.current?.resume(); }}
          onChange={(event) => seek(Number(event.target.value) / 1000)} /></div>
      <div className="player-streets" role="group" aria-label="Play a moment">
        {STREETS.map((item, index) => <button type="button" key={item} className={`${studio.street === item ? 'on' : ''} ${playing && nowPlaying?.street === item ? 'live' : ''}`}
          aria-keyshortcuts={String(index + 1)} aria-pressed={studio.street === item} title={`${streetName(item)} (${index + 1})`} onClick={() => props.onPlay(item)}>{streetShort(item)}</button>)}
        <button type="button" className={`hand ${nowPlaying?.hand && playing ? 'live' : ''}`} title="A whole hand (H)" onClick={props.onHand}><Icon name="hand" size={15} />Hand</button>
      </div>
      <button type="button" className={`rate ${rate < 1 ? 'on' : ''}`} onClick={() => props.setRate(RATES[(RATES.findIndex(([value]) => value === rate) + RATES.length - 1) % RATES.length]![0])}
        aria-label={`Preview speed ${RATES.find(([value]) => value === rate)?.[1] ?? '1×'}. Change preview speed`} title="Preview speed only, never saved. Your PokerNow speed is in Settings.">
        <Icon name="slow" size={15} />{RATES.find(([value]) => value === rate)?.[1] ?? '1×'}</button>
    </div>
  </section>;
}
