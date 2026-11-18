import { useState } from 'react';
import type { EffectSettings } from '../../types';
import { SHORTCUTS } from '../CommandMenu';
import type { Studio } from '../studio-types';
import { Icon, Kbd, Range, Section, Setting, Toggle } from '../ui';

const EFFECTS: [keyof EffectSettings, string, string][] = [
  ['chips', 'Moving chips', 'Bets and the pot as chip stacks that slide between seats.'],
  ['celebrations', 'Winner celebrations', 'Light and particles for the winner, scaled to the pot.'],
  ['moments', 'Table moments', 'Turn light, all-in beat, fold muck and the low-time cue.'],
  ['ambience', 'Ambient particles', 'Dust, petals or pixels drifting above the felt.'],
];
type Mode = 'high' | 'balanced' | 'light';
const MODES: Record<Mode, { name: string; note: string; effects: EffectSettings }> = {
  high: { name: 'High quality', note: 'Everything on.', effects: { chips: true, celebrations: true, moments: true, ambience: true } },
  balanced: { name: 'Balanced', note: 'No ambient particles.', effects: { chips: true, celebrations: true, moments: true, ambience: false } },
  light: { name: 'Lightweight', note: 'Card effects only. Best on older laptops.', effects: { chips: false, celebrations: false, moments: false, ambience: false } },
};
const modeOf = (effects: EffectSettings): Mode | undefined => (Object.keys(MODES) as Mode[]).find((mode) => (Object.keys(effects) as (keyof EffectSettings)[]).every((key) => MODES[mode].effects[key] === effects[key]));

export function SettingsPage({ studio }: { studio: Studio }) {
  const { library, inspection } = studio;
  const settings = library.settings;
  const mode = modeOf(settings.effects);
  const [confirm, setConfirm] = useState(false);
  return <div className="page settings-page">
    <header className="page-head"><h2>Settings</h2><p>These apply to every theme.</p></header>

    <Section title="PokerNow">
      <Setting title="Customization" description={settings.enabled ? `On: “${studio.theme.name}” and its effects show on every PokerNow table you open.` : 'Off: PokerNow shows its normal table. Your themes are kept.'}>
        <Toggle label="Enable customization in settings" checked={settings.enabled} onChange={(value) => studio.setting('enabled', value)} /></Setting>
      <div className="connection">
        {!studio.extensionContext && <p className="hint">This is a browser preview: changes are saved on this website only. Open the studio from the extension’s toolbar icon to apply them to PokerNow.</p>}
        <button type="button" className="secondary-button" onClick={studio.checkConnection} disabled={studio.checkingConnection}><Icon name="external" size={15} />{studio.checkingConnection ? 'Checking…' : 'Check PokerNow connection'}</button>
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
    </Section>

    <Section title="Motion and accessibility">
      <Setting title="Reduced motion" description="Cards land in place without flying, shaking or flashing. The puppy rests quietly. Also follows your system setting.">
        <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(value) => studio.setting('reducedMotion', value)} /></Setting>
      <Range label="Animation speed on PokerNow" value={settings.speed} min={0.5} max={2} step={0.1} format={(value) => `${Number(value.toFixed(1))}×`} onChange={(value) => studio.setting('speed', value)}
        hint="1× is the designed pace. The studio’s preview speed (¼×, ½×) is separate and never saved." />
    </Section>

    <Section title="Performance" note="How much the table does besides the card effects.">
      <div className="mode-grid" role="radiogroup" aria-label="Performance mode">
        {(Object.keys(MODES) as Mode[]).map((key) => <button type="button" role="radio" key={key} aria-checked={mode === key} className={`mode ${mode === key ? 'on' : ''}`}
          onClick={() => studio.setting('effects', { ...MODES[key].effects })}><b>{MODES[key].name}</b><small>{MODES[key].note}</small></button>)}
      </div>
      {!mode && <p className="hint">Custom: your own mix below.</p>}
      {EFFECTS.map(([key, title, description]) => <Setting key={key} title={title} description={description}>
        <Toggle label={`Enable ${key}`} checked={settings.effects[key]} onChange={(value) => studio.setting('effects', { ...settings.effects, [key]: value })} /></Setting>)}
    </Section>

    <Section title="Your data" note="Themes, settings and images stay on this computer, in this browser profile.">
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => studio.exportTheme(studio.theme.id)}><Icon name="download" size={15} />Export “{studio.theme.name}”</button>
        <button type="button" className="secondary-button" onClick={studio.openImport}><Icon name="upload" size={15} />Import a theme</button>
      </div>
      <Setting title="Reset settings and built-in themes" description="Your own themes are kept. You can undo this.">
        {confirm ? <span className="inline-confirm"><button type="button" className="danger-button" onClick={() => { setConfirm(false); studio.resetEverything(); }}>Reset</button>
          <button type="button" className="ghost-button" onClick={() => setConfirm(false)}>Cancel</button></span>
          : <button type="button" className="secondary-button" onClick={() => setConfirm(true)}>Reset…</button>}
      </Setting>
    </Section>

    <Section title="Keyboard shortcuts">
      <dl className="shortcut-list">{SHORTCUTS.map(([keys, action]) => <div key={keys}><dt>{keys.split(' or ').map((key, index) => <span key={key}>{index > 0 && ' or '}<Kbd>{key}</Kbd></span>)}</dt><dd>{action}</dd></div>)}</dl>
    </Section>

    <p className="fine-print"><Icon name="check" size={15} />The extension only changes how the table looks. It never changes the game, reads hidden cards, delays your turn or touches PokerNow’s buttons.</p>
  </div>;
}
