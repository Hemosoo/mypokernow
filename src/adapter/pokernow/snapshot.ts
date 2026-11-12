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
  /** Where a dealt card should appear to come from, when the site shows a dealer button. */
  dealer?: Rect;
}

export type IdentityCache = WeakMap<HTMLElement, { identity: CardIdentity | undefined }>;

const isElement = (node: Node | null | undefined): node is HTMLElement => Boolean(node) && node!.nodeType === 1;
const styleOf = (element: Element): CSSStyleDeclaration => (element.ownerDocument.defaultView ?? window).getComputedStyle(element);

export function rectangle(element: Element): Rect {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

export function validRectangle(rect: Rect): boolean {
  return Object.values(rect).every(Number.isFinite) && rect.width >= 5 && rect.height >= 5;
}

/**
 * The override applies only to a previously observed source under our visibility lease.
 * `ownOpacity` is skipped for profiles whose cards may be mid entrance: the element's
 * ancestors must still be fully painted.
 */
export function isPainted(element: HTMLElement, leased = false, allowEmptyContainer = false, ownOpacity = true): boolean {
  if (!element.isConnected || (!allowEmptyContainer && !validRectangle(rectangle(element)))) return false;
  let current: HTMLElement | null = element;
  while (current) {
    const style = styleOf(current);
    const transparent = Number(style.opacity || 1) === 0 && (ownOpacity || current !== element);
    if (current.hidden || current.getAttribute('aria-hidden') === 'true' ||
      style.display === 'none' || style.contentVisibility === 'hidden' || transparent ||
      ((style.visibility === 'hidden' || style.visibility === 'collapse') && !(leased && current === element))) return false;
    if (/opacity\(\s*(?:0|0%)\s*\)/.test(style.filter)) return false;
    current = current.parentElement;
  }
  return true;
}

function hasVisibleFront(element: HTMLElement, requireOpaqueText = true): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    const transform = styleOf(current).transform;
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
  const color = styleOf(element).color;
  return color !== 'transparent' && !/^rgba\([^)]*,\s*0\s*\)$/.test(color);
}

function hasVisibleBack(element: HTMLElement, profile: SelectorProfile): boolean {
  // Where the site states which side is up, anything not face-up shows its back.
  if (profile.faceUp) return !element.matches(profile.faceUp);
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
  if (!hasVisibleFront(element) || Number.parseFloat(styleOf(element).fontSize) === 0) return '';
  let result = '';
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 3) result += child.textContent ?? '';
    else if (isElement(child) && isPainted(child)) result += visibleText(child);
  }
  return result.trim();
}

function parseIdentity(rankText: string, suitText: string): CardIdentity | undefined {
  const upper = rankText.trim().toUpperCase();
  const rank = upper === 'T' ? '10' : upper;
  if (!/^(?:[2-9]|10|J|Q|K|A)$/.test(rank)) return undefined;
  const suit = suits[suitText.trim().toLowerCase()];
  return suit ? { rank: rank as Rank, suit } : undefined;
}

/**
 * Identity of a card the player can already see.
 *
 * A card is read only when its face is showing, or (`publicCard`) when it is a
 * community card the site has just placed on the board and is turning over.
 * A face-down hole card carries no rank or suit in the page; nothing is guessed.
 */
export function readVisibleIdentity(element: HTMLElement, profile: SelectorProfile, publicCard = false): CardIdentity | undefined {
  if (profile.faceUp) {
    if (!element.matches(profile.faceUp) && !(publicCard && profile.boardIsPublic)) return undefined;
    const rankElement = element.querySelector<HTMLElement>(profile.rank);
    const suitElement = element.querySelector<HTMLElement>(profile.suit);
    if (!rankElement || !suitElement) return undefined;
    return parseIdentity(rankElement.textContent ?? '', suitElement.textContent ?? '');
  }
  if (element.matches(profile.faceDown)) return undefined;
  const rankElement = element.querySelector<HTMLElement>(profile.rank);
  const suitElement = element.querySelector<HTMLElement>(profile.suit);
  if (!rankElement || !suitElement || !isPainted(rankElement) || !isPainted(suitElement) ||
    rankElement.closest(profile.faceDown) || suitElement.closest(profile.faceDown) ||
    !hasVisibleFront(rankElement) || !hasVisibleFront(suitElement)) return undefined;
  let suitText = visibleText(suitElement);
  // A generated, visibly painted glyph is presentation too. Read its text, never hidden classes/data.
  if (!suits[suitText.toLowerCase()]) {
    const generated = (suitElement.ownerDocument.defaultView ?? window).getComputedStyle(suitElement, '::before').content;
    if (generated && generated !== 'none' && generated !== 'normal') suitText = generated.replace(/^["']|["']$/g, '').trim();
  }
  return parseIdentity(visibleText(rankElement), suitText);
}

function visibleCards(container: HTMLElement, profile: SelectorProfile, cache: IdentityCache): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(profile.card)).filter((element) => {
    if (element.closest(OWNED_SELECTOR)) return false;
    if (profile.unpainted && element.matches(profile.unpainted)) return false;
    if (profile.hiddenHand && element.closest(profile.hiddenHand)) return false;
    const leased = element.getAttribute('data-pnc-concealed') === 'true' && cache.has(element);
    return isPainted(element, leased, false, !profile.trustFaceText);
  });
  // A .card-container and its inner .card are one logical card. Lease the
  // painted wrapper when available so both its front and back are concealed.
  return candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
}

/** Linear part of an element's computed transform: [a, b, c, d]. Translation is irrelevant here. */
function linearTransform(element: Element): [number, number, number, number] {
  const value = styleOf(element).transform;
  if (!value || value === 'none') return [1, 0, 0, 1];
  const numbers = value.slice(value.indexOf('(') + 1, -1).split(',').map(Number);
  if (value.startsWith('matrix3d(') && numbers.length === 16) return [numbers[0]!, numbers[1]!, numbers[4]!, numbers[5]!];
  if (value.startsWith('matrix(') && numbers.length === 6) return [numbers[0]!, numbers[1]!, numbers[2]!, numbers[3]!];
  return [1, 0, 0, 1];
}

/**
 * Where a card actually rests: its own box (not the larger bounding box of a
 * tilted card), centred where it is painted, plus its tilt. PokerNow fans hole
 * cards at ±7°; animations must land on that exact pose or they visibly snap.
 */
export function restingPose(element: HTMLElement): { target: Rect; rotation: number } {
  const box = rectangle(element);
  let [a, b, c, d] = [1, 0, 0, 1];
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const [e, f, g, h] = linearTransform(current);
    // Ancestor transforms apply after the element's own: M = T_ancestor · M.
    [a, b, c, d] = [e * a + g * b, f * a + h * b, e * c + g * d, f * c + h * d];
  }
  const rotation = Math.atan2(b, a) * 180 / Math.PI;
  const width = element.offsetWidth * Math.hypot(a, b), height = element.offsetHeight * Math.hypot(c, d);
  if (!(width > 4 && height > 4) || !Number.isFinite(rotation)) return { target: box, rotation: 0 };
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  return { target: { x: cx - width / 2, y: cy - height / 2, width, height }, rotation: Math.abs(rotation) < 0.05 ? 0 : rotation };
}

function describe(element: HTMLElement, id: string, profile: SelectorProfile, cache: IdentityCache, publicCard: boolean, seatId?: string, round?: number): VisualCard {
  const leased = element.getAttribute('data-pnc-concealed') === 'true' && cache.has(element);
  // Reusing only previously visible identity prevents a newer hidden value being inspected during a lease.
  const identity = leased ? cache.get(element)?.identity : readVisibleIdentity(element, profile, publicCard);
  if (!leased) cache.set(element, { identity });
  const pose = profile.id === 'pokernow' ? restingPose(element) : { target: rectangle(element), rotation: 0 };
  const fourColor = profile.id === 'pokernow' && Boolean(element.closest('.four-color'));
  return { id, identity, target: pose.target, source: element, seatId, round,
    ...(pose.rotation ? { rotation: pose.rotation } : {}), ...(fourColor ? { fourColor } : {}) };
}

function visibleBoards(table: HTMLElement, profile: SelectorProfile): HTMLElement[] {
  const candidates = Array.from(table.querySelectorAll<HTMLElement>(profile.board))
    .filter((element) => !element.closest(OWNED_SELECTOR) && isPainted(element, false, true));
  // Nested aliases may describe the same board. Distinct sibling boards still
  // produce multiple candidates and retain the animation fail-open guard.
  return candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
}

export function visibleSeats(table: HTMLElement, profile: SelectorProfile): HTMLElement[] {
  return Array.from(table.querySelectorAll<HTMLElement>(profile.seat))
    .filter((element) => !element.closest(OWNED_SELECTOR) && isPainted(element));
}

/** Resolve nested #table/.table aliases without choosing between independent tables. */
export function findTableCandidates(document: Document, profile: SelectorProfile): HTMLElement[] {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(profile.table))
    .filter((element) => !element.closest(OWNED_SELECTOR) && isPainted(element));
  const roots = candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
  return roots.flatMap((root) => {
    const aliases = candidates.filter((element) => element === root || root.contains(element));
    const coherent = aliases.filter((element) => visibleBoards(element, profile).length > 0 && visibleSeats(element, profile).length > 0);
    const choices = coherent.length ? coherent : aliases;
    return choices.filter((element) => !choices.some((other) => other !== element && element.contains(other)));
  });
}

/** The single supported table and the profile that recognised it, if any. */
export function locateTable(document: Document, allowFixture = false): { table: HTMLElement; profile: SelectorProfile } | undefined {
  for (const profile of selectorProfiles) {
    if (profile.id === 'fixture' && !allowFixture) continue;
    const tables = findTableCandidates(document, profile);
    if (tables.length === 1) return { table: tables[0]!, profile };
  }
  return undefined;
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
    const seats = visibleSeats(table, profile);
    const describeSafeCards = (container: HTMLElement, prefix: string, publicCard: boolean): VisualCard[] =>
      visibleCards(container, profile, cache).map((element, index) => describe(element, `${prefix}-${index}`, profile, cache, publicCard))
        .filter((card) => Boolean(card.identity) || Boolean(card.source && hasVisibleBack(card.source, profile)));
    return {
      table, boardElement, profile: profile.id, bounds: rectangle(table),
      board: boardElement ? describeSafeCards(boardElement, 'board', true) : [],
      holes: seats.flatMap((seat, index) => describeSafeCards(seat, `seat-${index}-card`, false)
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
      .map((element, index) => describe(element, `board-${index}`, profile, cache, true));
    // Unsupported multiple boards, partially rendered identities, and alternate street shapes fail open.
    if (![0, 3, 4, 5].includes(board.length) || board.some((card) => !card.identity)) continue;
    const seatElements = visibleSeats(table, profile);
    if (seatElements.length < 2 || seatElements.length > 10) continue;
    const holes: VisualCard[] = [];
    let supported = true;
    seatElements.forEach((seat, seatIndex) => {
      const elements = visibleCards(seat, profile, cache).filter((card) => !boardElement.contains(card));
      // Omaha / partially observed seats are unsupported rather than coerced into two-card dealing.
      if (elements.length !== 0 && elements.length !== 2) supported = false;
      elements.forEach((element, cardIndex) => holes.push(describe(element, `seat-${seatIndex}-card-${cardIndex}`, profile, cache, false, `seat-${seatIndex}`, cardIndex)));
    });
    if (!supported) continue;
    const button = profile.id === 'pokernow' ? table.querySelector<HTMLElement>('.dealer-button-ctn:not(.live-straddle) .button') : null;
    const dealer = button && isPainted(button) ? rectangle(button) : undefined;
    return { table, boardElement, profile: profile.id, bounds: rectangle(table), board, holes, seats: seatElements.map(rectangle), ...(dealer ? { dealer } : {}) };
  }
  return undefined;
}
