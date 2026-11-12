import { inspectLayout, type ObservedLayout } from '../adapter/pokernow/diagnostics';
import { Runtime, type RuntimeState } from '../runtime';
import { loadLibrary, subscribeLibrary } from '../storage/library';
import { resolveThemeAssets } from '../storage/assets';
import type { RuntimeStatus } from '../storage/diagnostics';
import type { Library, Theme } from '../types';
import type { CompanionModule } from '../puppy/types';

const VERSION = '0.3.0';
const globals = globalThis as typeof globalThis & { __pncCleanup?: () => void };
globals.__pncCleanup?.();

let library: Library | undefined;
let stopped = false, suspended = false, revision = 0;
let imageWarning = '';
let lastSignature = '';
let status: RuntimeStatus = { state: 'starting', reason: 'The content script is loading extension settings.', tableCount: 0, boardCount: 0, seatCount: 0, cardCount: 0, observedAt: Date.now(), version: VERSION };

function publish(state: RuntimeState, reason: string, layout: ObservedLayout = inspectLayout(document)): void {
  status = { ...layout, state, reason: (reason + (imageWarning ? ' ' + imageWarning : '')).slice(0, 600), observedAt: Date.now(), version: VERSION };
  const signature = JSON.stringify({ ...status, observedAt: 0 });
  if (signature === lastSignature) return;
  lastSignature = signature;
  void chrome.runtime.sendMessage({ type: 'pnc.runtime.status', status }).catch(() => {});
}

let fontBase: string | undefined;
try { fontBase = chrome.runtime.getURL('fonts'); } catch { fontBase = undefined; }
// The 3D puppy is a separate module, fetched from the extension only on a Puppy table.
const loadCompanion = (): Promise<CompanionModule> => import(/* @vite-ignore */ chrome.runtime.getURL('puppy.js')) as Promise<CompanionModule>;
const runtime = new Runtime({ document, fontBase, onStatus: publish, loadCompanion });

async function applyLibrary(next: Library): Promise<void> {
  const currentRevision = ++revision;
  library = next;
  imageWarning = '';
  if (stopped || suspended) return;
  if (!next.settings.enabled) {
    runtime.configure(undefined, next.settings);
    publish('disabled', 'Customization is switched off in the extension studio.');
    return;
  }
  const selected = next.themes.find((candidate) => candidate.id === next.settings.activeThemeId) ?? next.themes[0];
  if (!selected) {
    runtime.configure(undefined, next.settings);
    publish('error', 'No usable theme is selected. Restore defaults in the extension studio.');
    return;
  }
  publish('starting', 'Loading the selected theme and looking for the PokerNow table.');
  let resolved: Theme;
  try { resolved = await resolveThemeAssets(selected); }
  catch {
    // A missing upload must never take the rest of the skin down with it.
    resolved = structuredClone(selected);
    delete resolved.card.backImage;
    delete resolved.table.backgroundImage;
    if (resolved.card.back === 'image') resolved.card.back = 'solid';
    imageWarning = 'An uploaded image could not load; other customizations continue. Re-upload that image in the studio.';
  }
  if (currentRevision !== revision || stopped || suspended) return;
  runtime.configure(resolved, next.settings);
}

const unsubscribe = subscribeLibrary((next) => { void applyLibrary(next); });
void loadLibrary().then(applyLibrary).catch(() => {
  runtime.configure(undefined, undefined);
  publish('error', 'Saved settings could not be loaded. Open the extension studio and use Restore local defaults.');
});

const probe = (message: unknown, sender: { id?: string }, sendResponse: (response: unknown) => void): void => {
  if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object' || (message as { type?: unknown }).type !== 'pnc.runtime.probe') return;
  if (library?.settings.enabled && !suspended) runtime.scan();
  sendResponse({ ...status, observedAt: Date.now() });
};
chrome.runtime.onMessage.addListener(probe);

function cleanup(): void {
  if (stopped) return;
  stopped = true;
  revision++;
  unsubscribe();
  runtime.dispose();
  chrome.runtime.onMessage.removeListener(probe);
  window.removeEventListener('pagehide', pagehide);
  window.removeEventListener('pageshow', pageshow);
  delete globals.__pncCleanup;
}
function pagehide(event: PageTransitionEvent): void {
  if (!event.persisted) { cleanup(); return; }
  suspended = true;
  revision++;
  runtime.configure(undefined, library?.settings);
}
function pageshow(event: PageTransitionEvent): void {
  if (!event.persisted || stopped) return;
  suspended = false;
  void loadLibrary().then(applyLibrary).catch(() => publish('error', 'Saved settings could not be loaded after restoring this tab.'));
}
globals.__pncCleanup = cleanup;
window.addEventListener('pagehide', pagehide);
window.addEventListener('pageshow', pageshow);
publish('starting', 'The content script is loading extension settings.');
