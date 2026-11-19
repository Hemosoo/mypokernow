/**
 * Cat motifs shared by the Cat Café deck, felt, chips and dealer button. Like the
 * puppy art, every shape is drawn in a unit box around the origin.
 */

/** A cat's paw print: a rounder, smaller pad than a dog's and four close toes, about 1 unit tall. */
export const CAT_PAW = '<path d="M0 .04C.2 .04 .32 .2 .3 .34C.28 .47 .14 .48 0 .45C-.14 .48-.28 .47-.3 .34C-.32 .2-.2 .04 0 .04Z"/>'
  + '<circle cx="-.31" cy="-.06" r=".11"/><circle cx="-.12" cy="-.24" r=".115"/><circle cx=".12" cy="-.24" r=".115"/><circle cx=".31" cy="-.06" r=".11"/>';

/** A ball of yarn with its wraps showing, about 1 unit across, plus a loose end. Strokes take the caller's colour. */
export const YARN = '<circle r=".42"/>'
  + '<g fill="none" stroke-width=".05" stroke-opacity=".55" stroke-linecap="round"><path d="M-.38-.16C-.18-.32 .18-.34 .36-.2"/><path d="M-.4 .06C-.16-.14 .2-.16 .41 0"/><path d="M-.32 .26C-.1 .08 .22 .08 .36 .2"/><path d="M-.12-.4C.06-.14 .08 .18-.04 .41"/><path d="M.12-.4C.3-.12 .3 .16 .18 .37"/></g>'
  + '<path d="M.3 .3C.42 .44 .56 .4 .62 .5" fill="none" stroke-width=".05" stroke-linecap="round"/>';

/** A little fish, 1 unit long, facing right. */
export const FISH = '<path d="M-.32 0C-.12-.22 .2-.2 .34 0C.2 .2-.12 .22-.32 0ZM-.32 0L-.5-.16V.16Z"/>';

const n = (value: number): string => Number(value.toFixed(2)).toString();
const place = (shape: string, x: number, y: number, size: number, rotate = 0): string =>
  `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rotate)}) scale(${n(size)})">${shape}</g>`;
export const catPaw = (x: number, y: number, size: number, rotate = 0): string => place(CAT_PAW, x, y, size, rotate);
export const yarn = (x: number, y: number, size: number, rotate = 0): string => place(YARN, x, y, size, rotate);
export const fish = (x: number, y: number, size: number, rotate = 0): string => place(FISH, x, y, size, rotate);

/**
 * A cat portrait for the court cards, about 24 units wide, in one ink:
 * the king wears a crown, the queen a ribbon, the jack a bell collar.
 */
export function catPortrait(rank: 'J' | 'Q' | 'K', ink: string, paper: string): string {
  const head = `<path d="M-9-1C-9-6.6-5.2-8.6 0-8.6S9-6.6 9-1C9 5.4 5 9 0 9S-9 5.4-9-1Z" fill="${paper}" stroke="${ink}" stroke-width="1.1"/>`;
  // Pointed ears with their inner fold.
  const ears = `<path d="M-8.4-3.2L-8.8-12.6L-2.6-8" fill="${paper}" stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"/><path d="M8.4-3.2L8.8-12.6L2.6-8" fill="${paper}" stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"/>`
    + `<path d="M-7.4-5.4L-7.6-10L-4.6-7.6Z M7.4-5.4L7.6-10L4.6-7.6Z" fill="${ink}" fill-opacity=".55"/>`;
  // Tabby stripes on the brow.
  const stripes = `<path d="M-2.2-8.2L-1.6-5.6M0-8.6V-5.6M2.2-8.2L1.6-5.6" stroke="${ink}" stroke-width=".8" stroke-linecap="round"/>`;
  // Almond eyes with slit pupils, a small nose, the W mouth and whiskers.
  const face = `<path d="M-6-.4C-5-2.2-2.6-2.2-1.8-.4C-2.6 1.2-5 1.2-6-.4Z M6-.4C5-2.2 2.6-2.2 1.8-.4C2.6 1.2 5 1.2 6-.4Z" fill="${ink}" fill-opacity=".85"/>`
    + `<path d="M-3.9-1.5V.7M3.9-1.5V.7" stroke="${paper}" stroke-width=".7" stroke-linecap="round"/>`
    + `<path d="M-1.2 2.4H1.2L0 3.6Z" fill="${ink}"/>`
    + `<path d="M0 3.6V4.4M0 4.4C-.7 5.4-1.8 5.4-2.3 4.6M0 4.4C.7 5.4 1.8 5.4 2.3 4.6" fill="none" stroke="${ink}" stroke-width=".65" stroke-linecap="round"/>`
    + `<path d="M-4 3.4L-11 2.2M-4 4.4L-10.6 5.4M4 3.4L11 2.2M4 4.4L10.6 5.4" stroke="${ink}" stroke-width=".45" stroke-linecap="round" stroke-opacity=".8"/>`;
  const accessory = rank === 'K'
    ? `<path d="M-5-8.6L-5.8-13.6L-2.8-11L0-14.6L2.8-11L5.8-13.6L5-8.6Z" fill="${ink}"/><circle cx="0" cy="-15.2" r=".85" fill="${ink}"/>`
    : rank === 'Q'
      ? `<path d="M3.4-8.2C4.6-11.4 8.4-11.6 8-8.8C7.8-7.4 5.8-7.2 4.4-7.9C6-7.2 7.4-5.6 6.2-4.6C5-3.6 3.4-5.8 3.4-8.2Z" fill="${ink}"/><circle cx="3.8" cy="-8" r="1" fill="${paper}" stroke="${ink}" stroke-width=".6"/>`
      : `<path d="M-6.8 7.2C-3.2 9.4 3.2 9.4 6.8 7.2" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><circle cx="0" cy="10.6" r="1.9" fill="${ink}"/><path d="M-1.9 10.6H1.9" stroke="${paper}" stroke-width=".5"/><circle cx="0" cy="11.5" r=".45" fill="${paper}"/>`;
  return `<g>${ears}${head}${stripes}${face}${accessory}</g>`;
}
