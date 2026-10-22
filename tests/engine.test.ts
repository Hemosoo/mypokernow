import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { AnimationCoordinator } from '../src/animation/core/coordinator';
import { getPreset } from '../src/animation/registry';
import { semanticArtwork } from '../src/animation/fragments/semantic';
import { sequence } from '../src/animation/primitives/composition';
import { createDefaultTheme } from '../src/themes/defaults';
import type { Rank, VisualEvent } from '../src/types';

function environment(deferredDecode = false) {
  const { JSDOM } = createRequire(import.meta.url)('jsdom');
  const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
  const original = new Map<string, PropertyDescriptor | undefined>();
  const set = (key: string, value: unknown) => {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  let clock = 0, sequence = 0, warnings = 0, rejectDecode = false;
  const frames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, { callback: () => void; deadline: number }>();
  const decodes: (() => void)[] = [];
  const motionListeners = new Set<() => void>();
  const motion = { matches: false, addEventListener: (_name: string, callback: () => void) => motionListeners.add(callback), removeEventListener: (_name: string, callback: () => void) => motionListeners.delete(callback) };
  const timeout = dom.window.setTimeout;
  dom.window.setTimeout = (callback: () => void, delay: number) => {
    const id = ++sequence;
    timers.set(id, { callback, deadline: clock + delay });
    return id;
  };
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, DOMParser: dom.window.DOMParser, XMLSerializer: dom.window.XMLSerializer,
    performance: { now: () => clock }, matchMedia: () => motion,
    requestAnimationFrame: (callback: FrameRequestCallback) => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => frames.delete(id), clearTimeout: (id: number) => timers.delete(id),
    Image: class {
      src = '';
      decode() { return rejectDecode ? Promise.reject(new Error('Expected SVG decode rejection')) : deferredDecode ? new Promise<void>(resolve => decodes.push(resolve)) : Promise.resolve(); }
    },
  })) set(key, value);
  const warn = console.warn;
  console.warn = () => { warnings++; };
  const host = document.createElement('div'); document.body.append(host);
  const theme = createDefaultTheme();
  let eventId = 0;
  const fixture = (): VisualEvent => {
    const cards = Array.from({ length: 3 }, (_, index) => {
      const source = document.createElement('div');
      source.style.setProperty('visibility', 'visible', 'important');
      source.style.transform = 'rotate(3deg)'; document.body.append(source);
      return { id: `card-${index}`, source, identity: { rank: '8' as const, suit: 'hearts' as const }, target: { x: 200 + index * 80, y: 220, width: 70, height: 98 } };
    });
    return { id: `test-${eventId++}`, type: 'FLOP_REVEALED', cards, origin: { x: 160, y: 160 }, timestamp: Date.now() };
  };
  const engine = new AnimationCoordinator(host);
  return {
    engine, host, theme, fixture, motion, decodes, frames, timers,
    get warnings() { return warnings; },
    async flush() { await new Promise<void>(resolve => setImmediate(resolve)); },
    step(delta: number) {
      clock += delta;
      for (const [id, timer] of [...timers]) if (timer.deadline <= clock) { timers.delete(id); timer.callback(); }
      const pending = [...frames]; frames.clear();
      for (const [, callback] of pending) callback(clock);
    },
    reduce() { motion.matches = true; for (const listener of motionListeners) listener(); },
    failDecodes() { rejectDecode = true; },
    close() {
      engine.dispose(); console.warn = warn;
      dom.window.setTimeout = timeout;
      for (const [key, descriptor] of original) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      dom.window.close();
    },
  };
}

function restored(event: VisualEvent): void {
  for (const card of event.cards) {
    assert.equal(card.source!.style.visibility, 'visible');
    assert.equal(card.source!.style.getPropertyPriority('visibility'), 'important');
    assert.equal(card.source!.getAttribute('data-pnc-concealed'), null);
    assert.equal(card.source!.style.transform, 'rotate(3deg)');
  }
}

test('async cancellation and finish before artwork decode never conceal a source', async () => {
  const env = environment(true);
  try {
    const event = env.fixture();
    const handle = env.engine.play(event, env.theme);
    assert.equal(env.host.firstElementChild!.getAttribute('data-pnc-overlay'), 'true');
    assert.equal((env.host.firstElementChild as HTMLElement).style.visibility, 'hidden');
    restored(event);
    handle.cancel(); await handle.finished;
    env.decodes.forEach(resolve => resolve()); await env.flush();
    restored(event); assert.equal(env.host.childElementCount, 0); assert.equal(env.timers.size, 0);
    const second = env.fixture(), finished = env.engine.play(second, env.theme);
    finished.finish(); await finished.finished; assert.equal(finished.progress, 1);
    env.decodes.forEach(resolve => resolve()); await env.flush(); restored(second);
  } finally { env.close(); }
});

test('prepare and running-track exceptions release every original and temporary object', async () => {
  const env = environment(), preset = getPreset('flop.triple-spread')!, original = preset.build;
  try {
    const event = env.fixture();
    preset.build = () => { throw new Error('Expected preparation failure'); };
    await env.engine.play(event, env.theme).finished; restored(event); assert.equal(env.host.childElementCount, 0);
    preset.build = context => {
      context.card(context.event.cards[0]!);
      return [{ start: 0, end: 1, update: progress => { if (progress > 0.1) throw new Error('Expected track failure'); } }];
    };
    const next = env.fixture(), handle = env.engine.play(next, env.theme); await env.flush();
    assert.ok(next.cards.every(card => card.source!.style.visibility === 'hidden'));
    env.step(300); await handle.finished;
    restored(next); assert.equal(env.host.childElementCount, 0); assert.equal(env.frames.size, 0); assert.equal(env.timers.size, 0);
    assert.equal(env.warnings, 2);
  } finally { preset.build = original; env.close(); }
});

test('artwork decode rejection leaves all originals painted and removes the hidden preparation layer', async () => {
  const env = environment();
  try {
    env.failDecodes();
    const event = env.fixture(), handle = env.engine.play(event, env.theme);
    restored(event); await env.flush(); await handle.finished;
    restored(event); assert.equal(env.host.childElementCount, 0); assert.equal(env.timers.size, 0); assert.equal(env.warnings, 1);
  } finally { env.close(); }
});

test('watchdog restores paused animations and cannot leave a hidden card or timer', async () => {
  const env = environment();
  try {
    const event = env.fixture(), handle = env.engine.play(event, env.theme); await env.flush();
    handle.pause(); env.step(12001); await handle.finished;
    restored(event); assert.equal(env.host.childElementCount, 0); assert.equal(env.frames.size, 0); assert.equal(env.timers.size, 0);
  } finally { env.close(); }
});

test('conflicting events cancel earlier leases while identical event IDs do not replay', async () => {
  const env = environment();
  try {
    const event = env.fixture(), first = env.engine.play(event, env.theme); await env.flush();
    const next = { ...event, id: 'new-generation' }, second = env.engine.play(next, env.theme); await first.finished; await env.flush();
    assert.equal(env.host.childElementCount, 1); assert.ok(event.cards.every(card => card.source!.style.visibility === 'hidden'));
    const duplicate = env.engine.play(next, env.theme); await duplicate.finished;
    assert.equal(duplicate.progress, 1); assert.equal(env.host.childElementCount, 1);
    second.cancel(); await second.finished; restored(event);
    await env.engine.play(next, env.theme).finished; assert.equal(env.host.childElementCount, 0);
  } finally { env.close(); }
});

test('progress, pause/resume and forced completion share one clock and exact restoration', async () => {
  const env = environment();
  try {
    const event = env.fixture(), progress: number[] = [], handle = env.engine.play(event, env.theme, { onProgress: value => progress.push(value) }); await env.flush();
    env.step(180); assert.ok(handle.progress > 0); const pausedAt = handle.progress;
    handle.pause(); env.step(300); assert.equal(handle.progress, pausedAt);
    handle.resume(); env.step(180); assert.ok(handle.progress > pausedAt);
    handle.finish(); await handle.finished;
    assert.equal(handle.progress, 1); assert.ok(progress.every((value, index) => index === 0 || value >= progress[index - 1]!));
    restored(event); assert.equal(env.host.childElementCount, 0); assert.equal(env.frames.size, 0);
  } finally { env.close(); }
});

test('system reduced motion and host/source detachment fail open immediately', async () => {
  const env = environment();
  try {
    const event = env.fixture(), active = env.engine.play(event, env.theme); await env.flush();
    env.reduce(); await active.finished; restored(event);
    await env.engine.play(env.fixture(), env.theme, { reducedMotion: false }).finished; assert.equal(env.host.childElementCount, 0);
    env.motion.matches = false;
    const sourceEvent = env.fixture(), sourceRun = env.engine.play(sourceEvent, env.theme); await env.flush();
    sourceEvent.cards[0]!.source!.remove(); env.step(16); await sourceRun.finished; restored(sourceEvent);
    const detached = env.fixture(), handle = env.engine.play(detached, env.theme); await env.flush();
    env.host.remove(); env.step(16); await handle.finished; restored(detached);
  } finally { env.close(); }
});

test('semantic layers contain actual complete rank/suit/pip groups and one coherent court', () => {
  const env = environment();
  try {
    for (const rank of ['A', '2', '7', '8', '10', 'J', 'Q', 'K'] as Rank[]) {
      const card = { id: rank, identity: { rank, suit: 'hearts' as const }, target: { x: 200, y: 200, width: 70, height: 98 } };
      const layers = semanticArtwork(card, env.theme, env.host);
      assert.equal(layers.filter(layer => layer.kind === 'rank').length, 2);
      const court = ['J', 'Q', 'K'].includes(rank);
      assert.equal(layers.filter(layer => layer.kind === 'art').length, court ? 1 : 0);
      assert.equal(layers.filter(layer => layer.id.startsWith('pip-')).length, court ? 0 : rank === 'A' ? 1 : Number(rank));
      for (const layer of layers) {
        const src = layer.visual.element.querySelector('img')!.src;
        const svg = new DOMParser().parseFromString(decodeURIComponent(src.split(',').slice(1).join(',')), 'image/svg+xml');
        assert.equal(svg.querySelector('parsererror'), null);
        if (layer.kind === 'rank') assert.equal(svg.querySelector('text')!.textContent, rank);
        if (layer.kind === 'body') { assert.equal(svg.querySelector('text'), null); assert.equal(svg.querySelector('g'), null); }
        if (layer.id === 'rank-bottom') assert.match(svg.querySelector('g g')!.getAttribute('transform')!, /rotate\(180/);
      }
      env.host.replaceChildren();
    }
  } finally { env.close(); }
});

test('overlapping reusable sequence segments cover one synchronized parent clock', () => {
  const base = [{ start: 0, end: 1, update() {} }];
  const tracks = sequence({ tracks: base }, { tracks: base, overlap: 0.2 });
  assert.equal(tracks[0]!.start, 0); assert.ok(tracks[1]!.start < tracks[0]!.end);
  assert.ok(Math.abs(tracks[1]!.end - 1) < 1e-9);
});
