import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { builtInThemes, createDefaultLibrary, puppyTheme } from '../src/themes/defaults';
import { validateLibrary, validateTheme } from '../src/themes/schema';
import { choreograph, planFor, planForEvent, type PlanKind } from '../src/puppy/plan';
import type { Companion, CompanionModule, StageDirector } from '../src/puppy/types';
import type { VisualCard, VisualEvent } from '../src/types';

const card = (id: string, x: number, y: number, identity?: VisualCard['identity'], seat?: number, round?: number): VisualCard =>
  ({ id, target: { x, y, width: 60, height: 74 }, ...(identity ? { identity } : {}), ...(seat !== undefined ? { seatId: `seat-${seat}`, round } : {}) });

function event(kind: PlanKind): VisualEvent {
  const base = { id: `fixture-${kind}`, timestamp: Date.now(), origin: { x: 900, y: 420, z: 0 } };
  if (kind === 'deal') {
    const seats = [[620, 600], [300, 520], [260, 200], [620, 100], [980, 200]];
    const cards = [0, 1].flatMap((round) => seats.map(([x, y], seat) => card(`s${seat}-c${round}`, x! + round * 30, y!, seat === 0 ? { rank: 'A', suit: 'hearts' } : undefined, seat, round)));
    return { ...base, type: 'HOLE_CARDS_APPEARED', cards };
  }
  if (kind === 'flop') return { ...base, type: 'FLOP_REVEALED', cards: [0, 1, 2].map((i) => card(`b${i}`, 400 + i * 70, 320, { rank: 'K', suit: 'spades' })) };
  return { ...base, type: kind === 'mouth' ? 'TURN_REVEALED' : 'RIVER_REVEALED', cards: [card('b3', 610, 320, { rank: 'Q', suit: 'hearts' })] };
}

test('Puppy is a valid built-in theme with a companion, puppy deck, paw table and puppy presets', () => {
  const theme = validateTheme(structuredClone(puppyTheme));
  assert.equal(theme.name, 'Puppy');
  assert.equal(theme.description, 'A playful 3D puppy brings your poker table to life.');
  assert.deepEqual(theme.companion, { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium' });
  assert.equal(theme.card.face, 'puppy'); assert.equal(theme.card.back, 'paws');
  assert.equal(theme.table.motif, 'puppy'); assert.equal(theme.table.emblem, 'paw');
  assert.deepEqual(Object.values(theme.animations).map((a) => a.preset), ['deal.puppy', 'flop.puppy', 'turn.puppy', 'river.puppy']);
  assert.ok(builtInThemes.some((room) => room.id === 'room-puppy'));
  // Other rooms are untouched: no companion, classic decor.
  for (const room of builtInThemes.filter((r) => r.id !== 'room-puppy')) { assert.equal(room.companion, undefined); assert.equal(room.table.motif, 'classic'); }
  assert.throws(() => validateTheme({ ...structuredClone(puppyTheme), companion: { kind: 'puppy', animations: true, intensity: 'wild', scale: 'medium' } }));
  assert.throws(() => validateTheme({ ...structuredClone(puppyTheme), companion: { kind: 'cat', animations: true, intensity: 'normal', scale: 'medium' } }));
});

test('library v4 adds the Puppy room once, keeps the owner\'s themes and choice, and respects a later deletion', () => {
  const v3 = structuredClone(createDefaultLibrary()) as unknown as { version: number; settings: { activeThemeId: string }; themes: { id: string }[] };
  v3.version = 3;
  v3.themes = v3.themes.filter((theme) => theme.id !== 'room-puppy');
  v3.settings.activeThemeId = 'room-rouge';
  const upgraded = validateLibrary(v3);
  assert.equal(upgraded.version, 4);
  assert.equal(upgraded.themes.filter((theme) => theme.id === 'room-puppy').length, 1);
  assert.equal(upgraded.settings.activeThemeId, 'room-rouge', 'the active theme is not switched');
  // A theme missing `motif` (saved before this release) reads as classic.
  const legacy = structuredClone(builtInThemes[0]!) as unknown as { table: Record<string, unknown> };
  delete legacy.table.motif;
  assert.equal(validateTheme(legacy).table.motif, 'classic');
  // Deleting Puppy later is final: a v4 library is not re-migrated.
  const deleted = structuredClone(upgraded); deleted.themes = deleted.themes.filter((theme) => theme.id !== 'room-puppy');
  assert.equal(validateLibrary(deleted).themes.some((theme) => theme.id === 'room-puppy'), false);
});

test('each card leaves exactly when the puppy touches it, and every card lands on its measured slot', () => {
  for (const kind of ['deal', 'flop', 'mouth', 'paw'] as PlanKind[]) {
    const e = event(kind), plan = choreograph(e, kind)!;
    assert.ok(plan, kind);
    for (const c of e.cards) {
      const cue = plan.cards.get(c.id)!;
      // Find the moment the card first moves.
      let start = -1, previous = cue(0);
      for (let i = 1; i <= 2000; i++) {
        const p = i / 2000, now = cue(p);
        if (Math.hypot(now.x - previous.x, now.y - previous.y) > 0.05 || Math.abs(now.z - previous.z) > 0.05) { start = p; break; }
        previous = now;
      }
      assert.ok(start > 0.15, `${kind} ${c.id} moved before the puppy arrived (${start})`);
      // At that moment the puppy is acting (not still approaching) and its contact point is at the card.
      const puppy = plan.puppy(start);
      assert.equal(puppy.phase, 'act', `${kind} ${c.id}: puppy phase ${puppy.phase} at ${start}`);
      assert.notEqual(puppy.part, 'body');
      const at = cue(start), reach = Math.hypot(puppy.point.x - at.x, puppy.point.y - at.y);
      assert.ok(reach <= c.target.width * 1.05 + c.target.height * 0.4, `${kind} ${c.id}: contact ${reach.toFixed(1)}px from the card`);
      // It lands on its slot, flat and face-up as measured.
      const end = cue(1);
      assert.equal(end.x, c.target.x + c.target.width / 2); assert.equal(end.y, c.target.y + c.target.height / 2);
      assert.deepEqual([end.z, end.rx, end.ry, end.rz, end.scale, end.opacity], [0, 0, 0, 0, 1, 1]);
      for (let i = 0; i <= 100; i++) { const v = cue(i / 100); assert.ok([v.x, v.y, v.z, v.rx, v.ry, v.rz, v.scale, v.opacity].every(Number.isFinite)); }
    }
    for (let i = 0; i <= 100; i++) { const p = plan.puppy(i / 100); assert.ok(Number.isFinite(p.point.x + p.point.y + p.actionT + p.approach)); }
  }
  // The preset and the puppy share one plan per event.
  const e = event('flop');
  assert.equal(planFor(e, 'flop'), planForEvent(e.id));
  assert.equal(planFor(e, 'flop'), planFor(e, 'flop'));
  assert.equal(choreograph(event('flop'), 'flop') && choreograph({ ...event('flop'), cards: event('flop').cards.slice(0, 2) }, 'flop'), undefined, 'a partial flop is not choreographed');
});

test('the runtime loads the companion only for a companion theme, wires the director, and disposes it on switch', async () => {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const dom = new JSDOM('<!doctype html><html><body><div class="table"></div></body></html>', { url: 'https://www.pokernow.com/games/fixture', pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, getComputedStyle: dom.window.getComputedStyle.bind(dom.window) })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const { Runtime } = await import('../src/runtime');
  const log: string[] = [];
  let loads = 0;
  const director: StageDirector = { collect: () => 0, fold: () => 0, bet() {}, award() {}, allIn() {}, turn() {}, newHand() {} };
  const module: CompanionModule = {
    createCompanion: () => {
      const companion: Companion = { director, configure: (theme) => log.push(`configure:${theme.id}`), table: () => {}, animation: () => {}, ready: () => true, geometry: () => log.push('geometry'), dispose: () => log.push('dispose') };
      log.push('create');
      return companion;
    },
  };
  const runtime = new Runtime({ document: dom.window.document, allowAnyLocation: true, loadCompanion: async () => { loads++; return module; } });
  const flush = async () => { for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve)); };
  try {
    const settings = createDefaultLibrary().settings;
    runtime.configure(builtInThemes[0], settings); await flush();
    assert.equal(loads, 0, 'a classic room never loads the 3D module');
    runtime.configure(puppyTheme, settings); await flush();
    assert.deepEqual(log, ['create', 'configure:room-puppy']);
    runtime.configure({ ...puppyTheme, companion: { ...puppyTheme.companion!, scale: 'large' } }, settings); await flush();
    assert.deepEqual(log.slice(-1), ['configure:room-puppy'], 'settings changes reconfigure the same puppy');
    runtime.configure(builtInThemes[1], settings); await flush();
    assert.equal(log.at(-1), 'dispose', 'switching skins removes the puppy');
    // A quick switch away while the module is loading never leaves a stray puppy behind.
    runtime.configure(puppyTheme, settings); runtime.configure(builtInThemes[2], settings); await flush();
    assert.equal(log.filter((entry) => entry === 'create').length, 1);
    // Another room that uses a puppy animation gets a visiting puppy, without the room's table moments.
    const visited = { ...builtInThemes[0]!, animations: { ...builtInThemes[0]!.animations, flop: { preset: 'flop.puppy', parameters: {} } } };
    runtime.configure(visited, settings); await flush();
    assert.equal(log.filter((entry) => entry === 'create').length, 2, 'a puppy preset in another room brings the puppy in');
    assert.equal(log.at(-1), `configure:${visited.id}`);
    runtime.configure(puppyTheme, settings); await flush();
    runtime.dispose();
    assert.equal(log.at(-1), 'dispose');
    assert.equal(loads, 1, 'the module is fetched once and reused');
  } finally {
    runtime.dispose();
    dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
