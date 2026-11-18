import { useState, type CSSProperties } from 'react';
import { cardDataUrl, artOptions } from '../../rendering/cards';
import type { Theme } from '../../types';
import type { Studio } from '../studio-types';
import { Group, Icon, Range, Setting, Toggle } from '../ui';

/** A small drawing of a theme: room, felt, rail and two cards. */
export function ThemeArt({ theme }: { theme: Theme }) {
  return <span className="theme-art" style={{ '--bg': theme.table.backgroundColor, '--felt': theme.table.feltColor, '--rail': theme.table.railColor, '--trim': theme.table.trimColor } as CSSProperties}>
    <i className="theme-art-felt" />
    <img src={cardDataUrl(undefined, theme.card, artOptions(theme))} alt="" />
    <img src={cardDataUrl({ rank: 'A', suit: 'hearts' }, theme.card, artOptions(theme))} alt="" />
  </span>;
}

export function LibraryStep({ studio }: { studio: Studio }) {
  const { library, theme } = studio;
  const [confirming, setConfirming] = useState(false);
  return <div className="step">
    <Group title="Your themes" note="A theme is a whole look: deck, felt, board, effects and companion." action={<button type="button" className="primary-button new-theme" onClick={studio.createTheme}><Icon name="plus" size={15} />New theme</button>}>
      <div className="theme-grid">
        {library.themes.map((item) => {
          const on = item.id === theme.id;
          return <button type="button" key={item.id} className={`theme-card ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => studio.switchTheme(item.id)}>
            <ThemeArt theme={item} />
            <span className="theme-card-text"><b>{item.name}</b><small>{item.description || (item.companion ? 'With the puppy' : 'Your own theme')}</small></span>
            {on && <span className="theme-check"><Icon name="check" size={13} /></span>}
          </button>;
        })}
      </div>
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={studio.openImport}><Icon name="upload" size={15} />Import a theme</button>
        <button type="button" className="secondary-button" onClick={studio.downloadTheme}><Icon name="download" size={15} />Export this theme</button>
      </div>
      <p className="hint">Themes are saved as a JSON file, uploaded images included. A friend can import yours in their own studio.</p>
    </Group>

    <Group title="This theme" id="this-theme">
      <div className="field"><label htmlFor="theme-name">Name</label>
        <input id="theme-name" key={theme.id} aria-label="Theme name" value={theme.name} autoFocus={studio.editingName} onBlur={() => studio.setEditingName(false)} maxLength={80}
          onChange={(event) => studio.updateTheme((next) => ({ ...next, name: event.target.value }))} /></div>
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={studio.duplicateTheme}><Icon name="copy" size={15} />Duplicate</button>
        <button type="button" className="secondary-button" onClick={studio.restoreTheme}><Icon name="reset" size={15} />Restore defaults</button>
        {!confirming ? <button type="button" className="secondary-button danger" onClick={() => setConfirming(true)}><Icon name="trash" size={15} />Delete…</button>
          : <span className="confirm" role="group" aria-label="Confirm delete"><span>Delete “{theme.name}”?</span>
            <button type="button" className="secondary-button danger" onClick={() => { setConfirming(false); studio.deleteTheme(); }}>Delete theme</button>
            <button type="button" className="text-button" onClick={() => setConfirming(false)}>Keep it</button></span>}
      </div>
    </Group>
  </div>;
}

const EFFECTS = [
  ['chips', 'Moving chips', 'Bets and the pot as chip stacks that slide between seats.'],
  ['celebrations', 'Winner celebrations', 'Scaled to the size of the pot.'],
  ['moments', 'Table moments', 'Turn light, all-in beat, fold muck and the low-time cue.'],
  ['ambience', 'Ambient light', 'Drifting motes of light above the felt.'],
] as const;

export function SettingsStep({ studio }: { studio: Studio }) {
  const { library, inspection } = studio;
  const settings = library.settings;
  return <div className="step">
    <Group title="On PokerNow">
      <Setting title="Customization" description="Apply your theme and effects on PokerNow tables."><Toggle label="Enable customization in settings" checked={settings.enabled} onChange={(value) => studio.setting('enabled', value)} /></Setting>
      <Setting title="Reduced motion" description="Skip large movement, flying fragments, shake and impact effects."><Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(value) => studio.setting('reducedMotion', value)} /></Setting>
      <Range label="Animation speed" value={settings.speed} min={0.5} max={2} step={0.1} unit="×" onChange={(value) => studio.setting('speed', value)} hint="Applies to every effect. 1× is the designed pace." />
    </Group>
    <Group title="Table effects" note="Each one can be turned off without changing your theme.">
      {EFFECTS.map(([key, title, description]) => <Setting key={key} title={title} description={description}>
        <Toggle label={`Enable ${key}`} checked={settings.effects[key]} onChange={(value) => studio.setting('effects', { ...settings.effects, [key]: value })} /></Setting>)}
    </Group>
    <Group title="Connection" id="connection">
      <div className="connection-card">
        {!studio.extensionContext && <p className="hint">This is a browser preview: changes are saved on this website only. Open the studio from the extension’s toolbar icon to apply them to PokerNow.</p>}
        <button type="button" className="secondary-button" onClick={studio.checkConnection} disabled={studio.checkingConnection}>{studio.checkingConnection ? 'Checking…' : 'Check PokerNow connection'}</button>
        {inspection && <div className="connection-results" role="status">
          {inspection.context === 'standalone' ? <p>Browser preview only. Open the extension studio from the Chrome toolbar to connect to PokerNow.</p>
            : !inspection.statuses.length ? <p>No PokerNow tab answered. Open a table, refresh the tab after installing or reloading the extension, then check again.</p>
              : inspection.statuses.map((status, index) => <div className={`connection-result state-${status.state}`} key={status.tabId ?? index}>
                <strong>{status.state === 'ready' ? 'Connected' : status.state[0]!.toUpperCase() + status.state.slice(1)}</strong>
                <p>{status.reason}</p>
                <small>{status.tableCount} table · {status.seatCount} seats · {status.boardCount} boards · {status.cardCount} card elements</small>
              </div>)}
        </div>}
      </div>
    </Group>
    <div className="note"><Icon name="check" size={18} /><p>Your themes, settings and images stay on this computer. The extension only changes how the table looks. It never changes the game, reads hidden cards or touches PokerNow’s buttons.</p></div>
  </div>;
}
