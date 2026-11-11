import './replica.css';
import { Scenario } from './scenario';
import { fitReplica } from './markup';
import { Runtime } from '../runtime';
import { builtInThemes, createDefaultLibrary } from '../themes/defaults';
import { validateTheme } from '../themes/schema';
const root = document.getElementById('main-container')!;
const scenario = new Scenario(root, 6);
scenario.prepare('river');
const settings = createDefaultLibrary().settings;
const runtime = new Runtime({ document, fontBase: './fonts', allowAnyLocation: true });
let theme = builtInThemes[0]!;
runtime.configure(theme, settings);
const toolbar = document.createElement('div'); toolbar.className = 'replica-toolbar';
const rooms = document.createElement('select'); rooms.ariaLabel = 'Preview room';
for (const room of builtInThemes) rooms.add(new Option(room.name, room.id));
rooms.onchange = () => { theme = builtInThemes.find(room => room.id === rooms.value)!; runtime.configure(theme, settings); };
const button = (name: string, action: () => void) => { const b = document.createElement('button'); b.textContent = name; b.onclick = action; return b; };
toolbar.append(rooms, button('Play a hand', () => { void scenario.playHand(); }), button('Reset', () => { scenario.stop(); scenario.prepare('river'); runtime.scan(); }));
const label = document.createElement('div'); label.className = 'replica-label'; label.textContent = 'ROOM REHEARSAL · SAMPLE GAME';
document.body.append(toolbar, label);
window.addEventListener('resize', () => { fitReplica(root); runtime.scan(); });
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent) return;
  if (event.data?.type === 'pnc.preview.theme') {
    try { theme = validateTheme(event.data.theme); runtime.configure(theme, settings); } catch { /* Ignore malformed host messages. */ }
  }
});
Object.assign(globalThis, { __pncReplica: { scenario, runtime, settings } });
window.addEventListener('pagehide', () => { scenario.stop(); runtime.dispose(); }, { once: true });
