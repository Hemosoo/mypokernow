import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { artOptions, cardDataUrl } from '../../rendering/cards';
import type { Theme } from '../../types';
import { METALS, PALETTES, moodFromFelt, paletteFromMood, type Mood2D } from '../catalog';
import type { AppearanceTab, Studio } from '../studio-types';
import { ColorField, Disclosure, Icon, Range, Section, Setting, Toggle } from '../ui';

type Face = Theme['card']['face'];
const FACES: { id: Face; name: string; note: string; style: Partial<Theme['card']> }[] = [
  { id: 'classic', name: 'Classic', note: 'Engraved keyline, crowned courts', style: { faceColor: '#fffdf4', redColor: '#b83348', blackColor: '#25332e', borderColor: '#d8d2bf', borderRadius: 7 } },
  { id: 'modern', name: 'Modern', note: 'Flat, oversized suits, badge courts', style: { faceColor: '#f7f7f5', redColor: '#c92b3c', blackColor: '#111316', borderColor: '#d9dce0', borderRadius: 5 } },
  { id: 'midnight', name: 'Midnight', note: 'Dark faces under starlight', style: { faceColor: '#181c2c', redColor: '#fd8b9a', blackColor: '#dcdafa', borderColor: '#626a87', borderRadius: 8 } },
  { id: 'neon', name: 'Neon', note: 'Glowing ink on black glass', style: { faceColor: '#0c0e18', redColor: '#ff4f9a', blackColor: '#63e6ff', borderColor: '#313a66', borderRadius: 6 } },
  { id: 'sakura', name: 'Sakura', note: 'Washi paper and blossoms', style: { faceColor: '#fcf5ef', redColor: '#c23c5c', blackColor: '#2a2a3e', borderColor: '#ecd8d3', borderRadius: 10 } },
  { id: 'pixel', name: 'Pixel', note: 'Pixel ranks, chunky suits, square corners', style: { faceColor: '#ffffff', redColor: '#e4202e', blackColor: '#141414', borderColor: '#141414', borderRadius: 0 } },
  { id: 'holo', name: 'Hologram', note: 'Tinted glass, split-colour edges', style: { faceColor: '#0f1a22', redColor: '#ff5c9d', blackColor: '#a8f4ff', borderColor: '#2f6b78', borderRadius: 5 } },
  { id: 'cipher', name: 'Cipher', note: 'Black, dot-matrix index, corner brackets', style: { faceColor: '#0b0c0d', redColor: '#ff4646', blackColor: '#b7ff3c', borderColor: '#30353a', borderRadius: 2 } },
  { id: 'puppy', name: 'Puppy', note: 'Dog-portrait courts, paw trims', style: { faceColor: '#fffaf0', redColor: '#c8394a', blackColor: '#2a211c', borderColor: '#ecd9bc', borderRadius: 9 } },
  { id: 'cat', name: 'Cat', note: 'Cat-portrait courts, paw prints and yarn', style: { faceColor: '#fffaf2', redColor: '#c4374a', blackColor: '#2b2422', borderColor: '#ecdcc4', borderRadius: 9 } },
  { id: 'native', name: 'PokerNow', note: 'The site’s own artwork', style: { faceColor: '#fffdf7', redColor: '#be354a', blackColor: '#24282f', borderColor: '#d7d5cb', borderRadius: 6 } },
];
const BACKS: [Theme['card']['back'], string][] = [['crosshatch', 'Guilloché'], ['diamonds', 'Harlequin'], ['solid', 'Plain'], ['circuit', 'Circuit'], ['petals', 'Petals'], ['paws', 'Paws'],
  ['pixel', 'Pixel coin'], ['holo', 'Hologram foil'], ['glyph', 'Glyph block'], ['yarn', 'Yarn']];
const MOTIFS: [Theme['table']['motif'], string][] = [['classic', 'Plain'], ['puppy', 'Paw prints'], ['cat', 'Paws and yarn'], ['neon', 'Lit grid'], ['sakura', 'Petals'],
  ['arcade', 'Pixel marquee'], ['rain', 'Wet street'], ['breach', 'Circuit traces']];
const EMBLEMS: [Theme['table']['emblem'], string][] = [['spade', 'Spade'], ['crown', 'Crown'], ['laurel', 'Laurel'], ['blossom', 'Blossom'], ['bolt', 'Bolt'], ['paw', 'Paw'],
  ['yarn', 'Yarn'], ['coin', 'Coin'], ['sigil', 'Sigil'], ['chip', 'Chip'], ['none', 'None']];
const TRIMS = [...METALS, { name: 'Neon', trim: '#43e3ff', aura: '#8af4ff' }, { name: 'Magenta', trim: '#ff3d8b', aura: '#ffb84a' }, { name: 'Acid', trim: '#b7ff3c', aura: '#c8ff6a' }];
const TABS: [AppearanceTab, string][] = [['cards', 'Cards'], ['table', 'Table'], ['room', 'Room'], ['board', 'Board']];
const same = (a?: string, b?: string): boolean => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

export function AppearancePage({ studio }: { studio: Studio }) {
  return <div className="page appearance-page">
    <header className="page-head"><h2>Appearance</h2><p>Changes show on the table as you make them and save to <b>{studio.theme.name}</b>.</p></header>
    <div className="subtabs" role="tablist" aria-label="Appearance">
      {TABS.map(([id, label]) => <button type="button" role="tab" key={id} aria-selected={studio.appearanceTab === id} className={studio.appearanceTab === id ? 'on' : ''} onClick={() => studio.setAppearanceTab(id)}>{label}</button>)}
    </div>
    {studio.appearanceTab === 'cards' && <CardsTab studio={studio} />}
    {studio.appearanceTab === 'table' && <TableTab studio={studio} />}
    {studio.appearanceTab === 'room' && <RoomTab studio={studio} />}
    {studio.appearanceTab === 'board' && <BoardTab studio={studio} />}
  </div>;
}

/* ------------------------------------------------------------------ cards */

function CardsTab({ studio }: { studio: Studio }) {
  const { theme, display, baseline } = studio;
  const card = theme.card;
  const reset = (key: 'faceColor' | 'redColor' | 'blackColor' | 'borderColor' | 'backColor') =>
    baseline && !same(baseline.card[key], card[key]) ? () => studio.patchCard({ [key]: baseline.card[key] }) : undefined;
  return <>
    <Section title="Card face" id="faces-title">
      <div className="face-grid" role="radiogroup" aria-labelledby="faces-title">
        {FACES.map((face) => {
          const on = card.face === face.id;
          const style = { ...display.card, ...face.style, face: face.id };
          const art = (rank: 'A' | 'K' | '7', suit: 'spades' | 'hearts' | 'diamonds') => cardDataUrl({ rank, suit }, style, artOptions(display));
          return <button type="button" role="radio" aria-checked={on} key={face.id} className={`face-option ${on ? 'on' : ''}`} onClick={() => studio.patchCard({ face: face.id, ...face.style })}>
            <span className="face-fan"><img src={art('A', 'spades')} alt="" /><img src={art('K', 'hearts')} alt="" /><img src={art('7', 'diamonds')} alt="" /></span>
            <b>{face.name}</b><small>{face.note}</small>
          </button>;
        })}
      </div>
      {card.face === 'native' && <p className="hint">On PokerNow your table keeps the site’s own card artwork; the preview shows a close copy.</p>}
    </Section>

    <Section title="Card back" note="What opponents’ hidden cards look like." id="backs-title">
      <div className="back-grid" role="radiogroup" aria-labelledby="backs-title">
        {[...BACKS, ...(card.backImage ? [['image', 'Your image'] as [Theme['card']['back'], string]] : [])].map(([back, label]) => {
          const on = card.back === back;
          return <button type="button" role="radio" aria-checked={on} key={back} className={`back-option ${on ? 'on' : ''}`} onClick={() => studio.patchCard({ back })}>
            <img src={cardDataUrl(undefined, { ...display.card, back }, artOptions(display))} alt="" /><span>{label}</span></button>;
        })}
      </div>
      <ColorField label="Back colour" value={card.backColor} onChange={(backColor) => studio.patchCard({ backColor })} onReset={reset('backColor')} />
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => studio.uploadImage('back')}><Icon name="upload" size={15} />Upload a back image</button>
        {card.backImage && <button type="button" className="text-button" onClick={() => studio.patchCard({ backImage: undefined, back: 'crosshatch' })}>Remove image</button>}
      </div>
    </Section>

    <Disclosure title="Colours">
      <ColorField label="Card paper" value={card.faceColor} onChange={(faceColor) => studio.patchCard({ faceColor })} onReset={reset('faceColor')} />
      <ColorField label="Hearts and diamonds" value={card.redColor} onChange={(redColor) => studio.patchCard({ redColor })} onReset={reset('redColor')} />
      <ColorField label="Spades and clubs" value={card.blackColor} onChange={(blackColor) => studio.patchCard({ blackColor })} onReset={reset('blackColor')} />
      <ColorField label="Edge" value={card.borderColor} onChange={(borderColor) => studio.patchCard({ borderColor })} onReset={reset('borderColor')} />
    </Disclosure>
    <Disclosure title="Advanced">
      <Range label="Corner radius" value={card.borderRadius} min={0} max={14} unit="px" onChange={(borderRadius) => studio.patchCard({ borderRadius })} />
      <Range label="Card shadow" value={card.shadow} min={0} max={1} step={0.05} format={(value) => `${Math.round(value * 100)}%`} onChange={(shadow) => studio.patchCard({ shadow })} />
      <Setting title="Made-hand glow" description="A soft glow around your own cards when they make a pair or better.">
        <Toggle label="Made-hand glow" checked={card.aura.enabled} onChange={(enabled) => studio.patchCard({ aura: { ...card.aura, enabled } })} /></Setting>
      {card.aura.enabled && <>
        <ColorField label="Glow colour" value={card.aura.color} onChange={(color) => studio.patchCard({ aura: { ...card.aura, color } })} />
        <Range label="Glow strength" value={card.aura.strength} min={0} max={1} step={0.05} format={(value) => `${Math.round(value * 100)}%`} onChange={(strength) => studio.patchCard({ aura: { ...card.aura, strength } })} />
      </>}
    </Disclosure>
  </>;
}

/* ------------------------------------------------------------------ table */

type Part = 'felt' | 'rail' | 'trim' | 'room';

function TableTab({ studio }: { studio: Studio }) {
  const { theme, baseline } = studio;
  const table = theme.table;
  const [part, setPart] = useState<Part | undefined>();
  const palette = PALETTES.find((item) => same(item.felt, table.feltColor) && same(item.rail, table.railColor) && same(item.trim, table.trimColor));
  const metal = TRIMS.find((item) => same(item.trim, table.trimColor));
  const reset = (key: 'feltColor' | 'railColor' | 'trimColor') => baseline && !same(baseline.table[key], table[key]) ? () => studio.patchTable({ [key]: baseline.table[key] }) : undefined;
  const changed = baseline && (['feltColor', 'railColor', 'trimColor', 'backgroundColor'] as const).some((key) => !same(baseline.table[key], table[key]));
  return <>
    <Section title="Palettes" note={palette ? `${palette.name}: felt, rail, trim, room and card back chosen together.` : 'Your own colours. Pick a palette to start again from one.'} id="palettes-title"
      action={changed && baseline ? <button type="button" className="text-button" onClick={() => studio.updateTheme((next) => ({ ...next, table: { ...next.table, feltColor: baseline.table.feltColor, railColor: baseline.table.railColor, trimColor: baseline.table.trimColor, backgroundColor: baseline.table.backgroundColor }, card: { ...next.card, backColor: baseline.card.backColor } }))}><Icon name="reset" size={14} />Reset colours</button> : undefined}>
      <div className="palette-grid" role="radiogroup" aria-labelledby="palettes-title">
        {PALETTES.map((item) => <button type="button" role="radio" key={item.name} aria-checked={palette?.name === item.name} className={`palette ${palette?.name === item.name ? 'on' : ''}`}
          style={{ '--felt': item.felt, '--rail': item.rail, '--trim': item.trim, '--room': item.room } as CSSProperties}
          onClick={() => studio.updateTheme((next) => ({ ...next, table: { ...next.table, feltColor: item.felt, railColor: item.rail, trimColor: item.trim, backgroundColor: item.room },
            card: { ...next.card, backColor: item.back }, board: { ...next.board, color: item.felt } }))}>
          <i aria-hidden="true" /><span>{item.name}</span></button>)}
      </div>
    </Section>

    <Section title="Mood" note="Drag across for colour and down for depth. Felt, rail, room and card back follow one point.">
      <MoodPad felt={table.feltColor} onChange={(mood) => studio.updateTheme((next) => ({ ...next,
        table: { ...next.table, feltColor: mood.felt, railColor: mood.rail, backgroundColor: mood.surroundings },
        card: { ...next.card, backColor: mood.back }, board: { ...next.board, color: mood.board } }))} />
    </Section>

    <Section title="Surfaces" note="Point at a colour to see where it goes.">
      <div className="surfaces">
        <TableDiagram table={table} part={part} />
        <div className="surface-fields">
          <ColorField label="Felt" value={table.feltColor} onChange={(feltColor) => studio.patchTable({ feltColor })} onReset={reset('feltColor')} onFocusPart={(on) => setPart(on ? 'felt' : undefined)} />
          <ColorField label="Rail" value={table.railColor} onChange={(railColor) => studio.patchTable({ railColor })} onReset={reset('railColor')} onFocusPart={(on) => setPart(on ? 'rail' : undefined)} />
          <ColorField label="Trim" value={table.trimColor} onChange={(trimColor) => studio.patchTable({ trimColor })} onReset={reset('trimColor')} onFocusPart={(on) => setPart(on ? 'trim' : undefined)} />
        </div>
      </div>
    </Section>

    <Section title="Trim metal" id="trim-title">
      <div className="metal-row" role="radiogroup" aria-labelledby="trim-title">
        {TRIMS.map((item) => <button type="button" key={item.name} role="radio" aria-checked={metal?.name === item.name} className={`metal ${metal?.name === item.name ? 'on' : ''}`}
          style={{ '--metal': item.trim } as CSSProperties} onClick={() => studio.updateTheme((next) => ({ ...next, table: { ...next.table, trimColor: item.trim }, card: { ...next.card, aura: { ...next.card.aura, color: item.aura } } }))}>
          <i aria-hidden="true" />{item.name}</button>)}
      </div>
    </Section>

    <Section title="Felt pattern" note="Also marks the chips and the dealer button." id="motif-title">
      <div className="choice-row" role="radiogroup" aria-labelledby="motif-title">
        {MOTIFS.map(([value, label]) => <button type="button" role="radio" key={value} aria-checked={table.motif === value} className={`choice ${table.motif === value ? 'on' : ''}`} onClick={() => studio.patchTable({ motif: value })}>{label}</button>)}
      </div>
    </Section>

    <Section title="Emblem and words" id="emblem-title">
      <div className="choice-row" role="radiogroup" aria-labelledby="emblem-title">
        {EMBLEMS.map(([value, label]) => <button type="button" role="radio" key={value} aria-checked={table.emblem === value} className={`choice ${table.emblem === value ? 'on' : ''}`} onClick={() => studio.patchTable({ emblem: value })}>{label}</button>)}
      </div>
      <div className="field"><label htmlFor="felt-inscription">Words on the felt</label>
        <input id="felt-inscription" maxLength={28} placeholder="For example: Friday Night Club" value={table.inscription}
          onChange={(event) => { const inscription = event.target.value; if (/^[\p{L}\p{N} .,'’&·+\-]*$/u.test(inscription)) studio.patchTable({ inscription }); }} /></div>
    </Section>
  </>;
}

/** A plan of the table that lights up the surface being edited. */
function TableDiagram({ table, part }: { table: Theme['table']; part?: Part }) {
  const on = (name: Part) => part === name ? 'on' : part ? 'dim' : '';
  return <svg className="diagram" viewBox="0 0 200 120" role="img" aria-label="Which part of the table each colour changes">
    <rect className={on('room')} x="1" y="1" width="198" height="118" rx="10" fill={table.backgroundColor} />
    <ellipse className={on('rail')} cx="100" cy="60" rx="86" ry="46" fill={table.railColor} />
    <ellipse className={on('trim')} cx="100" cy="60" rx="74" ry="36" fill="none" stroke={table.trimColor} strokeWidth="3.4" />
    <ellipse className={on('felt')} cx="100" cy="60" rx="71" ry="33.5" fill={table.feltColor} />
    <g className="diagram-labels" fontSize="8.5" fontWeight="600" textAnchor="middle">
      <text x="100" y="63" className={on('felt')}>Felt</text><text x="100" y="101" className={on('rail')}>Rail</text>
      <text x="171" y="33" className={on('trim')}>Trim</text><text x="20" y="13" className={on('room')}>Room</text>
    </g>
  </svg>;
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
      {([['Felt', palette.felt], ['Rail', palette.rail], ['Room', palette.surroundings], ['Back', palette.back]] as const).map(([name, color]) =>
        <span key={name}><i style={{ background: color }} />{name}</span>)}
    </div>
  </div>;
}

/* ------------------------------------------------------------------ room */

function RoomTab({ studio }: { studio: Studio }) {
  const { theme, baseline, library } = studio;
  const table = theme.table;
  const particles = table.motif === 'sakura' ? 'Petals drift down' : table.motif === 'neon' ? 'Pixels flicker' : table.motif === 'arcade' ? 'Pixels twinkle'
    : table.motif === 'rain' ? 'Rain falls through the light' : table.motif === 'breach' ? 'Data packets run along the traces' : 'Dust drifts in the light';
  return <>
    <Section title="Room colour" note="The space around the table.">
      <ColorField label="Room" value={table.backgroundColor} onChange={(backgroundColor) => studio.patchTable({ backgroundColor })}
        onReset={baseline && !same(baseline.table.backgroundColor, table.backgroundColor) ? () => studio.patchTable({ backgroundColor: baseline.table.backgroundColor }) : undefined} />
    </Section>
    <Section title="Background image" note="Your own photo behind the table, darkened at the edges so the table stays clear.">
      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => studio.uploadImage('table')}><Icon name="upload" size={15} />{table.backgroundImage ? 'Replace image' : 'Upload an image'}</button>
        {table.backgroundImage && <button type="button" className="text-button" onClick={() => studio.patchTable({ backgroundImage: undefined })}>Remove image</button>}
      </div>
      <p className="hint">PNG, JPEG or WebP. Images stay in this browser and travel with exported themes.</p>
    </Section>
    <Section title="Atmosphere" tag="All themes">
      <Setting title="Ambient particles" description={`${particles} above the felt. The felt pattern sets the style.`}>
        <Toggle label="Ambient particles" checked={library.settings.effects.ambience} onChange={(ambience) => studio.setting('effects', { ...library.settings.effects, ambience })} /></Setting>
    </Section>
  </>;
}

/* ------------------------------------------------------------------ board */

function BoardTab({ studio }: { studio: Studio }) {
  const board = studio.theme.board;
  const baseline = studio.baseline?.board;
  return <>
    <Section title="Community cards" note="The glow under the board, chip highlights and win light all take the highlight colour.">
      <ColorField label="Highlight" value={board.highlight} onChange={(highlight) => studio.patchBoard({ highlight })}
        onReset={baseline && !same(baseline.highlight, board.highlight) ? () => studio.patchBoard({ highlight: baseline.highlight }) : undefined} />
    </Section>
    <Disclosure title="Effect lab" tag="Not on PokerNow">
      <p className="hint">PokerNow decides where its cards sit and draws their plate, so these change only the studio’s effect lab, never the game.</p>
      <ColorField label="Backplate" value={board.color} onChange={(color) => studio.patchBoard({ color })}
        onReset={baseline && !same(baseline.color, board.color) ? () => studio.patchBoard({ color: baseline.color }) : undefined} />
      <Range label="Card spacing" value={board.spacing} min={4} max={24} unit="px" onChange={(spacing) => studio.patchBoard({ spacing })} />
      <Range label="Card shadows" value={board.shadow} min={0} max={1} step={0.05} format={(value) => `${Math.round(value * 100)}%`} onChange={(shadow) => studio.patchBoard({ shadow })} />
    </Disclosure>
  </>;
}
