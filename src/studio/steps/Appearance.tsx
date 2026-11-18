import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { cardDataUrl, artOptions } from '../../rendering/cards';
import { builtInThemes } from '../../themes/defaults';
import type { Theme } from '../../types';
import { METALS, moodFromFelt, paletteFromMood, posterUrl, type Mood2D } from '../catalog';
import type { Studio } from '../studio-types';
import { ColorField, Disclosure, Group, Icon, Range, Segmented, Setting, Toggle } from '../ui';

const FACE_STYLES: Record<Theme['card']['face'], Partial<Theme['card']>> = {
  native: { face: 'native', faceColor: '#fffdf7', redColor: '#be354a', blackColor: '#24282f', borderColor: '#d7d5cb', borderRadius: 6 },
  classic: { face: 'classic', faceColor: '#fffdf4', redColor: '#b83348', blackColor: '#25332e', borderColor: '#d8d2bf', borderRadius: 5 },
  modern: { face: 'modern', faceColor: '#faf8f2', redColor: '#d35165', blackColor: '#22293a', borderColor: '#dcd9ef', borderRadius: 8 },
  midnight: { face: 'midnight', faceColor: '#181c2c', redColor: '#fd8b9a', blackColor: '#dcdafa', borderColor: '#626a87', borderRadius: 8 },
  puppy: { face: 'puppy', faceColor: '#fffaf0', redColor: '#c8394a', blackColor: '#2a211c', borderColor: '#ecd9bc', borderRadius: 9 },
};
const FACE_NAMES: Record<Theme['card']['face'], [string, string]> = {
  native: ['PokerNow', 'The site’s own artwork'], classic: ['Classic', 'Serif corners'], modern: ['Modern', 'Large, clean pips'],
  midnight: ['Midnight', 'Dark faces'], puppy: ['Puppy', 'Warm paper, paw details'],
};
const BACKS = [['crosshatch', 'Crosshatch'], ['diamonds', 'Diamonds'], ['solid', 'Solid'], ['paws', 'Paws']] as const;

/* ------------------------------------------------------------------ deck */

export function Deck({ studio }: { studio: Studio }) {
  const { theme, display } = studio;
  const card = theme.card;
  return <div className="step">
    <Group title="Card faces" note="Artwork shared by your table and every animation." id="faces-title">
      <div className="face-grid" role="radiogroup" aria-labelledby="faces-title">
        {(Object.keys(FACE_STYLES) as Theme['card']['face'][]).map((face) => {
          const on = card.face === face;
          const style = { ...display.card, ...FACE_STYLES[face] };
          return <button type="button" role="radio" aria-checked={on} key={face} className={`face-option ${on ? 'on' : ''}`} onClick={() => studio.patchCard(FACE_STYLES[face])}>
            <span className="face-cards"><img src={cardDataUrl({ rank: 'A', suit: 'spades' }, style, artOptions(display))} alt="" /><img src={cardDataUrl({ rank: 'K', suit: 'hearts' }, style, artOptions(display))} alt="" /></span>
            <b>{FACE_NAMES[face][0]}</b><small>{FACE_NAMES[face][1]}</small>
          </button>;
        })}
      </div>
      {card.face === 'native' && <p className="hint">On PokerNow your table keeps the site’s own card artwork. The preview shows a close local copy.</p>}
    </Group>

    <Group title="Card back" note="What opponents’ hidden cards look like.">
      <div className="back-row">
        <img className="back-preview" src={cardDataUrl(undefined, display.card, artOptions(display))} alt="Your card back" />
        <div className="back-controls">
          <Segmented label="Card back pattern" value={card.back === 'image' ? 'image' : card.back} options={[...BACKS, ...(card.backImage ? [['image', 'Your image'] as const] : [])]}
            onChange={(back) => studio.patchCard({ back })} />
          <ColorField label="Back colour" value={card.backColor} onChange={(backColor) => studio.patchCard({ backColor })} />
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => studio.uploadImage('back')}><Icon name="upload" size={15} />Upload an image</button>
            {card.backImage && <button type="button" className="text-button" onClick={() => studio.patchCard({ backImage: undefined, back: 'crosshatch' })}>Remove image</button>}
          </div>
        </div>
      </div>
    </Group>

    <Group title="Made-hand glow" note="A soft glow around your own cards when they make a pair or better. Board-only hands don’t count.">
      <Setting title="Glow" description="Shown only on your seat."><Toggle label="Made-hand aura" checked={card.aura.enabled} onChange={(enabled) => studio.patchCard({ aura: { ...card.aura, enabled } })} /></Setting>
      {card.aura.enabled && <>
        <ColorField label="Glow colour" value={card.aura.color} onChange={(color) => studio.patchCard({ aura: { ...card.aura, color } })} />
        <Range label="Strength" value={card.aura.strength} min={0} max={1} step={0.05} onChange={(strength) => studio.patchCard({ aura: { ...card.aura, strength } })} />
      </>}
    </Group>

    <Disclosure title="Fine-tune the face">
      <ColorField label="Card background" value={card.faceColor} onChange={(faceColor) => studio.patchCard({ faceColor })} />
      <ColorField label="Hearts and diamonds" value={card.redColor} onChange={(redColor) => studio.patchCard({ redColor })} />
      <ColorField label="Spades and clubs" value={card.blackColor} onChange={(blackColor) => studio.patchCard({ blackColor })} />
      <ColorField label="Border" value={card.borderColor} onChange={(borderColor) => studio.patchCard({ borderColor })} />
      <Range label="Corner radius" value={card.borderRadius} min={0} max={14} unit="px" onChange={(borderRadius) => studio.patchCard({ borderRadius })} />
      <Range label="Card shadow" value={card.shadow} min={0} max={1} step={0.05} onChange={(shadow) => studio.patchCard({ shadow })} />
    </Disclosure>
  </div>;
}

/* ------------------------------------------------------------------ felt */

const sameRoom = (table: Theme['table'], room: Theme): boolean =>
  table.feltColor.toLowerCase() === room.table.feltColor.toLowerCase() && table.railColor.toLowerCase() === room.table.railColor.toLowerCase();

export function Felt({ studio }: { studio: Studio }) {
  const { theme } = studio;
  const table = theme.table;
  const activeRoom = builtInThemes.find((room) => sameRoom(table, room));
  const metal = METALS.find((item) => item.trim.toLowerCase() === table.trimColor.toLowerCase());
  return <div className="step">
    <Group title="Rooms" note={activeRoom ? `${activeRoom.name}: ${activeRoom.description ?? 'a signature table.'}` : 'Your own colours. Pick a room to start again from one.'} id="rooms-title">
      <div className="room-row" role="radiogroup" aria-labelledby="rooms-title">
        {builtInThemes.map((room) => {
          const on = activeRoom?.id === room.id;
          return <button type="button" key={room.id} role="radio" aria-checked={on} aria-label={room.name} title={room.name} className={`room-swatch ${on ? 'on' : ''}`}
            style={{ '--felt': room.table.feltColor, '--rail': room.table.railColor, '--bg': room.table.backgroundColor } as CSSProperties}
            onClick={() => studio.patchTable({ feltColor: room.table.feltColor, railColor: room.table.railColor, backgroundColor: room.table.backgroundColor, trimColor: room.table.trimColor, motif: room.table.motif, emblem: room.table.emblem })}>
            <i /><span>{room.name}</span>
          </button>;
        })}
      </div>
    </Group>

    <Group title="Mood" note="Drag across for colour and down for depth. Felt, rail, room and card back are all matched to one point.">
      <MoodPad felt={table.feltColor} onChange={(palette) => {
        studio.updateTheme((next) => ({ ...next,
          table: { ...next.table, feltColor: palette.felt, railColor: palette.rail, backgroundColor: palette.surroundings },
          card: { ...next.card, backColor: palette.back }, board: { ...next.board, color: palette.board } }));
      }} />
      <div className="metal-row" role="radiogroup" aria-label="Trim metal">
        <span className="label">Trim</span>
        {METALS.map((item) => <button type="button" key={item.name} role="radio" aria-checked={metal?.name === item.name} className={`metal ${metal?.name === item.name ? 'on' : ''}`}
          style={{ '--metal': item.trim } as CSSProperties} onClick={() => studio.updateTheme((next) => ({ ...next, table: { ...next.table, trimColor: item.trim }, card: { ...next.card, aura: { ...next.card.aura, color: item.aura } } }))}>
          <i />{item.name}</button>)}
      </div>
    </Group>

    <Disclosure title="Fine-tune colours">
      <ColorField label="Felt" value={table.feltColor} onChange={(feltColor) => studio.patchTable({ feltColor })} />
      <ColorField label="Metal trim" value={table.trimColor} onChange={(trimColor) => studio.patchTable({ trimColor })} />
      <ColorField label="Rail" value={table.railColor} onChange={(railColor) => studio.patchTable({ railColor })} />
      <ColorField label="Room" value={table.backgroundColor} onChange={(backgroundColor) => studio.patchTable({ backgroundColor })} />
    </Disclosure>

    <Group title="Make it yours">
      <div className="field"><label htmlFor="felt-inscription">Words on the felt</label>
        <input id="felt-inscription" aria-label="Felt inscription" maxLength={28} placeholder="For example: Friday Night Club" value={table.inscription}
          onChange={(event) => { const inscription = event.target.value; if (/^[\p{L}\p{N} .,'’&·+\-]*$/u.test(inscription)) studio.patchTable({ inscription }); }} /></div>
      <div className="field-row">
        <div className="field"><label htmlFor="felt-emblem">Emblem</label>
          <select id="felt-emblem" aria-label="Table emblem" value={table.emblem} onChange={(event) => studio.patchTable({ emblem: event.target.value as Theme['table']['emblem'] })}>
            {([['spade', 'Spade'], ['crown', 'Crown'], ['laurel', 'Laurel'], ['paw', 'Paw'], ['none', 'None']] as const).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></div>
        <div className="field"><label htmlFor="felt-decor">Decor</label>
          <select id="felt-decor" aria-label="Table decor" value={table.motif} onChange={(event) => studio.patchTable({ motif: event.target.value as Theme['table']['motif'] })}>
            <option value="classic">Classic</option><option value="puppy">Puppy: paw prints and paw chips</option>
          </select></div>
      </div>
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => studio.uploadImage('table')}><Icon name="upload" size={15} />Room background image</button>
        {table.backgroundImage && <button type="button" className="text-button" onClick={() => studio.patchTable({ backgroundImage: undefined })}>Remove image</button>}
      </div>
      <p className="hint">Images stay in this browser and travel with exported themes.</p>
    </Group>
  </div>;
}

/** Hue across, depth down. Changes are applied at most ten times a second while dragging. */
function MoodPad({ felt, onChange }: { felt: string; onChange: (palette: ReturnType<typeof paletteFromMood>) => void }) {
  const pad = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Mood2D | null>(null);
  const pending = useRef<Mood2D | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mood = drag ?? moodFromFelt(felt);
  const palette = paletteFromMood(mood);
  useEffect(() => () => clearTimeout(timer.current), []);
  const push = (next: Mood2D, now = false): void => {
    pending.current = next;
    if (now) { clearTimeout(timer.current); timer.current = undefined; onChange(paletteFromMood(next)); return; }
    if (timer.current) return;
    timer.current = setTimeout(() => { timer.current = undefined; if (pending.current) onChange(paletteFromMood(pending.current)); }, 100);
  };
  const at = (event: PointerEvent): Mood2D => {
    const box = pad.current!.getBoundingClientRect();
    return { hue: Math.max(0, Math.min(359.9, ((event.clientX - box.left) / box.width) * 360)), depth: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) };
  };
  const key = (event: KeyboardEvent): void => {
    const step = event.shiftKey ? 4 : 1;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-6 * step, 0], ArrowRight: [6 * step, 0], ArrowUp: [0, -0.04 * step], ArrowDown: [0, 0.04 * step] };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    push({ hue: (mood.hue + move[0] + 360) % 360, depth: Math.max(0, Math.min(1, mood.depth + move[1])) }, true);
  };
  return <div className="mood">
    <div ref={pad} className="mood-pad" onPointerDown={(event) => { pad.current?.setPointerCapture(event.pointerId); const next = at(event); setDrag(next); push(next); }}
      onPointerMove={(event) => { if (!drag) return; const next = at(event); setDrag(next); push(next); }}
      onPointerUp={(event) => { if (!drag) return; const next = at(event); setDrag(null); push(next, true); }} onPointerCancel={() => setDrag(null)}>
      <span className="mood-knob" role="slider" tabIndex={0} aria-label="Table mood" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(mood.hue)}
        aria-valuetext={`Hue ${Math.round(mood.hue)} degrees, depth ${Math.round(mood.depth * 100)} percent`} onKeyDown={key}
        style={{ left: `${(mood.hue / 360) * 100}%`, top: `${mood.depth * 100}%`, background: palette.felt }} />
    </div>
    <div className="mood-swatches" aria-label="Colours from this mood">
      {([['Felt', palette.felt], ['Rail', palette.rail], ['Room', palette.surroundings], ['Card back', palette.back]] as const).map(([name, color]) =>
        <span key={name}><i style={{ background: color }} />{name}</span>)}
    </div>
  </div>;
}

/* ------------------------------------------------------------------ board */

export function Board({ studio }: { studio: Studio }) {
  const board = studio.theme.board;
  return <div className="step">
    <Group title="Community cards" note="The plate the board sits on, and how the five cards are spaced.">
      <ColorField label="Backplate" value={board.color} onChange={(color) => studio.patchBoard({ color })} />
      <ColorField label="Highlight" value={board.highlight} onChange={(highlight) => studio.patchBoard({ highlight })} />
      <Range label="Card spacing" value={board.spacing} min={4} max={24} unit="px" onChange={(spacing) => studio.patchBoard({ spacing })} />
      <Range label="Card shadows" value={board.shadow} min={0} max={1} step={0.05} onChange={(shadow) => studio.patchBoard({ shadow })} />
    </Group>
    <div className="note"><Icon name="board" size={18} /><p>On PokerNow, every animation lands exactly where the site puts each card. Spacing changes the effect lab preview only, so the game’s layout never moves.</p></div>
  </div>;
}

/* ------------------------------------------------------------------ puppy */

export function Puppy({ studio }: { studio: Studio }) {
  const companion = studio.theme.companion;
  const puppyEverywhere = (['deal', 'flop', 'turn', 'river'] as const).every((street) => studio.theme.animations[street].preset.endsWith('.puppy'));
  const usePuppyMoments = (): void => studio.updateTheme((theme) => ({ ...theme, animations: {
    deal: { preset: 'deal.puppy', parameters: {} }, flop: { preset: 'flop.puppy', parameters: {} },
    turn: { preset: 'turn.puppy', parameters: {} }, river: { preset: 'river.puppy', parameters: {} } } }));
  return <div className="step">
    <Group title="Table companion" note="A 3D puppy who lives on your table. It always rests where it covers no cards, chips or names." id="companion-title">
      <div className="companion-grid" role="radiogroup" aria-labelledby="companion-title" aria-label="Table companion">
        <button type="button" role="radio" aria-checked={!companion} className={`companion-option ${!companion ? 'on' : ''}`} onClick={() => studio.patchCompanion(undefined)}>
          <img src={posterUrl('flop.grand')} alt="" /><b>No companion</b><small>Puppy effects still work: the puppy drops in for them, then trots off.</small></button>
        <button type="button" role="radio" aria-checked={Boolean(companion)} className={`companion-option ${companion ? 'on' : ''}`}
          onClick={() => studio.patchCompanion(companion ?? { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium' })}>
          <img src={posterUrl('flop.puppy')} alt="" /><b>Puppy</b><small>Deals, reveals the board, sweeps the chips, naps when someone tanks.</small></button>
      </div>
    </Group>
    {companion && <Group title="How it behaves">
      <Setting title="Puppy runs the action" description="Off keeps the puppy resting at its spot."><Toggle label="Puppy animations" checked={companion.animations} onChange={(animations) => studio.patchCompanion({ ...companion, animations })} /></Setting>
      <div className="field"><span className="label">Energy</span><Segmented label="Puppy animation intensity" value={companion.intensity} options={[['subtle', 'Calm'], ['normal', 'Normal'], ['playful', 'Playful']]} onChange={(intensity) => studio.patchCompanion({ ...companion, intensity })} /></div>
      <div className="field"><span className="label">Size</span><Segmented label="Puppy size" value={companion.scale} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} onChange={(scale) => studio.patchCompanion({ ...companion, scale })} /></div>
    </Group>}
    <Group title="Puppy moments" note="Effects the puppy performs itself, for every street." action={<button type="button" className="secondary-button" disabled={puppyEverywhere} onClick={usePuppyMoments}><Icon name="paw" size={15} />{puppyEverywhere ? 'Puppy on every street' : 'Use on every street'}</button>}>
      <p className="hint">Reduced motion (in Settings) keeps the puppy resting quietly.</p>
    </Group>
  </div>;
}
