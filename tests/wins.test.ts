import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describeHand } from '../src/rendering/hand-name';
import { builtInThemes, defaultEffects } from '../src/themes/defaults';
import type { CardIdentity, EffectSettings, Rank, Suit } from '../src/types';
import type { SeatState, TableState } from '../src/adapter/pokernow/table-state';

const c = (code: string): CardIdentity => {
  const rank = (code.length === 3 ? '10' : code[0] === 'T' ? '10' : code[0]) as Rank;
  const suit = ({ s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as Record<string, Suit>)[code.at(-1)!]!;
  return { rank, suit };
};
const name = (codes: string): string | undefined => describeHand(codes.split(' ').map(c))?.name;

test('your hand is named the way a dealer says it', () => {
  assert.equal(name('Ks Kh Kd 7c 7h 3s 9d'), 'Full house, kings over sevens');
  assert.equal(name('7s 7d Kd 7c Kh 3s 3d'), 'Full house, sevens over kings');
  assert.equal(name('Ah 8h As 8c Kd 2s 3c'), 'Two pair, aces and eights');
  assert.equal(name('Qs Qh 2d 5c 9h Js 3d'), 'Pair of queens');
  assert.equal(name('Ah Kh Qh Jh 10h 2s 3c'), 'Royal flush');
  assert.equal(name('9c 8c 7c 6c 5c 2s 3d'), 'Straight flush, nine high');
  assert.equal(name('Ah 2d 3c 4s 5h Kd Qc'), 'Five-high straight');
  assert.equal(name('Ah 9h 4h 2h 7h Kd Qc'), 'Ace-high flush');
  assert.equal(name('8s 8h 8d 8c Kh 3s 3d'), 'Four eights');
  assert.equal(name('6s 6h 6d Kc 2h 9s 3d'), 'Three sixes');
  assert.equal(name('As Jh 9d 6c 4h 3s 2d'), 'Ace high');
  assert.equal(describeHand(['As', 'As', 'Kd', 'Qc', 'Jh'].map(c)), undefined, 'A duplicated card is not a hand');
  assert.equal(describeHand(['As', 'Kd'].map(c)), undefined, 'Too few cards');
});

// ─────────────────────────────────────────────────────────────── the stage

const rect = (x: number, y: number, width = 80, height = 30) => ({ x, y, width, height });
const seat = (patch: Partial<SeatState>): SeatState => ({ position: 1, plate: rect(400, 600), you: false, deciding: false, winner: false, folded: false, allIn: false, check: false, urgent: false, cards: [], ...patch });

function harness(motif: string, effects: Partial<EffectSettings> = {}) {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const window = dom.window;
  // jsdom has no Web Animations: keep animated elements in place so they can be inspected.
  const started: { element: Element; frames: Keyframe[] }[] = [];
  window.Element.prototype.animate = function (this: Element, frames: Keyframe[]) {
    started.push({ element: this, frames });
    return { finished: new Promise(() => {}), cancel() {} } as unknown as Animation;
  };
  return { window, started, theme: { ...builtInThemes.find((theme) => theme.table.motif === motif)! }, effects: { ...defaultEffects(), ...effects } };
}

async function award(motif: string, options: { pot: number; hero?: boolean; allIn?: boolean; effects?: Partial<EffectSettings>; handReadEarlier?: boolean }) {
  const h = harness(motif, options.effects);
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: h.window, document: h.window.document, HTMLElement: h.window.HTMLElement, Element: h.window.Element, getComputedStyle: h.window.getComputedStyle.bind(h.window) })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  try {
    const { Stage } = await import('../src/stage/stage');
    const surface = h.window.document.createElement('div');
    h.window.document.body.append(surface);
    const stage = new Stage(surface, { setLiveRules() {} } as never, h.window.document);
    stage.configure(h.theme, h.effects, false);
    const hero = Boolean(options.hero);
    const board = rect(400, 300, 500, 120);
    const hole = [c('Ks'), c('Kh')], cards = [c('Kd'), c('7c'), c('7h'), c('3s'), c('9d')];
    const before: TableState = { table: rect(100, 100, 1200, 600), boardCount: 5, board, pot: options.pot, potRect: rect(600, 250, 100, 30), bigBlind: 20,
      seats: [seat({ position: 1, you: true, plate: rect(600, 620) }), seat({ position: 4, plate: rect(150, 400), allIn: Boolean(options.allIn) })],
      heroHand: { position: 1, hole, board: cards } };
    const winner = hero ? 1 : 4;
    const after: TableState = { ...before, pot: 0, seats: before.seats.map((s) => ({ ...s, winner: s.position === winner })),
      ...(options.allIn ? { winning: [rect(410, 310, 60, 90), rect(480, 310, 60, 90)] } : {}) };
    if (options.handReadEarlier) {
      // Your cards were read earlier in the hand; at showdown the site is redrawing them.
      stage.sync({ ...before, pot: 400 });
      delete before.heroHand;
      delete (after as Partial<TableState>).heroHand;
    }
    stage.sync(before);
    stage.sync(after);
    const root = surface.querySelector('.pnc-stage')!;
    return { root, text: root.textContent ?? '', started: h.started, stage };
  } finally {
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
}

test('your own win names your hand and what you won, in every room', async () => {
  for (const motif of ['classic', 'arcade', 'rain', 'breach', 'cat']) {
    const { root } = await award(motif, { pot: 1240, hero: true });
    const banner = root.querySelector('.pnc-banner');
    assert.ok(banner, `${motif}: a banner for your win`);
    assert.match(banner!.textContent!, /Full house, kings over sevens\+1,240/);
  }
  const { root } = await award('classic', { pot: 1240, hero: false });
  assert.equal(root.querySelector('.pnc-banner'), null, 'Another player’s win has no banner');
  const earlier = await award('classic', { pot: 1240, hero: true, handReadEarlier: true });
  assert.match(earlier.root.querySelector('.pnc-banner')!.textContent!, /Full house, kings over sevens/, 'Your hand is still named when the site redraws your cards at showdown');
});

test('a big pot brings the room’s own flourish; Quiet and "others’ wins off" keep it small', async () => {
  assert.match((await award('rain', { pot: 2400 })).text, /WINNER/, 'Rain District: the sign');
  assert.match((await award('breach', { pot: 2400 })).text, /ACCESS GRANTED/, 'Breach: the stamp');
  const arcade = await award('arcade', { pot: 2400 });
  assert.ok(arcade.started.some((run) => run.frames.some((frame) => String(frame.backgroundImage ?? '').includes('svg'))), 'Arcade: the pixel score counts up');
  assert.doesNotMatch((await award('rain', { pot: 2400, effects: { winSize: 'quiet' } })).text, /WINNER/, 'Quiet stops short of the flourish');
  assert.doesNotMatch((await award('rain', { pot: 2400, effects: { othersWins: false } })).text, /WINNER/, 'Other players’ wins kept small');
  assert.match((await award('rain', { pot: 600, effects: { winSize: 'loud' } })).text, /WINNER/, 'Loud lifts a medium pot to the full show');
  assert.doesNotMatch((await award('rain', { pot: 600 })).text, /WINNER/, 'Balanced keeps a medium pot medium');
  const off = await award('rain', { pot: 2400, hero: true, effects: { celebrations: false } });
  assert.equal(off.root.querySelector('.pnc-banner'), null, 'Celebrations off: no banner');
});

test('an all-in won lights the winning cards first', async () => {
  const { started } = await award('classic', { pot: 1800, allIn: true });
  const rings = started.filter((run) => run.frames.length === 5 && String(run.frames[1]!.transform).includes('scale(1.08)'));
  assert.equal(rings.length, 2, 'one light for each winning card');
  const { started: quiet } = await award('classic', { pot: 1800, allIn: true, effects: { winSize: 'quiet' } });
  assert.equal(quiet.filter((run) => run.frames.length === 5 && String(run.frames[1]!.transform).includes('scale(1.08)')).length, 0);
});
