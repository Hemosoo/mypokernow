import type { CardAppearance, CardIdentity, Suit, Theme, VisualCard } from '../types';
import { darken, lighten, luminance, metal, mix, rgba, safeHex, svgDataUrl } from './color';
import { CAP_HEIGHT, glyphs } from './glyphs';
import { bone, dogPortrait, paw } from './puppy-art';
import { BLOSSOM, BOLT, CHIP_MARK, CIRCUIT_TILE, PIXEL_SUITS, SIGIL, bitmap, blossom, dotText, fallingPetal, pixelText } from './motifs';
import { YARN, catPaw, catPortrait, yarn } from './cat-art';

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

/** Court-card ornament for each deck, drawn around (0, 0) about 20 units wide. */
function courtMark(face: CardAppearance['face'], rank: 'J' | 'Q' | 'K', ink: string, ornamentInk: string, paper: string): string {
  if (face === 'puppy') return `<g transform="translate(59.5 42) scale(.92)">${dogPortrait(rank, ornamentInk, paper)}</g>`;
  if (face === 'cat') return `<g transform="translate(59.5 43) scale(.92)">${catPortrait(rank, ornamentInk, paper)}</g>`;
  if (face === 'modern') {
    // An inverted badge: the crown cut out of a solid disc of the suit's ink.
    return `<g transform="translate(60 42)"><circle r="11.2" fill="${ink}"/><g fill="${paper}" transform="translate(0 .6) scale(.62)">${CROWNS[rank]}</g></g>`;
  }
  if (face === 'neon') {
    const rows = rank === 'K' ? 3 : rank === 'Q' ? 2 : 1;
    let chevrons = '';
    for (let row = 0; row < rows; row++) chevrons += `<path d="M-9 ${n(5 - row * 5)}L0 ${n(-3 - row * 5)}L9 ${n(5 - row * 5)}"/>`;
    return `<g transform="translate(60 45)" fill="none" stroke="${ornamentInk}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">${chevrons}</g>`;
  }
  if (face === 'sakura') {
    const size = rank === 'K' ? 22 : rank === 'Q' ? 19 : 16;
    return `<g transform="translate(60 42)" fill="${ornamentInk}"><g transform="scale(${size})">${BLOSSOM}</g><circle r="${n(size * 0.09)}" fill="${paper}"/></g>`;
  }
  return `<g fill="${ornamentInk}"><g transform="translate(59.5 44)">${CROWNS[rank]}</g></g>`;
}

function faceArt(identity: CardIdentity, appearance: CardAppearance, colors: Palette, radius: number, fourColor: boolean): string {
  if (appearance.face === 'pixel') return pixelFace(identity, colors, fourColor);
  if (appearance.face === 'holo') return holoFace(identity, colors, radius, fourColor);
  if (appearance.face === 'cipher') return cipherFace(identity, colors, radius, fourColor);
  const ink = inkFor(identity, colors, fourColor);
  const dark = luminance(colors.paper) < 0.2;
  const style = appearance.face;
  const court = identity.rank === 'J' || identity.rank === 'Q' || identity.rank === 'K';
  const ace = identity.rank === 'A';
  const rank = rankShape(identity.rank, 8.4, 9, 30.5);
  const indexSuitX = 8.4 + Math.max(11, Math.min(rank.width, 26)) / 2;
  // J and Q descend below the baseline; their index suit sits a little lower to clear the tail.
  const indexSuitY = identity.rank === 'J' || identity.rank === 'Q' ? 57.5 : 51.5;
  const paperLow = dark ? lighten(colors.paper, 0.05) : mix(colors.paper, colors.edge, 0.55);
  const ornamentInk = style === 'neon' ? colors.accent : dark ? lighten(colors.accent, 0.1) : darken(colors.accent, 0.12);
  const inner = (inset: number): string => `x="${inset}" y="${inset}" width="${n(90 - inset * 2)}" height="${n(110 - inset * 2)}" rx="${n(Math.max(0, radius - inset * 0.6))}"`;

  // Each deck's own paper, frame and flourishes, all behind the index and suit.
  let decor = '';
  if (style === 'classic' || style === 'native') {
    // A fine keyline gives the classic deck its engraved character.
    if (style === 'classic') decor = `<rect ${inner(3.6)} fill="none" stroke="${ink}" stroke-opacity=".16" stroke-width=".5"/>`;
  } else if (style === 'modern') {
    // An open, flat face: a tinted tab behind the index and nothing else.
    decor = `<rect x="4.2" y="4.2" width="${n(Math.max(30, rank.width + 9))}" height="${n(indexSuitY + 9)}" rx="${n(Math.max(2, radius - 2))}" fill="${ink}" fill-opacity=".075"/>`;
  } else if (style === 'midnight') {
    const stars = [[72, 12, 0.7], [80, 22, 0.45], [64, 9, 0.4], [14, 92, 0.5], [24, 101, 0.7], [82, 100, 0.4]];
    decor = `<rect ${inner(3.6)} fill="none" stroke="${ornamentInk}" stroke-opacity=".35" stroke-width=".5"/><g fill="${ornamentInk}">${stars.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill-opacity=".7"/>`).join('')}</g>`;
  } else if (style === 'neon') {
    decor = `<rect width="90" height="110" rx="${n(radius)}" fill="url(#scan)"/><rect ${inner(3.2)} fill="none" stroke="${colors.accent}" stroke-opacity=".9" stroke-width=".8" filter="url(#glow)"/>`;
  } else if (style === 'sakura') {
    const twig = `<path d="M90 2C80 6 74 10 69 18M78 8C80 13 79 17 76 21" fill="none" stroke="${darken(colors.accent, 0.35)}" stroke-opacity=".5" stroke-width=".9" stroke-linecap="round"/>`;
    decor = `<rect ${inner(3.4)} fill="none" stroke="${ornamentInk}" stroke-opacity=".5" stroke-width=".55"/><rect ${inner(5)} fill="none" stroke="${ornamentInk}" stroke-opacity=".25" stroke-width=".35"/>
${twig}<g fill="${ornamentInk}" fill-opacity=".55">${blossom(71, 15, 9, 10)}${blossom(80, 25, 6.5, -20)}</g><g fill="${ornamentInk}" fill-opacity=".35">${fallingPetal(13, 99, 4.4, 40)}${fallingPetal(21, 103, 3.4, -30)}</g>`;
  } else if (style === 'cat') {
    // Cat paw prints tiptoe along the frame, and a loose strand of yarn crosses a corner.
    decor = `<rect ${inner(3.4)} fill="none" stroke="${ornamentInk}" stroke-opacity=".45" stroke-width=".6"/>`
      + `<path d="M66 4.5C72 10 76 6 81 11S86 15 86 19" fill="none" stroke="${ornamentInk}" stroke-opacity=".4" stroke-width=".7" stroke-linecap="round"/>`
      + `<g fill="${ornamentInk}" fill-opacity=".38">${catPaw(10, 100.5, 2.8, 200)}${catPaw(14.4, 96, 2.8, 200)}</g>`;
  } else if (style === 'puppy') {
    // Two tiny paw prints walk along the puppy deck's frame; they stay clear of the index.
    decor = `<rect ${inner(3.4)} fill="none" stroke="${ornamentInk}" stroke-opacity=".45" stroke-width=".6"/><rect ${inner(5)} fill="none" stroke="${ornamentInk}" stroke-opacity=".22" stroke-width=".35" stroke-dasharray="1.2 1.6"/>`
      + `<g fill="${ornamentInk}" fill-opacity=".38">${paw(80.5, 9.5, 3.1, 28)}${paw(76.4, 14.6, 3.1, 28)}${paw(9.6, 100.8, 3.1, 208)}${paw(13.7, 95.7, 3.1, 208)}</g>`;
  }

  const ring = `<circle cx="58" cy="73" r="27.5" fill="none" stroke="${ornamentInk}" stroke-opacity=".55" stroke-width=".7"/>`;
  const halo = !ace ? '' : style === 'puppy' ? `${ring}<g fill="${ornamentInk}" fill-opacity=".42">${bone(58, 104.5, 4.2)}</g>`
    : style === 'cat' ? `${ring}<g fill="${ornamentInk}" fill-opacity=".45" stroke="${ornamentInk}" stroke-width=".05">${yarn(80.5, 99, 9, 20)}</g>`
    : style === 'modern' ? ''
      : style === 'neon' ? `<circle cx="58" cy="73" r="27" fill="none" stroke="${ink}" stroke-opacity=".75" stroke-width=".8" filter="url(#glow)"/>`
        : style === 'sakura' ? `<g fill="${ornamentInk}" fill-opacity=".45">${[0, 72, 144, 216, 288].map((angle) => fallingPetal(58 + Math.sin(angle * Math.PI / 180) * 28, 73 - Math.cos(angle * Math.PI / 180) * 28, 5.5, angle)).join('')}</g>`
          : `${ring}<circle cx="58" cy="73" r="25.2" fill="none" stroke="${ornamentInk}" stroke-opacity=".28" stroke-width=".4" stroke-dasharray=".6 1.8"/>`;
  const crown = court ? `<g data-part="art" data-id="crown" data-cx=".66" data-cy=".4">${courtMark(style, identity.rank as 'J' | 'Q' | 'K', ink, ornamentInk, colors.paper)}</g>` : '';
  // The modern deck sets one oversized suit low in the corner; the rest centre it under the index.
  const modern = style === 'modern';
  const suitX = modern ? 60 : 58;
  const suitY = modern ? (court ? 80 : 78) : court ? 78 : ace ? 73 : 74.5;
  const suitSize = modern ? (court ? 40 : ace ? 52 : 48) : court ? 36 : ace ? 38 : 43;
  const glow = style === 'neon' ? ' filter="url(#glow)"' : '';
  const fill = modern || style === 'neon' ? ink : 'url(#ink)';
  const flat = modern || style === 'neon';
  return `<defs>
<linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${flat ? colors.paper : lighten(colors.paper, dark ? 0.06 : 0.5)}"/><stop offset=".55" stop-color="${colors.paper}"/><stop offset="1" stop-color="${flat ? colors.paper : paperLow}"/></linearGradient>
<linearGradient id="ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lighten(ink, dark ? 0.12 : 0.1)}"/><stop offset="1" stop-color="${darken(ink, dark ? 0 : 0.14)}"/></linearGradient>${style === 'neon' ? `
<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<pattern id="scan" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 .5H6M.5 0V6" stroke="${colors.accent}" stroke-opacity=".07" stroke-width=".4"/></pattern>` : ''}
</defs>
<g data-body="1"><rect width="90" height="110" rx="${n(radius)}" fill="url(#paper)"/>${decor}${halo}</g>
<g data-part="rank" data-id="rank" data-cx=".25" data-cy=".22" fill="${fill}"${glow}>${rank.markup}</g>
<g data-part="suit" data-id="index-suit" data-cx=".2" data-cy=".47" fill="${fill}"${glow}>${suitShape(identity.suit, indexSuitX, indexSuitY, 15.5)}</g>
<g data-part="suit" data-id="suit" data-cx=".64" data-cy=".68" fill="${fill}"${glow}>${suitShape(identity.suit, suitX, suitY, suitSize)}</g>
${crown}`;
}

/** Pixel crowns for the Arcade court cards, 11 wide. */
const PIXEL_CROWNS: Record<'J' | 'Q' | 'K', string[]> = {
  K: ['10000100001', '11001110011', '11111111111', '11111111111', '01111111110', '01111111110'],
  Q: ['00000100000', '01001110010', '01111111110', '01111111110', '00111111100', '00111111100'],
  J: ['00011111000', '00111111100', '01111111110', '11111111111', '00000000000', '00000000000'],
};
/** A pixel coin for the Arcade back, 11 × 11. */
const PIXEL_COIN = ['00011111000', '00111111100', '01111011110', '11111011111', '11000000011', '11100000111', '11110001111', '11100100111', '01101110110', '00111111100', '00011111000'];

/**
 * Arcade: everything on a 3-unit pixel grid with square corners, bold pixel ranks
 * and chunky suits, in ordinary red and black so suits read at a glance.
 */
function pixelFace(identity: CardIdentity, colors: Palette, fourColor: boolean): string {
  const ink = inkFor(identity, colors, fourColor), edge = colors.edge;
  const court = identity.rank === 'J' || identity.rank === 'Q' || identity.rank === 'K', ace = identity.rank === 'A';
  const p = 3;
  // A frame with notched corners, like a sprite's outline.
  const frame = `<path d="M${p} 0H${90 - p}V${p}H${p}Z M${p} ${110 - p}H${90 - p}V110H${p}Z M0 ${p}H${p}V${110 - p}H0Z M${90 - p} ${p}H90V${110 - p}H${90 - p}Z M${p} ${p}h${p}v${p}h${-p}Z M${90 - 2 * p} ${p}h${p}v${p}h${-p}Z M${p} ${110 - 2 * p}h${p}v${p}h${-p}Z M${90 - 2 * p} ${110 - 2 * p}h${p}v${p}h${-p}Z" fill="${edge}"/>`;
  const rankSize = identity.rank === '10' ? 3 : 3.4;
  const rank = `<g data-part="rank" data-id="rank" data-cx=".25" data-cy=".2" fill="${ink}">${pixelText(identity.rank, 9, 9, rankSize)}</g>`;
  const indexSuit = `<g data-part="suit" data-id="index-suit" data-cx=".2" data-cy=".44" fill="${ink}">${bitmap(PIXEL_SUITS[identity.suit], 9, 39, 2.4)}</g>`;
  const big = court ? 4 : 5, suitX = Math.round(58 - 4.5 * big), suitY = Math.round((court ? 80 : 74) - 4.5 * big);
  const suit = `<g data-part="suit" data-id="suit" data-cx=".64" data-cy=".68" fill="${ink}">${bitmap(PIXEL_SUITS[identity.suit], suitX, suitY, big)}</g>`;
  const crown = court ? `<g data-part="art" data-id="crown" data-cx=".64" data-cy=".36" fill="${darken(colors.accent, 0.08)}">${bitmap(PIXEL_CROWNS[identity.rank as 'J' | 'Q' | 'K'], 58 - 16.5, 32, 3)}</g>` : '';
  // Four little twinkles around the ace.
  const sparkle = (x: number, y: number): string => `<path d="M${x} ${y - 6}h3v3h3v3h-3v3h-3v-3h-3v-3h3Z"/>`;
  const halo = ace ? `<g fill="${colors.accent}">${sparkle(30, 46)}${sparkle(83, 50)}${sparkle(33, 100)}${sparkle(81, 98)}</g>` : '';
  return `<g data-body="1" shape-rendering="crispEdges"><rect width="90" height="110" fill="${colors.paper}"/>${frame}${halo}</g>
<g shape-rendering="crispEdges">${rank}${indexSuit}${suit}${crown}</g>`;
}

/** Wireframe solids for the Rain District court cards: a cube, an octahedron and a pyramid. */
function wireframe(rank: 'J' | 'Q' | 'K'): string {
  if (rank === 'K') return '<path d="M0-12L10.4-6V6L0 12L-10.4 6V-6Z M0-12V0 M0 0L10.4 6 M0 0L-10.4 6 M-10.4-6L0 0 M10.4-6L0 0" />';
  if (rank === 'Q') return '<path d="M0-13L9 0L0 13L-9 0Z M-9 0L2.5 3.2L9 0 M0-13L2.5 3.2L0 13 M-9 0L-2 -2.6L9 0" stroke-dasharray=""/>';
  return '<path d="M0-12L10 8L-10 8Z M0-12L2 2 M-10 8L2 2L10 8"/>';
}

/**
 * Rain District: tinted glass with a split-colour edge, as if projected. The index
 * is printed three times, magenta and cyan a hair either side of the ink.
 */
function holoFace(identity: CardIdentity, colors: Palette, radius: number, fourColor: boolean): string {
  const ink = inkFor(identity, colors, fourColor);
  const court = identity.rank === 'J' || identity.rank === 'Q' || identity.rank === 'K', ace = identity.rank === 'A';
  const rank = rankShape(identity.rank, 8.4, 9, 30.5);
  const indexSuitX = 8.4 + Math.max(11, Math.min(rank.width, 26)) / 2, indexSuitY = identity.rank === 'J' || identity.rank === 'Q' ? 57.5 : 51.5;
  const suitY = court ? 79 : ace ? 73 : 74.5, suitSize = court ? 34 : ace ? 38 : 42;
  const split = (markup: string, part: string, id: string, cx: string, cy: string): string => `<g data-part="${part}" data-id="${id}" data-cx="${cx}" data-cy="${cy}">
<g fill="#ff2e88" fill-opacity=".55" transform="translate(-.9 0)">${markup}</g><g fill="#33e1ff" fill-opacity=".55" transform="translate(.9 0)">${markup}</g><g fill="${ink}" filter="url(#hglow)">${markup}</g></g>`;
  const inset = 3.2, inner = `x="${inset}" y="${inset}" width="${90 - inset * 2}" height="${110 - inset * 2}" rx="${n(Math.max(0, radius - 2))}"`;
  const ticks = `<path d="M3 16V3H16M74 3H87V16M87 94V107H74M16 107H3V94" fill="none" stroke="${colors.accent}" stroke-width="1" stroke-opacity=".8"/>`;
  const crown = court ? `<g data-part="art" data-id="crown" data-cx=".66" data-cy=".38" transform="translate(60 41)" fill="none" stroke="${colors.black}" stroke-width="1" stroke-linejoin="round" filter="url(#hglow)">${wireframe(identity.rank as 'J' | 'Q' | 'K')}</g>` : '';
  const halo = ace ? `<circle cx="58" cy="73" r="27" fill="none" stroke="${colors.black}" stroke-opacity=".5" stroke-width=".7" stroke-dasharray="5 3"/><circle cx="58" cy="73" r="31" fill="none" stroke="${colors.accent}" stroke-opacity=".35" stroke-width=".5"/>` : '';
  return `<defs>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3ff2e0" stop-opacity=".18"/><stop offset=".55" stop-color="${colors.paper}" stop-opacity="0"/><stop offset="1" stop-color="#8a5cff" stop-opacity=".2"/></linearGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity=".09"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
<pattern id="lines" width="4" height="2.6" patternUnits="userSpaceOnUse"><rect width="4" height=".6" fill="#fff" fill-opacity=".05"/></pattern>
<filter id="hglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g data-body="1"><rect width="90" height="110" rx="${n(radius)}" fill="${colors.paper}"/><rect width="90" height="110" rx="${n(radius)}" fill="url(#glass)"/><rect width="90" height="110" rx="${n(radius)}" fill="url(#lines)"/>
<rect width="90" height="110" rx="${n(radius)}" fill="url(#sheen)"/><rect ${inner} fill="none" stroke="${colors.black}" stroke-opacity=".35" stroke-width=".6"/>${ticks}${halo}</g>
${split(rank.markup, 'rank', 'rank', '.25', '.22')}
${split(suitShape(identity.suit, indexSuitX, indexSuitY, 15.5), 'suit', 'index-suit', '.2', '.47')}
${split(suitShape(identity.suit, 58, suitY, suitSize), 'suit', 'suit', '.64', '.68')}
${crown}`;
}

/**
 * Breach: black cards with corner brackets and a dot-matrix index, like a terminal
 * readout; the centre suit is an outline around a solid core.
 */
function cipherFace(identity: CardIdentity, colors: Palette, radius: number, fourColor: boolean): string {
  const ink = inkFor(identity, colors, fourColor);
  const court = identity.rank === 'J' || identity.rank === 'Q' || identity.rank === 'K', ace = identity.rank === 'A';
  const wide = identity.rank === '10';
  const dot = wide ? 2.6 : 3.2;
  const suitY = court ? 79 : 74, suitSize = court ? 34 : 42;
  // A readout line: the card's position in a sorted deck, as digits.
  const code = String((['spades', 'hearts', 'diamonds', 'clubs'].indexOf(identity.suit) * 13) + ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].indexOf(identity.rank) + 1).padStart(2, '0');
  const readout = `0${code}.${String(code.split('').reverse().join('')).padStart(2, '0')}`;
  const crown = court ? `<g data-part="art" data-id="crown" data-cx=".66" data-cy=".38" transform="translate(60 41) scale(22)" fill="${ink}" fill-opacity=".85">${CHIP_MARK}</g>`
    + `<g transform="translate(60 41)" fill="${colors.paper}">${dotText(identity.rank, -2.4, -3.4, 1)}</g>` : '';
  const halo = ace ? `<circle cx="58" cy="73" r="28" fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width=".6" stroke-dasharray="1 2.4"/><path d="M30 73H38M78 73H86M58 45V53M58 93V101" stroke="${ink}" stroke-width=".8"/>` : '';
  return `<defs>
<pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r=".4" fill="${ink}" fill-opacity=".14"/></pattern>
<filter id="led" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation=".9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<g data-body="1"><rect width="90" height="110" rx="${n(radius)}" fill="${colors.paper}"/><rect width="90" height="110" rx="${n(radius)}" fill="url(#dots)"/>
<path d="M3 15V3H15M87 95V107H75" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M75 3H87V7M3 103V107H7" fill="none" stroke="${ink}" stroke-opacity=".4" stroke-width=".8"/>
<g fill="${ink}" fill-opacity=".6">${dotText(readout.replace(/[^0-9.]/g, ''), 9, 100, 0.9)}</g>${halo}</g>
<g data-part="rank" data-id="rank" data-cx=".25" data-cy=".22" fill="${ink}" filter="url(#led)">${dotText(identity.rank, 9, 10, dot)}</g>
<g data-part="suit" data-id="index-suit" data-cx=".2" data-cy=".47" fill="${ink}">${suitShape(identity.suit, 17, 46, 14)}</g>
<g data-part="suit" data-id="suit" data-cx=".64" data-cy=".68"><g fill="none" stroke="${ink}" stroke-width=".05">${suitShape(identity.suit, 58, suitY, suitSize)}</g><g fill="${ink}" filter="url(#led)">${suitShape(identity.suit, 58, suitY, suitSize * 0.46)}</g></g>
${crown}`;
}

/** Breach back: a block of glyph cells, deterministic, with one warning-red row. */
function glyphBlock(ink: string, alert: string): string {
  let cells = '';
  const cols = 8, rows = 10, size = 7.4, x0 = 45 - (cols * size) / 2, y0 = 55 - (rows * size) / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const on = ((i * 7 + j * 11 + i * j * 3) % 5) > 1;
      if (on) cells += `<rect x="${n(x0 + i * size + 0.8)}" y="${n(y0 + j * size + 0.8)}" width="${n(size - 1.6)}" height="${n(size - 1.6)}" fill="${j === 6 ? alert : ink}" fill-opacity="${j === 6 ? 0.9 : 0.55 + ((i + j) % 3) * 0.12}"/>`;
    }
  }
  return `<g shape-rendering="crispEdges">${cells}</g><path d="M9 17V9H17M81 93V101H73" fill="none" stroke="${ink}" stroke-width="1.2"/>`;
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
  } else if (appearance.back === 'circuit') {
    field = `<rect x="5" y="5" width="80" height="100" fill="url(#circuit)" clip-path="url(#panel)"/>`;
  } else if (appearance.back === 'petals') {
    field = `<rect x="5" y="5" width="80" height="100" fill="url(#petals)" clip-path="url(#panel)"/>`;
  } else if (appearance.back === 'pixel') {
    field = `<rect x="5" y="5" width="80" height="100" fill="url(#checker)" shape-rendering="crispEdges"/>`;
  } else if (appearance.back === 'holo') {
    field = `<rect x="5" y="5" width="80" height="100" fill="url(#foil)" clip-path="url(#panel)"/><rect x="5" y="5" width="80" height="100" fill="url(#foilSheen)" clip-path="url(#panel)"/><rect x="5" y="5" width="80" height="100" fill="url(#scan2)" clip-path="url(#panel)"/>`;
  } else if (appearance.back === 'glyph') {
    field = glyphBlock(colors.accent, colors.red);
  } else if (appearance.back === 'yarn') {
    field = `<rect x="5" y="5" width="80" height="100" fill="url(#yarnfield)" clip-path="url(#panel)"/>`;
  }
  const medallion = appearance.back === 'image' && image ? '' : appearance.back === 'glyph' ? ''
    : appearance.back === 'pixel' ? `<g shape-rendering="crispEdges"><rect x="25" y="35" width="40" height="40" fill="${darken(colors.back, 0.45)}"/><rect x="28" y="38" width="34" height="34" fill="${colors.back}"/><g fill="${colors.accent}">${bitmap(PIXEL_COIN, 28.5, 38.5, 3)}</g></g>`
    : appearance.back === 'holo' ? `<g transform="translate(45 55)">
<circle r="18" fill="${darken(colors.back, 0.3)}" fill-opacity=".85" stroke="${line}" stroke-width=".8" filter="url(#bglow)"/>
<g transform="scale(24)" fill="${line}" stroke="${line}" stroke-width=".07" filter="url(#bglow)">${SIGIL}</g></g>`
    : appearance.back === 'yarn' ? `<g transform="translate(45 55)">
<circle r="19" fill="${colors.back}" stroke="${line}" stroke-width=".9"/><circle r="16.2" fill="none" stroke="${line}" stroke-opacity=".55" stroke-width=".45" stroke-dasharray="1 1.4"/>
<g transform="scale(24)" fill="${line}" stroke="${darken(colors.back, 0.25)}" stroke-width=".05">${YARN}</g></g>`
    : appearance.back === 'circuit' ? `<g transform="translate(45 55)">
<path d="M0-19L16.5-9.5V9.5L0 19L-16.5 9.5V-9.5Z" fill="${colors.back}" stroke="${line}" stroke-width=".9" filter="url(#bglow)"/>
<path d="M0-14.5L12.6-7.2V7.2L0 14.5L-12.6 7.2V-7.2Z" fill="none" stroke="${line}" stroke-opacity=".5" stroke-width=".45"/>
<g fill="${line}" filter="url(#bglow)" transform="scale(17)">${BOLT}</g>
</g>` : appearance.back === 'petals' ? `<g transform="translate(45 55)">
<circle r="18" fill="${colors.back}" stroke="${line}" stroke-width=".8"/><circle r="15.4" fill="none" stroke="${line}" stroke-opacity=".5" stroke-width=".4"/>
<g fill="${line}" transform="scale(24)">${BLOSSOM}</g><circle r="1.8" fill="${colors.back}"/>
</g>` : appearance.back === 'paws' ? `<g transform="translate(45 55)">
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
<pattern id="circuit" width="20" height="20" patternUnits="userSpaceOnUse"><g fill="${line}" stroke="${line}" fill-opacity=".5" stroke-opacity=".42">${CIRCUIT_TILE}</g></pattern>
<pattern id="petals" width="22" height="22" patternUnits="userSpaceOnUse"><g fill="${line}" fill-opacity=".3">${blossom(6, 6, 7, 10)}${blossom(17, 17, 7, -16)}</g><g fill="${line}" fill-opacity=".2">${fallingPetal(17, 5, 3, 40)}${fallingPetal(5, 17, 3, -30)}</g></pattern>
<pattern id="checker" x="5" y="5" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${darken(colors.back, 0.35)}"/><rect width="5" height="5" fill="${colors.back}"/><rect x="5" y="5" width="5" height="5" fill="${colors.back}"/></pattern>
<linearGradient id="foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(colors.back, '#3ff2e0', 0.35)}"/><stop offset=".35" stop-color="${mix(colors.back, '#8a5cff', 0.4)}"/><stop offset=".65" stop-color="${mix(colors.back, '#ff3d8b', 0.35)}"/><stop offset="1" stop-color="${mix(colors.back, '#ffb84a', 0.3)}"/></linearGradient>
<linearGradient id="foilSheen" x1="0" y1="0" x2="1" y2=".6"><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset=".35" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset=".68" stop-color="#fff" stop-opacity=".12"/><stop offset=".74" stop-color="#fff" stop-opacity="0"/></linearGradient>
<pattern id="scan2" width="4" height="2.4" patternUnits="userSpaceOnUse"><rect width="4" height=".7" fill="#000" fill-opacity=".18"/></pattern>
<pattern id="yarnfield" width="22" height="22" patternUnits="userSpaceOnUse"><g fill="${line}" fill-opacity=".3" stroke="${darken(colors.back, 0.2)}" stroke-width=".05">${yarn(6, 6, 7, 10)}</g><g fill="${line}" fill-opacity=".26">${catPaw(16.5, 16.5, 5.5, 25)}</g></pattern>
<filter id="bglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
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
