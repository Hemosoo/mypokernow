import { memo, useMemo, type CSSProperties } from 'react';
import { artOptions, cardDataUrl } from '../rendering/cards';
import { lighten, rgba, svgDataUrl } from '../rendering/color';
import { dogPortrait } from '../rendering/puppy-art';
import { catPortrait } from '../rendering/cat-art';
import { landscapeTableUrl } from '../skin/table-art';
import type { CardIdentity, Theme } from '../types';

/**
 * A miniature of a whole theme, drawn with the same artwork the live table uses:
 * the room light, the table (felt, rail, inlay, emblem, pattern), a flop in the
 * theme's own deck, your two hole cards, a card back, and the puppy if it lives here.
 */
const FLOP: CardIdentity[] = [{ rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' }, { rank: '7', suit: 'diamonds' }];
const HAND: CardIdentity[] = [{ rank: 'Q', suit: 'clubs' }, { rank: 'Q', suit: 'hearts' }];

/** The companion's face in a little medallion: the puppy or the cat. */
function companionBadge(trim: string, kind: 'puppy' | 'cat'): string {
  const face = kind === 'cat' ? `<g transform="translate(0 1.4) scale(.82)">${catPortrait('J', '#3c3e45', '#fff8ec')}</g>` : `<g transform="translate(0 .6) scale(.86)">${dogPortrait('J', '#5b3a24', '#fff8ec')}</g>`;
  return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16 -16 32 32" width="64" height="64"><circle r="15" fill="${trim}"/><circle r="13.6" fill="#fff8ec"/>${face}</svg>`);
}

/** Cache table art by its inputs: drawing it is the costly part, and themes share rooms. */
const tableCache = new Map<string, string>();
function tableArt(table: Theme['table']): string {
  const key = JSON.stringify({ ...table, backgroundImage: undefined });
  let url = tableCache.get(key);
  if (!url) {
    url = landscapeTableUrl(table);
    if (tableCache.size > 60) tableCache.clear();
    tableCache.set(key, url);
  }
  return url;
}

export const ThemePreview = memo(function ThemePreview({ theme, detail = 'full', className = '' }: { theme: Theme; detail?: 'full' | 'table'; className?: string }) {
  const table = tableArt(theme.table);
  const cardKey = JSON.stringify(theme.card) + theme.table.trimColor;
  const cards = useMemo(() => ({
    flop: FLOP.map((identity) => cardDataUrl(identity, theme.card, artOptions(theme))),
    hand: HAND.map((identity) => cardDataUrl(identity, theme.card, artOptions(theme))),
    back: cardDataUrl(undefined, theme.card, artOptions(theme)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cardKey]);
  const style = {
    '--room': theme.table.backgroundColor,
    '--room-hi': lighten(theme.table.backgroundColor, 0.12),
    '--light': rgba(theme.table.trimColor, 0.2),
  } as CSSProperties;
  return <span className={`tp ${detail === 'table' ? 'tp-mini' : ''} ${className}`} style={style} aria-hidden="true">
    <span className="tp-stage">
      <img className="tp-table" src={table} alt="" decoding="async" draggable={false} />
      <span className="tp-board">{cards.flop.map((url, index) => <img key={index} src={url} alt="" draggable={false} />)}</span>
      {detail === 'full' && <>
        <span className="tp-hand"><img src={cards.hand[0]} alt="" draggable={false} /><img src={cards.hand[1]} alt="" draggable={false} /></span>
        <span className="tp-back left"><img src={cards.back} alt="" draggable={false} /><img src={cards.back} alt="" draggable={false} /></span>
        <span className="tp-back right"><img src={cards.back} alt="" draggable={false} /><img src={cards.back} alt="" draggable={false} /></span>
      </>}
    </span>
    {theme.companion && detail === 'full' && <img className="tp-pup" src={companionBadge(theme.table.trimColor, theme.companion.kind)} alt="" draggable={false} />}
  </span>;
});

/** A tiny table for menus: rail, felt and trim. */
export function ThemeDot({ theme, size = 28 }: { theme: Theme; size?: number }) {
  return <span className="theme-dot" style={{ width: size, height: Math.round(size * 0.72), '--felt': theme.table.feltColor, '--rail': theme.table.railColor, '--trim': theme.table.trimColor } as CSSProperties} aria-hidden="true" />;
}
