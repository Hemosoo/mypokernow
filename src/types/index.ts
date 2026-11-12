export type Street = 'deal' | 'flop' | 'turn' | 'river';
export type VisualEventType = 'TABLE_READY' | 'HAND_VISUAL_RESET' | 'HOLE_CARDS_APPEARED' | 'FLOP_REVEALED' | 'TURN_REVEALED' | 'RIVER_REVEALED';
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export interface CardIdentity {rank: Rank; suit: Suit}
export interface Rect {x: number; y: number; width: number; height: number}
export interface Point3 {x: number; y: number; z?: number}
export interface VisualCard {id: string; identity?: CardIdentity; target: Rect; source?: HTMLElement; seatId?: string; round?: number}
export interface VisualEvent {id: string; type: VisualEventType; cards: VisualCard[]; origin: Point3; timestamp: number; seats?: Rect[]}
export interface ParameterSchema {key: string; label: string; min: number; max: number; step: number; default: number; unit?: string}
export interface CardAppearance {
  aura: { enabled: boolean; color: string; strength: number };
  face: 'classic' | 'modern' | 'midnight' | 'native';
  back: 'crosshatch' | 'diamonds' | 'solid' | 'image'; backColor: string; backImage?: string;
  faceColor: string; redColor: string; blackColor: string; borderColor: string; borderRadius: number; shadow: number;
}
export type TableEmblem = 'spade' | 'crown' | 'laurel' | 'none';
export interface TableAppearance {
  feltColor: string; railColor: string; backgroundColor: string; backgroundImage?: string;
  /** Polished metal used for the table inlay, plates, chips and every accent. */
  trimColor: string;
  /** Optional words set into the felt beneath the board. */
  inscription: string;
  emblem: TableEmblem;
}
export interface BoardAppearance {color: string; highlight: string; spacing: number; shadow: number}
export interface AnimationAssignment {preset: string; parameters: Record<string, number>}
export interface Theme {
  version: 2; id: string; name: string; createdAt: string; updatedAt: string;
  card: CardAppearance; table: TableAppearance; board: BoardAppearance; animations: Record<Street, AnimationAssignment>;
}
/** Live-table flourishes. Each can be switched off without affecting the skin itself. */
export interface EffectSettings {
  /** Chip stacks for bets and the pot, and the chip movement between them. */
  chips: boolean;
  /** Winner celebrations, scaled to the size of the pot. */
  celebrations: boolean;
  /** Turn light, all-in beat, fold muck and time-pressure cue. */
  moments: boolean;
  /** Drifting light motes above the felt. */
  ambience: boolean;
}
export interface Settings {enabled: boolean; reducedMotion: boolean; speed: number; activeThemeId: string; effects: EffectSettings}
export interface Library {version: 2; settings: Settings; themes: Theme[]}
export const streetForEvent = (type: VisualEventType): Street | undefined => ({HOLE_CARDS_APPEARED: 'deal', FLOP_REVEALED: 'flop', TURN_REVEALED: 'turn', RIVER_REVEALED: 'river'} as Partial<Record<VisualEventType, Street>>)[type];
export const eventForStreet: Record<Street, VisualEventType> = {deal: 'HOLE_CARDS_APPEARED', flop: 'FLOP_REVEALED', turn: 'TURN_REVEALED', river: 'RIVER_REVEALED'};
