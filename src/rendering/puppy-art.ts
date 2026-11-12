/**
 * Puppy motifs shared by the deck, felt, chips and dealer button. Every shape is
 * drawn in a unit box around the origin so it can be placed at any size.
 */

/** A paw print: one pad and four toes, about 1 unit tall. */
export const PAW = '<path d="M0 .1C.17 .1 .32 .22 .33 .36C.34 .49 .22 .52 0 .48C-.22 .52-.34 .49-.33 .36C-.32 .22-.17 .1 0 .1Z"/>'
  + '<ellipse cx="-.3" cy="-.08" rx=".11" ry=".14" transform="rotate(-24 -.3 -.08)"/><ellipse cx="-.11" cy="-.26" rx=".11" ry=".145" transform="rotate(-8 -.11 -.26)"/>'
  + '<ellipse cx=".11" cy="-.26" rx=".11" ry=".145" transform="rotate(8 .11 -.26)"/><ellipse cx=".3" cy="-.08" rx=".11" ry=".14" transform="rotate(24 .3 -.08)"/>';

/** A dog bone, 2 units long, lying horizontally. */
export const BONE = '<path d="M-.72-.12H.72A.22 .22 0 1 1 .92-.3A.2 .2 0 1 1 .92 .3A.22 .22 0 1 1 .72 .12H-.72A.22 .22 0 1 1-.92 .3A.2 .2 0 1 1-.92-.3A.22 .22 0 1 1-.72-.12Z"/>';

export const paw = (x: number, y: number, size: number, rotate = 0): string =>
  `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotate}) scale(${size.toFixed(3)})">${PAW}</g>`;
export const bone = (x: number, y: number, size: number, rotate = 0): string =>
  `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rotate}) scale(${size.toFixed(3)})">${BONE}</g>`;

/**
 * A puppy portrait for the court cards, about 24 units wide, line-drawn in one ink:
 * the king wears a small crown, the queen a bow, the jack a collar tag.
 */
export function dogPortrait(rank: 'J' | 'Q' | 'K', ink: string, paper: string): string {
  const head = `<path d="M-8.4 1.5C-8.4-5.6-4.6-9 0-9S8.4-5.6 8.4 1.5C8.4 7.2 4.6 10 0 10S-8.4 7.2-8.4 1.5Z" fill="${paper}" stroke="${ink}" stroke-width="1.1"/>`;
  const ears = `<path d="M-7.2-5.4C-11.4-6.6-13.2-1.5-12.4 4.2C-11.9 7.4-9.4 7.6-8.2 4.8" fill="${ink}" fill-opacity=".85" stroke="${ink}" stroke-width="1" stroke-linejoin="round"/>`
    + `<path d="M7.2-5.4C11.4-6.6 13.2-1.5 12.4 4.2C11.9 7.4 9.4 7.6 8.2 4.8" fill="${ink}" fill-opacity=".85" stroke="${ink}" stroke-width="1" stroke-linejoin="round"/>`;
  const face = `<ellipse cx="0" cy="4.6" rx="4.4" ry="3.6" fill="${paper}" stroke="${ink}" stroke-width=".7" stroke-opacity=".6"/>`
    + `<ellipse cx="-3.4" cy="-.6" rx="1.35" ry="1.6" fill="${ink}"/><ellipse cx="3.4" cy="-.6" rx="1.35" ry="1.6" fill="${ink}"/>`
    + `<circle cx="-2.95" cy="-1.15" r=".45" fill="${paper}"/><circle cx="3.85" cy="-1.15" r=".45" fill="${paper}"/>`
    + `<path d="M-1.6 2.6C-1.6 1.7 1.6 1.7 1.6 2.6C1.6 3.6 0 4.3 0 4.3S-1.6 3.6-1.6 2.6Z" fill="${ink}"/>`
    + `<path d="M0 4.3V5.6M0 5.6C-.8 6.6-2 6.6-2.6 5.8M0 5.6C.8 6.6 2 6.6 2.6 5.8" fill="none" stroke="${ink}" stroke-width=".7" stroke-linecap="round"/>`;
  const accessory = rank === 'K'
    ? `<path d="M-5.5-8.4L-6.3-14L-3-11L0-15L3-11L6.3-14L5.5-8.4Z" fill="${ink}"/><circle cx="0" cy="-15.6" r=".9" fill="${ink}"/>`
    : rank === 'Q'
      ? `<path d="M3.2-8.6C4.6-12 8.6-12.4 8.2-9.4C8-7.8 6-7.6 4.4-8.4C6-7.6 7.6-5.8 6.4-4.8C5-3.6 3.2-6 3.2-8.6Z" fill="${ink}"/><circle cx="3.6" cy="-8.4" r="1.1" fill="${paper}" stroke="${ink}" stroke-width=".6"/>`
      : `<path d="M-6.6 8.4C-3 10.6 3 10.6 6.6 8.4" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/><circle cx="0" cy="11.6" r="1.7" fill="${ink}"/><circle cx="0" cy="11.6" r=".6" fill="${paper}"/>`;
  return `<g>${ears}${head}${face}${accessory}</g>`;
}
