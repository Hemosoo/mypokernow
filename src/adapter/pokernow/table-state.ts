import type { CardIdentity, Rect } from '../../types';
import { OWNED_SELECTOR, selectorProfiles } from './selectors';
import { isPainted, rectangle, readVisibleIdentity } from './snapshot';

/**
 * What is happening at the table, read from what the page already shows:
 * who is to act, who has folded or won, the bets in front of each seat and
 * the pot. This drives presentation only (chips, light, celebrations).
 */
export interface SeatState {
  /** PokerNow's seat position, 1–10; stable for as long as the player sits there. */
  position: number;
  /** The seat's name plate. */
  plate: Rect;
  you: boolean;
  deciding: boolean;
  winner: boolean;
  folded: boolean;
  allIn: boolean;
  /** Chips committed this street, when the seat shows a bet. */
  bet?: number;
  betRect?: Rect;
  check: boolean;
  stack?: number;
  /** Face-down or face-up hole cards currently shown at the seat. */
  cards: Rect[];
  /** The player's clock has entered its warning phase. */
  urgent: boolean;
}

export interface TableState {
  table: Rect;
  seats: SeatState[];
  pot?: number;
  potRect?: Rect;
  bigBlind?: number;
  heroHand?: { position: number; hole: CardIdentity[]; board: CardIdentity[] };
  boardCount: number;
  board?: Rect;
}

/** "1,250", "12.50", "3.4k" → number. Returns undefined for anything else. */
export function parseChips(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const match = /(-?\d[\d,]*(?:\.\d+)?)\s*([kmb])?/i.exec(text.replace(/\s+/g, ' '));
  if (!match) return undefined;
  const value = Number(match[1]!.replace(/,/g, ''));
  if (!Number.isFinite(value)) return undefined;
  const scale = { k: 1e3, m: 1e6, b: 1e9 }[match[2]?.toLowerCase() ?? ''] ?? 1;
  return value * scale;
}

/**
 * Prefer the plain chip count. When the table is set to display big blinds the
 * site renders both forms and hides the plain one, which is the same number in
 * another unit rather than private information.
 */
function chipValue(container: Element | null): number | undefined {
  if (!container) return undefined;
  const plain = container.querySelector('.normal-value');
  return parseChips((plain ?? container).textContent);
}

function readSeat(element: HTMLElement): SeatState | undefined {
  const position = Number(/(?:^|\s)table-player-(\d+)(?:\s|$)/.exec(element.className)?.[1]);
  if (!Number.isInteger(position) || position < 1 || position > 10) return undefined;
  const plateElement = element.querySelector<HTMLElement>('.table-player-infos-ctn') ?? element;
  const betElement = element.querySelector<HTMLElement>('.table-player-bet-value');
  const stackElement = element.querySelector<HTMLElement>('.table-player-stack');
  const check = Boolean(betElement?.classList.contains('check'));
  const hand = element.querySelector<HTMLElement>('.table-player-cards:not(.hide-cards)');
  const cards = hand ? Array.from(hand.querySelectorAll<HTMLElement>('.card-container')).map(rectangle).filter((rect) => rect.width > 4 && rect.height > 4) : [];
  // The prize badge sits inside the stack; exclude it so the number read is the stack itself.
  const stackText = stackElement ? Array.from(stackElement.childNodes)
    .filter((node) => !(node.nodeType === 1 && (node as Element).classList.contains('table-player-stack-prize')))
    .map((node) => (node.nodeType === 1 ? ((node as Element).querySelector('.normal-value') ?? node).textContent : node.textContent) ?? '').join(' ') : '';
  return {
    position, plate: rectangle(plateElement),
    you: element.classList.contains('you-player'), deciding: element.classList.contains('decision-current'),
    winner: element.classList.contains('winner'), folded: element.classList.contains('fold'),
    allIn: /all\s*in/i.test(stackText),
    ...(betElement && !check ? { bet: chipValue(betElement) } : {}),
    ...(betElement ? { betRect: rectangle(betElement) } : {}),
    check, stack: parseChips(stackText), cards,
    urgent: Boolean(element.querySelector('.time-to-talk .red')),
  };
}

export function readTableState(table: HTMLElement): TableState | undefined {
  const document = table.ownerDocument;
  const seats = Array.from(table.querySelectorAll<HTMLElement>('.table-player:not(.table-player-seat)'))
    .filter((element) => !element.closest(OWNED_SELECTOR) && isPainted(element))
    .map(readSeat).filter((seat): seat is SeatState => Boolean(seat));
  const potElement = table.querySelector<HTMLElement>('.table-pot-size');
  const main = potElement?.querySelector<HTMLElement>('.main-value') ?? null;
  const blinds = Array.from(document.querySelectorAll('.blind-value:not(.ante) .chips-value'));
  const bigBlind = chipValue(blinds[blinds.length - 1] ?? null);
  const boards = Array.from(table.querySelectorAll<HTMLElement>('.table-cards'));
  const boardCards = boards.length === 1 ? Array.from(boards[0]!.querySelectorAll('.card-container:not(.not-visible)')) : [];
  const hero = table.querySelector<HTMLElement>('.table-player.you-player:not(.fold)');
  const profile = selectorProfiles.find(profile=>profile.id==='pokernow')!;
  const visible = (elements: Element[]): CardIdentity[] => elements.filter((element): element is HTMLElement=>element instanceof HTMLElement&&isPainted(element)).map(element=>readVisibleIdentity(element,profile)).filter((identity): identity is CardIdentity=>Boolean(identity));
  const hole=hero?visible(Array.from(hero.querySelectorAll('.table-player-cards:not(.hide-cards) .card-container'))):[];
  const board=visible(boardCards);
  const position=seats.find(seat=>seat.you&&!seat.folded)?.position;
  return {
    ...(position&&hole.length===2&&board.length===boardCards.length&&boards.length===1?{heroHand:{position,hole,board}}:{}),
    table: rectangle(table), seats,
    ...(main ? { pot: chipValue(main), potRect: rectangle(potElement!) } : {}),
    ...(bigBlind && bigBlind > 0 ? { bigBlind } : {}),
    boardCount: boardCards.length,
    ...(boards.length === 1 ? { board: rectangle(boards[0]!) } : {}),
  };
}
