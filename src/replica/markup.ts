/**
 * A local stand-in for PokerNow's table markup.
 *
 * The class names and nesting mirror what the real game renders (seats, cards,
 * pot, dealer button, action bar) so the skin, the adapter and the stage can be
 * developed and tested without a live game. Like React, `renderReplica` keeps
 * DOM nodes stable between updates and only patches what changed.
 */

export type CardCode = string; // rank + suit, e.g. "Ah", "Td"

export interface ReplicaCard {
  value?: CardCode;
  flipped?: boolean;
  up?: boolean;
  hide?: boolean;
  sneak?: boolean;
}

export interface ReplicaSeat {
  /** Visual position 1–10 (1 is bottom centre-right, counting clockwise). */
  position: number;
  id: string;
  name: string;
  stack: number;
  bet?: number | 'check';
  cards?: ReplicaCard[];
  you?: boolean;
  deciding?: boolean;
  winner?: boolean;
  folded?: boolean;
  offline?: boolean;
  away?: boolean;
  gained?: number;
  handMessage?: string;
  /** Remaining time as percentages of the action bar: [normal, bank]. */
  timer?: { normal: number; bank: number; red?: boolean };
  chat?: string;
}

export interface ReplicaDecisions {
  /** Highlighted (attention) state when it is the local player's turn. */
  attention: boolean;
  buttons: { label: string; kind: 'check' | 'call' | 'raise' | 'fold' | 'bet'; color: 'green' | 'red' | 'gray' | 'blue'; disabled?: boolean }[];
}

export interface ReplicaState {
  orientation: 'landscape' | 'portrait';
  seats: ReplicaSeat[];
  /** Open seat positions rendered as "sit" placeholders. */
  openSeats?: number[];
  board: ReplicaCard[];
  pot: number;
  fullPot?: number;
  dealer?: number;
  blinds: [number, number];
  owner?: string;
  decisions?: ReplicaDecisions;
  fourColor?: boolean;
}

interface VNode {
  tag: string;
  key: string;
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
  children?: VNode[];
}

const keys = new WeakMap<Element, string>();
const h = (tag: string, key: string, className?: string, content?: string | VNode[], attrs?: Record<string, string>): VNode =>
  ({ tag, key, className, ...(typeof content === 'string' ? { text: content } : { children: content ?? [] }), ...(attrs ? { attrs } : {}) });

function patch(parent: Element, next: VNode[]): void {
  const document = parent.ownerDocument;
  const existing = new Map<string, Element>();
  for (const child of Array.from(parent.children)) {
    const key = keys.get(child);
    if (key !== undefined) existing.set(key, child);
  }
  let reference: Element | null = parent.firstElementChild;
  while (reference && keys.get(reference) === undefined) reference = reference.nextElementSibling;
  for (const node of next) {
    let element = existing.get(node.key);
    if (element && element.tagName.toLowerCase() !== node.tag) element = undefined;
    if (!element) {
      element = document.createElement(node.tag);
      keys.set(element, node.key);
    } else existing.delete(node.key);
    if (element !== reference) parent.insertBefore(element, reference);
    else {
      reference = reference.nextElementSibling;
      while (reference && keys.get(reference) === undefined) reference = reference.nextElementSibling;
    }
    const className = (node.className ?? '').replace(/\s+/g, ' ').trim();
    if (element.className !== className) element.className = className;
    for (const [name, value] of Object.entries(node.attrs ?? {})) if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    if (node.text !== undefined) { if (element.textContent !== node.text) element.textContent = node.text; }
    else patch(element, node.children ?? []);
  }
  for (const stale of existing.values()) stale.remove();
}

export const formatChips = (value: number): string => Math.round(value).toLocaleString('en-US');
const chips = (key: string, value: number): VNode => h('span', key, 'chips-value', [h('span', 'n', 'normal-value', formatChips(value))]);

function card(key: string, value: ReplicaCard, className: string): VNode {
  const code = value.value;
  const flipped = Boolean(code && value.flipped);
  return h('div', key, `card-container ${code ? `card-${code[1]}` : ''} ${code ? `card-s-${code[0]}` : ''} ${flipped ? 'flipped' : ''} ${className}`, [
    h('div', 'flipper', 'card-flipper card-flipper-animated', [
      h('div', 'front', 'front'),
      h('div', 'card', 'card', code ? [
        h('span', 'value', 'value', code[0] === 'T' ? '10' : code[0]!),
        h('span', 'sub', 'suit sub-suit', code[1]!),
        h('span', 'suit', 'suit', code[1]!),
      ] : []),
    ]),
  ]);
}

function seat(player: ReplicaSeat): VNode {
  const cards = player.cards ?? [];
  // Opponents' folded hands are hidden; the local player's are dimmed instead.
  const renderCards = cards.length > 0 && !(player.folded && !player.you);
  const remaining = player.stack - (typeof player.bet === 'number' ? player.bet : 0);
  const stack: VNode[] = player.gained
    ? [chips('value', remaining - player.gained), h('span', 'prize', `table-player-stack-prize ${player.gained < 0 ? 'red' : ''}`, `${player.gained > 0 ? '+' : ''}${formatChips(player.gained)}`)]
    : remaining > 0 ? [chips('value', remaining)] : [h('span', 'allin', '', 'All In')];
  const children: VNode[] = [];
  if (player.bet !== undefined && !(player.folded && player.bet === 'check')) {
    children.push(h('p', 'bet', `table-player-bet-value ${player.bet === 'check' ? 'check' : ''}`, player.bet === 'check' ? 'check' : [chips('value', player.bet)]));
  }
  if (renderCards && (player.handMessage || player.away || player.offline)) {
    children.push(h('div', 'message', 'player-hand-message-ctn', [h('div', 'm', 'player-hand-message', [
      h('div', 'n', `name ${player.winner ? 'active' : ''}`, player.handMessage ?? (player.offline ? 'Offline' : 'Away')),
    ])]));
  }
  children.push(h('div', 'cards', `table-player-cards ${renderCards ? '' : 'hide-cards'} ${renderCards && player.folded ? 'hide' : ''}`,
    cards.map((value, index) => card(`hand-${index}`, value, `card-p${index + 1} ${value.sneak ? 'sneak' : ''} ${value.up ? 'up' : value.hide ? 'hide' : ''} med`))));
  if (!renderCards) {
    const status = player.folded ? ['fold', 'Fold'] : player.away ? ['standing-up', 'Away'] : ['waiting', 'Waiting'];
    children.push(h('p', 'status', `table-player-status-icon ${status[0]}`, status[1]!));
  }
  if (player.chat) children.push(h('p', 'chat', 'table-player-chat-message', player.chat));
  children.push(h('div', 'signals', 'player-table-signals-container bottom'));
  const info: VNode[] = [
    h('div', 'name', 'table-player-name', [h('span', 's', '', [h('a', 'a', '', player.name, { href: '#', target: '_blank' })])]),
    h('p', 'stack', 'table-player-stack', stack),
  ];
  if (player.timer) {
    info.push(h('div', 'timer', 'time-to-talk', [
      h('div', 'bank', `time-bank ${player.timer.red ? 'red' : ''}`, [], { style: `width:${player.timer.bank}%` }),
      h('div', 'normal', `normal-time ${player.timer.red ? 'red' : ''}`, [], { style: `width:${player.timer.normal}%` }),
    ]));
  }
  children.push(h('div', 'infos', 'table-player-infos-ctn', [h('div', 'c', 'infos-ctn-container', info)]));
  const className = `table-player table-player-${player.position} ${player.deciding ? 'decision-current' : ''} ${player.winner ? 'winner' : ''} ${player.folded ? 'fold' : ''} ${player.you ? 'you-player' : ''} ${player.offline ? 'offline' : ''}`;
  return h('div', `seat-${player.id}`, className, children);
}

function tree(state: ReplicaState): VNode[] {
  const seats: VNode[] = [];
  if (state.dealer) seats.push(h('div', 'dealer', `dealer-button-ctn dealer-position-${state.dealer}`, [h('div', 'b', 'button', 'Dealer')]));
  for (const player of state.seats) seats.push(seat(player));
  for (const position of state.openSeats ?? []) {
    seats.push(h('div', `open-${position}`, `table-player table-player-seat table-player-${position}`, [
      h('p', 'n', 'table-player-seat-position-number', String(position)),
      h('button', 'b', 'table-player-seat-button', 'Sit', { type: 'button' }),
    ]));
  }
  const table: VNode[] = [
    h('div', 'pot', 'table-pot-size', [
      h('div', 'main', 'main-value', [chips('value', state.pot)]),
      h('div', 'addon', `add-on-container ${state.fullPot !== undefined && state.fullPot !== state.pot ? '' : 'hidden'}`, [
        h('p', 'p', 'add-on', [h('small', 's', '', 'total'), chips('value', state.fullPot ?? state.pot)]),
      ]),
    ]),
    h('div', 'board', 'table-cards run-1', state.board.map((value, index) => card(`tc-${index}`, value, `big ${value.up ? 'up' : ''} ${value.hide ? 'semi-hide' : ''}`))),
    h('div', 'seats', 'seats', seats),
  ];
  const main: VNode[] = [
    h('div', 'top', 'top-buttons', [h('button', 'o', 'top-buttons-button options', 'Options', { type: 'button' })]),
    h('div', 'infos', 'game-infos', [
      ...(state.owner ? [h('p', 'owner', 'owner-table-name', `Owner: ${state.owner}`)] : []),
      h('div', 'blinds', 'blind-value-ctn', [h('div', 'b', 'blind-value', [
        h('span', 't', 'game-type-ctn', 'NLH'), h('span', 'tilde', 'blind-separator', '~'), chips('sb', state.blinds[0]), h('span', 'slash', 'blind-separator', '/'), chips('bb', state.blinds[1]),
      ])]),
    ]),
    h('div', 'table', 'table', table),
    h('div', 'chat', 'chat', [h('button', 'b', 'chat-new-message-button with-tip', 'Message', { type: 'button' })]),
  ];
  if (state.decisions) {
    main.push(h('div', 'decisions', `game-decisions-ctn ${state.decisions.attention ? '' : 'low'}`, [
      h('div', 'buttons', 'action-buttons', state.decisions.buttons.map((button) => h('button', button.kind,
        `button-1 action-button with-tip ${button.kind} ${button.color}`, button.label, { type: 'button', ...(button.disabled ? { disabled: '' } : {}) }))),
    ]));
  }
  return [h('div', 'canvas', '', [h('div', 'game', `game-main-container ${state.fourColor ? 'four-color' : 'two-color'}`, main)], { id: 'canvas' })];
}

/** Root font size follows the game canvas exactly as PokerNow computes it. */
export function fitReplica(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLElement>('#canvas');
  if (!canvas) return;
  const box = canvas.getBoundingClientRect();
  const stage = Math.min(box.height, 1.8 * box.width);
  const html = root.ownerDocument.documentElement;
  html.style.fontSize = `${0.032 * stage}px`;
  html.style.setProperty('--table-stage-offset', `${(box.height - stage) / 2}px`);
}

export function renderReplica(root: HTMLElement, state: ReplicaState): void {
  const html = root.ownerDocument.documentElement;
  if (!html.classList.contains(state.orientation)) {
    html.classList.remove('landscape', 'portrait');
    html.classList.add(state.orientation);
  }
  if (root.id !== 'main-container') root.id = 'main-container';
  patch(root, tree(state));
  fitReplica(root);
}
