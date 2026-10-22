/** Candidate legacy markup is deliberately isolated here; it is not verified live. */
export interface SelectorProfile {
  id: 'fixture' | 'legacy-candidate';
  table: string;
  board: string;
  seat: string;
  card: string;
  rank: string;
  suit: string;
  faceDown: string;
}

export const selectorProfiles: readonly SelectorProfile[] = [
  {
    id: 'fixture', table: '[data-pnc-table]', board: '[data-pnc-board]',
    seat: '[data-pnc-seat]', card: '[data-pnc-card]',
    rank: '[data-pnc-rank]', suit: '[data-pnc-suit]',
    faceDown: '.face-down, .card-back',
  },
  {
    id: 'legacy-candidate', table: '#table, .table',
    // Corroborated public adapters; these remain candidates until live verification.
    board: '.table-cards, .community-cards, .table-community-cards, .board-cards',
    seat: '.table-player:not(.table-player-seat)',
    card: '.card-container, .card', rank: '.value', suit: '.suit',
    faceDown: '.card-back, .back, .flipped, .face-down, .facedown',
  },
];

export const OWNED_SELECTOR = '[data-pnc-overlay], [data-pnc-owned]';
