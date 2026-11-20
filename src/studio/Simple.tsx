import { useEffect, useMemo, useRef, useState } from 'react';
import { aiPrompt } from '../themes/ai';
import { colourwayOf, isBuiltIn, isOriginal } from '../themes/defaults';
import type { StudioMode, Theme } from '../types';
import { Colourways } from './pages/Themes';
import type { Studio } from './studio-types';
import { ThemePreview } from './ThemePreview';
import { Icon } from './ui';

/**
 * The studio has two ways in. "Just pick a theme" is a single page of ready-made
 * tables, one click each, plus importing one a friend or an AI made. "Customize
 * everything" is the full workspace. The choice is asked once and can be changed
 * any time from either side.
 */

const Brand = () => <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3c1.4 2.5 7 6.2 7 10a4 4 0 0 1-6.3 3.3c.3 1.6 1 2.8 2.3 3.7H9c1.3-.9 2-2.1 2.3-3.7A4 4 0 0 1 5 13c0-3.8 5.6-7.5 7-10Z" fill="currentColor" /></svg></span>;

export function Welcome({ studio, onChoose }: { studio: Studio; onChoose: (mode: StudioMode) => void }) {
  const fan = useMemo(() => ['room-neon', 'room-cat', 'room-arcade'].map((id) => studio.library.themes.find((theme) => theme.id === id)).filter((theme): theme is Theme => Boolean(theme)), [studio.library.themes]);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  return <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
    <div className="welcome-card">
      <span className="welcome-brand"><Brand />PokerNow Customizer</span>
      <h1 id="welcome-title">How would you like to start?</h1>
      <div className="welcome-choices">
        <button ref={first} type="button" className="welcome-choice" onClick={() => onChoose('simple')}>
          <span className="welcome-art fan">{fan.map((theme) => <ThemePreview key={theme.id} theme={theme} detail="table" />)}</span>
          <b>Just pick a theme</b>
          <small>Ready-made tables, one click each. Import one a friend or an AI made.</small>
        </button>
        <button type="button" className="welcome-choice" onClick={() => onChoose('studio')}>
          <span className="welcome-art studio-art" aria-hidden="true"><Icon name="brush" size={30} /><Icon name="cards" size={30} /><Icon name="spark" size={30} /></span>
          <b>Customize everything</b>
          <small>The full studio: cards, felt, effects, wins and the companion, on a live preview table.</small>
        </button>
      </div>
      <p className="welcome-note">You can switch at any time.</p>
    </div>
  </div>;
}

export function SimpleHome({ studio }: { studio: Studio }) {
  const { library, theme, extensionContext } = studio;
  const enabled = library.settings.enabled;
  const state = !enabled ? 'Off' : extensionContext ? 'Live' : 'Preview only';
  const builtIn = library.themes.filter((item) => isBuiltIn(item.id));
  const own = library.themes.filter((item) => !isBuiltIn(item.id));
  return <div className="simple">
    <header className="simple-bar">
      <span className="welcome-brand"><Brand />PokerNow Customizer</span>
      <div className="simple-tools">
        <button type="button" className="ghost-button" onClick={() => studio.setting('mode', 'studio')}><Icon name="brush" size={15} />Customize</button>
        <button type="button" className={`power ${enabled && extensionContext ? 'live' : ''} ${enabled ? 'on' : 'off'}`} role="switch" aria-checked={enabled} aria-label="Enable customization on PokerNow"
          onClick={() => studio.setting('enabled', !enabled)}>
          <span className="power-text"><b>PokerNow</b><small><i aria-hidden="true" />{state}</small></span>
          <span className={`switch ${enabled ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
        </button>
      </div>
    </header>
    <main className="simple-main">
      <section className="simple-hero">
        <h1>Pick your table</h1>
        <p>{extensionContext ? 'One click and it’s on every PokerNow table you open.' : 'One click to choose. Open this from the extension’s toolbar icon to use it on PokerNow.'} Change it whenever you like.</p>
      </section>
      <div className="simple-grid">
        {[...builtIn, ...own].map((item) => <SimpleCard key={item.id} item={item} studio={studio} active={item.id === theme.id} own={!isBuiltIn(item.id)} />)}
        <button type="button" className="simple-import" onClick={studio.openImport}>
          <Icon name="upload" size={24} /><b>Import a theme</b><small>One a friend exported, or one an AI assistant wrote for you.</small>
        </button>
      </div>
      <p className="fine-print"><Icon name="check" size={15} />Only the look of the table changes. The game, the cards and PokerNow’s buttons never do.</p>
    </main>
  </div>;
}

/**
 * A recording of the theme playing on a table (scripts/capture-themes.mjs): built-in
 * themes exactly as shipped, and Classic in each of its colourways. A theme someone
 * changed has no recording, since it would show the wrong look.
 */
export function themeClip(theme: Theme): string | undefined {
  if (!isBuiltIn(theme.id) || !isOriginal(theme)) return undefined;
  const colourway = theme.id === 'room-monte-carlo' ? colourwayOf(theme)?.id : undefined;
  if (theme.id === 'room-monte-carlo' && !colourway) return undefined;
  return `./media/theme-${colourway ? `${theme.id}.${colourway}` : theme.id}.webm`;
}

/** React sets `muted` as a property only; Chrome needs the attribute to autoplay without a click. */
function startMuted(video: HTMLVideoElement | null): void {
  if (!video) return;
  video.muted = true; video.defaultMuted = true; video.setAttribute('muted', '');
  void video.play?.()?.catch(() => { /* The still preview stays. */ });
}

function SimpleCard({ item, studio, active, own }: { item: Theme; studio: Studio; active: boolean; own: boolean }) {
  const classic = item.id === 'room-monte-carlo';
  const note = classic ? `${colourwayOf(item)?.name ?? 'Your colours'} · choose a colourway below` : item.description || (own ? 'Your theme' : '');
  const clip = studio.motionAllowed ? themeClip(item) : undefined;
  // Hovering (or focusing) a card plays the theme for real; the Watch button does the same on a touch screen.
  const [watching, setWatching] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<number>(0);
  const watch = (): void => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setWatching(true), 120); };
  const stop = (): void => { window.clearTimeout(timer.current); setWatching(false); setReady(false); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { setReady(false); }, [clip]);
  return <article className={`simple-card ${active ? 'active' : ''} ${watching && ready ? 'watching' : ''}`} onMouseEnter={clip ? watch : undefined} onMouseLeave={clip ? stop : undefined}
    onFocus={clip ? watch : undefined} onBlur={clip ? (event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) stop(); } : undefined}>
    <button type="button" className="simple-pick" onClick={() => studio.applyTheme(item.id)} aria-pressed={active} aria-label={active ? `${item.name}, in use` : `Use ${item.name}`}>
      <ThemePreview theme={item} />
      {clip && watching && <video key={clip} ref={startMuted} className={ready ? 'ready' : ''} src={clip} autoPlay muted loop playsInline preload="auto" aria-hidden="true" onPlaying={() => setReady(true)} />}
      {active && <span className="theme-flag"><Icon name="check" size={12} />In use</span>}
    </button>
    {clip && <button type="button" className={`simple-watch ${watching ? 'on' : ''}`} aria-pressed={watching} aria-label={watching ? `Stop the ${item.name} preview` : `Watch ${item.name} play`}
      onClick={() => (watching ? stop() : setWatching(true))}><Icon name={watching ? 'pause' : 'play'} size={13} />{watching ? 'Playing' : 'Watch'}</button>}
    <div className="simple-info">
      <b>{item.name}{own && <span className="tag">Yours</span>}</b>
      <small>{note}</small>
      {classic && <Colourways theme={item} studio={studio} />}
    </div>
  </article>;
}

export function ImportDialog({ onClose, onFile, onText }: { onClose: () => void; onFile: () => void; onText: (text: string) => Promise<string | undefined> }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(aiPrompt, []);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const key = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const submit = async (): Promise<void> => {
    setBusy(true); setError('');
    const problem = await onText(text);
    setBusy(false);
    if (problem) setError(problem);
  };
  const copy = async (): Promise<void> => {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { setCopied(false); setError('Copying was blocked. Open “See the prompt” and copy it from there.'); }
  };
  return <div className="modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <header className="dialog-head"><h2 id="import-title">Import a theme</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close" size={17} /></button></header>

      <section className="import-part">
        <div><h3>From a file</h3><p>A theme someone exported from this extension.</p></div>
        <button type="button" className="secondary-button" onClick={onFile}><Icon name="upload" size={15} />Choose a file…</button>
      </section>

      <section className="import-part stacked">
        <h3><label htmlFor="theme-code">Paste a theme</label></h3>
        <p>Paste an AI assistant’s whole answer, or theme code from anywhere. Anything around the theme is ignored.</p>
        <textarea id="theme-code" ref={area} value={text} onChange={(event) => { setText(event.target.value); setError(''); }} spellCheck={false}
          placeholder={'{\n  "name": "Deep Sea",\n  "card": { … },\n  "table": { … }\n}'} rows={7} />
        {error && <p className="import-error" role="alert">{error}</p>}
        <button type="button" className="primary-button" disabled={!text.trim() || busy} onClick={() => { void submit(); }}>{busy ? 'Importing…' : 'Import and use'}</button>
      </section>

      <section className="import-part stacked ai">
        <h3><Icon name="spark" size={16} />Make one with AI</h3>
        <ol>
          <li>Copy the prompt and paste it into ChatGPT, Claude, Gemini or any assistant.</li>
          <li>Add what you’d like, for example “a deep-sea table with glowing jellyfish colours”.</li>
          <li>Paste its answer into the box above.</li>
        </ol>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => { void copy(); }}><Icon name={copied ? 'check' : 'copy'} size={15} />{copied ? 'Copied' : 'Copy the prompt'}</button>
        </div>
        <details><summary>See the prompt</summary><pre className="prompt">{prompt}</pre></details>
      </section>
    </div>
  </div>;
}
