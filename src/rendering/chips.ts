import { darken, metal, mix, safeHex, svgDataUrl } from './color';
import { CAP_HEIGHT, glyphs } from './glyphs';

/**
 * Casino chips, drawn at a three-quarter angle so a stack reads as an object
 * with weight. Values are expressed in big blinds, which keeps the colours
 * meaningful at any stake: a red chip is always one big blind.
 */
export type ChipTone = 'ivory' | 'crimson' | 'emerald' | 'onyx' | 'violet' | 'gold';

export const DENOMINATIONS: readonly { value: number; tone: ChipTone }[] = [
  { value: 500, tone: 'gold' }, { value: 100, tone: 'violet' }, { value: 25, tone: 'onyx' },
  { value: 5, tone: 'emerald' }, { value: 1, tone: 'crimson' }, { value: 0.25, tone: 'ivory' },
];

/** Bottom-to-top chips for an amount in big blinds, capped to a readable stack. */
export function chipsFor(bigBlinds: number, max = 10): ChipTone[] {
  if (!Number.isFinite(bigBlinds) || bigBlinds <= 0) return [];
  const chips: ChipTone[] = [];
  let remaining = bigBlinds;
  for (const { value, tone } of DENOMINATIONS) {
    let count = Math.floor(remaining / value + 1e-9);
    remaining -= count * value;
    // Several of a kind read as a stack; a tall column of one colour reads as noise.
    count = Math.min(count, tone === 'gold' ? max : 4);
    for (let index = 0; index < count; index++) chips.push(tone);
  }
  if (!chips.length) chips.push('ivory');
  // Too many chips: keep the valuable end of the stack and drop the small change.
  return chips.slice(0, max);
}

interface Tone { face: string; side: string; insert: string; inlay: string; ring: string }
function toneColors(tone: ChipTone, accent: string): Tone {
  const gold = metal(safeHex(accent, '#d4b274'));
  switch (tone) {
    case 'ivory': return { face: '#efe9db', side: '#c6bca6', insert: '#5d6b78', inlay: '#f8f4ea', ring: '#b9ad92' };
    case 'crimson': return { face: '#b8242f', side: '#7c161e', insert: '#f3ecdc', inlay: '#c9333d', ring: '#f3ecdc' };
    case 'emerald': return { face: '#1c7a52', side: '#115237', insert: '#f3ecdc', inlay: '#239264', ring: '#f3ecdc' };
    case 'onyx': return { face: '#25272c', side: '#0f1012', insert: gold.high, inlay: '#32353b', ring: gold.high };
    case 'violet': return { face: '#5b3f9f', side: '#3b276c', insert: '#f3ecdc', inlay: '#6d4fb8', ring: '#f3ecdc' };
    default: return { face: gold.mid, side: gold.deep, insert: '#1d1f23', inlay: gold.high, ring: gold.spec };
  }
}

export const CHIP = { width: 24, ry: 6.6, thickness: 4.1 } as const;
const n = (value: number): string => Number(value.toFixed(2)).toString();

function chipSide(x: number, cy: number, tone: Tone, turn = 0): string {
  const { width: w, ry, thickness: t } = CHIP, rx = w / 2;
  const edge = (px: number) => cy + ry * Math.sqrt(Math.max(0, 1 - ((px - rx) / rx) ** 2));
  let markup = `<path d="M${n(x)} ${n(cy)}v${t}A${rx} ${ry} 0 0 0 ${n(x + w)} ${n(cy + t)}v${-t}A${rx} ${ry} 0 0 1 ${n(x)} ${n(cy)}Z" fill="${tone.side}"/>`;
  // Edge inserts follow the curve of the rim.
  // Each chip sits at its own rotation, so inserts never line up into stripes.
  const shift = ((turn * 7) % 5 - 2) * 1.25;
  for (const [a, b] of [[2.4, 6], [10.2, 13.8], [18, 21.6]] as const) {
    const from = Math.max(0.4, a + shift), to = Math.min(w - 0.4, b + shift);
    markup += `<path d="M${n(x + from)} ${n(edge(from))}L${n(x + to)} ${n(edge(to))}v${t}L${n(x + from)} ${n(edge(from) + t)}Z" fill="${tone.insert}" fill-opacity=".85"/>`;
  }
  // A soft highlight where the room light catches the rim.
  markup += `<path d="M${n(x)} ${n(cy)}A${rx} ${ry} 0 0 0 ${n(x + w)} ${n(cy)}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".5"/>`;
  return markup;
}

function chipTop(x: number, cy: number, tone: Tone): string {
  const { width: w, ry } = CHIP, rx = w / 2, cx = x + rx;
  return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${rx}" ry="${ry}" fill="${tone.face}"/>`
    + `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx - 1.5)}" ry="${n(ry - 0.85)}" fill="none" stroke="${tone.insert}" stroke-opacity=".9" stroke-width="2.4" stroke-dasharray="4.1 5.05"/>`
    + `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx * 0.56)}" ry="${n(ry * 0.56)}" fill="${tone.inlay}" stroke="${tone.ring}" stroke-opacity=".8" stroke-width=".5"/>`
    + `<ellipse cx="${n(cx - 2.2)}" cy="${n(cy - 1.6)}" rx="${n(rx * 0.5)}" ry="${n(ry * 0.34)}" fill="#fff" fill-opacity=".1"/>`;
}

export interface ChipArt { svg: string; width: number; height: number; url: string }

/**
 * Draw one or more adjacent columns. Each column is listed bottom to top.
 * Columns overlap slightly and step back, the way a croupier racks a bet.
 */
export function chipColumnsArt(columns: ChipTone[][], accent: string): ChipArt {
  const stacks = columns.filter((column) => column.length);
  if (!stacks.length) return { svg: '', width: 0, height: 0, url: '' };
  const { width: w, ry, thickness: t } = CHIP;
  const step = w * 0.86, tallest = Math.max(...stacks.map((column) => column.length));
  const width = w + step * (stacks.length - 1) + 3, height = ry * 2 + t * tallest + 5.5;
  const base = height - ry - 4.2;
  let markup = '';
  stacks.forEach((_, index) => {
    const x = 1.5 + index * step;
    // Contact shadow: tight and dark underneath, wide and faint around.
    markup += `<ellipse cx="${n(x + w / 2 + 0.8)}" cy="${n(base + t + 1.4)}" rx="${n(w / 2 + 1.2)}" ry="${n(ry + 1)}" fill="#000" fill-opacity=".2"/>`
      + `<ellipse cx="${n(x + w / 2 + 0.3)}" cy="${n(base + t + 0.6)}" rx="${n(w / 2)}" ry="${n(ry)}" fill="#000" fill-opacity=".34"/>`;
  });
  stacks.forEach((column, index) => {
    const x = 1.5 + index * step;
    column.forEach((tone, level) => {
      const colors = toneColors(tone, accent), cy = base - level * t;
      markup += chipSide(x, cy, colors, level + index * 3);
      if (level === column.length - 1) markup += chipTop(x, cy, colors);
      else markup += `<path d="M${n(x)} ${n(cy)}A${w / 2} ${ry} 0 0 0 ${n(x + w)} ${n(cy)}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".45"/>`;
    });
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(width)} ${n(height)}" width="${n(width)}" height="${n(height)}">${markup}</svg>`;
  return { svg, width, height, url: svgDataUrl(svg) };
}

/** Split a stack into racked columns of at most `perColumn` chips. */
export function rack(chips: ChipTone[], perColumn = 5, maxColumns = 3): ChipTone[][] {
  const columns: ChipTone[][] = [];
  for (let index = 0; index < chips.length && columns.length < maxColumns; index += perColumn) columns.push(chips.slice(index, index + perColumn));
  // Tallest column at the back-left so shorter ones never hide it.
  return columns.sort((a, b) => b.length - a.length);
}

/** A bet as racked chips. */
export function betArt(bigBlinds: number, accent: string): ChipArt {
  return chipColumnsArt(rack(chipsFor(bigBlinds, 10), 5, 2), accent);
}

/** The pot as a wider rack: more columns, same language. */
export function potArt(bigBlinds: number, accent: string): ChipArt {
  return chipColumnsArt(rack(chipsFor(bigBlinds, 18), 6, 3), accent);
}

/** A single chip, used while chips are in motion. */
export function singleChipArt(tone: ChipTone, accent: string): ChipArt {
  return chipColumnsArt([[tone]], accent);
}

/** Flat, top-down chip used for the dealer puck and studio swatches. */
function letterMark(letter: string): string {
  const glyph = glyphs[letter] ?? glyphs.D!;
  const height = 17, scale = height / CAP_HEIGHT, width = (glyph.x1 - glyph.x0) * scale;
  // Foreshortened to sit on the tilted face of the puck.
  return `<path transform="translate(${n(32 - width / 2 - glyph.x0 * scale)} ${n(25 + height * 0.74 / 2)}) scale(${n(scale)} ${n(scale * 0.74)})" d="${glyph.d}" fill="#1b1d21"/>`;
}

export function puckSvg(accent: string, letter = 'D'): string {
  const gold = metal(safeHex(accent, '#d4b274'));
  const ivory = '#f6f1e4', shade = mix(ivory, '#8f8672', 0.55);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 56" width="64" height="56">
<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="${darken(ivory, 0.1)}"/></linearGradient>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${gold.spec}"/><stop offset=".5" stop-color="${gold.mid}"/><stop offset="1" stop-color="${gold.low}"/></linearGradient></defs>
<ellipse cx="33" cy="35" rx="27" ry="17.5" fill="#000" fill-opacity=".26"/>
<path d="M5 25v6A27 18 0 0 0 59 31v-6Z" fill="${shade}"/>
<path d="M5 25v6A27 18 0 0 0 59 31v-6" fill="none" stroke="#000" stroke-opacity=".18" stroke-width=".6"/>
<ellipse cx="32" cy="25" rx="27" ry="18" fill="url(#f)"/>
<ellipse cx="32" cy="25" rx="23.2" ry="15" fill="none" stroke="url(#g)" stroke-width="1.5"/>
<ellipse cx="32" cy="25" rx="20.6" ry="13.1" fill="none" stroke="${gold.low}" stroke-opacity=".5" stroke-width=".4"/>
${letterMark(letter)}
<ellipse cx="24" cy="17" rx="13" ry="5" fill="#fff" fill-opacity=".35"/>
</svg>`;
}
