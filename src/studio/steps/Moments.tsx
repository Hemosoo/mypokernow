import { useRef, useState } from 'react';
import { getPreset, type AnimationPreset } from '../../animation/registry';
import type { Street } from '../../types';
import { STREETS, SHELVES, assignmentLabel, clipUrl, moodOf, posterUrl, presetName, presetsFor, seconds, streetName } from '../catalog';
import type { Studio } from '../studio-types';
import { Disclosure, Icon, Range } from '../ui';

/** Three bars that bounce while a track is playing. */
function Bars() { return <span className="bars" aria-hidden="true"><i /><i /><i /></span>; }

export function Moments({ studio }: { studio: Studio }) {
  const { theme, street, library, nowPlaying, playing } = studio;
  const favorites = library.settings.favorites;
  // What each street ran before Shuffle took over, to restore it when Shuffle is turned off.
  const before = useRef<Partial<Record<Street, string>>>({});
  const assignment = theme.animations[street];
  const shuffle = assignment.preset === 'random';
  const selected = shuffle ? undefined : getPreset(assignment.preset);
  const available = presetsFor(street);
  const hearted = available.filter((preset) => favorites.includes(preset.id));
  const shufflePool = hearted.filter((preset) => !preset.companion);
  const allShuffle = STREETS.every((item) => theme.animations[item].preset === 'random');

  const setShuffle = (item: Street, on: boolean): void => {
    const current = theme.animations[item].preset;
    if (on && current !== 'random') before.current[item] = current;
    const restore = before.current[item] ?? presetsFor(item).find((preset) => !preset.companion)?.id ?? 'random';
    studio.updateTheme((next) => {
      const keep = on ? 'random' : restore;
      const preset = getPreset(keep);
      return { ...next, animations: { ...next.animations, [item]: { preset: keep,
        parameters: preset ? Object.fromEntries(preset.parameters.map((parameter) => [parameter.key, parameter.default])) : {} } } };
    });
  };

  return <div className="step">
    <section className="group" aria-labelledby="hand-title">
      <header className="group-head">
        <div><h3 id="hand-title">Your hand</h3><p>The four moments of a hand, in order. Pick one to change its effect.</p></div>
        <div className="hand-actions">
          <button type="button" className={`round-play ${playing && nowPlaying?.hand ? 'on' : ''}`} onClick={studio.playHand} aria-label="Play a whole hand on the table" title="Play a whole hand"><Icon name={playing && nowPlaying?.hand ? 'pause' : 'play'} size={18} /></button>
          <button type="button" className={`chip-button ${allShuffle ? 'on' : ''}`} aria-pressed={allShuffle} onClick={() => STREETS.forEach((item) => setShuffle(item, !allShuffle))}><Icon name="shuffle" size={16} />Shuffle all</button>
        </div>
      </header>
      <ol className="tracks">
        {STREETS.map((item, index) => {
          const label = assignmentLabel(theme, item);
          const live = playing && nowPlaying?.street === item;
          return <li key={item} className={`${item === street ? 'selected' : ''} ${live ? 'live' : ''}`}>
            <button type="button" className="track" aria-current={item === street ? 'true' : undefined} onClick={() => { studio.setStreet(item); studio.playStreet(item); }}>
              <span className="track-index">{live ? <Bars /> : index + 1}</span>
              <span className="track-title"><b>{label.name}</b><small>{streetName(item)}</small></span>
              <span className="track-time">{label.preset ? seconds(label.preset.duration) : 'Varies'}</span>
            </button>
            <button type="button" className={`icon-toggle ${label.shuffle ? 'on' : ''}`} aria-pressed={label.shuffle} aria-label={`Shuffle the ${streetName(item).toLowerCase()}`} title="Shuffle" onClick={() => setShuffle(item, !label.shuffle)}><Icon name="shuffle" size={17} /></button>
          </li>;
        })}
      </ol>
    </section>

    <section className="feature" aria-label={`${streetName(street)} effect`}>
      <div className="feature-media">
        {selected ? <img src={posterUrl(selected.id)} alt="" draggable={false} /> : <div className="shuffle-art"><Icon name="shuffle" size={34} /></div>}
      </div>
      <div className="feature-text">
        <span className="eyebrow">{streetName(street)}</span>
        <h3>{selected ? presetName(selected) : 'Shuffle'}</h3>
        <p>{selected ? selected.description : shufflePool.length
          ? `Each ${street === 'deal' ? 'deal' : street} plays one of your ${shufflePool.length} hearted effects at random.`
          : 'Each time, a different effect that suits this moment. Heart effects below to choose which ones Shuffle uses.'}</p>
        <div className="feature-actions">
          <button type="button" className="primary-button" onClick={() => studio.playStreet(street)}><Icon name="play" size={15} />Preview the {street === 'deal' ? 'deal' : street}</button>
          {selected && <button type="button" className={`icon-toggle ${favorites.includes(selected.id) ? 'on' : ''}`} aria-pressed={favorites.includes(selected.id)}
            aria-label={favorites.includes(selected.id) ? `Remove ${presetName(selected)} from favorites` : `Add ${presetName(selected)} to favorites`} onClick={() => studio.toggleFavorite(selected.id)}>
            <Icon name={favorites.includes(selected.id) ? 'heart-fill' : 'heart'} size={18} /></button>}
        </div>
      </div>
      {selected && selected.parameters.length > 0 && <div className="feature-tune"><Disclosure title={`Fine-tune ${presetName(selected)}`}>
        {selected.parameters.map((parameter) => <Range key={parameter.key} label={parameter.label} value={assignment.parameters[parameter.key] ?? parameter.default}
          min={parameter.min} max={parameter.max} step={parameter.step} unit={parameter.unit} onChange={(value) => studio.setParameter(parameter.key, value)} />)}
        <button type="button" className="text-button" onClick={studio.resetParameters}>Reset to default tuning</button>
      </Disclosure></div>}
    </section>

    <div className="shelves">
      <header className="shelves-head"><h3>Effects for the {street === 'deal' ? 'deal' : street}</h3><p>Hover to watch. Click to use it. Heart the ones you love.</p></header>
      <button type="button" className={`shuffle-row ${shuffle ? 'on' : ''}`} aria-pressed={shuffle} aria-label="Select Random" onClick={() => studio.selectPreset('random', true)}>
        <span className="shuffle-icon"><Icon name="shuffle" size={20} /></span>
        <span><b>Shuffle</b><small>{shufflePool.length ? `Picks from your ${shufflePool.length} hearted ${shufflePool.length === 1 ? 'effect' : 'effects'}` : 'Picks a different effect every time'}</small></span>
        {shuffle && <Icon name="check" size={18} />}
      </button>
      {hearted.length > 0 && <Shelf title="Your favorites" items={hearted} studio={studio} />}
      {SHELVES.map((shelf) => {
        const items = available.filter((preset) => moodOf(preset) === shelf.mood);
        return items.length ? <Shelf key={shelf.mood} title={shelf.title} note={shelf.note} items={items} studio={studio} /> : null;
      })}
    </div>
  </div>;
}

function Shelf({ title, note, items, studio }: { title: string; note?: string; items: AnimationPreset[]; studio: Studio }) {
  return <section className="shelf" aria-label={title}>
    <h4>{title}{note && <small>{note}</small>}</h4>
    <div className="tiles">{items.map((preset) => <Tile key={preset.id} preset={preset} studio={studio} />)}</div>
  </section>;
}

/**
 * React sets `muted` as a property only, so Chrome can treat a new clip as
 * unmuted and refuse to autoplay it before the visitor's first click. Mark it
 * muted on the element itself, then start it.
 */
function startMuted(video: HTMLVideoElement | null): void {
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  void video.play?.()?.catch(() => { /* The poster stays; nothing else depends on the clip. */ });
}

function Tile({ preset, studio }: { preset: AnimationPreset; studio: Studio }) {
  const [watching, setWatching] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const assigned = studio.theme.animations[studio.street].preset === preset.id;
  const favorite = studio.library.settings.favorites.includes(preset.id);
  const playingHere = studio.playing && studio.nowPlaying?.presetId === preset.id;
  const name = presetName(preset);
  const watch = (): void => { clearTimeout(timer.current); timer.current = setTimeout(() => setWatching(true), 160); };
  const stop = (): void => { clearTimeout(timer.current); setWatching(false); setReady(false); };
  return <article className={`tile ${assigned ? 'on' : ''} ${playingHere ? 'live' : ''}`} onMouseEnter={watch} onMouseLeave={stop}
    onFocus={watch} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) stop(); }}>
    <button type="button" className="tile-pick" aria-pressed={assigned} aria-label={`Select ${preset.name}`} title={preset.description} onClick={() => studio.selectPreset(preset.id, true)}>
      <span className="tile-media">
        <img src={posterUrl(preset.id)} alt="" loading="lazy" draggable={false} />
        {watching && studio.motionAllowed && <video ref={startMuted} className={ready ? 'ready' : ''} src={clipUrl(preset.id)} autoPlay muted loop playsInline preload="auto" aria-hidden="true" onPlaying={() => setReady(true)} />}
        {assigned && <span className="tile-badge"><Icon name="check" size={13} />In use</span>}
      </span>
      <span className="tile-name">{name}</span>
      <span className="tile-meta">{seconds(preset.duration)}{preset.companion ? ' · Puppy' : ''}</span>
    </button>
    <button type="button" className={`tile-heart ${favorite ? 'on' : ''}`} aria-pressed={favorite} aria-label={favorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`} onClick={() => studio.toggleFavorite(preset.id)}>
      <Icon name={favorite ? 'heart-fill' : 'heart'} size={16} /></button>
    <button type="button" className="tile-preview" aria-label={`Preview ${preset.name}`} title="Play on the table" onClick={() => studio.previewPreset(preset.id)}><Icon name="play" size={13} /></button>
  </article>;
}
