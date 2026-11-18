import type { Studio } from '../studio-types';
import { Group, Icon } from '../ui';

const SAME = [
  ['The game', 'Same cards, same order, same result. The extension never touches the game.'],
  ['Your information', 'Names, stacks, bets, the pot and the blinds stay where PokerNow puts them.'],
  ['Your turn', 'PokerNow’s own buttons and timer. No effect ever delays you.'],
] as const;

export function Home({ studio }: { studio: Studio }) {
  const puppy = studio.library.themes.find((theme) => theme.id === 'room-puppy') ?? studio.library.themes.find((theme) => theme.companion);
  const usingPuppy = puppy?.id === studio.theme.id;
  return <div className="step">
    <p className="home-lede">PokerNow Customizer changes how your PokerNow table <em>looks</em>, never how it plays: the felt, the cards, the chips, and how cards are dealt and revealed.</p>

    <Group title="Get started">
      <ol className="starts">
        <li><span className="start-n">1</span><div><b>Choose a look</b><p>Pick a theme from the dots at the top, or build your own deck, felt and board.</p></div>
          <button type="button" className="secondary-button" onClick={() => studio.goTo('library')}>Themes</button></li>
        <li><span className="start-n">2</span><div><b>Pick your effects</b><p>Choose how the deal, flop, turn and river arrive. Hover any effect to watch it.</p></div>
          <button type="button" className="secondary-button" onClick={() => studio.goTo('moments')}>Effects</button></li>
        <li><span className="start-n">3</span><div><b>Play on PokerNow</b><p>Open a game and your theme is already there. Switch it off any time with <b>On PokerNow</b>, top right.</p></div>
          <span className={`state-chip ${studio.library.settings.enabled ? 'on' : ''}`}>{studio.library.settings.enabled ? 'On' : 'Off'}</span></li>
      </ol>
      {puppy && <button type="button" className="primary-button home-puppy" disabled={usingPuppy} onClick={() => studio.switchTheme(puppy.id)}>
        <Icon name="paw" size={16} />{usingPuppy ? 'You’re using the Puppy theme' : 'Use the Puppy theme'}</button>}
    </Group>

    <Group title="What never changes">
      <ul className="facts">
        {SAME.map(([title, text]) => <li key={title}><Icon name="check" size={16} /><div><b>{title}</b><p>{text}</p></div></li>)}
      </ul>
    </Group>
  </div>;
}
