import { useMemo, useRef, useState } from 'react';
import { getPreset, type AnimationPreset } from '../../animation/registry';
import type { Street } from '../../types';
import {
  EFFECT_FILTERS, MOOD_LABEL, STREETS, assignmentLabel, clipUrl, matchesFilter, moodOf, posterUrl, presetName, presetsFor, seconds, sortEffects,
  streetLower, streetShort, type EffectFilter, type EffectSort,
} from '../catalog';
import type { Studio } from '../studio-types';
import { Disclosure, Icon, Range, Toggle } from '../ui';

/** React sets `muted` as a property only; Chrome needs the attribute to autoplay before a click. */
function startMuted(video: HTMLVideoElement | null): void {
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  void video.play?.()?.catch(() => { /* The poster stays; nothing else depends on the clip. */ });
}

export function EffectsPage({ studio }: { studio: Studio }) {
  const { theme, street, library } = studio;
  const favorites = library.settings.favorites;
  const [filter, setFilter] = useState<EffectFilter>('all');
  const [sort, setSort] = useState<EffectSort>('featured');
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState<string | undefined>();
  // What each street ran before Shuffle took over, to restore it when Shuffle is turned off.
  const before = useRef<Partial<Record<Street, string>>>({});
  const assignment = theme.animations[street];
  const shuffle = assignment.preset === 'random';
  const available = presetsFor(street);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = useMemo(() => sortEffects(available.filter((preset) => matchesFilter(preset, filter, favorites)
    && words.every((word) => `${presetName(preset)} ${preset.description} ${MOOD_LABEL[moodOf(preset)]}`.toLowerCase().includes(word))), sort),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [available, filter, favorites, query, sort]);
  const detail = getPreset(focused && available.some((preset) => preset.id === focused) ? focused : shuffle ? '' : assignment.preset);
  const pool = available.filter((preset) => favorites.includes(preset.id) && !preset.companion);

  const chooseStreet = (item: Street): void => { setFocused(undefined); studio.setStreet(item); studio.playStreet(item); };
  const setShuffle = (on: boolean): void => {
    const current = theme.animations[street].preset;
    if (on && current !== 'random') before.current[street] = current;
    studio.equipPreset(on ? 'random' : before.current[street] ?? available.find((preset) => !preset.companion)?.id ?? 'random', street);
  };
  const tryOn = (preset: AnimationPreset): void => { setFocused(preset.id); studio.tryPreset(preset.id, street); };
  const equip = (preset: AnimationPreset): void => { setFocused(preset.id); studio.equipPreset(preset.id, street); studio.playStreet(street); };

  return <div className="page effects-page">
    <header className="page-head"><h2>Effects</h2><p>How the cards arrive at each moment of the hand.</p></header>

    <div className="event-tabs" role="tablist" aria-label="Moment of the hand">
      {STREETS.map((item) => {
        const label = assignmentLabel(theme, item);
        return <button type="button" role="tab" key={item} aria-selected={street === item} className={`event-tab ${street === item ? 'on' : ''}`} onClick={() => chooseStreet(item)}>
          <span className="event-name">{streetShort(item)}</span>
          <span className="event-effect">{label.shuffle ? <><Icon name="shuffle" size={13} />Shuffle</> : label.name}</span>
        </button>;
      })}
    </div>

    <div className="shuffle-line">
      <Icon name="shuffle" size={18} />
      <span><b>Shuffle the {streetLower(street)}</b><small>{pool.length ? `A random pick from your ${pool.length} favorite${pool.length === 1 ? '' : 's'}, each hand` : 'A random effect each hand. Heart effects to choose the pool.'}</small></span>
      <Toggle label={`Shuffle the ${streetLower(street)}`} checked={shuffle} onChange={setShuffle} />
    </div>

    <div className="fx-toolbar">
      <label className="search-field"><Icon name="search" size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${available.length} effects`} aria-label="Search effects" /></label>
      <label className="sort"><span className="visually-hidden">Sort effects</span>
        <select value={sort} onChange={(event) => setSort(event.target.value as EffectSort)} aria-label="Sort effects">
          <option value="featured">Featured</option><option value="shortest">Shortest first</option><option value="longest">Longest first</option><option value="name">A to Z</option>
        </select></label>
    </div>
    <div className="filters" role="radiogroup" aria-label="Filter effects">
      {EFFECT_FILTERS.map((item) => {
        const count = available.filter((preset) => matchesFilter(preset, item.id, favorites)).length;
        return <button type="button" role="radio" key={item.id} aria-checked={filter === item.id} className={`filter ${filter === item.id ? 'on' : ''}`} disabled={!count && item.id !== 'all'}
          onClick={() => setFilter(item.id)}>{item.id === 'favorites' && <Icon name="heart" size={13} />}{item.label}<span>{count}</span></button>;
      })}
    </div>

    {list.length ? <div className="fx-grid">{list.map((preset) => <EffectCard key={preset.id} preset={preset} studio={studio} focused={detail?.id === preset.id}
      equipped={assignment.preset === preset.id} onTry={() => tryOn(preset)} onEquip={() => equip(preset)} />)}</div>
      : <div className="empty"><Icon name={filter === 'favorites' ? 'heart' : 'search'} size={22} /><p>{filter === 'favorites' ? `No favorites for the ${streetLower(street)} yet. Heart an effect to keep it here.` : 'Nothing matches. Try another word or filter.'}</p>
        <button type="button" className="text-button" onClick={() => { setQuery(''); setFilter('all'); }}>Show all effects</button></div>}

    {detail ? <EffectDetail preset={detail} studio={studio} equipped={assignment.preset === detail.id} onTry={() => tryOn(detail)} onEquip={() => equip(detail)} />
      : <div className="fx-detail"><div className="fx-detail-main"><div className="fx-detail-art shuffle-art"><Icon name="shuffle" size={26} /></div>
        <div><span className="eyebrow">{streetShort(street)} · Shuffle</span><h3>A different effect each hand</h3>
          <p>{pool.length ? `Picks from your ${pool.length} hearted effects that suit the ${streetLower(street)}.` : `Picks from every effect that suits the ${streetLower(street)}. Companion effects are never picked; choose those on purpose.`}</p></div></div></div>}
  </div>;
}

function EffectCard({ preset, studio, focused, equipped, onTry, onEquip }: { preset: AnimationPreset; studio: Studio; focused: boolean; equipped: boolean; onTry: () => void; onEquip: () => void }) {
  const [watching, setWatching] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const favorite = studio.library.settings.favorites.includes(preset.id);
  const live = studio.playing && studio.nowPlaying?.presetId === preset.id;
  const name = presetName(preset);
  const watch = (): void => { clearTimeout(timer.current); timer.current = setTimeout(() => setWatching(true), 140); };
  const stop = (): void => { clearTimeout(timer.current); setWatching(false); setReady(false); };
  return <article className={`fx-card ${equipped ? 'equipped' : ''} ${focused ? 'focused' : ''} ${live ? 'live' : ''}`} onMouseEnter={watch} onMouseLeave={stop}
    onFocus={watch} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) stop(); }}>
    <button type="button" className="fx-pick" aria-pressed={focused} aria-label={`Try ${name} on the table`} aria-describedby={`fx-${preset.id}`} onClick={onTry} onDoubleClick={onEquip}>
      <span className="fx-media">
        <img src={posterUrl(preset.id)} alt="" loading="lazy" decoding="async" draggable={false} />
        {watching && studio.motionAllowed && <video ref={startMuted} className={ready ? 'ready' : ''} src={clipUrl(preset.id)} autoPlay muted loop playsInline preload="auto" aria-hidden="true" onPlaying={() => setReady(true)} />}
        {equipped && <span className="fx-badge"><Icon name="check" size={12} />Equipped</span>}
        {live && <span className="fx-live" aria-hidden="true"><i /><i /><i /></span>}
      </span>
      <span className="fx-info"><b>{name}</b><small id={`fx-${preset.id}`}>{MOOD_LABEL[moodOf(preset)]} · {seconds(preset.duration)}</small></span>
    </button>
    <button type="button" className={`fx-heart ${favorite ? 'on' : ''}`} aria-pressed={favorite} aria-label={favorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`} onClick={() => studio.toggleFavorite(preset.id)}>
      <Icon name={favorite ? 'heart-fill' : 'heart'} size={15} /></button>
  </article>;
}

function EffectDetail({ preset, studio, equipped, onTry, onEquip }: { preset: AnimationPreset; studio: Studio; equipped: boolean; onTry: () => void; onEquip: () => void }) {
  const { street } = studio;
  const favorite = studio.library.settings.favorites.includes(preset.id);
  const assignment = studio.theme.animations[street];
  const name = presetName(preset);
  return <div className="fx-detail" aria-label={`${name} details`}>
    <div className="fx-detail-main">
      <img className="fx-detail-art" src={posterUrl(preset.id)} alt="" draggable={false} />
      <div>
        <span className="eyebrow">{MOOD_LABEL[moodOf(preset)]} · {seconds(preset.duration)}</span>
        <h3>{name}</h3>
        <p>{preset.description}</p>
      </div>
    </div>
    <div className="fx-detail-actions">
      <button type="button" className="secondary-button" onClick={onTry}><Icon name="play" size={14} />Try on table</button>
      {equipped ? <span className="equipped-note"><Icon name="check" size={15} />Equipped for the {streetLower(street)}</span>
        : <button type="button" className="primary-button" onClick={onEquip}>Equip for the {streetLower(street)}</button>}
      <button type="button" className={`icon-toggle ${favorite ? 'on' : ''}`} aria-pressed={favorite} aria-label={favorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`} onClick={() => studio.toggleFavorite(preset.id)}>
        <Icon name={favorite ? 'heart-fill' : 'heart'} size={17} /></button>
    </div>
    {equipped && preset.parameters.length > 0 && <Disclosure title="Fine-tune">
      {preset.parameters.map((parameter) => <Range key={parameter.key} label={parameter.label} value={assignment.parameters[parameter.key] ?? parameter.default}
        min={parameter.min} max={parameter.max} step={parameter.step} unit={parameter.unit} onChange={(value) => studio.setParameter(parameter.key, value)} />)}
      <button type="button" className="text-button" onClick={studio.resetParameters}><Icon name="reset" size={14} />Reset to default tuning</button>
    </Disclosure>}
  </div>;
}
