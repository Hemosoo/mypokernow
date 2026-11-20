import { useRef, useState } from 'react';
import { isBuiltIn } from '../themes/defaults';
import type { Page, Studio } from './studio-types';
import { ThemeDot, ThemePreview } from './ThemePreview';
import { Icon, Kbd, moveFocus, useDismiss, type IconName } from './ui';

export const PAGES: { id: Page; label: string; icon: IconName; blurb: string }[] = [
  { id: 'discover', label: 'Discover', icon: 'compass', blurb: 'What the customizer can do' },
  { id: 'themes', label: 'Themes', icon: 'library', blurb: 'Browse, apply and manage complete looks' },
  { id: 'appearance', label: 'Appearance', icon: 'brush', blurb: 'Cards, table, room and board' },
  { id: 'effects', label: 'Effects', icon: 'spark', blurb: 'How cards are dealt and revealed' },
  { id: 'companion', label: 'Companion', icon: 'paw', blurb: 'The 3D puppy who lives on your table' },
  { id: 'settings', label: 'Settings', icon: 'settings', blurb: 'PokerNow, motion, performance and data' },
];

export function Rail({ page, onGo, onShortcuts }: { page: Page; onGo: (page: Page) => void; onShortcuts: () => void }) {
  const item = (entry: typeof PAGES[number]) => <button type="button" key={entry.id} className={`rail-item ${page === entry.id ? 'on' : ''}`}
    aria-current={page === entry.id ? 'page' : undefined} onClick={() => onGo(entry.id)} title={entry.blurb}>
    <Icon name={entry.icon} size={20} /><span>{entry.label}</span></button>;
  return <nav className="rail" aria-label="Studio">
    <div className="rail-main">{PAGES.filter((entry) => entry.id !== 'settings').map(item)}</div>
    <div className="rail-end">
      {item(PAGES.find((entry) => entry.id === 'settings')!)}
      <button type="button" className="rail-item quiet" onClick={onShortcuts} title="Keyboard shortcuts (?)"><Icon name="keyboard" size={20} /><span>Keys</span></button>
    </div>
  </nav>;
}

type SaveStatus = 'loading' | 'saving' | 'saved' | 'failed' | 'blocked';
const SAVE_TEXT: Record<SaveStatus, string> = { loading: 'Loading', saving: 'Saving…', saved: 'Saved', failed: 'Not saved', blocked: 'Name the theme to save' };

export function TopBar({ studio, saveStatus, canUndo, canRedo, onUndo, onRedo, onSearch }: {
  studio: Studio; saveStatus: SaveStatus; canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; onSearch: () => void;
}) {
  const { library, theme, extensionContext } = studio;
  const enabled = library.settings.enabled;
  const live = enabled && extensionContext;
  const state = !enabled ? 'Off' : extensionContext ? 'Live' : 'Preview only';
  const stateTitle = !enabled ? 'PokerNow shows its normal table. Your themes are kept.'
    : extensionContext ? `“${theme.name}” is applied to every PokerNow table you open.`
      : 'This is a browser preview of the studio. Open it from the extension’s toolbar icon to apply changes to PokerNow.';
  return <header className="topbar">
    <a className="brand" href="#discover" onClick={(event) => { event.preventDefault(); studio.goTo('discover'); }} aria-label="PokerNow Customizer, Discover">
      <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 3c1.4 2.5 7 6.2 7 10a4 4 0 0 1-6.3 3.3c.3 1.6 1 2.8 2.3 3.7H9c1.3-.9 2-2.1 2.3-3.7A4 4 0 0 1 5 13c0-3.8 5.6-7.5 7-10Z" fill="currentColor" /></svg></span>
      <span className="brand-name">Customizer</span>
    </a>
    <ThemeSwitcher studio={studio} />
    <div className="topbar-tools">
      <button type="button" className="ghost-button simple-switch" onClick={() => studio.setting('mode', 'simple')} title="Just pick a theme: one page of ready-made tables">Simple view</button>
      <button type="button" className="search" onClick={onSearch} aria-label="Search the studio" aria-keyshortcuts="Meta+K Control+K /"><Icon name="search" size={16} /><span>Search</span><Kbd>⌘K</Kbd></button>
      <div className="history" role="group" aria-label="History">
        <button type="button" className="icon-button" onClick={onUndo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)" aria-keyshortcuts="Meta+Z Control+Z"><Icon name="undo" size={17} /></button>
        <button type="button" className="icon-button" onClick={onRedo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)" aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"><Icon name="redo" size={17} /></button>
      </div>
      <span className={`save-status s-${saveStatus}`} role="status" title={saveStatus === 'saved' ? 'Every change saves automatically' : undefined}>
        {saveStatus === 'saved' ? <Icon name="check" size={14} /> : <i aria-hidden="true" />}{SAVE_TEXT[saveStatus]}</span>
    </div>
    <button type="button" className={`power ${live ? 'live' : ''} ${enabled ? 'on' : 'off'}`} role="switch" aria-checked={enabled} aria-label="Enable customization on PokerNow"
      title={stateTitle} onClick={() => studio.setting('enabled', !enabled)}>
      <span className="power-text"><b>PokerNow</b><small><i aria-hidden="true" />{state}</small></span>
      <span className={`switch ${enabled ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
    </button>
  </header>;
}

function ThemeSwitcher({ studio }: { studio: Studio }) {
  const { library, theme } = studio;
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  useDismiss(open, () => { setOpen(false); button.current?.focus(); }, [button, popover]);
  const recent = library.settings.recent.map((id) => library.themes.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item) && item!.id !== theme.id).slice(0, 3);
  const choose = (id: string) => { studio.applyTheme(id); setOpen(false); button.current?.focus(); };
  const option = (item: typeof theme) => <button type="button" role="menuitemradio" aria-checked={item.id === theme.id} key={item.id} className={`switcher-item ${item.id === theme.id ? 'on' : ''}`} onClick={() => choose(item.id)}>
    <ThemeDot theme={item} size={26} /><span>{item.name}<small>{isBuiltIn(item.id) ? 'Built-in' : 'Yours'}{item.companion ? (item.companion.kind === 'cat' ? ' · Cat' : ' · Puppy') : ''}</small></span>{item.id === theme.id && <Icon name="check" size={15} />}</button>;
  return <div className="switcher">
    <button ref={button} type="button" className="switcher-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}
      onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); window.setTimeout(() => popover.current?.querySelector<HTMLElement>('[role="menuitemradio"]')?.focus(), 0); } }}>
      <ThemePreview theme={theme} detail="table" className="switcher-thumb" />
      <span className="switcher-text"><small>Theme in use</small><b>{theme.name}</b></span>
      <Icon name="down" size={15} />
    </button>
    {open && <div ref={popover} className="switcher-menu" role="menu" aria-label="Switch theme" onKeyDown={(event) => moveFocus(event, popover.current, '[role="menuitemradio"], .switcher-foot button')}>
      {recent.length > 0 && <><p className="menu-label">Recent</p>{recent.map(option)}</>}
      <p className="menu-label">All themes</p>
      <div className="switcher-list">{library.themes.map(option)}</div>
      <div className="switcher-foot">
        <button type="button" className="text-button" onClick={() => { setOpen(false); studio.goTo('themes'); }}><Icon name="library" size={15} />Open the gallery</button>
        <button type="button" className="text-button" onClick={() => { setOpen(false); studio.createTheme(); }}><Icon name="plus" size={15} />New theme</button>
      </div>
    </div>}
  </div>;
}
