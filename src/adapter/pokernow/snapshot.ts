import type { CardIdentity, Rank, Rect, Suit, VisualCard } from '../../types';
import { OWNED_SELECTOR, selectorProfiles, type SelectorProfile } from './selectors';

/** Appearance needs only a recognizable table, not a complete poker hand. */
export interface TablePresentationSnapshot {
  table: HTMLElement;
  boardElement?: HTMLElement;
  profile: SelectorProfile['id'];
  bounds: Rect;
  board: VisualCard[];
  holes: VisualCard[];
}

export interface TableSnapshot extends TablePresentationSnapshot {
  boardElement: HTMLElement;
  seats: Rect[];
}

export type IdentityCache = WeakMap<HTMLElement, { identity: CardIdentity | undefined }>;

export function rectangle(element: Element): Rect {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

export function validRectangle(rect: Rect): boolean {
  return Object.values(rect).every(Number.isFinite) && rect.width >= 5 && rect.height >= 5;
}

/** The override applies only to a previously observed source under our visibility lease. */
export function isPainted(element: HTMLElement, leased = false, allowEmptyContainer = false): boolean {
  if (!element.isConnected || (!allowEmptyContainer && !validRectangle(rectangle(element)))) return false;
  let current: HTMLElement | null = element;
  while (current) {
    const style = getComputedStyle(current);
    if (current.hidden || current.getAttribute('aria-hidden') === 'true' ||
      style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity || 1) === 0 ||
      ((style.visibility === 'hidden' || style.visibility === 'collapse') && !(leased && current === element))) return false;
    if (/opacity\(\s*(?:0|0%)\s*\)/.test(style.filter)) return false;
    current = current.parentElement;
  }
  return true;
}

function hasVisibleFront(element: HTMLElement, requireOpaqueText = true): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    const style = getComputedStyle(current);
    const transform = style.transform;
    if (transform.startsWith('matrix3d(')) {
      const matrix = transform.slice(9, -1).split(',').map(Number);
      // A back-facing/front-edge-on transform is not proof its rank is visible.
      if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value)) || matrix[10]! <= 0.05) return false;
    } else if (/rotate[XY]|rotate3d/i.test(transform)) {
      // Browsers normally resolve transforms to matrices. Unknown 3D forms fail conservatively.
      return false;
    }
    current = current.parentElement;
  }
  if (!requireOpaqueText) return true;
  const color = getComputedStyle(element).color;
  return color !== 'transparent' && !/^rgba\([^)]*,\s*0\s*\)$/.test(color);
}

function hasVisibleBack(element: HTMLElement, profile: SelectorProfile): boolean {
  if (element.matches(profile.faceDown) && hasVisibleFront(element, false)) return true;
  // Wrapper markup may place the explicit back surface on the inner .card.
  // Do not accept a hidden or back-facing back surface as proof of its display.
  return Array.from(element.querySelectorAll<HTMLElement>(profile.faceDown))
    .some((back) => isPainted(back) && hasVisibleFront(back, false));
}

const suits: Record<string, Suit> = {
  '♥': 'hearts', '♡': 'hearts', h: 'hearts', heart: 'hearts', hearts: 'hearts',
  '♦': 'diamonds', '♢': 'diamonds', d: 'diamonds', diamond: 'diamonds', diamonds: 'diamonds',
  '♣': 'clubs', '♧': 'clubs', c: 'clubs', club: 'clubs', clubs: 'clubs',
  '♠': 'spades', '♤': 'spades', s: 'spades', spade: 'spades', spades: 'spades',
};

function visibleText(element: HTMLElement): string {
  // textContent includes display:none descendants. Never consume their contents.
  if (!hasVisibleFront(element) || Number.parseFloat(getComputedStyle(element).fontSize) === 0) return '';
  let result = '';
  for (const child of element.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) result += child.textContent ?? '';
    else if (child instanceof HTMLElement && isPainted(child)) result += visibleText(child);
  }
  return result.trim();
}

export function readVisibleIdentity(element: HTMLElement, profile: SelectorProfile): CardIdentity | undefined {
  if (element.matches(profile.faceDown)) return undefined;
  const rankElement = element.querySelector<HTMLElement>(profile.rank);
  const suitElement = element.querySelector<HTMLElement>(profile.suit);
  if (!rankElement || !suitElement || !isPainted(rankElement) || !isPainted(suitElement) ||
    rankElement.closest(profile.faceDown) || suitElement.closest(profile.faceDown) ||
    !hasVisibleFront(rankElement) || !hasVisibleFront(suitElement)) return undefined;
  const rankText = visibleText(rankElement).toUpperCase();
  const rank = rankText === 'T' ? '10' : rankText;
  if (!/^(?:[2-9]|10|J|Q|K|A)$/.test(rank)) return undefined;
  let suit = suits[visibleText(suitElement).toLowerCase()];
  // A generated, visibly painted glyph is presentation too. Read its text, never hidden classes/data.
  if (!suit) {
    const generated = getComputedStyle(suitElement, '::before').content;
    if (generated && generated !== 'none' && generated !== 'normal') suit = suits[generated.replace(/^["']|["']$/g, '').trim()];
  }
  return suit ? { rank: rank as Rank, suit } : undefined;
}

function visibleCards(container: HTMLElement, profile: SelectorProfile, cache: IdentityCache): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(profile.card)).filter((element) => {
    if (element.closest(OWNED_SELECTOR)) return false;
    const leased = element.getAttribute('data-pnc-concealed') === 'true' && cache.has(element);
    return isPainted(element, leased);
  });
  // A .card-container and its inner .card are one logical card. Lease the
  // painted wrapper when available so both its front and back are concealed.
  return candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
}

function describe(element: HTMLElement, id: string, profile: SelectorProfile, cache: IdentityCache, seatId?: string, round?: number): VisualCard {
  const leased = element.getAttribute('data-pnc-concealed') === 'true' && cache.has(element);
  // Reusing only previously visible identity prevents a newer hidden value being inspected during a lease.
  const identity = leased ? cache.get(element)?.identity : readVisibleIdentity(element, profile);
  if (!leased) cache.set(element, { identity });
  return { id, identity, target: rectangle(element), source: element, seatId, round };
}

function visibleBoards(table: HTMLElement, profile: SelectorProfile): HTMLElement[] {
  const candidates = Array.from(table.querySelectorAll<HTMLElement>(profile.board))
    .filter((element) => !element.closest(OWNED_SELECTOR) && isPainted(element, false, true));
  // Nested aliases may describe the same board. Distinct sibling boards still
  // produce multiple candidates and retain the animation fail-open guard.
  return candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
}

/** Resolve nested #table/.table aliases without choosing between independent tables. */
export function findTableCandidates(document: Document, profile: SelectorProfile): HTMLElement[] {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(profile.table))
    .filter((element) => !element.closest(OWNED_SELECTOR) && isPainted(element));
  const roots = candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
  return roots.flatMap((root) => {
    const aliases = candidates.filter((element) => element === root || root.contains(element));
    const coherent = aliases.filter((element) => visibleBoards(element, profile).length > 0 &&
      Array.from(element.querySelectorAll<HTMLElement>(profile.seat)).some((seat) => !seat.closest(OWNED_SELECTOR) && isPainted(seat)));
    const choices = coherent.length ? coherent : aliases;
    return choices.filter((element) => !choices.some((other) => other !== element && element.contains(other)));
  });
}

/**
 * Static appearance is independent from street/deal detection. Empty tables,
 * partially rendered streets, and games we do not animate may still be themed.
 * An unrecognized face is never replaced by a guessed card back.
 */
export function takePresentationSnapshot(document: Document, cache: IdentityCache = new WeakMap(), allowFixture = false): TablePresentationSnapshot | undefined {
  for (const profile of selectorProfiles) {
    if (profile.id === 'fixture' && !allowFixture) continue;
    const tables = findTableCandidates(document, profile);
    if (tables.length !== 1) continue;
    const table = tables[0]!;
    const boards = visibleBoards(table, profile);
    // Multiple boards can keep their native layout and receive table appearance.
    const boardElement = boards.length === 1 ? boards[0] : undefined;
    const seats = Array.from(table.querySelectorAll<HTMLElement>(profile.seat))
      .filter((element) => !element.closest(OWNED_SELECTOR) && isPainted(element));
    const describeSafeCards = (container: HTMLElement, prefix: string): VisualCard[] =>
      visibleCards(container, profile, cache).map((element, index) => describe(element, `${prefix}-${index}`, profile, cache))
        .filter((card) => Boolean(card.identity) || Boolean(card.source && hasVisibleBack(card.source, profile)));
    return {
      table, boardElement, profile: profile.id, bounds: rectangle(table),
      board: boardElement ? describeSafeCards(boardElement, 'board') : [],
      holes: seats.flatMap((seat, index) => describeSafeCards(seat, `seat-${index}-card`)
        .filter((card) => !boards.some((board) => board.contains(card.source!)))),
    };
  }
  return undefined;
}

export function takeSnapshot(document: Document, cache: IdentityCache = new WeakMap(), allowFixture = false): TableSnapshot | undefined {
  for (const profile of selectorProfiles) {
    if (profile.id === 'fixture' && !allowFixture) continue;
    const tables = findTableCandidates(document, profile);
    // A broad fallback must not choose a nested/ambiguous table by accident.
    if (tables.length !== 1) continue;
    const table = tables[0]!;
    // An empty flex board may legitimately have zero height before the flop.
    const boards = visibleBoards(table, profile);
    if (boards.length !== 1) continue;
    const boardElement = boards[0]!;
    const board = visibleCards(boardElement, profile, cache)
      .map((element, index) => describe(element, `board-${index}`, profile, cache));
    // Unsupported multiple boards, partially rendered identities, and alternate street shapes fail open.
    if (![0, 3, 4, 5].includes(board.length) || board.some((card) => !card.identity)) continue;
    const seatElements = Array.from(table.querySelectorAll<HTMLElement>(profile.seat))
      .filter((element) => !element.closest(OWNED_SELECTOR) && isPainted(element));
    if (seatElements.length < 2 || seatElements.length > 10) continue;
    const holes: VisualCard[] = [];
    let supported = true;
    seatElements.forEach((seat, seatIndex) => {
      const elements = visibleCards(seat, profile, cache).filter((card) => !boardElement.contains(card));
      // Omaha / partially observed seats are unsupported rather than coerced into two-card dealing.
      if (elements.length !== 0 && elements.length !== 2) supported = false;
      elements.forEach((element, cardIndex) => holes.push(describe(element, `seat-${seatIndex}-card-${cardIndex}`, profile, cache, `seat-${seatIndex}`, cardIndex)));
    });
    if (!supported) continue;
    return { table, boardElement, profile: profile.id, bounds: rectangle(table), board, holes, seats: seatElements.map(rectangle) };
  }
  return undefined;
}
