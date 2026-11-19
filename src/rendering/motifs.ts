/**
 * Shapes for the Neon and Sakura rooms, shared by the deck, felt, chips and
 * dealer button. Like the puppy art, every shape is drawn in a unit box around
 * the origin so it can be placed at any size.
 */

const petal = 'M0 0C-.17-.1-.22-.33-.11-.47L0-.39L.11-.47C.22-.33 .17-.1 0 0Z';

/** A five-petal cherry blossom, about 1 unit across. */
export const BLOSSOM = [0, 72, 144, 216, 288].map((angle) => `<path transform="rotate(${angle})" d="${petal}"/>`).join('');

/** A single falling petal, about 1 unit tall, with the notch at the top. */
export const PETAL = '<path d="M0-.5L.1-.42C.32-.2 .3 .22 0 .5C-.3 .22-.32-.2-.1-.42Z"/>';

/** A lightning bolt, about 1 unit tall. */
export const BOLT = '<path d="M.12-.5L-.3 .06H-.02L-.14 .5L.3-.08H.02Z"/>';

const n = (value: number): string => Number(value.toFixed(2)).toString();
const place = (shape: string, x: number, y: number, size: number, rotate = 0): string =>
  `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rotate)}) scale(${n(size)})">${shape}</g>`;

export const blossom = (x: number, y: number, size: number, rotate = 0): string => place(BLOSSOM, x, y, size, rotate);
export const fallingPetal = (x: number, y: number, size: number, rotate = 0): string => place(PETAL, x, y, size, rotate);
export const bolt = (x: number, y: number, size: number, rotate = 0): string => place(BOLT, x, y, size, rotate);

/**
 * Circuit traces for a 20 × 20 tile: right-angled runs ending in pads. Drawn as
 * strokes; the caller supplies the colour.
 */
export const CIRCUIT_TILE = '<path d="M0 5H6L9 8V14M20 5H14L11 2V0M4 20V16L7 13M20 15H15L12 18V20M0 12H3" fill="none" stroke-width=".55" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<circle cx="9" cy="14" r="1"/><circle cx="7" cy="13" r=".8"/><circle cx="3" cy="12" r=".8"/><circle cx="15" cy="15" r=".8"/>';

// ───────────────────────────────────────────── Arcade, Rain District and Breach

/** A coin with a star stamped in it, about 1 unit across. */
export const COIN = '<circle r=".5"/><path d="M0-.27L.075-.09L.27-.085L.12 .04L.17 .23L0 .12L-.17 .23L-.12 .04L-.27-.085L-.075-.09Z" fill-opacity=".45"/>';

/**
 * Rain District's own sigil, invented for the room: a ring cut by a falling stroke
 * with a drop beneath, about 1 unit across. Drawn as strokes; set stroke-width.
 */
export const SIGIL = '<circle r=".36" fill="none"/><path d="M-.12-.5L.14 .22" fill="none"/><path d="M.14 .3C.2 .38 .2 .46 .14 .5C.08 .46 .08 .38 .14 .3Z"/><path d="M-.36 0H-.5M.36 0H.5" fill="none"/>';

/** A microchip seen from above: body, notch and pins, about 1 unit across. */
export const CHIP_MARK = '<rect x="-.3" y="-.3" width=".6" height=".6" rx=".05"/>'
  + [-0.18, 0, 0.18].map((o) => `<rect x="${o - 0.04}" y="-.46" width=".08" height=".14"/><rect x="${o - 0.04}" y=".32" width=".08" height=".14"/><rect x="-.46" y="${o - 0.04}" width=".14" height=".08"/><rect x=".32" y="${o - 0.04}" width=".14" height=".08"/>`).join('')
  + '<circle cx="-.17" cy="-.17" r=".05" fill-opacity=".3"/>';

export const coin = (x: number, y: number, size: number): string => place(COIN, x, y, size);
export const chipMark = (x: number, y: number, size: number, rotate = 0): string => place(CHIP_MARK, x, y, size, rotate);

/**
 * Pixel letterforms for the Arcade deck and its effects: 5 × 7 bitmaps, one string
 * per row, `1` for a lit pixel. "10" is drawn as one 7-wide glyph so it fits the index.
 */
export const PIXEL_FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  '10': ['1001110', '1010001', '1010001', '1010001', '1010001', '1010001', '1001110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  0: ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  ',': ['00000', '00000', '00000', '00000', '00110', '00100', '01000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/** Suits as 9 × 9 bitmaps, chunky enough to read at a glance. */
export const PIXEL_SUITS: Record<'hearts' | 'diamonds' | 'clubs' | 'spades', string[]> = {
  hearts: ['011000110', '111101111', '111111111', '111111111', '111111111', '011111110', '001111100', '000111000', '000010000'],
  diamonds: ['000010000', '000111000', '001111100', '011111110', '111111111', '011111110', '001111100', '000111000', '000010000'],
  spades: ['000010000', '000111000', '001111100', '011111110', '111111111', '111111111', '011010110', '000010000', '000111000'],
  clubs: ['000111000', '001111100', '000111000', '011010110', '111111111', '111111111', '011010110', '000010000', '000111000'],
};

/** A bitmap as one path of unit squares, `size` units each, top left at (x, y). */
export function bitmap(rows: string[], x: number, y: number, size: number): string {
  let d = '';
  rows.forEach((row, j) => {
    // Runs of lit pixels become one rectangle each, which keeps the path short.
    let i = 0;
    while (i < row.length) {
      if (row[i] !== '1') { i++; continue; }
      let end = i;
      while (row[end + 1] === '1') end++;
      d += `M${n(x + i * size)} ${n(y + j * size)}h${n((end - i + 1) * size)}v${n(size)}h${n(-(end - i + 1) * size)}Z`;
      i = end + 1;
    }
  });
  return d ? `<path d="${d}"/>` : '';
}

/** Width in pixels of a pixel-font string, one blank column between letters. */
export function pixelTextWidth(text: string): number {
  return [...text].reduce((sum, letter, index) => sum + (PIXEL_FONT[letter]?.[0]!.length ?? 5) + (index ? 1 : 0), 0);
}

/** A string in the pixel font; unknown letters are skipped. */
export function pixelText(text: string, x: number, y: number, size: number): string {
  let cursor = 0, markup = '';
  for (const letter of text === '10' ? ['10'] : [...text]) {
    const rows = PIXEL_FONT[letter];
    if (!rows) continue;
    markup += bitmap(rows, x + cursor * size, y, size);
    cursor += rows[0]!.length + 1;
  }
  return markup;
}

/**
 * Dot-matrix letters for the Breach deck: the same bitmaps lit as small round
 * LEDs with gaps between them, like a terminal readout.
 */
export function dotText(text: string, x: number, y: number, size: number): string {
  let cursor = 0, markup = '';
  for (const letter of text === '10' ? ['10'] : [...text]) {
    const rows = PIXEL_FONT[letter];
    if (!rows) continue;
    rows.forEach((row, j) => [...row].forEach((bit, i) => {
      if (bit === '1') markup += `<rect x="${n(x + (cursor + i) * size + size * 0.1)}" y="${n(y + j * size + size * 0.1)}" width="${n(size * 0.8)}" height="${n(size * 0.8)}" rx="${n(size * 0.22)}"/>`;
    }));
    cursor += rows[0]!.length + 1;
  }
  return markup;
}
