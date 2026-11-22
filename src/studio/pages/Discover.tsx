import { useEffect, useRef, useState } from 'react';
import { getPreset } from '../../animation/registry';
import { builtInThemes } from '../../themes/defaults';
import type { Street } from '../../types';
import { BeforeAfter, useCompareSource } from '../BeforeAfter';
import { MOOD_LABEL, clipUrl, moodOf, posterUrl, presetName, seconds } from '../catalog';
import type { Studio } from '../studio-types';
import { ThemePreview } from '../ThemePreview';
import { Icon } from '../ui';

const FEATURED: { id: string; street: Street }[] = [
  { id: 'flop.grand', street: 'flop' }, { id: 'reveal.showdown', street: 'river' }, { id: 'reveal.crystallization', street: 'turn' }, { id: 'deal.orbit', street: 'deal' },
];
const VISITED = 'pnc.studio.visited';
const seen = (): boolean => { try { return localStorage.getItem(VISITED) === '1'; } catch { return false; } };

export function Discover({ studio }: { studio: Studio }) {
  const { library, theme } = studio;
  const [chapter, setChapter] = useState(-1);
  const compare = useCompareSource();
  const [seek, setSeek] = useState<{ frame: number; at: number } | undefined>();
  const [returning] = useState(seen);
  const [guide, setGuide] = useState(!returning);
  useEffect(() => { try { localStorage.setItem(VISITED, '1'); } catch { /* A convenience only. */ } }, []);
  const recent = library.settings.recent.map((id) => library.themes.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item) && item!.id !== theme.id).slice(0, 3);
  const tryEffect = (id: string, street: Street) => { studio.goTo('effects'); studio.setStreet(street); window.setTimeout(() => studio.tryPreset(id, street), 0); };
  const previewTheme = (id: string) => { studio.goTo('themes'); if (id !== theme.id) studio.previewTheme(id); };

  return <div className="discover">
    {returning && <section className="continue" aria-label="Continue">
      <ThemePreview theme={studio.display} detail="table" className="continue-art" />
      <div className="continue-text"><small>Continue with</small><b>{theme.name}</b></div>
      <div className="continue-actions">
        <button type="button" className="secondary-button" onClick={() => studio.goTo('appearance')}><Icon name="brush" size={15} />Appearance</button>
        <button type="button" className="secondary-button" onClick={() => studio.goTo('effects')}><Icon name="spark" size={15} />Effects</button>
        {theme.companion && <button type="button" className="secondary-button" onClick={() => studio.goTo('companion')}><Icon name="paw" size={15} />Companion</button>}
      </div>
      {recent.length > 0 && <div className="continue-recent"><small>Recent</small>{recent.map((item) => <button type="button" key={item.id} className="chip-button" onClick={() => studio.applyTheme(item.id)} title={`Use ${item.name}`}>{item.name}</button>)}</div>}
    </section>}

    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">PokerNow Customizer</span>
        <h1>Your PokerNow table, <em>reimagined.</em></h1>
        <p>Themes, card art, cinematic deals and a table puppy or cat, for the game you already play. Drag the line to compare the same hand with and without.</p>
        <div className="hero-actions">
          <button type="button" className="primary-button large" onClick={() => studio.goTo('themes')}>Browse themes<Icon name="chevron" size={16} /></button>
          <button type="button" className="ghost-button large" onClick={() => studio.goTo('appearance')}>Customize {theme.name}</button>
        </div>
        <ul className="promise">
          <li><Icon name="check" size={15} />The game, cards and results never change</li>
          <li><Icon name="check" size={15} />Names, stacks, bets and buttons stay where PokerNow puts them</li>
        </ul>
      </div>
      <div className="hero-compare">
        <div className="compare-frame"><BeforeAfter active={studio.page === 'discover'} onChapter={setChapter} seek={seek} source={compare} /></div>
        <div className="chapters">
          {compare.chapters.length > 0 && <div className="chapter-buttons" role="group" aria-label="Jump to a moment">
            {compare.chapters.map((item, index) => <button type="button" key={item.label} className={chapter === index ? 'on' : ''} aria-pressed={chapter === index} onClick={() => setSeek({ frame: item.frame, at: Date.now() })}>{item.label}</button>)}
          </div>}
          <p aria-live="polite">{chapter >= 0 && compare.chapters[chapter] ? compare.chapters[chapter]!.text : compare.source === 'pokernow' ? 'A real hand on PokerNow, recorded twice at once: without the extension, and with it.' : 'PokerNow’s standard table, recreated, beside the Puppy theme. Blinds go in and the hand begins.'}</p>
        </div>
      </div>
    </section>

    {guide && <section className="quickstart" aria-label="Getting started">
      <ol>
        <li><span>1</span><div><b>Pick a theme</b><p>Each one is a complete look: deck, felt, room and effects.</p></div></li>
        <li><span>2</span><div><b>Make it yours</b><p>Change any card, colour or effect. Everything saves as you go.</p></div></li>
        <li><span>3</span><div><b>Play on PokerNow</b><p>Open a game. Switch it off any time with the PokerNow switch, top right.</p></div></li>
      </ol>
      <button type="button" className="icon-button" aria-label="Hide getting started" onClick={() => setGuide(false)}><Icon name="close" size={16} /></button>
    </section>}

    <section className="shelf" aria-labelledby="shelf-themes">
      <header className="shelf-head"><h2 id="shelf-themes">Themes</h2><button type="button" className="text-button" onClick={() => studio.goTo('themes')}>See all<Icon name="chevron" size={14} /></button></header>
      <div className="theme-row">
        {builtInThemes.map((room) => {
          const item = library.themes.find((candidate) => candidate.id === room.id) ?? room;
          return <button type="button" key={item.id} className={`theme-tile ${item.id === theme.id ? 'active' : ''}`} onClick={() => previewTheme(item.id)} aria-label={`Preview ${item.name}`}>
            <ThemePreview theme={item} /><span><b>{item.name}</b><small>{item.id === theme.id ? 'In use' : room.description}</small></span></button>;
        })}
      </div>
    </section>

    <section className="shelf" aria-labelledby="shelf-effects">
      <header className="shelf-head"><h2 id="shelf-effects">Cinematic effects</h2><button type="button" className="text-button" onClick={() => studio.goTo('effects')}>All effects<Icon name="chevron" size={14} /></button></header>
      <div className="effect-row">{FEATURED.map((item) => <FeaturedEffect key={item.id} id={item.id} street={item.street} motion={studio.motionAllowed} onTry={() => tryEffect(item.id, item.street)} />)}</div>
    </section>

    <section className="companion-promo" aria-labelledby="promo-title">
      <PromoClip motion={studio.motionAllowed} />
      <div className="promo-copy">
        <span className="eyebrow">Companion</span>
        <h2 id="promo-title">A puppy or a cat who deals for you</h2>
        <p>The puppy trots to the deck, paws out each card, noses the flop across the felt and fetches the turn. The cat flicks out the deal, bats a ball of yarn across the flop and pounces on the river. Both nap when someone tanks and always rest clear of cards, chips and names.</p>
        <button type="button" className="primary-button" onClick={() => studio.goTo('companion')}><Icon name="paw" size={15} />Meet the companions</button>
      </div>
    </section>
  </div>;
}

function FeaturedEffect({ id, street, motion, onTry }: { id: string; street: Street; motion: boolean; onTry: () => void }) {
  const preset = getPreset(id);
  const [watching, setWatching] = useState(false);
  if (!preset) return null;
  return <button type="button" className="effect-tile" onClick={onTry} onMouseEnter={() => setWatching(true)} onMouseLeave={() => setWatching(false)} onFocus={() => setWatching(true)} onBlur={() => setWatching(false)}
    aria-label={`Try ${presetName(preset)} on the ${street}`}>
    <span className="effect-media"><img src={posterUrl(id)} alt="" loading="lazy" draggable={false} />
      {watching && motion && <video ref={(video) => { if (video) { video.muted = true; video.setAttribute('muted', ''); void video.play?.()?.catch(() => {}); } }} src={clipUrl(id)} muted loop playsInline autoPlay aria-hidden="true" />}
      <span className="effect-play"><Icon name="play" size={14} /></span></span>
    <span className="effect-text"><b>{presetName(preset)}</b><small>{MOOD_LABEL[moodOf(preset)]} · {street === 'deal' ? 'Deal' : street[0]!.toUpperCase() + street.slice(1)} · {seconds(preset.duration)}</small></span>
  </button>;
}

/** The puppy clip plays only while it is on screen. */
function PromoClip({ motion }: { motion: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element || !motion || typeof IntersectionObserver === 'undefined') return;
    element.muted = true; element.setAttribute('muted', '');
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) void element.play?.()?.catch(() => {}); else element.pause?.(); }, { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [motion]);
  return <div className="promo-media"><video ref={video} src={clipUrl('deal.puppy')} poster={posterUrl('deal.puppy')} muted loop playsInline preload="metadata" aria-label="The puppy dealing the hole cards" /></div>;
}
