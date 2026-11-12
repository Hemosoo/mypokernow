import { renderReplica, type ReplicaCard, type ReplicaSeat, type ReplicaState } from './markup';

/**
 * A scripted hand played on the replica table. It changes the markup the way
 * the real game does (classes toggled in place, board cards added face down
 * then turned a beat apart), which makes it both the studio's live demo and
 * the fixture the browser tests drive.
 */
const NAMES = ['You', 'Maya', 'Alex', 'Jordan', 'Riley', 'Sam', 'Casey', 'Avery', 'Morgan', 'Quinn'];
const LAYOUTS: Record<number, number[]> = {
  2: [1, 6], 3: [1, 4, 8], 4: [1, 3, 6, 9], 5: [1, 3, 5, 7, 9], 6: [1, 2, 4, 6, 8, 9],
  7: [1, 2, 3, 5, 6, 8, 9], 8: [1, 2, 3, 4, 6, 7, 8, 9], 9: [1, 2, 3, 4, 5, 6, 7, 8, 9], 10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};
const BOARD = ['As', 'Kh', '7c', 'Qd', '8h'];
const HERO = ['Ah', 'Jh'];
const VILLAIN = ['Kd', 'Qs'];

export type Street = 'deal' | 'flop' | 'turn' | 'river';

export class Scenario {
  state: ReplicaState;
  private token = 0;
  private hand = 0;

  constructor(private readonly root: HTMLElement, players = 6, orientation: ReplicaState['orientation'] = 'landscape') {
    this.state = this.fresh(players, orientation);
  }

  private fresh(players: number, orientation: ReplicaState['orientation']): ReplicaState {
    const count = Math.min(10, Math.max(2, Math.round(players)));
    const positions = LAYOUTS[count]!;
    const seats: ReplicaSeat[] = positions.map((position, index) => ({
      position, id: `p${index}`, name: NAMES[index]!, stack: [2480, 1815, 2940, 3260, 2000, 1500, 5120, 2210, 1975, 2650][index]!, you: index === 0,
    }));
    return { orientation, blinds: [10, 20], owner: 'The House', pot: 0, board: [], seats, dealer: positions[positions.length - 1], openSeats: [] };
  }

  render(): void { renderReplica(this.root, this.state); }
  get players(): number { return this.state.seats.length; }

  /** Cancel anything in progress; the table stays as it is. */
  stop(): void { this.token++; }

  setPlayers(players: number): void {
    this.stop();
    this.state = this.fresh(players, this.state.orientation);
    this.render();
  }

  setOrientation(orientation: ReplicaState['orientation']): void {
    this.state.orientation = orientation;
    this.render();
  }

  private sleep(ms: number, token: number): Promise<boolean> {
    return new Promise((resolve) => setTimeout(() => resolve(token === this.token), ms));
  }

  private seat(index: number): ReplicaSeat { return this.state.seats[index % this.state.seats.length]!; }

  /** Clear the felt for a new hand without dealing. */
  clear(): void {
    for (const seat of this.state.seats) {
      Object.assign(seat, { bet: undefined, cards: undefined, deciding: false, winner: false, folded: false, gained: undefined, handMessage: undefined, timer: undefined });
    }
    this.state.board = [];
    this.state.pot = 0;
    this.state.fullPot = undefined;
    this.state.decisions = undefined;
  }

  /** Put the table at rest just before a street, so that street can be shown on its own. */
  prepare(street: Street): void {
    this.stop();
    this.clear();
    const dealt = street !== 'deal';
    if (dealt) this.giveCards();
    const count = street === 'turn' ? 3 : street === 'river' ? 4 : 0;
    this.state.board = BOARD.slice(0, count).map((value) => ({ value, flipped: true }));
    this.state.pot = street === 'deal' ? 0 : street === 'flop' ? 180 : street === 'turn' ? 460 : 900;
    this.render();
  }

  private giveCards(): void {
    this.state.seats.forEach((seat, index) => {
      seat.cards = index === 0 ? HERO.map((value) => ({ value, flipped: true })) : [{}, {}];
    });
  }

  /** Reveal one street exactly as the site does: cards arrive face down, then turn 150 ms apart. */
  async reveal(street: Street, runningToken?: number): Promise<void> {
    const token = runningToken ?? ++this.token;
    if (street === 'deal') { this.giveCards(); this.render(); return; }
    const range = street === 'flop' ? [0, 3] : street === 'turn' ? [3, 4] : [4, 5];
    const added: ReplicaCard[] = BOARD.slice(range[0], range[1]).map((value) => ({ value, flipped: false }));
    this.state.board = [...this.state.board.slice(0, range[0]), ...added];
    this.render();
    for (const card of added) {
      if (!await this.sleep(150, token)) return;
      card.flipped = true;
      this.render();
    }
  }

  /** A complete hand: blinds, deal, three streets of betting, an all-in and a showdown. */
  async playHand(pace = 1): Promise<boolean> {
    const token = ++this.token;
    const wait = (ms: number): Promise<boolean> => this.sleep(ms / pace, token);
    const state = this.state, n = state.seats.length;
    const step = async (ms: number, change: () => void): Promise<boolean> => { change(); this.render(); return wait(ms); };
    const act = async (index: number, ms: number, change: (seat: ReplicaSeat) => void): Promise<boolean> => {
      const seat = this.seat(index);
      for (const other of state.seats) { other.deciding = false; other.timer = undefined; }
      seat.deciding = true;
      seat.timer = { normal: 70, bank: 20 };
      state.decisions = seat.you ? { attention: true, buttons: [{ label: 'Check', kind: 'check', color: 'green' }, { label: 'Raise', kind: 'raise', color: 'green' }, { label: 'Fold', kind: 'fold', color: 'red' }] } : undefined;
      this.render();
      if (!await wait(ms)) return false;
      change(seat);
      seat.deciding = false;
      seat.timer = undefined;
      state.decisions = undefined;
      this.render();
      return wait(260);
    };
    const sweep = async (): Promise<boolean> => step(700, () => {
      for (const seat of state.seats) {
        if (typeof seat.bet === 'number') { state.pot += seat.bet; seat.stack -= seat.bet; }
        seat.bet = undefined;
      }
    });

    // New hand: the button moves on, everything is cleared.
    this.hand++;
    const dealerIndex = (this.hand + n - 1) % n;
    const sb = dealerIndex + 1, bb = dealerIndex + 2;
    if (!await step(650, () => { this.clear(); state.dealer = this.seat(dealerIndex).position; })) return false;
    if (!await step(450, () => { this.seat(sb).bet = 10; this.seat(bb).bet = 20; })) return false;
    if (!await step(1900, () => this.giveCards())) return false;

    // Pre-flop.
    const order = Array.from({ length: n }, (_, index) => bb + 1 + index);
    const villain = order.find((index) => index % n !== 0) ?? 1;
    for (const index of order) {
      const seat = this.seat(index);
      if (seat.folded) continue;
      const isVillain = index % n === villain % n, isHero = seat.you;
      const fold = !isVillain && !isHero && (index % 3 === 0) && n > 3;
      if (!await act(index, isHero ? 1100 : 620, (target) => { if (fold) target.folded = true; else target.bet = isVillain ? 60 : Math.max(typeof target.bet === 'number' ? target.bet : 0, isHero ? 60 : 20); })) return false;
    }
    for (const seat of state.seats) if (!seat.folded && typeof seat.bet === 'number' && seat.bet < 60) seat.bet = 60;
    this.render();
    if (!await wait(380) || !await sweep()) return false;

    // Flop.
    await this.reveal('flop', token);
    if (token !== this.token || !await wait(2100)) return false;
    const live = (): number[] => order.filter((index) => !this.seat(index).folded);
    for (const index of live()) {
      const seat = this.seat(index), isVillain = index % n === villain % n;
      if (!await act(index, seat.you ? 1000 : 560, (target) => { if (isVillain) target.bet = 140; else if (target.you) target.bet = 140; else if (live().length > 3) target.folded = true; else target.bet = 'check'; })) return false;
    }
    for (const seat of state.seats) if (seat.bet === 'check') seat.bet = undefined;
    this.render();
    if (!await wait(320) || !await sweep()) return false;

    // Turn.
    await this.reveal('turn', token);
    if (token !== this.token || !await wait(1500)) return false;
    for (const index of live()) {
      const seat = this.seat(index), isVillain = index % n === villain % n;
      if (!await act(index, seat.you ? 1000 : 600, (target) => { if (isVillain || target.you) target.bet = 320; else target.folded = true; })) return false;
    }
    if (!await wait(320) || !await sweep()) return false;

    // River: the villain shoves, the hero calls.
    await this.reveal('river', token);
    if (token !== this.token || !await wait(2300)) return false;
    const villainSeat = this.seat(villain), hero = state.seats[0]!;
    if (!await act(villain, 900, (target) => { target.bet = target.stack; })) return false;
    if (!await act(0, 1500, (target) => { target.bet = Math.min(target.stack, villainSeat.stack); })) return false;
    if (!await sweep()) return false;

    // Showdown.
    const prize = state.pot;
    if (!await step(900, () => {
      villainSeat.cards = VILLAIN.map((value) => ({ value, flipped: true, hide: value !== 'Kd' }));
      villainSeat.handMessage = 'Two Pair';
      hero.handMessage = 'Two Pair';
    })) return false;
    if (!await step(4200, () => {
      hero.winner = true;
      hero.gained = prize;
      hero.stack += prize;
      hero.cards = HERO.map((value) => ({ value, flipped: true, up: value === 'Ah', hide: value !== 'Ah' }));
      state.board = state.board.map((card) => ({ ...card, up: card.value === 'As' || card.value === '8h' ? true : undefined, hide: !(card.value === 'As' || card.value === '8h') }));
      state.board[4] = { ...state.board[4]!, up: false, hide: true };
      state.board[0] = { ...state.board[0]!, up: true, hide: false };
    })) return false;
    // Stacks reset so the demo can run forever without anyone going broke.
    const reset = this.fresh(n, state.orientation);
    state.seats.forEach((seat, index) => { seat.stack = reset.seats[index]!.stack; });
    return true;
  }
}
