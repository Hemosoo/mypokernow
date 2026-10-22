import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { VisualDiffer } from '../src/adapter/pokernow/diff';
import { takePresentationSnapshot, takeSnapshot as extractSnapshot, type IdentityCache, type TableSnapshot } from '../src/adapter/pokernow/snapshot';
import { PokerNowAdapter } from '../src/adapter/pokernow';
import { StyleLedger, TablePresentation } from '../src/content/presentation';
import { AnimationCoordinator, type AnimationHandle } from '../src/animation/core/coordinator';
import { createDefaultTheme } from '../src/themes/defaults';
import type { CardIdentity, VisualEventType } from '../src/types';

const { JSDOM } = createRequire(import.meta.url)('jsdom');
const takeSnapshot = (doc: Document, cache?: IdentityCache) => extractSnapshot(doc, cache, true);
const identities: CardIdentity[] = [
  { rank: 'A', suit: 'spades' }, { rank: '8', suit: 'hearts' },
  { rank: 'K', suit: 'clubs' }, { rank: '3', suit: 'diamonds' }, { rank: 'Q', suit: 'hearts' },
];
const table = {} as HTMLElement;
function snapshot(count = 0, holes = 0): TableSnapshot {
  return {
    table, boardElement: {} as HTMLElement, profile: 'fixture', bounds: { x: 20, y: 40, width: 900, height: 500 },
    seats: [{ x: 20, y: 20, width: 100, height: 80 }, { x: 300, y: 20, width: 100, height: 80 }],
    board: identities.slice(0, count).map((identity, index) => ({ id: `board-${index}`, identity, target: { x: index * 60, y: 200, width: 50, height: 70 } })),
    holes: Array.from({ length: holes }, (_, index) => ({ id: `seat-${Math.floor(index / 2)}-card-${index % 2}`, round: index % 2, target: { x: index * 20, y: 400, width: 50, height: 70 } })),
  };
}
const kinds = (events: { type: VisualEventType }[]) => events.map((event) => event.type);

test('first attachment mid-hand and equivalent DOM rerenders never replay historical reveals', () => {
  const differ = new VisualDiffer();
  assert.deepEqual(kinds(differ.observe(snapshot(3, 4))), ['TABLE_READY']);
  assert.deepEqual(differ.observe(snapshot(3, 4)), []);
  assert.deepEqual(kinds(differ.observe(snapshot(4, 4))), ['TURN_REVEALED']);
  assert.deepEqual(differ.observe(snapshot(4, 4)), []);
});

test('normal observed streets emit once with only newly exposed cards', () => {
  const differ = new VisualDiffer();
  differ.observe(snapshot());
  const deal = differ.observe(snapshot(0, 4));
  assert.deepEqual(kinds(deal), ['HOLE_CARDS_APPEARED']);
  assert.deepEqual(deal[0]!.cards.map((card) => card.round), [0, 0, 1, 1]);
  assert(deal[0]!.cards.every((card) => card.identity === undefined));
  assert.deepEqual(kinds(differ.observe(snapshot(3, 4))), ['FLOP_REVEALED']);
  assert.equal(differ.observe(snapshot(4, 4))[0]!.cards[0]!.identity!.rank, '3');
  assert.equal(differ.observe(snapshot(5, 4))[0]!.cards[0]!.identity!.rank, 'Q');
  assert.deepEqual(differ.observe(snapshot(5, 4)), []);
});

test('new visual generation can reveal the same card set; missed streets and showdown are skipped', () => {
  const differ = new VisualDiffer();
  differ.observe(snapshot());
  differ.observe(snapshot(3, 4));
  assert.deepEqual(kinds(differ.observe(snapshot())), ['HAND_VISUAL_RESET']);
  assert.deepEqual(kinds(differ.observe(snapshot(3, 4))), ['FLOP_REVEALED']);
  differ.baseline();
  differ.observe(snapshot());
  assert.deepEqual(differ.observe(snapshot(5, 4)), []);
  const showdown = snapshot(5, 4);
  showdown.holes[0]!.identity = identities[0];
  assert.deepEqual(differ.observe(showdown), []);
});

test('an incomplete formation never invents cards for ambiguous or delayed seats', () => {
  const differ = new VisualDiffer();
  const empty = snapshot();
  empty.seats.push({ x: 600, y: 20, width: 100, height: 80 });
  differ.observe(empty);
  const partial = snapshot(0, 4);
  partial.seats = empty.seats;
  assert.deepEqual(differ.observe(partial), []);
});

function installDom(): Document {
  const dom = new JSDOM('<!doctype html><html><body><div data-pnc-table><div data-pnc-board></div><div data-pnc-seat></div><div data-pnc-seat></div></div></body></html>', { url: 'https://fixture.test/', pretendToBeVisual: true });
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  });
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    const isTable = this.hasAttribute('data-pnc-table');
    return { x: 20, y: 30, left: 20, top: 30, width: isTable ? 800 : 50, height: isTable ? 500 : 70, right: 70, bottom: 100, toJSON: () => ({}) };
  };
  return dom.window.document;
}

function cardMarkup(rank: string, suit = '♥'): string {
  return `<div data-pnc-card><span data-pnc-rank>${rank}</span><span data-pnc-suit>${suit}</span></div>`;
}

test('fixture selectors require explicit offline opt-in', () => {
  const doc = installDom();
  assert.equal(extractSnapshot(doc), undefined);
  assert.equal(takeSnapshot(doc)!.profile, 'fixture');
});

test('table appearance works before players, a board, or a supported animation hand exists', () => {
  const doc = installDom();
  const table = doc.querySelector<HTMLElement>('[data-pnc-table]')!;
  table.replaceChildren();
  const presentation = new TablePresentation();
  const theme = createDefaultTheme();
  table.style.setProperty('background-color', 'red', 'important');
  let unsupported = 0;
  const adapter = new PokerNowAdapter({
    allowFixture: true, onEvent: () => assert.fail('an incomplete table must not emit game events'),
    onPresentation: (snapshot) => { if (snapshot) presentation.apply(snapshot, theme); else presentation.clear(); },
    onUnsupported: () => { unsupported++; },
  }, doc);
  try {
    adapter.start();
    assert.equal(takeSnapshot(doc), undefined, 'animation guards still reject incomplete game state');
    assert(unsupported > 0);
    assert.notEqual(table.style.backgroundColor, 'red');
    assert.equal(table.style.getPropertyPriority('background-color'), 'important', 'appearance overrides native important styles');
    adapter.stop();
    assert.equal(table.style.backgroundColor, 'red');
    assert.equal(table.style.getPropertyPriority('background-color'), 'important');
    assert.equal(doc.body.style.backgroundColor, '');
  } finally { adapter.stop(); presentation.clear(); }
});

test('partial streets receive safe artwork without guessing unreadable faces or blocking appearance', () => {
  const doc = installDom();
  const board = doc.querySelector('[data-pnc-board]')!;
  board.innerHTML = cardMarkup('A') + '<div data-pnc-card><span>Unknown native face</span></div>';
  const seat = doc.querySelector('[data-pnc-seat]')!;
  seat.innerHTML = '<div data-pnc-card class="face-down"><span data-pnc-rank style="display:none">Q</span><span data-pnc-suit>♠</span></div>';
  assert.equal(takeSnapshot(doc), undefined);
  const snapshot = takePresentationSnapshot(doc, new WeakMap(), true)!;
  assert.equal(snapshot.board.length, 1, 'only a genuinely readable face is replaced');
  assert.equal(snapshot.holes.length, 1, 'an explicit face-down presentation can receive custom back art');
  assert.equal(snapshot.holes[0]!.identity, undefined);
  const presentation = new TablePresentation();
  try {
    presentation.apply(snapshot, createDefaultTheme());
    assert(board.children[0]!.querySelector('[data-pnc-owned]'));
    assert.equal(board.children[1]!.querySelector('[data-pnc-owned]'), null);
    assert(seat.querySelector('[data-pnc-owned]'));
    assert.equal(doc.querySelectorAll('[data-pnc-owned]').length, 2);
  } finally {
    presentation.clear();
    assert.equal(doc.querySelectorAll('[data-pnc-owned]').length, 0);
  }
});

test('board and table replacements release previous appearance styles and artwork', () => {
  const doc = installDom();
  const theme = createDefaultTheme();
  const presentation = new TablePresentation();
  const before = doc.querySelector<HTMLElement>('[data-pnc-table]')!;
  doc.querySelector('[data-pnc-board]')!.innerHTML = cardMarkup('A');
  presentation.apply(takePresentationSnapshot(doc, new WeakMap(), true)!, theme);
  const oldBoard = doc.querySelector<HTMLElement>('[data-pnc-board]')!;
  const newBoard = doc.createElement('div');
  newBoard.dataset.pncBoard = '';
  oldBoard.replaceWith(newBoard);
  presentation.apply(takePresentationSnapshot(doc, new WeakMap(), true)!, theme);
  assert.equal(oldBoard.style.backgroundColor, '', 'removed board lease is restored even when the table stays mounted');
  assert.equal(oldBoard.querySelector('[data-pnc-owned]'), null);
  const after = before.cloneNode(true) as HTMLElement;
  after.removeAttribute('style');
  before.replaceWith(after);
  presentation.apply(takePresentationSnapshot(doc, new WeakMap(), true)!, theme);
  assert.equal(before.style.backgroundColor, '', 'removed table styles are restored');
  assert(after.style.backgroundColor);
  presentation.clear();
  assert.equal(after.style.backgroundColor, '');
});

function legacyCard(rank: string, suit = '♥'): string {
  return `<div class="card-container"><div class="card"><span class="value">${rank}</span><span class="suit">${suit}</span></div></div>`;
}

function legacyTable(boardClass = 'table-cards'): string {
  return `<div class="table"><div class="${boardClass}"></div><div class="table-player">${legacyCard('A')}${legacyCard('8')}</div><div class="table-player">${legacyCard('K')}${legacyCard('Q')}</div>${'<div class="table-player table-player-seat"></div>'.repeat(8)}</div>`;
}

test('corroborated candidate profile resolves nested aliases, wrapper cards, and empty seat placeholders', () => {
  const doc = installDom();
  doc.defaultView!.history.replaceState({}, '', '/games/candidate-profile');
  doc.body.innerHTML = `<div id="table">${legacyTable()}</div>`;
  const selected = extractSnapshot(doc)!;
  assert(selected);
  assert.equal(selected.profile, 'legacy-candidate');
  assert.equal(selected.table.className, 'table', 'nested aliases resolve the coherent inner table');
  assert.equal(selected.seats.length, 2, 'empty seat placeholders are not participating players');
  assert.equal(selected.holes.length, 4, 'a wrapper and face represent one card');
  assert(selected.holes.every((card) => card.source!.matches('.card-container')));
  assert.equal(selected.holes[0]!.identity!.rank, 'A');
  const events: VisualEventType[] = [];
  const adapter = new PokerNowAdapter({ onEvent: (event) => events.push(event.type) }, doc);
  try {
    adapter.start();
    doc.querySelector('.table-cards')!.innerHTML = legacyCard('A') + legacyCard('8') + legacyCard('K');
    adapter.scan();
    adapter.scan();
    assert.deepEqual(events, ['TABLE_READY', 'FLOP_REVEALED']);
  } finally { adapter.stop(); }
});

test('candidate board aliases stay scoped to one table and independent tables remain ambiguous', () => {
  const doc = installDom();
  for (const alias of ['table-community-cards', 'board-cards']) {
    doc.body.innerHTML = legacyTable(alias);
    assert.equal(extractSnapshot(doc)!.boardElement.className, alias);
  }
  doc.body.innerHTML = `<div id="table">${legacyTable()}${legacyTable()}</div>`;
  assert.equal(extractSnapshot(doc), undefined, 'two independent tables must never be merged');
  assert.equal(takePresentationSnapshot(doc), undefined, 'appearance also requires an unambiguous table');
  doc.body.innerHTML = `${legacyTable()}<div class="table"></div>`;
  assert.equal(takePresentationSnapshot(doc), undefined, 'a second unrecognized table must not be silently discarded');
});

test('wrapper transforms and face-down ancestors never turn hidden class values into visible identities', () => {
  const doc = installDom();
  doc.body.innerHTML = legacyTable();
  const cards = doc.querySelectorAll<HTMLElement>('.card-container');
  cards[0]!.style.transform = 'matrix3d(-1,0,0,0,0,1,0,0,0,0,-1,0,0,0,0,1)';
  cards[1]!.querySelector('.card')!.classList.add('face-down');
  const snapshot = extractSnapshot(doc)!;
  assert.equal(snapshot.holes[0]!.identity, undefined);
  assert.equal(snapshot.holes[1]!.identity, undefined);
  assert.equal(snapshot.holes[2]!.identity!.rank, 'K');
});

test('a visibly painted inner back gets custom artwork while unreadable and hidden back surfaces remain native', () => {
  const doc = installDom();
  doc.body.innerHTML = legacyTable();
  const seat = doc.querySelector('.table-player')!;
  seat.innerHTML = '<div class="card-container"><div class="card card-back"><span class="value" style="display:none">Q</span><span class="suit" style="display:none">♠</span></div></div>' +
    '<div class="card-container"><div class="card"><span>Unrecognized native face</span><div class="card-back" style="display:none"></div></div></div>' +
    '<div class="card-container"><div class="card"><span>Another native face</span><div class="card-back" style="transform:matrix3d(-1,0,0,0,0,1,0,0,0,0,-1,0,0,0,0,1)"></div></div></div>';
  const nativeCards = seat.querySelectorAll('.card-container');
  const snapshot = takePresentationSnapshot(doc)!;
  assert.equal(snapshot.holes.length, 3, 'one visible back and two readable cards from the other player are safe');
  assert.equal(snapshot.holes[0]!.identity, undefined, 'hidden rank and suit remain unread');
  const presentation = new TablePresentation();
  try {
    presentation.apply(snapshot, createDefaultTheme());
    assert(nativeCards[0]!.querySelector('[data-pnc-owned]'));
    assert.equal(nativeCards[1]!.querySelector('[data-pnc-owned]'), null);
    assert.equal(nativeCards[2]!.querySelector('[data-pnc-owned]'), null);
  } finally { presentation.clear(); }
});

test('a displayed empty zero-height board establishes a baseline before its first flop', () => {
  const doc = installDom();
  const board = doc.querySelector<HTMLElement>('[data-pnc-board]')!;
  board.getBoundingClientRect = () => ({ x: 20, y: 30, left: 20, top: 30, width: 200, height: 0, right: 220, bottom: 30, toJSON: () => ({}) });
  const before = takeSnapshot(doc)!;
  assert.equal(before.board.length, 0);
  board.innerHTML = cardMarkup('A') + cardMarkup('8') + cardMarkup('K');
  const differ = new VisualDiffer();
  differ.observe(before);
  assert.deepEqual(kinds(differ.observe(takeSnapshot(doc)!)), ['FLOP_REVEALED']);
});

test('DOM extractor reads only visibly painted rank/suit, never identity attributes or hidden descendants', () => {
  const doc = installDom();
  const seats = doc.querySelectorAll('[data-pnc-seat]');
  seats[0]!.innerHTML = `${cardMarkup('A<span style="display:none">K</span>')}${cardMarkup('8')}`;
  seats[1]!.innerHTML = '<div data-pnc-card data-rank="Q" data-suit="spades"><span data-pnc-rank style="display:none">Q</span><span data-pnc-suit>♠</span></div><div data-pnc-card></div>';
  const next = takeSnapshot(doc)!;
  assert.equal(next.holes.length, 4);
  assert.equal(next.holes[0]!.identity!.rank, 'A');
  assert.equal(next.holes[2]!.identity, undefined);
  assert.equal(next.holes[3]!.identity, undefined);
  (seats[0] as HTMLElement).style.opacity = '0';
  assert.equal(takeSnapshot(doc), undefined);
});

test('a conceal lease reuses only previously observed identity without inspecting new hidden values', () => {
  const doc = installDom();
  doc.querySelector('[data-pnc-board]')!.innerHTML = cardMarkup('A') + cardMarkup('8') + cardMarkup('K');
  const cache = new WeakMap<HTMLElement, { identity: CardIdentity | undefined }>();
  const first = takeSnapshot(doc, cache)!;
  const source = first.board[0]!.source!;
  source.setAttribute('data-pnc-concealed', 'true');
  source.style.setProperty('visibility', 'hidden', 'important');
  source.querySelector('[data-pnc-rank]')!.textContent = 'Q';
  assert.equal(takeSnapshot(doc, cache)!.board[0]!.identity!.rank, 'A');
  // A marker on an unobserved hidden card is not authorization to inspect it.
  assert.equal(takeSnapshot(doc, new WeakMap()), undefined);
  source.removeAttribute('data-pnc-concealed');
  source.style.removeProperty('visibility');
  assert.equal(takeSnapshot(doc, cache)!.board[0]!.identity!.rank, 'Q');
});

test('partial deals, Omaha-sized hands, and multiple boards fail open', () => {
  const doc = installDom();
  const seat = doc.querySelector('[data-pnc-seat]')!;
  seat.innerHTML = cardMarkup('A');
  assert.equal(takeSnapshot(doc), undefined);
  seat.innerHTML = cardMarkup('A') + cardMarkup('K') + cardMarkup('Q') + cardMarkup('J');
  assert.equal(takeSnapshot(doc), undefined);
  seat.innerHTML = '';
  doc.querySelector('[data-pnc-table]')!.insertAdjacentHTML('beforeend', '<div data-pnc-board></div>');
  assert.equal(takeSnapshot(doc), undefined);
});

test('face-down markers, transparent text, and back-facing transforms never expose DOM identities', () => {
  const doc = installDom();
  const seats = doc.querySelectorAll('[data-pnc-seat]');
  seats[0]!.innerHTML = cardMarkup('A').replace('data-pnc-card', 'data-pnc-card class="face-down"') + cardMarkup('K').replace('data-pnc-card', 'data-pnc-card style="transform:matrix3d(-1,0,0,0,0,1,0,0,0,0,-1,0,0,0,0,1)"');
  seats[1]!.innerHTML = cardMarkup('<span style="color:transparent">Q</span>') + cardMarkup('J');
  const next = takeSnapshot(doc)!;
  assert.equal(next.holes[0]!.identity, undefined);
  assert.equal(next.holes[1]!.identity, undefined);
  assert.equal(next.holes[2]!.identity, undefined);
  assert.equal(next.holes[3]!.identity!.rank, 'J');
});

test('adapter fixture observes a single flop and rerender invalidates without replaying it', () => {
  const doc = installDom();
  const events: VisualEventType[] = [];
  let invalidations = 0;
  const adapter = new PokerNowAdapter({ allowFixture: true, onEvent: (event) => events.push(event.type), onInvalidate: () => { invalidations++; } }, doc);
  try {
    adapter.start();
    const board = doc.querySelector('[data-pnc-board]')!;
    board.innerHTML = cardMarkup('A') + cardMarkup('8') + cardMarkup('K');
    adapter.scan();
    board.innerHTML = cardMarkup('A') + cardMarkup('8') + cardMarkup('K');
    adapter.scan();
    assert.deepEqual(events, ['TABLE_READY', 'FLOP_REVEALED']);
    assert.equal(invalidations, 1);
  } finally { adapter.stop(); }
});

test('style leases restore original priorities and preserve external site changes', () => {
  const doc = installDom();
  const element = doc.querySelector<HTMLElement>('[data-pnc-table]')!;
  element.style.setProperty('background-color', 'red', 'important');
  const ledger = new StyleLedger();
  ledger.set(element, 'background-color', 'blue');
  ledger.restore();
  assert.equal(element.style.backgroundColor, 'red');
  assert.equal(element.style.getPropertyPriority('background-color'), 'important');
  ledger.set(element, 'background-color', 'blue');
  element.style.setProperty('background-color', 'green');
  ledger.restore();
  assert.equal(element.style.backgroundColor, 'green');
});

test('stopping with a queued mutation does not disable observation after restarting', async () => {
  const doc = installDom();
  const events: VisualEventType[] = [];
  const adapter = new PokerNowAdapter({ allowFixture: true, onEvent: (event) => events.push(event.type) }, doc);
  try {
    adapter.start();
    const board = doc.querySelector('[data-pnc-board]')!;
    board.innerHTML = cardMarkup('A') + cardMarkup('8') + cardMarkup('K');
    await Promise.resolve(); // MutationObserver queues the adapter's batching timer.
    adapter.stop();
    board.innerHTML = '';
    adapter.start();
    board.innerHTML = cardMarkup('A') + cardMarkup('8') + cardMarkup('K');
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(events.filter((kind) => kind === 'FLOP_REVEALED').length, 1);
  } finally { adapter.stop(); }
});

test('actual adapter and coordinator preserve one flop through artwork leases, owned mutations, and cancellation', async () => {
  const doc = installDom();
  const browser = doc.defaultView!;
  const imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const cancelDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  const timeoutDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'setTimeout');
  const clearTimeoutDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'clearTimeout');
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  Object.defineProperty(globalThis, 'setTimeout', { configurable: true, value: (callback: (...args: unknown[]) => void, delay = 0, ...args: unknown[]) => {
    const id = ++timerId;
    timers.set(id, { callback: () => callback(...args), delay: Number(delay) });
    return id;
  } });
  Object.defineProperty(globalThis, 'clearTimeout', { configurable: true, value: (id: number) => { timers.delete(id); } });
  const drainObservationBatches = async () => {
    for (let pass = 0; pass < 8; pass++) {
      // MutationObserver and image-decode microtasks settle before inspecting the clock.
      await new Promise<void>((resolve) => setImmediate(resolve));
      const batches = [...timers.entries()].filter(([, timer]) => timer.delay <= 100);
      if (!batches.length) return;
      for (const [id, timer] of batches) { timers.delete(id); timer.callback(); }
    }
    assert.fail('native observation batches did not settle; possible presentation write loop');
  };
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    src = '';
    decode(): Promise<void> { return Promise.resolve(); }
  } });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: browser.cancelAnimationFrame.bind(browser) });
  const host = doc.createElement('div');
  host.dataset.pncOverlay = 'fixture-engine';
  doc.body.append(host);
  const engine = new AnimationCoordinator(host);
  const presentation = new TablePresentation();
  const theme = createDefaultTheme();
  const events: VisualEventType[] = [];
  let snapshotCount = 0;
  let handle: AnimationHandle | undefined;
  const adapter = new PokerNowAdapter({
    allowFixture: true,
    onInvalidate: () => engine.cancelAll(),
    onUnsupported: () => presentation.clear(),
    onSnapshot: (current) => { snapshotCount++; presentation.apply(current, theme); },
    onEvent: (event) => {
      events.push(event.type);
      if (event.type === 'FLOP_REVEALED') {
        handle = engine.play(event, theme);
        // Pause during asynchronous preparation, before any frame clock starts.
        handle.pause();
      }
    },
  }, doc);
  try {
    adapter.start();
    const board = doc.querySelector('[data-pnc-board]')!;
    board.innerHTML = cardMarkup('A') + cardMarkup('8') + cardMarkup('K');
    const sources = Array.from(board.querySelectorAll<HTMLElement>('[data-pnc-card]'));
    sources.forEach((source) => source.style.setProperty('visibility', 'visible', 'important'));
    adapter.scan(); // Cache each visible identity before the coordinator acquires a lease.
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert(handle, 'the actual flop event must dispatch to the shared engine');
    assert(sources.every((source) => source.dataset.pncConcealed === 'true' && source.style.visibility === 'hidden'));
    adapter.scan();
    await drainObservationBatches();
    assert.deepEqual(events, ['TABLE_READY', 'FLOP_REVEALED']);
    assert.equal(handle.progress, 0, 'preparation-time pause must retain the source lease without running a frame');

    const beforeOwnedMutation = snapshotCount;
    const artwork = sources[0]!.querySelector<HTMLElement>('[data-pnc-owned]')!;
    artwork.style.opacity = '0.9';
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert(![...timers.values()].some((timer) => timer.delay <= 100), 'owned artwork must not queue a native batching timer');
    assert.equal(snapshotCount, beforeOwnedMutation, 'extension artwork mutations must not schedule native snapshots');
    assert(sources.every((source) => source.dataset.pncConcealed === 'true'));

    handle.cancel();
    await handle.finished;
    assert(sources.every((source) => !source.hasAttribute('data-pnc-concealed') &&
      source.style.visibility === 'visible' && source.style.getPropertyPriority('visibility') === 'important'));
    adapter.scan();
    await drainObservationBatches();
    assert.deepEqual(events, ['TABLE_READY', 'FLOP_REVEALED']);
    assert.equal(host.childElementCount, 0, 'cancellation must remove every temporary engine layer');
  } finally {
    adapter.stop();
    engine.dispose();
    presentation.clear();
    host.remove();
    browser.close(); // Also clears jsdom's separate window watchdog timer registry.
    if (imageDescriptor) Object.defineProperty(globalThis, 'Image', imageDescriptor);
    else Reflect.deleteProperty(globalThis, 'Image');
    if (cancelDescriptor) Object.defineProperty(globalThis, 'cancelAnimationFrame', cancelDescriptor);
    else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
    timers.clear();
    if (timeoutDescriptor) Object.defineProperty(globalThis, 'setTimeout', timeoutDescriptor);
    else Reflect.deleteProperty(globalThis, 'setTimeout');
    if (clearTimeoutDescriptor) Object.defineProperty(globalThis, 'clearTimeout', clearTimeoutDescriptor);
    else Reflect.deleteProperty(globalThis, 'clearTimeout');
  }
});
