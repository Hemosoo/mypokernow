import type { AnimationHandle } from '../animation/core/coordinator';
import type { SeatState, TableState } from '../adapter/pokernow/table-state';
import type { Rect, Settings, Theme, VisualEvent } from '../types';
import type { Choreography } from './plan';

/**
 * The contract between the shared Runtime and a table companion. It lives in a
 * file with no Three.js import, so the content script can talk to the puppy
 * module without bundling it; the module is loaded only when a theme asks for it.
 */

/** Lets a character reach chips or cards before they move. Never delays gameplay. */
export interface StageDirector {
  /** Milliseconds to hold swept bets in place before they slide to the pot. */
  collect(bets: { position: number; rect: Rect }[], pot: Rect | undefined): number;
  /** Milliseconds to hold folded cards before they are mucked. */
  fold(cards: Rect[], seat: SeatState | undefined): number;
  /** A bet has just been placed. */
  bet(seat: SeatState | undefined, at: Rect | undefined): void;
  /** Chips are flying from the pot to the winners. */
  award(winners: SeatState[], pot: Rect | undefined, tier: 'small' | 'medium' | 'big'): void;
  allIn(seat: SeatState | undefined): void;
  turn(seat: SeatState | undefined): void;
  newHand(): void;
}

export interface Companion {
  readonly director: StageDirector;
  configure(theme: Theme, settings: Settings): void;
  /** Latest reading of the table, or undefined when no table is recognised. */
  table(state: TableState | undefined): void;
  /**
   * A card animation has started; the companion follows its progress. `plan` is the
   * choreography the card preset is running. It is handed over explicitly because the
   * companion module is loaded separately and has its own copy of every module.
   */
  animation(handle: AnimationHandle, event: VisualEvent, plan?: Choreography): void;
  /** Window geometry changed (resize, scroll, zoom). */
  geometry(): void;
  dispose(): void;
  /** Read-only state for tests and diagnostics. */
  debug?(): { state: string; visible: boolean; renders: number; at: { x: number; y: number } };
}

export interface CompanionModule {
  /** Returns undefined when the browser cannot render the companion (no WebGL). */
  createCompanion(surface: HTMLElement, document: Document): Companion | undefined;
}
