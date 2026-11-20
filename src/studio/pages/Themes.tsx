import { useRef, useState } from 'react';
import { CLASSIC_COLOURWAYS, colourwayOf, isBuiltIn, isOriginal } from '../../themes/defaults';
import type { Theme } from '../../types';
import { assignmentLabel } from '../catalog';
import type { Studio } from '../studio-types';
import { ThemePreview } from '../ThemePreview';
import { Icon, moveFocus, useDismiss } from '../ui';

const modified = (theme: Theme): boolean => isBuiltIn(theme.id) && !isOriginal(theme);

/** Classic's colourways as a row of felt-and-trim swatches. */
export function Colourways({ theme, studio, compact = false }: { theme: Theme; studio: Pick<Studio, 'useColourway'>; compact?: boolean }) {
  const current = colourwayOf(theme)?.id;
  return <div className={`colourways ${compact ? 'compact' : ''}`} role="radiogroup" aria-label={`${theme.name} colourway`}>
    {CLASSIC_COLOURWAYS.map((item) => <button type="button" role="radio" key={item.id} aria-checked={current === item.id} className={current === item.id ? 'on' : ''}
      title={`${item.name}: ${item.note}`} aria-label={item.name} onClick={() => studio.useColourway(item.id)}
      style={{ '--felt': item.look.table.feltColor, '--trim': item.look.table.trimColor } as React.CSSProperties}>
      <i aria-hidden="true" />{!compact && <span>{item.name}</span>}</button>)}
  </div>;
}

export function ThemesPage({ studio }: { studio: Studio }) {
  const { library, theme } = studio;
  const builtIn = library.themes.filter((item) => isBuiltIn(item.id));
  const own = library.themes.filter((item) => !isBuiltIn(item.id));
  return <div className="page themes-page">
    <header className="page-head with-actions">
      <div><h2>Themes</h2><p>A theme is a whole look: deck, table, room, effects and companion. Click one to preview it on the table.</p></div>
      <div className="head-actions">
        <button type="button" className="secondary-button" onClick={studio.surpriseTheme} title="Make a new theme from a random palette, deck and set of effects"><Icon name="dice" size={15} />Surprise me</button>
        <button type="button" className="primary-button" onClick={studio.createTheme}><Icon name="plus" size={15} />New theme</button>
      </div>
    </header>

    <CurrentTheme studio={studio} />

    <section className="gallery-section" aria-labelledby="own-title">
      <header className="gallery-head"><h3 id="own-title">Your themes</h3>
        <button type="button" className="text-button" onClick={studio.openImport}><Icon name="upload" size={14} />Import</button></header>
      {own.length ? <div className="theme-grid">{own.map((item) => <ThemeCard key={item.id} item={item} studio={studio} active={item.id === theme.id} />)}</div>
        : <div className="empty-row"><p>Themes you create, duplicate or import live here, so the built-ins stay as they are.</p>
          <button type="button" className="secondary-button small" onClick={() => studio.duplicateTheme(theme.id)}><Icon name="copy" size={14} />Duplicate {theme.name}</button></div>}
    </section>

    <section className="gallery-section" aria-labelledby="builtin-title">
      <header className="gallery-head"><h3 id="builtin-title">Built-in</h3><span className="count">{builtIn.length}</span></header>
      <div className="theme-grid">{builtIn.map((item) => <ThemeCard key={item.id} item={item} studio={studio} active={item.id === theme.id} />)}</div>
    </section>
  </div>;
}

function CurrentTheme({ studio }: { studio: Studio }) {
  const { theme } = studio;
  const [editing, setEditing] = useState(false);
  const own = !isBuiltIn(theme.id);
  const changed = modified(theme);
  const effects = (['deal', 'flop', 'turn', 'river'] as const).map((street) => assignmentLabel(theme, street).name);
  return <section className="current" aria-label="Theme in use">
    <ThemePreview theme={studio.display} className="current-art" />
    <div className="current-body">
      <span className="eyebrow">In use{studio.library.settings.enabled ? '' : ' · PokerNow customization is off'}</span>
      {editing ? <input className="rename" autoFocus defaultValue={theme.name} maxLength={80} aria-label="Theme name"
        onBlur={(event) => { const name = event.target.value.trim(); if (name) studio.renameTheme(theme.id, name); setEditing(false); }}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = theme.name; event.currentTarget.blur(); } }} />
        : <h3>{theme.name}<button type="button" className="icon-button tiny" aria-label="Rename this theme" title="Rename" onClick={() => setEditing(true)}><Icon name="pencil" size={14} /></button></h3>}
      <p className="current-meta">{own ? 'Your theme' : changed ? 'Built-in, with your changes' : 'Built-in'}{theme.companion ? ` · with the ${theme.companion.kind}` : ''}{colourwayOf(theme) ? ` · ${colourwayOf(theme)!.name}` : ''}</p>
      {theme.id === 'room-monte-carlo' && <Colourways theme={theme} studio={studio} />}
      <p className="current-effects"><Icon name="spark" size={14} />{effects.join(' · ')}</p>
      <div className="button-row">
        <button type="button" className="primary-button" onClick={() => studio.goTo('appearance')}><Icon name="brush" size={15} />Customize</button>
        <button type="button" className="secondary-button" onClick={() => studio.duplicateTheme(theme.id)}><Icon name="copy" size={15} />Duplicate</button>
        <button type="button" className="secondary-button" onClick={() => studio.exportTheme(theme.id)}><Icon name="download" size={15} />Export</button>
        {!own && changed && <button type="button" className="ghost-button" onClick={() => studio.resetTheme(theme.id)}><Icon name="reset" size={15} />Restore original</button>}
      </div>
    </div>
  </section>;
}

function ThemeCard({ item, studio, active }: { item: Theme; studio: Studio; active: boolean }) {
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const more = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  useDismiss(menu, () => setMenu(false), [more, popover]);
  const own = !isBuiltIn(item.id);
  const previewing = studio.previewing?.id === item.id;
  const changed = modified(item);
  const run = (action: () => void) => () => { setMenu(false); action(); };
  return <article className={`theme-card ${active ? 'active' : ''} ${previewing ? 'previewing' : ''}`}>
    <button type="button" className="theme-pick" aria-pressed={previewing} aria-label={active ? `${item.name}, in use` : `Preview ${item.name} on the table`}
      onClick={() => active ? studio.previewTheme(undefined) : studio.previewTheme(previewing ? undefined : item.id)} onDoubleClick={() => studio.applyTheme(item.id)}>
      <ThemePreview theme={item} />
      {active && <span className="theme-flag"><Icon name="check" size={12} />In use</span>}
      {!active && previewing && <span className="theme-flag preview"><Icon name="eye" size={12} />Previewing</span>}
    </button>
    <div className="theme-info">
      {renaming ? <input className="rename small" autoFocus defaultValue={item.name} maxLength={80} aria-label={`Rename ${item.name}`}
        onBlur={(event) => { const name = event.target.value.trim(); if (name) studio.renameTheme(item.id, name); setRenaming(false); }}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = item.name; event.currentTarget.blur(); } }} />
        : <b title={item.description}>{item.name}</b>}
      <small>{own ? 'Yours' : changed ? 'Edited' : item.id === 'room-monte-carlo' ? `${colourwayOf(item)?.name ?? 'Custom'} · 5 colourways` : item.description || 'Built-in'}</small>
      {item.id === 'room-monte-carlo' && <Colourways theme={item} studio={studio} compact />}
    </div>
    <div className="theme-actions">
      {!active && <button type="button" className="secondary-button small" onClick={() => studio.applyTheme(item.id)} aria-label={`Use ${item.name}`}>Use</button>}
      <button ref={more} type="button" className="icon-button" aria-haspopup="menu" aria-expanded={menu} aria-label={`More actions for ${item.name}`} onClick={() => setMenu(!menu)}
        onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setMenu(true); window.setTimeout(() => popover.current?.querySelector<HTMLElement>('button')?.focus(), 0); } }}><Icon name="more" size={17} /></button>
      {menu && <div ref={popover} className="card-menu" role="menu" onKeyDown={(event) => moveFocus(event, popover.current, '[role="menuitem"]')}>
        <button type="button" role="menuitem" onClick={run(() => setRenaming(true))}><Icon name="pencil" size={15} />Rename</button>
        <button type="button" role="menuitem" onClick={run(() => studio.duplicateTheme(item.id))}><Icon name="copy" size={15} />Duplicate</button>
        <button type="button" role="menuitem" onClick={run(() => studio.exportTheme(item.id))}><Icon name="download" size={15} />Export</button>
        {!own && <button type="button" role="menuitem" disabled={!changed} onClick={run(() => studio.resetTheme(item.id))}><Icon name="reset" size={15} />Restore original</button>}
        {own && <button type="button" role="menuitem" className="danger" onClick={run(() => setConfirm(true))}><Icon name="trash" size={15} />Delete…</button>}
      </div>}
    </div>
    {confirm && <div className="confirm" role="alertdialog" aria-label={`Delete ${item.name}?`}>
      <p>Delete “{item.name}”?</p>
      <button type="button" className="danger-button" onClick={() => { setConfirm(false); studio.deleteTheme(item.id); }}>Delete</button>
      <button type="button" className="ghost-button" autoFocus onClick={() => setConfirm(false)}>Keep</button>
    </div>}
  </article>;
}
