import type { Rect } from '../types';
import type { SeatState, TableState } from '../adapter/pokernow/table-state';

/**
 * Table moments inferred by comparing two consecutive readings of the page.
 * They describe what the player has just watched happen; nothing here feeds
 * back into the game.
 */
export type TableAction =
  | { type: 'bet'; position: number; amount: number; added: number; first: boolean }
  | { type: 'check'; position: number }
  | { type: 'fold'; position: number; you: boolean; cards: Rect[] }
  | { type: 'all-in'; position: number }
  | { type: 'turn'; position: number; you: boolean }
  | { type: 'collect'; bets: { position: number; amount: number; rect: Rect }[] }
  | { type: 'award'; winners: number[]; pot: number; allIn: boolean }
  | { type: 'new-hand' };

const byPosition = (state: TableState): Map<number, SeatState> => new Map(state.seats.map((seat) => [seat.position, seat]));

export function diffTable(before: TableState, after: TableState): TableAction[] {
  const actions: TableAction[] = [];
  const previous = byPosition(before);
  const collected: { position: number; amount: number; rect: Rect }[] = [];
  const winners: number[] = [];
  const hadWinner = before.seats.some((seat) => seat.winner);
  const hasWinner = after.seats.some((seat) => seat.winner);

  // A cleared board, or winners stepping down, starts the next hand.
  if ((before.boardCount > 0 && after.boardCount === 0) || (hadWinner && !hasWinner)) actions.push({ type: 'new-hand' });

  for (const seat of after.seats) {
    const was = previous.get(seat.position);
    if (!was) continue; // A player who has just sat down has no history to compare.
    if (seat.folded && !was.folded) actions.push({ type: 'fold', position: seat.position, you: seat.you, cards: was.cards });
    if (seat.allIn && !was.allIn) actions.push({ type: 'all-in', position: seat.position });
    if (seat.bet !== undefined && seat.bet > 0 && (was.bet === undefined || seat.bet > was.bet)) {
      actions.push({ type: 'bet', position: seat.position, amount: seat.bet, added: seat.bet - (was.bet ?? 0), first: was.bet === undefined });
    }
    if (seat.check && !was.check) actions.push({ type: 'check', position: seat.position });
    if (was.bet !== undefined && was.bet > 0 && seat.bet === undefined && was.betRect) collected.push({ position: seat.position, amount: was.bet, rect: was.betRect });
    if (seat.winner && !was.winner) winners.push(seat.position);
    if (seat.deciding && !was.deciding) actions.push({ type: 'turn', position: seat.position, you: seat.you });
  }

  // Bets leave the felt together when a street closes or the hand is won.
  const potGrew = (after.pot ?? 0) >= (before.pot ?? 0);
  if (collected.length && (potGrew || winners.length)) actions.push({ type: 'collect', bets: collected });
  if (winners.length) {
    const swept = collected.reduce((sum, bet) => sum + bet.amount, 0);
    actions.push({ type: 'award', winners, pot: Math.max(before.pot ?? 0, after.pot ?? 0, (before.pot ?? 0) + swept),
      allIn: after.seats.some((seat) => seat.allIn) || before.seats.some((seat) => seat.allIn) });
  }
  return actions;
}

export type WinTier = 'small' | 'medium' | 'big';

/** How much ceremony a pot deserves, measured in big blinds. */
export function winTier(potInBigBlinds: number, allIn: boolean): WinTier {
  if (!Number.isFinite(potInBigBlinds)) return 'small';
  if (potInBigBlinds >= 80 || (allIn && potInBigBlinds >= 40)) return 'big';
  return potInBigBlinds >= 20 ? 'medium' : 'small';
}
