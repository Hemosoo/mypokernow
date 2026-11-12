import type { TableAppearance, TableEmblem } from '../types';
import { darken, lighten, luminance, metal, mix, rgba, safeHex, shade, svgDataUrl } from '../rendering/color';
import { PAW, bone, paw } from '../rendering/puppy-art';

/**
 * The table, drawn rather than photographed: padded leather rail with twin
 * stitching, a polished inlay, worsted felt lit from above, a betting line,
 * five card boxes and a recessed pot well.
 *
 * Coordinates match the artwork PokerNow positions its seats against
 * (1889 × 892 landscape, 540 × 859 portrait), so every seat, card and chip
 * lands where the game expects.
 */
const n = (value: number): string => Number(value.toFixed(1)).toString();
const escape = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));

interface Materials {
  felt: string; feltHigh: string; feltLow: string; feltLine: string; feltMark: string;
  rail: string; railHigh: string; railLow: string; thread: string;
  deep: string; low: string; mid: string; high: string; spec: string;
}

function materials(table: TableAppearance): Materials {
  const felt = safeHex(table.feltColor, '#0e5a41'), rail = safeHex(table.railColor, '#1c1613');
  const trim = metal(safeHex(table.trimColor, '#d4b274'));
  return {
    felt, feltHigh: shade(felt, 0.085), feltLow: shade(felt, -0.11), feltLine: lighten(felt, luminance(felt) > 0.3 ? 0.4 : 0.3), feltMark: lighten(felt, 0.13),
    rail, railHigh: lighten(rail, 0.16), railLow: darken(rail, 0.5), thread: mix(rail, trim.high, 0.55),
    ...trim,
  };
}

const EMBLEMS: Record<Exclude<TableEmblem, 'none'>, string> = {
  spade: '<path d="M0-26C3-19 25-5 25 8C25 16 19 20 13.5 20C8.5 20 4.5 17.5 2 13.5C3 19 5 23 9.5 26L-9.5 26C-5 23-3 19-2 13.5C-4.5 17.5-8.5 20-13.5 20C-19 20-25 16-25 8C-25-5-3-19 0-26Z"/>',
  crown: '<path d="M-24 17L-28-9L-14 3L0-17L14 3L28-9L24 17Z"/><circle cx="-28" cy="-13" r="3.4"/><circle cx="0" cy="-21" r="3.8"/><circle cx="28" cy="-13" r="3.4"/><rect x="-24" y="20" width="48" height="4.6" rx="2.3"/>',
  laurel: '<g fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M-6 24C-22 18-30 4-28-14"/><path d="M6 24C22 18 30 4 28-14"/></g><g><ellipse cx="-27" cy="-9" rx="3.2" ry="7" transform="rotate(-12 -27 -9)"/><ellipse cx="-25.5" cy="3" rx="3.2" ry="7" transform="rotate(-38 -25.5 3)"/><ellipse cx="-19" cy="13.5" rx="3.2" ry="7" transform="rotate(-62 -19 13.5)"/><ellipse cx="27" cy="-9" rx="3.2" ry="7" transform="rotate(12 27 -9)"/><ellipse cx="25.5" cy="3" rx="3.2" ry="7" transform="rotate(38 25.5 3)"/><ellipse cx="19" cy="13.5" rx="3.2" ry="7" transform="rotate(62 19 13.5)"/><path d="M0-13C1.6-9.4 12.5-2.6 12.5 4C12.5 8 9.5 10 6.8 10C4.2 10 2.2 8.8 1 6.8C1.5 9.6 2.5 11.6 4.8 13L-4.8 13C-2.5 11.6-1.5 9.6-1 6.8C-2.2 8.8-4.2 10-6.8 10C-9.5 10-12.5 8-12.5 4C-12.5-2.6-1.6-9.4 0-13Z"/></g>',
  paw: `<g transform="translate(0 -4) scale(64)">${PAW}</g>`,
};

function emblem(kind: TableEmblem, x: number, y: number, scale: number, m: Materials): string {
  if (kind === 'none') return '';
  const art = EMBLEMS[kind];
  // Debossed: a dark edge above, a light edge below, tone-on-tone body.
  return `<g transform="translate(${n(x)} ${n(y)}) scale(${scale})">
<g transform="translate(0 -1.2)" fill="#000" stroke="#000" opacity=".2">${art}</g>
<g transform="translate(0 1.2)" fill="${m.feltLine}" stroke="${m.feltLine}" opacity=".22">${art}</g>
<g fill="${m.feltMark}" stroke="${m.feltMark}" opacity=".6">${art}</g></g>`;
}

function inscription(text: string, x: number, y: number, size: number, m: Materials): string {
  const words = text.trim().toUpperCase();
  if (!words) return '';
  const attrs = `x="${n(x)}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="${size}" letter-spacing="${n(size * 0.42)}"`;
  return `<text ${attrs} y="${n(y - 0.8)}" fill="#000" opacity=".22">${escape(words)}</text>
<text ${attrs} y="${n(y + 0.8)}" fill="${m.feltLine}" opacity=".2">${escape(words)}</text>
<text ${attrs} y="${n(y)}" fill="${m.feltMark}" opacity=".7">${escape(words)}</text>`;
}

function sharedDefs(m: Materials, feltClip: string): string {
  return `<radialGradient id="felt" cx=".5" cy=".4" r=".72"><stop offset="0" stop-color="${m.feltHigh}"/><stop offset=".5" stop-color="${m.felt}"/><stop offset="1" stop-color="${m.feltLow}"/></radialGradient>
<linearGradient id="rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.railHigh}"/><stop offset=".3" stop-color="${m.rail}"/><stop offset="1" stop-color="${m.railLow}"/></linearGradient>
<linearGradient id="apron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${darken(m.rail, 0.35)}"/><stop offset="1" stop-color="#000"/></linearGradient>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.low}"/><stop offset=".16" stop-color="${m.spec}"/><stop offset=".3" stop-color="${m.mid}"/><stop offset=".48" stop-color="${m.deep}"/><stop offset=".62" stop-color="${m.high}"/><stop offset=".78" stop-color="${m.spec}"/><stop offset="1" stop-color="${m.low}"/></linearGradient>
<linearGradient id="well" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".46"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
<filter id="cloth" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".8 1.15" numOctaves="3" seed="11" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.5 0 0 0 -.62" result="fibres"/><feComposite in="fibres" in2="SourceAlpha" operator="in"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="4" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.3 0 0 0 -.56" result="pores"/><feComposite in="pores" in2="SourceAlpha" operator="in"/></filter>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="softer" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="34"/></filter>
<filter id="glint" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
<clipPath id="feltClip">${feltClip}</clipPath>
<pattern id="pawfelt" width="150" height="150" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><g fill="${m.feltMark}" fill-opacity=".55">${paw(36, 40, 26, -20)}${paw(108, 112, 26, 18)}</g><g fill="${m.feltMark}" fill-opacity=".32">${bone(110, 34, 13, -32)}${bone(36, 116, 13, 28)}</g></pattern>`;
}

function cardBoxes(left: number, top: number, width: number, height: number, gap: number, radius: number, m: Materials): string {
  let boxes = '';
  for (let index = 0; index < 5; index++) {
    const x = left + index * (width + gap);
    boxes += `<rect x="${n(x - 2)}" y="${n(top - 2)}" width="${n(width + 4)}" height="${n(height + 4)}" rx="${radius}" fill="#000" fill-opacity=".07" stroke="${m.feltLine}" stroke-opacity=".22" stroke-width="1.3"/>`;
  }
  return boxes;
}

function potWell(x: number, y: number, width: number, height: number, m: Materials): string {
  const r = height / 2;
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" rx="${n(r)}" fill="url(#well)"/>
<rect x="${n(x + 0.6)}" y="${n(y + 0.6)}" width="${n(width - 1.2)}" height="${n(height - 1.2)}" rx="${n(r - 0.6)}" fill="none" stroke="${m.high}" stroke-opacity=".34" stroke-width="1.2"/>
<path d="M${n(x + r)} ${n(y + 1.6)}H${n(x + width - r)}" stroke="#000" stroke-opacity=".5" stroke-width="2.2" stroke-linecap="round"/>`;
}

/** Paw prints walking around the rail between the two rows of stitching, toes pointing forward. */
function railPaws(cx: number, cy: number, rx: number, ry: number, m: Materials): string {
  let prints = '';
  const count = 34;
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2;
    // Alternate left and right feet a little either side of the centre line.
    const side = index % 2 ? 1 : -1, nx = Math.cos(angle) / rx, ny = Math.sin(angle) / ry, length = Math.hypot(nx, ny);
    const x = cx + Math.cos(angle) * rx + side * 4 * nx / length, y = cy + Math.sin(angle) * ry + side * 4 * ny / length;
    const heading = Math.atan2(Math.cos(angle) * ry, -Math.sin(angle) * rx) * 180 / Math.PI + 90;
    prints += paw(x, y, 9, heading);
  }
  return `<g fill="${m.thread}" fill-opacity=".42">${prints}</g>`;
}

export function landscapeTableSvg(table: TableAppearance): string {
  const m = materials(table);
  const puppy = table.motif === 'puppy';
  const cx = 945, cy = 418, rx = 600, ry = 292;
  const ellipse = (x: number, y: number, a: number, b: number, attrs: string) => `<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" ${attrs}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1889 892" width="1889" height="892">
<defs>${sharedDefs(m, ellipse(cx, cy, rx, ry, ''))}
<clipPath id="railClip">${ellipse(cx, cy + 6, 654, 340, '')}</clipPath>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
${ellipse(cx, 540, 730, 322, 'fill="#000" fill-opacity=".62" filter="url(#softer)"')}
${ellipse(cx, cy + 40, 649, 338, 'fill="url(#apron)"')}
${ellipse(cx, cy + 6, 654, 340, 'fill="url(#rail)"')}
<g clip-path="url(#railClip)">
${ellipse(cx, cy + 6, 654, 340, 'fill="#fff" filter="url(#grain)" opacity=".1"')}
${ellipse(cx, cy + 6, 652, 338, `fill="none" stroke="#000" stroke-opacity=".55" stroke-width="16" filter="url(#glint)"`)}
${ellipse(cx, cy - 2, 630, 320, 'fill="none" stroke="url(#sheen)" stroke-width="15" filter="url(#glint)"')}
</g>
${ellipse(cx, cy + 5, 643, 330, `fill="none" stroke="${m.thread}" stroke-opacity=".62" stroke-width="1.7" stroke-dasharray="9 7" stroke-linecap="round"`)}
${ellipse(cx, cy + 1, 619, 310, `fill="none" stroke="${m.thread}" stroke-opacity=".5" stroke-width="1.5" stroke-dasharray="8 7" stroke-linecap="round"`)}
${puppy ? railPaws(cx, cy + 3, 631, 320, m) : ''}
${ellipse(cx, cy + 1.5, 611, 303, 'fill="#000" fill-opacity=".55"')}
${ellipse(cx, cy, 609, 301, 'fill="url(#metal)"')}
${ellipse(cx, cy, 609, 301, `fill="none" stroke="${m.spec}" stroke-opacity=".55" stroke-width=".8"`)}
${ellipse(cx, cy, rx + 1, ry + 1, 'fill="#000" fill-opacity=".7"')}
${ellipse(cx, cy, rx, ry, 'fill="url(#felt)"')}
${ellipse(cx, cy, rx, ry, 'fill="#fff" filter="url(#cloth)" opacity=".085"')}
${puppy ? ellipse(cx, cy, rx, ry, 'fill="url(#pawfelt)" clip-path="url(#feltClip)" opacity=".5"') : ''}
<g clip-path="url(#feltClip)">
${ellipse(cx, cy, rx + 6, ry + 6, 'fill="none" stroke="#000" stroke-opacity=".62" stroke-width="42" filter="url(#soft)"')}
${ellipse(cx, cy - 8, rx, ry, 'fill="none" stroke="#000" stroke-opacity=".3" stroke-width="10" filter="url(#glint)"')}
${ellipse(cx, 318, 440, 170, 'fill="#fff" fill-opacity=".06" filter="url(#softer)"')}
${ellipse(cx, cy, 523, 234, `fill="none" stroke="${m.feltLine}" stroke-opacity=".3" stroke-width="1.6"`)}
${cardBoxes(528.9, 312.2, 153, 187, 13.6, puppy ? 20 : 13, m)}
${potWell(820, 214, 246, 65, m)}
${emblem(table.emblem, cx, table.inscription.trim() ? 580 : 590, 0.92, m)}
${inscription(table.inscription, cx, 636, 15, m)}
</g>
</svg>`;
}

export function portraitTableSvg(table: TableAppearance): string {
  const m = materials(table);
  const rect = (x: number, y: number, w: number, h: number, r: number, attrs: string) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${attrs}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 859" width="540" height="859">
<defs>${sharedDefs(m, rect(57, 82, 388, 648, 54, ''))}
<clipPath id="railClip">${rect(38, 60, 426, 692, 74, '')}</clipPath></defs>
${rect(30, 70, 442, 712, 80, 'fill="#000" fill-opacity=".6" filter="url(#soft)"')}
${rect(40, 70, 422, 694, 74, 'fill="url(#apron)"')}
${rect(38, 60, 426, 692, 74, 'fill="url(#rail)"')}
<g clip-path="url(#railClip)">${rect(38, 60, 426, 692, 74, 'fill="#fff" filter="url(#grain)" opacity=".1"')}
${rect(38, 60, 426, 692, 74, 'fill="none" stroke="#000" stroke-opacity=".5" stroke-width="8" filter="url(#glint)"')}</g>
${rect(43.5, 65.5, 415, 681, 69, `fill="none" stroke="${m.thread}" stroke-opacity=".6" stroke-width="1" stroke-dasharray="5 4" stroke-linecap="round"`)}
${rect(53, 78, 396, 656, 58, 'fill="url(#metal)"')}
${rect(56, 81, 390, 650, 55, 'fill="#000" fill-opacity=".7"')}
${rect(57, 82, 388, 648, 54, 'fill="url(#felt)"')}
${rect(57, 82, 388, 648, 54, 'fill="#fff" filter="url(#cloth)" opacity=".085"')}
${table.motif === 'puppy' ? rect(57, 82, 388, 648, 54, 'fill="url(#pawfelt)" clip-path="url(#feltClip)" opacity=".5"') : ''}
<g clip-path="url(#feltClip)">
${rect(53, 78, 396, 656, 58, 'fill="none" stroke="#000" stroke-opacity=".6" stroke-width="26" filter="url(#soft)"')}
<ellipse cx="251" cy="330" rx="170" ry="210" fill="#fff" fill-opacity=".05" filter="url(#softer)"/>
${rect(78, 104, 346, 604, 38, `fill="none" stroke="${m.feltLine}" stroke-opacity=".28" stroke-width="1.1"`)}
${cardBoxes(67.5, 382, 74.5, 91.1, 6.6, 7, m)}
${potWell(193, 309, 113, 35, m)}
${emblem(table.emblem, 251, table.inscription.trim() ? 612 : 622, 0.62, m)}
${inscription(table.inscription, 251, 654, 10, m)}
</g>
</svg>`;
}

export const landscapeTableUrl = (table: TableAppearance): string => svgDataUrl(landscapeTableSvg(table));
export const portraitTableUrl = (table: TableAppearance): string => svgDataUrl(portraitTableSvg(table));

/** A faint woven lattice for the room behind the table; tiles seamlessly. */
export function roomPatternUrl(table: TableAppearance): string {
  const trim = safeHex(table.trimColor, '#d4b274');
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><g fill="none" stroke="${trim}" stroke-opacity=".085" stroke-width=".8"><path d="M28 0L56 28L28 56L0 28Z"/><path d="M28 14L42 28L28 42L14 28Z"/></g><g fill="${trim}" fill-opacity=".12"><circle cx="28" cy="28" r="1.1"/><circle cx="0" cy="0" r="1.1"/><circle cx="56" cy="0" r="1.1"/><circle cx="0" cy="56" r="1.1"/><circle cx="56" cy="56" r="1.1"/></g></svg>`);
}

export const tableGlow = (table: TableAppearance): string => rgba(safeHex(table.trimColor, '#d4b274'), 0.09);
