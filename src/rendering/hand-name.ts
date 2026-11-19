import type { CardIdentity, Rank } from '../types';

/**
 * Names the best five-card hand among your hole cards and the board, the way a
 * dealer would say it: "Full house, kings over sevens", "Two pair, aces and
 * eights", "Ace-high flush". Used only for the banner on your own win; it reads
 * cards already face up on your screen and never anyone else's.
 */
const ORDER: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const ONE: Record<number, string> = { 14: 'ace', 13: 'king', 12: 'queen', 11: 'jack', 10: 'ten', 9: 'nine', 8: 'eight', 7: 'seven', 6: 'six', 5: 'five', 4: 'four', 3: 'three', 2: 'two' };
const MANY: Record<number, string> = { 14: 'aces', 13: 'kings', 12: 'queens', 11: 'jacks', 10: 'tens', 9: 'nines', 8: 'eights', 7: 'sevens', 6: 'sixes', 5: 'fives', 4: 'fours', 3: 'threes', 2: 'twos' };
const cap = (text: string): string => text[0]!.toUpperCase() + text.slice(1);
const value = (card: CardIdentity): number => ORDER.indexOf(card.rank) + 2;

/** The highest straight in a set of values (ace counts low as well), or 0. */
function straightHigh(values: number[]): number {
  const set = new Set(values);
  if (set.has(14)) set.add(1);
  for (let high = 14; high >= 5; high--) if ([0, 1, 2, 3, 4].every((step) => set.has(high - step))) return high;
  return 0;
}

export interface HandName { name: string; rank: number }

export function describeHand(cards: CardIdentity[]): HandName | undefined {
  const unique = new Map(cards.map((card) => [card.rank + card.suit, card]));
  if (unique.size < 5 || unique.size !== cards.length) return undefined;
  const all = [...unique.values()], values = all.map(value);
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
    const suited = all.filter((card) => card.suit === suit).map(value);
    if (suited.length < 5) continue;
    const high = straightHigh(suited);
    if (high === 14) return { name: 'Royal flush', rank: 9 };
    if (high) return { name: `Straight flush, ${ONE[high]} high`, rank: 8 };
  }
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const quads = groups.find(([, count]) => count === 4);
  if (quads) return { name: `Four ${MANY[quads[0]]}`, rank: 7 };
  const trips = groups.filter(([, count]) => count === 3).map(([v]) => v);
  const pairs = groups.filter(([, count]) => count === 2).map(([v]) => v);
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const over = Math.max(...trips.slice(1), ...pairs);
    return { name: `Full house, ${MANY[trips[0]!]} over ${MANY[over]}`, rank: 6 };
  }
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as const) {
    const suited = all.filter((card) => card.suit === suit).map(value);
    if (suited.length >= 5) return { name: `${cap(ONE[Math.max(...suited)]!)}-high flush`, rank: 5 };
  }
  const straight = straightHigh(values);
  if (straight) return { name: `${cap(ONE[straight]!)}-high straight`, rank: 4 };
  if (trips.length) return { name: `Three ${MANY[trips[0]!]}`, rank: 3 };
  if (pairs.length >= 2) return { name: `Two pair, ${MANY[pairs[0]!]} and ${MANY[pairs[1]!]}`, rank: 2 };
  if (pairs.length) return { name: `Pair of ${MANY[pairs[0]!]}`, rank: 1 };
  return { name: `${cap(ONE[Math.max(...values)]!)} high`, rank: 0 };
}
