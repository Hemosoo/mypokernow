/**
 * Everything the extension knows about PokerNow's markup lives in this folder.
 *
 * The `pokernow` profile follows the table the site actually renders: seats
 * are `.table-player.table-player-N`, each card is a `.card-container` holding
 * a `.front` (the printed back) and a `.card` (the face) with `.value` and
 * `.suit` text, and a container gains `.flipped` when its face is showing.
 * The `fixture` profile is an explicit, offline-only markup for unit tests.
 */
export interface SelectorProfile {
  id: 'fixture' | 'pokernow';
  table: string;
  board: string;
  seat: string;
  card: string;
  rank: string;
  suit: string;
  /** Marks a card whose back is showing. Used by profiles without `faceUp`. */
  faceDown: string;
  /** Marks a card whose face is showing. When set, a card without it is a back. */
  faceUp?: string;
  /** Cards the site keeps in the page but does not paint. */
  unpainted?: string;
  /** Containers of hole cards the site has faded out (a folded opponent). */
  hiddenHand?: string;
  /**
   * Site-rendered rank and suit text may be restyled by the skin, so identity
   * is taken from the face-up card's own text rather than from computed ink.
   */
  trustFaceText: boolean;
  /** Community cards are public the moment the site adds them, before its own flip. */
  boardIsPublic: boolean;
}

export const selectorProfiles: readonly SelectorProfile[] = [
  {
    id: 'fixture', table: '[data-pnc-table]', board: '[data-pnc-board]',
    seat: '[data-pnc-seat]', card: '[data-pnc-card]',
    rank: '[data-pnc-rank]', suit: '[data-pnc-suit]',
    faceDown: '.face-down, .card-back', trustFaceText: false, boardIsPublic: false,
  },
  {
    id: 'pokernow', table: '.table',
    board: '.table-cards',
    seat: '.table-player:not(.table-player-seat)',
    card: '.card-container', rank: '.value', suit: '.suit:not(.sub-suit)',
    faceDown: '.card-container:not(.flipped)', faceUp: '.flipped',
    unpainted: '.not-visible', hiddenHand: '.table-player-cards.hide-cards',
    trustFaceText: true, boardIsPublic: true,
  },
];

export const OWNED_SELECTOR = '[data-pnc-overlay], [data-pnc-owned]';
