import type { CardAppearance, CardIdentity, Suit, Theme, VisualCard } from '../types';
import { darken, lighten, luminance, metal, mix, rgba, safeHex, svgDataUrl } from './color';
import { CAP_HEIGHT, glyphs } from './glyphs';
import { bone, dogPortrait, paw } from './puppy-art';

/**
 * Card artwork. One renderer feeds the live table, the animation engine and
 * the studio, so a card in flight is indistinguishable from the card at rest.
 *
 * The design unit is 90 × 110: PokerNow's own card proportion, wider than a
 * bridge card. Faces use a jumbo index (rank over suit, top left) so a hand
 * stays readable when only a sliver of each card shows, and one large suit.
 */
export const CARD_WIDTH = 90;
export const CARD_HEIGHT = 110;

export interface CardArtOptions {
  /** Metal used for back linework and face ornaments; defaults to champagne. */
  accent?: string;
  /** Diamonds in blue and clubs in green, following the table's deck setting. */
  fourColor?: boolean;
}

const escape = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
const uploaded = (value: string | undefined): string | undefined => value && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : undefined;
const n = (value: number): string => Number(value.toFixed(2)).toString();

/** Suit shapes drawn in a unit box centred on the origin. */
const SUITS: Record<Suit, string> = {
  hearts: '<path d="M0 .43C-.07 .35-.5 .07-.5-.17C-.5-.36-.37-.46-.24-.46C-.13-.46-.04-.4 0-.3C.04-.4 .13-.46 .24-.46C.37-.46 .5-.36 .5-.17C.5 .07 .07 .35 0 .43Z"/>',
  diamonds: '<path d="M0-.5C.09-.31 .23-.13 .4 0C.23 .13 .09 .31 0 .5C-.09 .31-.23 .13-.4 0C-.23-.13-.09-.31 0-.5Z"/>',
  spades: '<path d="M0-.5C.06-.38 .5-.1 .5 .14C.5 .3 .39 .38 .27 .38C.17 .38 .09 .33 .04 .25C.06 .36 .1 .44 .19 .5L-.19 .5C-.1 .44-.06 .36-.04 .25C-.09 .33-.17 .38-.27 .38C-.39 .38-.5 .3-.5 .14C-.5-.1-.06-.38 0-.5Z"/>',
  clubs: '<path d="M0-.49A.215 .215 0 0 1 .17-.14A.215 .215 0 1 1 .09 .2C.07 .2 .05 .19 .04 .18C.06 .33 .1 .43 .19 .5L-.19 .5C-.1 .43-.06 .33-.04 .18C-.05 .19-.07 .2-.09 .2A.215 .215 0 1 1-.17-.14A.215 .215 0 0 1 0-.49Z"/>',
};

export function suitShape(suit: Suit, cx: number, cy: number, size: number): string {
  return `<g transform="translate(${n(cx)} ${n(cy)}) scale(${n(size)})">${SUITS[suit]}</g>`;
}

/** Rank drawn from stored letterforms; "10" is set tight so it sits in the index column. */
function rankShape(rank: string, x: number, top: number, height: number): { markup: string; width: number } {
  const scale = height / CAP_HEIGHT;
  const letters = rank === '10' ? ['1', '0'] : [rank];
  const squeeze = rank === '10' ? 0.78 : 1, tracking = rank === '10' ? -70 : 0;
  let cursor = 0, markup = '';
  letters.forEach((letter, index) => {
    const glyph = glyphs[letter]!;
    // Start each letter at its ink edge so the index aligns optically with the card margin.
    if (index === 0) cursor = -glyph.x0;
    markup += `<path transform="translate(${n(x + cursor * scale * squeeze)} ${n(top + height)}) scale(${n(scale * squeeze)} ${n(scale)})" d="${glyph.d}"/>`;
    cursor += glyph.w + tracking;
  });
  const last = glyphs[letters[letters.length - 1]!]!;
  const width = (cursor - tracking - last.w + last.x1) * scale * squeeze;
  return { markup, width };
}

const CROWNS: Record<string, string> = {
  K: '<path d="M-9 4L-10.5-5.2L-5.2-.6L0-7.5L5.2-.6L10.5-5.2L9 4Z"/><circle cx="-10.5" cy="-6.4" r="1.25"/><circle cx="0" cy="-8.8" r="1.4"/><circle cx="10.5" cy="-6.4" r="1.25"/><rect x="-9" y="5.2" width="18" height="1.7" rx=".8"/>',
  Q: '<path d="M-8.5 4L-9.5-3L-4.6 .6L0-5.2L4.6 .6L9.5-3L8.5 4Z"/><circle cx="-9.5" cy="-4.2" r="1.15"/><circle cx="0" cy="-6.5" r="1.3"/><circle cx="9.5" cy="-4.2" r="1.15"/><circle cx="-4.6" cy="-.8" r=".8"/><circle cx="4.6" cy="-.8" r=".8"/><rect x="-8.5" y="5.2" width="17" height="1.5" rx=".75"/>',
  J: '<path d="M-7.5 4L-7.5-1.2L-3.6 1.4L0-4.6L3.6 1.4L7.5-1.2L7.5 4Z"/><circle cx="0" cy="-5.9" r="1.25"/><rect x="-7.5" y="5.2" width="15" height="1.4" rx=".7"/>',
};

export interface SemanticRegion { id: string; x: number; y: number; width: number; height: number; kind: 'rank' | 'suit' | 'art' | 'body' }
/** Regions of the face that carry identity, in fractions of the card (0–1). */
export function cardSemanticRegions(identity?: CardIdentity): SemanticRegion[] {
  if (!identity) return [{ id: 'medallion', x: 0.28, y: 0.3, width: 0.44, height: 0.4, kind: 'art' }];
  const court = identity.rank === 'J' || identity.rank === 'Q' || identity.rank === 'K';
  return [
    { id: 'rank', x: 0.06, y: 0.06, width: 0.4, height: 0.3, kind: 'rank' },
    { id: 'index-suit', x: 0.06, y: 0.38, width: 0.26, height: 0.18, kind: 'suit' },
    { id: 'suit', x: 0.4, y: court ? 0.5 : 0.44, width: 0.52, height: court ? 0.42 : 0.48, kind: 'suit' },
    ...(court ? [{ id: 'crown', x: 0.5, y: 0.3, width: 0.32, height: 0.2, kind: 'art' as const }] : []),
  ];
}

interface Palette { paper: string; edge: string; red: string; black: string; blue: string; green: string; accent: string; back: string }
function palette(appearance: CardAppearance, options: CardArtOptions): Palette {
  const red = safeHex(appearance.redColor, '#b8242f'), black = safeHex(appearance.blackColor, '#16181b');
  const dark = luminance(safeHex(appearance.faceColor, '#fbf7ec')) < 0.2;
  return {
    paper: safeHex(appearance.faceColor, '#fbf7ec'), edge: safeHex(appearance.borderColor, '#e6dcc4'), red, black,
    // Four-colour inks keep the theme's value: lighter on dark faces, deeper on light ones.
    blue: dark ? '#7fb2ff' : '#1f55c4', green: dark ? '#6fd39a' : '#14773f',
    accent: safeHex(options.accent ?? '#d4b274', '#d4b274'), back: safeHex(appearance.backColor, '#0c3a2c'),
  };
}

function inkFor(identity: CardIdentity, colors: Palette, fourColor: boolean): string {
  if (identity.suit === 'hearts') return colors.red;
  if (identity.suit === 'diamonds') return fourColor ? colors.blue : colors.red;
  if (identity.suit === 'clubs') return fourColor ? colors.green : colors.black;
  return colors.black;
}

function faceArt(identity: CardIdentity, appearance: CardAppearance, colors: Palette, radius: number, fourColor: boolean): string {
  const ink = inkFor(identity, colors, fourColor);
  const dark = luminance(colors.paper) < 0.2;
  const court = identity.rank === 'J' || identity.rank === 'Q' || identity.rank === 'K';
  const ace = identity.rank === 'A';
  const rank = rankShape(identity.rank, 8.4, 9, 30.5);
  const indexSuitX = 8.4 + Math.max(11, Math.min(rank.width, 26)) / 2;
  // J and Q descend below the baseline; their index suit sits a little lower to clear the tail.
  const indexSuitY = identity.rank === 'J' || identity.rank === 'Q' ? 57.5 : 51.5;
  const paperLow = dark ? lighten(colors.paper, 0.05) : mix(colors.paper, colors.edge, 0.55);
  const classic = appearance.face === 'classic';
  // A fine keyline gives the classic deck its engraved character; the modern deck stays open.
  const frame = classic ? `<rect x="3.6" y="3.6" width="82.8" height="102.8" rx="${n(Math.max(0, radius - 2.2))}" fill="none" stroke="${ink}" stroke-opacity=".16" stroke-width=".5"/>` : '';
  const ornamentInk = dark ? lighten(colors.accent, 0.1) : darken(colors.accent, 0.12);
  const puppy = appearance.face === 'puppy';
  const crown = !court ? '' : puppy
    // The puppy deck's court cards are dog portraits in the same corner position as the crowns.
    ? `<g data-part="art" data-id="crown" data-cx=".66" data-cy=".4"><g transform="translate(59.5 42) scale(.92)">${dogPortrait(identity.rank as 'J' | 'Q' | 'K', ornamentInk, colors.paper)}</g></g>`
    : `<g data-part="art" data-id="crown" data-cx=".66" data-cy=".4" fill="${ornamentInk}"><g transform="translate(59.5 44)">${CROWNS[identity.rank]}</g></g>`;
  // Two tiny paw prints walk along the puppy deck's frame; they stay clear of the index.
  const trail = puppy ? `<g fill="${ornamentInk}" fill-opacity=".38">${paw(80.5, 9.5, 3.1, 28)}${paw(76.4, 14.6, 3.1, 28)}${paw(9.6, 100.8, 3.1, 208)}${paw(13.7, 95.7, 3.1, 208)}</g>` : '';
  const puppyFrame = puppy ? `<rect x="3.4" y="3.4" width="83.2" height="103.2" rx="${n(Math.max(0, radius - 2))}" fill="none" stroke="${ornamentInk}" stroke-opacity=".45" stroke-width=".6"/><rect x="5" y="5" width="80" height="100" rx="${n(Math.max(0, radius - 3.4))}" fill="none" stroke="${ornamentInk}" stroke-opacity=".22" stroke-width=".35" stroke-dasharray="1.2 1.6"/>` : '';
  const halo = !ace ? '' : puppy
    ? `<circle cx="58" cy="73" r="27.5" fill="none" stroke="${ornamentInk}" stroke-opacity=".55" stroke-width=".7"/><g fill="${ornamentInk}" fill-opacity=".42">${bone(58, 104.5, 4.2)}</g>`
    : `<circle cx="58" cy="73" r="27.5" fill="none" stroke="${ornamentInk}" stroke-opacity=".55" stroke-width=".7"/><circle cx="58" cy="73" r="25.2" fill="none" stroke="${ornamentInk}" stroke-opacity=".28" stroke-width=".4" stroke-dasharray=".6 1.8"/>`;
  const suitY = court ? 78 : ace ? 73 : 74.5, suitSize = court ? 36 : ace ? 38 : 43;
  return `<defs>
<linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(colors.paper, dark ? 0.06 : 0.5)}"/><stop offset=".55" stop-color="${colors.paper}"/><stop offset="1" stop-color="${paperLow}"/></linearGradient>
<linearGradient id="ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(ink, dark ? 0.12 : 0.1)}"/><stop offset="1" stop-color="${darken(ink, dark ? 0 : 0.14)}"/></linearGradient>
</defs>
<g data-body="1"><rect width="90" height="110" rx="${n(radius)}" fill="url(#paper)"/>${frame}${puppyFrame}${trail}${halo}</g>
<g data-part="rank" data-id="rank" data-cx=".25" data-cy=".22" fill="url(#ink)">${rank.markup}</g>
<g data-part="suit" data-id="index-suit" data-cx=".2" data-cy=".47" fill="url(#ink)">${suitShape(identity.suit, indexSuitX, indexSuitY, 15.5)}</g>
<g data-part="suit" data-id="suit" data-cx=".64" data-cy=".68" fill="url(#ink)">${suitShape(identity.suit, 58, suitY, suitSize)}</g>
${crown}`;
}

function backArt(appearance: CardAppearance, colors: Palette, radius: number): string {
  const metalTone = metal(colors.accent);
  const line = luminance(colors.back) > 0.45 ? darken(colors.back, 0.45) : metalTone.high;
  const inner = Math.max(0, radius - 3.2);
  const image = uploaded(appearance.backImage);
  let field = '';
  if (appearance.back === 'image' && image) {
    field = `<image href="${escape(image)}" x="5" y="5" width="80" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#panel)"/>`;
  } else if (appearance.back === 'crosshatch') {
    // Guilloché lattice: two families of fine arcs crossing, like engraved banknote work.
    field = `<rect x="5" y="5" width="80" height="100" fill="url(#lattice)" clip-path="url(#panel)"/>`;
  } else if (appearance.back === 'paws') {
    field = `<rect x="5" y="5" width="80" height="100" fill="url(#paws)" clip-path="url(#panel)"/>`;
  } else if (appearance.back === 'diamonds') {
    field = `<rect x="5" y="5" width="80" height="100" fill="url(#harlequin)" clip-path="url(#panel)"/>`;
  }
  const medallion = appearance.back === 'image' && image ? '' : appearance.back === 'paws' ? `<g transform="translate(45 55)">
<circle r="19" fill="${colors.back}" stroke="${line}" stroke-width=".9"/><circle r="16.2" fill="none" stroke="${line}" stroke-opacity=".55" stroke-width=".45" stroke-dasharray="1 1.4"/>
<g transform="translate(0 1) scale(1.12)">${dogPortrait('J', line, colors.back).replace('<g>', '<g>')}</g>
</g>` : `<g transform="translate(45 55)">
<path d="M0-21C6-12 12-6 17 0C12 6 6 12 0 21C-6 12-12 6-17 0C-12-6-6-12 0-21Z" fill="${colors.back}" stroke="${line}" stroke-width=".8"/>
<path d="M0-15.5C4.4-9 8.6-4.4 12.4 0C8.6 4.4 4.4 9 0 15.5C-4.4 9-8.6 4.4-12.4 0C-8.6-4.4-4.4-9 0-15.5Z" fill="none" stroke="${line}" stroke-opacity=".6" stroke-width=".45"/>
<g fill="${line}"><g transform="translate(0 -6.2) scale(7)">${SUITS.spades}</g><g transform="rotate(180) translate(0 -6.2) scale(7)">${SUITS.spades}</g><circle r="1.15"/></g>
</g>`;
  return `<defs>
<clipPath id="panel"><rect x="5" y="5" width="80" height="100" rx="${n(inner)}"/></clipPath>
<radialGradient id="field" cx=".5" cy=".42" r=".8"><stop offset="0" stop-color="${lighten(colors.back, 0.1)}"/><stop offset="1" stop-color="${darken(colors.back, 0.22)}"/></radialGradient>
<pattern id="lattice" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 5Q2.5 0 5 5T10 5M0 0Q2.5-5 5 0T10 0M0 10Q2.5 5 5 10T10 10M5 0Q0 2.5 5 5T5 10M0 0Q-5 2.5 0 5T0 10M10 0Q5 2.5 10 5T10 10" fill="none" stroke="${line}" stroke-opacity=".34" stroke-width=".42"/><circle cx="5" cy="5" r=".55" fill="${line}" fill-opacity=".5"/><circle cx="0" cy="0" r=".55" fill="${line}" fill-opacity=".5"/><circle cx="10" cy="10" r=".55" fill="${line}" fill-opacity=".5"/><circle cx="10" cy="0" r=".55" fill="${line}" fill-opacity=".5"/><circle cx="0" cy="10" r=".55" fill="${line}" fill-opacity=".5"/></pattern>
<pattern id="paws" width="20" height="20" patternUnits="userSpaceOnUse"><g fill="${line}" fill-opacity=".32">${paw(5, 6, 5.4, -18)}${paw(15, 15.5, 5.4, 22)}</g><g fill="${line}" fill-opacity=".16">${bone(15, 4.5, 2.4, -30)}${bone(5, 16, 2.4, 25)}</g></pattern>
<pattern id="harlequin" width="10" height="13.75" patternUnits="userSpaceOnUse"><path d="M5 0L10 6.875L5 13.75L0 6.875Z" fill="${line}" fill-opacity=".1" stroke="${line}" stroke-opacity=".4" stroke-width=".4"/><circle cx="5" cy="6.875" r=".7" fill="${line}" fill-opacity=".55"/></pattern>
</defs>
<g data-body="1"><rect width="90" height="110" rx="${n(radius)}" fill="${colors.paper}"/>
<rect x="5" y="5" width="80" height="100" rx="${n(inner)}" fill="url(#field)"/>${field}
<rect x="5" y="5" width="80" height="100" rx="${n(inner)}" fill="none" stroke="${line}" stroke-opacity=".9" stroke-width=".7"/>
<rect x="8" y="8" width="74" height="94" rx="${n(Math.max(0, inner - 2.4))}" fill="none" stroke="${line}" stroke-opacity=".45" stroke-width=".4"/></g>
<g data-part="art" data-id="medallion" data-cx=".5" data-cy=".5">${medallion}</g>`;
}

export function cardSvg(identity: CardIdentity | undefined, appearance: CardAppearance, options: CardArtOptions = {}): string {
  const colors = palette(appearance, options);
  // The theme radius is specified on a 100-unit card; keep that visual proportion here.
  const radius = Math.min(13, Math.max(0, appearance.borderRadius)) * 0.9;
  const art = identity ? faceArt(identity, appearance, colors, radius, Boolean(options.fourColor)) : backArt(appearance, colors, radius);
  const border = `<rect x=".5" y=".5" width="89" height="109" rx="${n(Math.max(0, radius - 0.3))}" fill="none" stroke="${identity ? colors.edge : rgba('#000000', 0.18)}" stroke-width="${identity ? 1 : 0.6}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}">${art}${border}</svg>`;
}

export function cardDataUrl(identity: CardIdentity | undefined, appearance: CardAppearance, options: CardArtOptions = {}): string {
  return svgDataUrl(cardSvg(identity, appearance, options));
}

export const artOptions = (theme: Theme, card?: Pick<VisualCard, 'fourColor'>): CardArtOptions =>
  ({ accent: theme.table.trimColor, ...(card?.fourColor ? { fourColor: true } : {}) });

/** Resting shadow shared by live cards and animation objects (in the card's own px). */
export function cardShadow(strength: number, lift = 0): string {
  const s = Math.min(1, Math.max(0, strength));
  if (s === 0) return 'none';
  return `0 ${n(1 + lift * 0.5)}px ${n(1.5 + lift)}px rgba(0,0,0,${n(0.34 * s)}), 0 ${n(4 + lift * 2.4)}px ${n(10 + lift * 5)}px rgba(0,0,0,${n(0.42 * s)})`;
}

export function createCardElement(card: VisualCard, theme: Theme): HTMLElement {
  const element = document.createElement('div');
  Object.assign(element.style, {
    position: 'absolute', width: `${card.target.width}px`, height: `${card.target.height}px`,
    backgroundImage: `url("${cardDataUrl(card.identity, theme.card, artOptions(theme, card))}")`, backgroundSize: '100% 100%',
    borderRadius: `${n(theme.card.borderRadius * 0.9 / CARD_WIDTH * 100)}% / ${n(theme.card.borderRadius * 0.9 / CARD_HEIGHT * 100)}%`,
    boxShadow: cardShadow(theme.card.shadow), transformStyle: 'preserve-3d', willChange: 'transform', pointerEvents: 'none',
  });
  element.setAttribute('aria-hidden', 'true');
  return element;
}
