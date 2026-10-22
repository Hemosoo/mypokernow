import type { VisualCard, VisualEvent, VisualEventType } from '../../types';
import type { TableSnapshot } from './snapshot';

export function cardSignature(card: VisualCard): string {
  return `${card.id}:${card.identity ? `${card.identity.rank}/${card.identity.suit}` : 'back'}`;
}

function samePrefix(before: VisualCard[], after: VisualCard[]): boolean {
  return before.every((card, index) => cardSignature(card) === cardSignature(after[index]!));
}

/** A pure visual differ. No table state, game rules, hidden cards, or networking. */
export class VisualDiffer {
  private previous: TableSnapshot | undefined;
  private generation = 0;
  private emitted = new Set<string>();
  private dealsObserved = false;

  baseline(): void {
    this.previous = undefined;
    this.dealsObserved = false;
    this.emitted.clear();
    this.generation++;
  }

  observe(snapshot: TableSnapshot, timestamp = Date.now()): VisualEvent[] {
    const previous = this.previous;
    this.previous = snapshot;
    const event = (type: VisualEventType, cards: VisualCard[]): VisualEvent | undefined => {
      const key = `${this.generation}:${type}:${cards.map(cardSignature).join('|')}`;
      if (this.emitted.has(key)) return undefined;
      this.emitted.add(key);
      // Bound memory even on very long sessions; generation resets normally keep this tiny.
      if (this.emitted.size > 64) this.emitted.delete(this.emitted.values().next().value!);
      return { id: key, type, cards, timestamp, seats: snapshot.seats,
        origin: { x: snapshot.bounds.x + snapshot.bounds.width * 0.5, y: snapshot.bounds.y + snapshot.bounds.height * 0.34, z: 0 } };
    };
    const result: VisualEvent[] = [];
    const push = (type: VisualEventType, cards: VisualCard[]) => {
      const next = event(type, cards);
      if (next) result.push(next);
    };
    if (!previous || previous.table !== snapshot.table) {
      if (previous) { this.generation++; this.emitted.clear(); }
      this.dealsObserved = snapshot.holes.length > 0;
      push('TABLE_READY', []);
      return result;
    }
    if (snapshot.board.length < previous.board.length ||
      (previous.holes.length > 0 && snapshot.holes.length === 0 && snapshot.board.length === 0)) {
      this.generation++;
      this.emitted.clear();
      this.dealsObserved = snapshot.holes.length > 0;
      push('HAND_VISUAL_RESET', []);
      return result;
    }
    if (previous.board.length <= snapshot.board.length && !samePrefix(previous.board, snapshot.board)) {
      // A replaced board prefix could be a rerender, replay, or missed hand: baseline only.
      this.generation++;
      this.emitted.clear();
      this.dealsObserved = snapshot.holes.length > 0;
      push('HAND_VISUAL_RESET', []);
      return result;
    }
    if (!this.dealsObserved && previous.holes.length === 0 && snapshot.holes.length >= 4 &&
      snapshot.holes.length === snapshot.seats.length * 2 && snapshot.board.length === 0) {
      this.dealsObserved = true;
      push('HOLE_CARDS_APPEARED', [...snapshot.holes].sort((a, b) => (a.round ?? 0) - (b.round ?? 0)));
    }
    if (previous.board.length === 0 && snapshot.board.length === 3) push('FLOP_REVEALED', snapshot.board);
    else if (previous.board.length === 3 && snapshot.board.length === 4) push('TURN_REVEALED', snapshot.board.slice(3));
    else if (previous.board.length === 4 && snapshot.board.length === 5) push('RIVER_REVEALED', snapshot.board.slice(4));
    // Other jumps deliberately establish the latest baseline without inventing missed events.
    return result;
  }
}
