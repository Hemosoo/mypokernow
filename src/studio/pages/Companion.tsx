import { useState, type CSSProperties } from 'react';
import { CAT_COATS, CAT_EYES, COATS, COLLARS } from '../../puppy/coats';
import { counterpart } from '../../animation/presets/puppy';
import type { CatCoat, CatEyes, CompanionAction, CompanionKind, CompanionSettings, PuppyCoat, PuppyCollar, Street, Theme } from '../../types';
import { posterUrl } from '../catalog';
import type { Studio } from '../studio-types';
import { Icon, Section, Segmented, Setting, Toggle } from '../ui';

/**
 * Companions are characters who live on the table: the puppy and the cat. Each
 * keeps its own coat, so switching back and forth never loses a choice.
 */
const COMPANIONS: { kind: CompanionKind; name: string; note: string; poster: string }[] = [
  { kind: 'puppy', name: 'Puppy', note: 'Deals, noses out the flop, fetches the turn, sweeps the chips, naps when someone tanks.', poster: 'flop.puppy' },
  { kind: 'cat', name: 'Cat', note: 'Flicks the deal, bats a yarn ball across the flop, pounces on the river, curls up on the winner’s chips.', poster: 'flop.cat' },
];
const DEFAULT: CompanionSettings = { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium', coat: 'golden', collar: 'ruby' };
/** Switch a theme's companion, and its companion effects with it, to the other character. */
export function withCompanion(theme: Theme, kind: CompanionKind | undefined): Theme {
  const animations = Object.fromEntries(Object.entries(theme.animations).map(([street, assignment]) => [street,
    kind ? { ...assignment, preset: counterpart(assignment.preset, kind) } : assignment])) as Theme['animations'];
  const companion = kind ? { ...DEFAULT, ...(kind === 'cat' ? { collar: 'sapphire' as const } : {}), ...theme.companion, kind } : undefined;
  return { ...theme, animations, ...(companion ? { companion } : { companion: undefined }) };
}
const COAT_NAMES: Record<PuppyCoat, string> = { golden: 'Golden', chocolate: 'Chocolate', cream: 'Cream', midnight: 'Midnight', silver: 'Silver' };
const COLLAR_NAMES: Record<PuppyCollar, string> = { ruby: 'Ruby', sapphire: 'Sapphire', emerald: 'Emerald', violet: 'Violet' };
const TRICKS: { action: CompanionAction; label: string; cat?: string }[] = [
  { action: 'celebrate', label: 'Celebrate' }, { action: 'nap', label: 'Nap' }, { action: 'bark', label: 'Bark', cat: 'Meow' },
  { action: 'tilt', label: 'Head tilt' }, { action: 'scratch', label: 'Scratch', cat: 'Groom' }, { action: 'stretch', label: 'Stretch' },
];
const DUTIES: Record<CompanionKind, { street: Street; preset: string; label: string }[]> = {
  puppy: [
    { street: 'deal', preset: 'deal.puppy', label: 'Deal the cards' }, { street: 'flop', preset: 'flop.puppy', label: 'Reveal the flop' },
    { street: 'turn', preset: 'turn.puppy', label: 'Fetch the turn' }, { street: 'river', preset: 'river.puppy', label: 'Slide the river' },
  ],
  cat: [
    { street: 'deal', preset: 'deal.cat', label: 'Flick out the deal' }, { street: 'flop', preset: 'flop.cat', label: 'Yarn-ball flop' },
    { street: 'turn', preset: 'turn.cat', label: 'Push in the turn' }, { street: 'river', preset: 'river.cat', label: 'Pounce on the river' },
  ],
};

export function CompanionPage({ studio }: { studio: Studio }) {
  const { theme } = studio;
  const companion = theme.companion;
  const [refused, setRefused] = useState('');
  const kind: CompanionKind = companion?.kind ?? 'puppy', who = kind === 'cat' ? 'cat' : 'puppy';
  const set = (patch: Partial<CompanionSettings>) => studio.patchCompanion({ ...DEFAULT, ...companion, ...patch });
  const duties = DUTIES[kind];
  const everywhere = duties.every((duty) => theme.animations[duty.street].preset === duty.preset);
  const blocked = !studio.motionAllowed ? `Reduced motion is on, so the ${who} rests quietly. Turn it off in Settings to see tricks.`
    : companion && !companion.animations ? 'Turn on “Joins the action” to see tricks.' : '';
  const act = (action: CompanionAction) => {
    const done = studio.companionAct(action);
    setRefused(done ? '' : `The ${who} is busy or still settling in. Try again in a moment.`);
  };

  return <div className="page companion-page">
    <header className="page-head"><h2>Companion</h2><p>A small 3D character who lives on your table. It never covers cards, chips, names or buttons.</p></header>

    <Section title="Character" id="companion-title">
      <div className="companion-grid" role="radiogroup" aria-labelledby="companion-title">
        {COMPANIONS.map((item) => {
          const on = companion?.kind === item.kind;
          return <button type="button" role="radio" key={item.kind} aria-checked={on} className={`companion-option ${on ? 'on' : ''}`}
            onClick={() => { if (!on) studio.updateTheme((next) => withCompanion(next, item.kind)); }}>
            <img src={posterUrl(item.poster)} alt="" draggable={false} /><span><b>{item.name}</b><small>{item.note}</small></span></button>;
        })}
        <button type="button" role="radio" aria-checked={!companion} className={`companion-option none ${!companion ? 'on' : ''}`} onClick={() => studio.patchCompanion(undefined)}>
          <span className="none-art"><Icon name="close" size={22} /></span><span><b>No companion</b><small>Companion effects still work: the puppy or cat drops in to perform them, then leaves.</small></span></button>
      </div>
    </Section>

    {companion ? <>
      <Section title="Look" note={`Click the ${who} on the table to say hello.`}>
        {kind === 'cat' ? <>
        <div className="field"><span className="label" id="cat-coat-label">Coat</span>
          <div className="swatch-row" role="radiogroup" aria-labelledby="cat-coat-label">
            {(Object.keys(CAT_COATS) as CatCoat[]).filter((coat) => coat !== 'bluegrey').map((coat) => {
              const on = (companion.catCoat ?? 'tabby') === coat, colors = CAT_COATS[coat];
              return <button type="button" role="radio" key={coat} aria-checked={on} className={`swatch ${on ? 'on' : ''}`} onClick={() => set({ catCoat: coat })}
                style={{ '--a': colors.fur, '--b': colors.cream, '--c': colors.stripe ?? colors.patchA ?? colors.fur } as CSSProperties}><i aria-hidden="true" />{colors.name}</button>;
            })}
          </div></div>
        <div className="field"><span className="label" id="eyes-label">Eyes</span>
          <div className="swatch-row" role="radiogroup" aria-labelledby="eyes-label">
            {(Object.keys(CAT_EYES) as CatEyes[]).map((eyes) => {
              const on = (companion.eyes ?? 'green') === eyes;
              return <button type="button" role="radio" key={eyes} aria-checked={on} className={`swatch round ${on ? 'on' : ''}`} onClick={() => set({ eyes })}
                style={{ '--a': CAT_EYES[eyes].iris } as CSSProperties}><i aria-hidden="true" />{CAT_EYES[eyes].name}</button>;
            })}
          </div></div>
        </> : <div className="field"><span className="label" id="coat-label">Coat</span>
          <div className="swatch-row" role="radiogroup" aria-labelledby="coat-label">
            {(Object.keys(COATS) as PuppyCoat[]).map((coat) => {
              const on = (companion.coat ?? 'golden') === coat;
              return <button type="button" role="radio" key={coat} aria-checked={on} className={`swatch ${on ? 'on' : ''}`} onClick={() => set({ coat })}
                style={{ '--a': COATS[coat].fur, '--b': COATS[coat].cream, '--c': COATS[coat].ear } as CSSProperties}><i aria-hidden="true" />{COAT_NAMES[coat]}</button>;
            })}
          </div></div>}
        <div className="field"><span className="label" id="collar-label">{kind === 'cat' ? 'Collar and bell' : 'Collar'}</span>
          <div className="swatch-row" role="radiogroup" aria-labelledby="collar-label">
            {(Object.keys(COLLARS) as PuppyCollar[]).map((collar) => {
              const on = (companion.collar ?? 'ruby') === collar;
              return <button type="button" role="radio" key={collar} aria-checked={on} className={`swatch round ${on ? 'on' : ''}`} onClick={() => set({ collar })}
                style={{ '--a': COLLARS[collar] } as CSSProperties}><i aria-hidden="true" />{COLLAR_NAMES[collar]}</button>;
            })}
          </div></div>
        <div className="field"><span className="label">Size</span><Segmented label={`${who === 'cat' ? 'Cat' : 'Puppy'} size`} value={companion.scale} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} onChange={(scale) => set({ scale })} /></div>
      </Section>

      <Section title="Personality">
        <div className="field"><span className="label">Energy</span><Segmented label={`${who === 'cat' ? 'Cat' : 'Puppy'} energy`} value={companion.intensity} options={[['subtle', 'Calm'], ['normal', 'Lively'], ['playful', 'Playful']]} onChange={(intensity) => set({ intensity })} /></div>
        <p className="hint">{companion.intensity === 'subtle' ? 'Moves less, rests more, small celebrations.' : companion.intensity === 'playful' ? 'Bigger hops, more tricks between hands, pushes fresh bets now and then.' : 'Wags, looks around, and celebrates every pot.'}</p>
        <Setting title="Joins the action" description={kind === 'cat' ? 'Watches the bets, bats folded cards away and curls up on the winner’s chips. Off, it watches from its spot.' : 'Noses bets into the pot, bats folded cards away and celebrates wins. Off, it watches from its spot.'}>
          <Toggle label={`${who === 'cat' ? 'Cat' : 'Puppy'} joins the action`} checked={companion.animations} onChange={(animations) => set({ animations })} /></Setting>
      </Section>

      <Section title="Try a trick" note={blocked || 'Plays on the table, right now.'}>
        <div className="trick-grid">
          {TRICKS.map((trick) => <button type="button" key={trick.action} className="trick" disabled={Boolean(blocked)} onClick={() => act(trick.action)}>{kind === 'cat' ? trick.cat ?? trick.label : trick.label}</button>)}
        </div>
        {refused && !blocked && <p className="hint" role="status">{refused}</p>}
      </Section>
    </> : <div className="empty"><Icon name="paw" size={22} /><p>No companion at this table. Choose the puppy or the cat above and it will come over.</p></div>}

    <Section title="Card duties" note={`Effects the ${who} performs itself. Try one, or give it every street.`}
      action={<button type="button" className="secondary-button small" disabled={everywhere} onClick={() => studio.updateTheme((next) => ({ ...next, animations: Object.fromEntries(duties.map((duty) => [duty.street, { preset: duty.preset, parameters: {} }])) as Theme['animations'] }))}>
        {everywhere ? <><Icon name="check" size={14} />Every street</> : 'Use on every street'}</button>}>
      <div className="duty-list">
        {duties.map((duty) => {
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
