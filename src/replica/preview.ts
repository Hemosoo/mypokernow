import './replica.css';
import { Scenario, type Street } from './scenario';
import { fitReplica } from './markup';
import { Runtime } from '../runtime';
import { builtInThemes, createDefaultLibrary } from '../themes/defaults';
import { validateTheme } from '../themes/schema';
import type { Settings, Theme } from '../types';
import type { AnimationHandle } from '../animation/core/coordinator';

/**
 * Room rehearsal: the replica table dressed by the very same Runtime the
 * content script runs on PokerNow. Opened directly it is a standalone page
 * with its own controls; embedded (`?embed=1`) it is the studio's live
 * preview, driven by same-origin messages from the studio.
 */
const params = new URLSearchParams(location.search);
const embedded = params.get('embed') === '1';
if (embedded) document.documentElement.classList.add('replica-embedded');

const root = document.getElementById('main-container')!;
const scenario = new Scenario(root, Number(params.get('players')) || 6);
scenario.prepare(embedded ? 'turn' : 'river');
let settings: Settings = createDefaultLibrary().settings;
type AnimationListener = (handle: AnimationHandle) => void;
let animationListener: AnimationListener | undefined;
const runtime = new Runtime({ document, fontBase: './fonts', allowAnyLocation: true, onAnimation: (handle) => animationListener?.(handle) });
let theme = builtInThemes[0]!;
runtime.configure(theme, settings);

let looping = false;
async function loop(): Promise<void> {
  if (looping) return;
  looping = true;
  while (looping) {
    const completed = await scenario.playHand();
    if (!completed || !looping) break;
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  looping = false;
}
function stop(): void { looping = false; scenario.stop(); }
function rest(street: Street = 'river'): void { stop(); scenario.prepare(street); runtime.scan(); }
async function play(street: Street): Promise<void> {
  stop();
  scenario.prepare(street);
  // Let the adapter record the table at rest, so the street is seen arriving.
  runtime.scan();
  await new Promise((resolve) => setTimeout(resolve, 160));
  await scenario.reveal(street);
}

if (!embedded) {
  const toolbar = document.createElement('div');
  toolbar.className = 'replica-toolbar';
  const select = (label: string, options: [string, string][], value: string, change: (value: string) => void): HTMLSelectElement => {
    const element = document.createElement('select');
    element.setAttribute('aria-label', label);
    for (const [key, text] of options) element.add(new Option(text, key));
    element.value = value;
    element.onchange = () => change(element.value);
    return element;
  };
  const button = (text: string, action: () => void, primary = false): HTMLButtonElement => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = text;
    if (primary) element.className = 'primary';
    element.onclick = action;
    return element;
  };
  toolbar.append(
    select('Room', builtInThemes.map((room) => [room.id, room.name]), theme.id, (id) => { theme = builtInThemes.find((room) => room.id === id)!; runtime.configure(theme, settings); }),
    select('Players', Array.from({ length: 9 }, (_, index) => [String(index + 2), `${index + 2} players`]), String(scenario.players), (count) => { stop(); scenario.setPlayers(Number(count)); scenario.prepare('river'); runtime.scan(); }),
    button('Play a hand', () => { stop(); void scenario.playHand(); }, true),
    button('Deal', () => { void play('deal'); }), button('Flop', () => { void play('flop'); }),
    button('Turn', () => { void play('turn'); }), button('River', () => { void play('river'); }),
    button('Reset', () => rest()),
  );
  const label = document.createElement('div');
  label.className = 'replica-label';
  label.textContent = 'ROOM REHEARSAL · SAMPLE GAME';
  document.body.append(toolbar, label);
}

window.addEventListener('resize', () => { fitReplica(root); runtime.scan(); });

type HostMessage =
  | { type: 'pnc.preview.theme'; theme: unknown; settings?: Partial<Settings> }
  | { type: 'pnc.preview.players'; players: number }
  | { type: 'pnc.preview.play'; street: Street }
  | { type: 'pnc.preview.hand'; loop?: boolean }
  | { type: 'pnc.preview.rest'; street?: Street };

window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
  if (event.origin !== location.origin || event.source !== parent || !event.data || typeof event.data !== 'object') return;
  const message = event.data;
  try {
    switch (message.type) {
      case 'pnc.preview.theme': {
        theme = validateTheme(message.theme);
        const next = message.settings ?? {};
        settings = { ...settings,
          ...(typeof next.reducedMotion === 'boolean' ? { reducedMotion: next.reducedMotion } : {}),
          ...(typeof next.speed === 'number' && Number.isFinite(next.speed) ? { speed: Math.min(3, Math.max(0.25, next.speed)) } : {}),
          ...(next.effects && typeof next.effects === 'object' ? { effects: { ...settings.effects, ...next.effects } } : {}),
          enabled: true };
        runtime.configure(theme, settings);
        break;
      }
      case 'pnc.preview.players': stop(); scenario.setPlayers(Number(message.players) || 6); scenario.prepare('turn'); runtime.scan(); break;
      case 'pnc.preview.play': void play(message.street); break;
      case 'pnc.preview.hand': stop(); if (message.loop) void loop(); else void scenario.playHand(); break;
      case 'pnc.preview.rest': rest(message.street); break;
      default: break;
    }
  } catch { /* Ignore malformed host messages. */ }
});

if (embedded) parent.postMessage({ type: 'pnc.preview.ready' }, location.origin);
/** Direct, same-origin control for the studio's embedded preview. */
function configure(nextTheme: Theme, nextSettings: Settings): void {
  theme = nextTheme;
  settings = nextSettings;
  runtime.configure(theme, settings);
}
function setPlayers(count: number): void { stop(); scenario.setPlayers(count); scenario.prepare('turn'); runtime.scan(); }
Object.assign(globalThis, { __pncReplica: {
  scenario, runtime, get settings() { return settings; }, play, loop, stop, rest, configure, setPlayers,
  onAnimation(listener: AnimationListener | undefined) { animationListener = listener; },
} });
window.addEventListener('pagehide', () => { stop(); runtime.dispose(); }, { once: true });
