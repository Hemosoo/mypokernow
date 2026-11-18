import { useState, type CSSProperties } from 'react';
import { COATS, COLLARS } from '../../puppy/coats';
import type { CompanionAction, CompanionSettings, PuppyCoat, PuppyCollar, Street } from '../../types';
import { posterUrl } from '../catalog';
import type { Studio } from '../studio-types';
import { Icon, Section, Segmented, Setting, Toggle } from '../ui';

/**
 * Companions are characters who live on the table. The puppy is the first; the
 * list is data, so another character is a new entry here and a new module.
 */
const COMPANIONS = [{ kind: 'puppy' as const, name: 'Puppy', note: 'Deals, reveals the board, sweeps the chips, naps when someone tanks.', poster: 'flop.puppy' }];
const DEFAULT: CompanionSettings = { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium', coat: 'golden', collar: 'ruby' };
const COAT_NAMES: Record<PuppyCoat, string> = { golden: 'Golden', chocolate: 'Chocolate', cream: 'Cream', midnight: 'Midnight', silver: 'Silver' };
const COLLAR_NAMES: Record<PuppyCollar, string> = { ruby: 'Ruby', sapphire: 'Sapphire', emerald: 'Emerald', violet: 'Violet' };
const TRICKS: { action: CompanionAction; label: string }[] = [
  { action: 'celebrate', label: 'Celebrate' }, { action: 'nap', label: 'Nap' }, { action: 'bark', label: 'Bark' },
  { action: 'tilt', label: 'Head tilt' }, { action: 'scratch', label: 'Scratch' }, { action: 'stretch', label: 'Stretch' },
];
const DUTIES: { street: Street; preset: string; label: string }[] = [
  { street: 'deal', preset: 'deal.puppy', label: 'Deal the cards' }, { street: 'flop', preset: 'flop.puppy', label: 'Reveal the flop' },
  { street: 'turn', preset: 'turn.puppy', label: 'Fetch the turn' }, { street: 'river', preset: 'river.puppy', label: 'Slide the river' },
];

export function CompanionPage({ studio }: { studio: Studio }) {
  const { theme } = studio;
  const companion = theme.companion;
  const [refused, setRefused] = useState('');
  const set = (patch: Partial<CompanionSettings>) => studio.patchCompanion({ ...DEFAULT, ...companion, ...patch });
  const puppyEverywhere = DUTIES.every((duty) => theme.animations[duty.street].preset === duty.preset);
  const blocked = !studio.motionAllowed ? 'Reduced motion is on, so the puppy rests quietly. Turn it off in Settings to see tricks.'
    : companion && !companion.animations ? 'Turn on “Joins the action” to see tricks.' : '';
  const act = (action: CompanionAction) => {
    const done = studio.companionAct(action);
    setRefused(done ? '' : 'The puppy is busy or still settling in. Try again in a moment.');
  };

  return <div className="page companion-page">
    <header className="page-head"><h2>Companion</h2><p>A small 3D character who lives on your table. It never covers cards, chips, names or buttons.</p></header>

    <Section title="Character" id="companion-title">
      <div className="companion-grid" role="radiogroup" aria-labelledby="companion-title">
        {COMPANIONS.map((item) => <button type="button" role="radio" key={item.kind} aria-checked={Boolean(companion)} className={`companion-option ${companion ? 'on' : ''}`}
          onClick={() => studio.patchCompanion(companion ?? DEFAULT)}>
          <img src={posterUrl(item.poster)} alt="" draggable={false} /><span><b>{item.name}</b><small>{item.note}</small></span></button>)}
        <button type="button" role="radio" aria-checked={!companion} className={`companion-option none ${!companion ? 'on' : ''}`} onClick={() => studio.patchCompanion(undefined)}>
          <span className="none-art"><Icon name="close" size={22} /></span><span><b>No companion</b><small>Puppy effects still work: it drops in to perform them, then trots off.</small></span></button>
      </div>
    </Section>

    {companion ? <>
      <Section title="Look" note="Click the puppy on the table to say hello.">
        <div className="field"><span className="label" id="coat-label">Coat</span>
          <div className="swatch-row" role="radiogroup" aria-labelledby="coat-label">
            {(Object.keys(COATS) as PuppyCoat[]).map((coat) => {
              const on = (companion.coat ?? 'golden') === coat;
              return <button type="button" role="radio" key={coat} aria-checked={on} className={`swatch ${on ? 'on' : ''}`} onClick={() => set({ coat })}
                style={{ '--a': COATS[coat].fur, '--b': COATS[coat].cream, '--c': COATS[coat].ear } as CSSProperties}><i aria-hidden="true" />{COAT_NAMES[coat]}</button>;
            })}
          </div></div>
        <div className="field"><span className="label" id="collar-label">Collar</span>
          <div className="swatch-row" role="radiogroup" aria-labelledby="collar-label">
            {(Object.keys(COLLARS) as PuppyCollar[]).map((collar) => {
              const on = (companion.collar ?? 'ruby') === collar;
              return <button type="button" role="radio" key={collar} aria-checked={on} className={`swatch round ${on ? 'on' : ''}`} onClick={() => set({ collar })}
                style={{ '--a': COLLARS[collar] } as CSSProperties}><i aria-hidden="true" />{COLLAR_NAMES[collar]}</button>;
            })}
          </div></div>
        <div className="field"><span className="label">Size</span><Segmented label="Puppy size" value={companion.scale} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} onChange={(scale) => set({ scale })} /></div>
      </Section>

      <Section title="Personality">
        <div className="field"><span className="label">Energy</span><Segmented label="Puppy energy" value={companion.intensity} options={[['subtle', 'Calm'], ['normal', 'Lively'], ['playful', 'Playful']]} onChange={(intensity) => set({ intensity })} /></div>
        <p className="hint">{companion.intensity === 'subtle' ? 'Moves less, rests more, small celebrations.' : companion.intensity === 'playful' ? 'Bigger hops, more tricks between hands, pushes fresh bets now and then.' : 'Wags, looks around, and celebrates every pot.'}</p>
        <Setting title="Joins the action" description="Noses bets into the pot, bats folded cards away and celebrates wins. Off, it watches from its spot.">
          <Toggle label="Puppy joins the action" checked={companion.animations} onChange={(animations) => set({ animations })} /></Setting>
      </Section>

      <Section title="Try a trick" note={blocked || 'Plays on the table, right now.'}>
        <div className="trick-grid">
          {TRICKS.map((trick) => <button type="button" key={trick.action} className="trick" disabled={Boolean(blocked)} onClick={() => act(trick.action)}>{trick.label}</button>)}
        </div>
        {refused && !blocked && <p className="hint" role="status">{refused}</p>}
      </Section>
    </> : <div className="empty"><Icon name="paw" size={22} /><p>No companion at this table. Choose the puppy above and it will trot on.</p></div>}

    <Section title="Card duties" note="Effects the puppy performs itself. Try one, or give it every street."
      action={<button type="button" className="secondary-button small" disabled={puppyEverywhere} onClick={() => studio.updateTheme((next) => ({ ...next, animations: {
        deal: { preset: 'deal.puppy', parameters: {} }, flop: { preset: 'flop.puppy', parameters: {} }, turn: { preset: 'turn.puppy', parameters: {} }, river: { preset: 'river.puppy', parameters: {} } } }))}>
        {puppyEverywhere ? <><Icon name="check" size={14} />Every street</> : 'Use on every street'}</button>}>
      <div className="duty-list">
        {DUTIES.map((duty) => {
          const equipped = theme.animations[duty.street].preset === duty.preset;
          return <div className="duty" key={duty.street}>
            <img src={posterUrl(duty.preset)} alt="" loading="lazy" draggable={false} />
            <span><b>{duty.label}</b><small>{equipped ? 'Equipped' : 'Not equipped'}</small></span>
            <button type="button" className="icon-button" aria-label={`Try: ${duty.label}`} title="Try on the table" onClick={() => studio.tryPreset(duty.preset, duty.street)}><Icon name="play" size={15} /></button>
          </div>;
        })}
      </div>
    </Section>
  </div>;
}
