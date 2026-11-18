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
