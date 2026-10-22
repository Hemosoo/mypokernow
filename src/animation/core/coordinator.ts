import { cardDataUrl } from '../../rendering/cards';
import { streetForEvent, type Theme, type VisualCard, type VisualEvent } from '../../types';
import { getPreset, presetsForStreet } from '../registry';
import { cardCenter, clamp } from '../primitives/motion';
import { cardObject } from '../primitives/objects';
import { Timeline } from './timeline';
import type { AnimationHandle, PlayOptions, TimelineTrack } from './types';

interface SourceLease {
  source: HTMLElement;
  visibility: string;
  priority: string;
  marker: string | null;
}
interface Run {
  id: string;
  layer: HTMLElement;
  cards: VisualCard[];
  cancel: () => void;
}

function completed(onProgress?: (progress: number) => void): AnimationHandle {
  try { onProgress?.(1); } catch { /* A preview callback must not affect the game. */ }
  return { finished: Promise.resolve(), progress: 1, pause() {}, resume() {}, cancel() {}, finish() {} };
}

export function validateGeometry(card: VisualCard): boolean {
  const r = card.target;
  return [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width >= 4 && r.height >= 4 && r.width <= 600 && r.height <= 840;
}

function conflicts(a: VisualCard, b: VisualCard): boolean {
  if (a.source && a.source === b.source) return true;
  const x = Math.min(a.target.x + a.target.width, b.target.x + b.target.width) - Math.max(a.target.x, b.target.x);
  const y = Math.min(a.target.y + a.target.height, b.target.y + b.target.height) - Math.max(a.target.y, b.target.y);
  return x > Math.min(a.target.width, b.target.width) * 0.65 && y > Math.min(a.target.height, b.target.height) * 0.65;
}

async function prepareArtwork(cards: VisualCard[], theme: Theme, layer: HTMLElement): Promise<void> {
  // SVG resources are decoded BEFORE taking visibility leases. No network or canvas capture.
  const images = new Map<string, HTMLImageElement>();
  for (const image of layer.querySelectorAll('img')) if (typeof image.decode === 'function') images.set(image.src, image);
  const urls = new Set([cardDataUrl(undefined, theme.card), ...cards.map(card => cardDataUrl(card.identity, theme.card)), ...images.keys()]);
  await Promise.all([...urls].map(async url => {
    const image = images.get(url) ?? new Image();
    if (!image.src) image.src = url;
    if (typeof image.decode === 'function') await image.decode();
    else if (!image.complete) await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve(); image.onerror = () => reject(new Error('Card artwork unavailable'));
    });
  }));
}

/** The coordinator owns leases, cancellation, budgets and restoration. Presets
 * only own temporary presentation nodes and cannot alter underlying game data.
 */
export class AnimationCoordinator {
  private runs = new Set<Run>();
  private seen = new Set<string>();
  private disposed = false;
  private readonly cancelForGeometry = (): void => this.cancelAll();
  private readonly visibilityChanged = (): void => { if (document.visibilityState === 'hidden') this.cancelAll(); };
  private readonly motionChanged = (): void => { if (this.motionPreference?.matches) this.cancelAll(); };
  private motionPreference: MediaQueryList | undefined;

  constructor(private host: HTMLElement) {
    window.addEventListener('resize', this.cancelForGeometry);
    window.addEventListener('scroll', this.cancelForGeometry, true);
    window.addEventListener('pagehide', this.cancelForGeometry);
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.motionPreference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined;
    this.motionPreference?.addEventListener?.('change', this.motionChanged);
  }

  play(event: VisualEvent, theme: Theme, options: PlayOptions = {}): AnimationHandle {
    const street = streetForEvent(event.type);
    if (event.type === 'HAND_VISUAL_RESET') this.cancelAll();
    if (this.disposed || !street || !event.cards.length || event.cards.length > 24 || !event.cards.every(validateGeometry)) return completed(options.onProgress);
    if ((street === 'flop' && event.cards.length !== 3) || ((street === 'turn' || street === 'river') && event.cards.length !== 1)) return completed(options.onProgress);
    if (![event.origin.x, event.origin.y].every(Number.isFinite)) return completed(options.onProgress);
    // Adapter emits epoch milliseconds; tolerate performance time in independent consumers.
    const age = (event.timestamp > 1e12 ? Date.now() : performance.now()) - event.timestamp;
    if (event.cards.some(card => card.source) && Number.isFinite(age) && age > 1600) return completed(options.onProgress);
    if (this.seen.has(event.id)) return completed(options.onProgress);
    this.seen.add(event.id);
    if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!);
    if (options.reducedMotion || this.motionPreference?.matches || document.visibilityState === 'hidden') return completed(options.onProgress);

    const assigned = theme.animations[street];
    let preset = getPreset(options.presetId ?? assigned.preset);
    if (!preset?.supportedEvents.includes(street)) preset = presetsForStreet(street)[0];
    if (!preset) return completed(options.onProgress);
    const raw = options.parameters ?? assigned.parameters;
    const parameters: Record<string, number> = {};
    for (const schema of preset.parameters) {
      const value = raw[schema.key];
      parameters[schema.key] = clamp(typeof value === 'number' && Number.isFinite(value) ? value : schema.default, schema.min, schema.max);
    }
    const speed = clamp(Number.isFinite(options.speed) ? options.speed! : 1, 0.1, 4) * (parameters.speed ?? 1);
    const duration = clamp((parameters.duration ?? preset.duration) / speed, 120, 10000);
    for (const run of this.runs) if (run.cards.some(a => event.cards.some(b => conflicts(a, b)))) run.cancel();
    // Bound concurrent presentation and fragment layers without delaying gameplay.
    if (this.runs.size >= 3) this.runs.values().next().value?.cancel();

    const layer = document.createElement('div');
    layer.dataset.pncOverlay = 'true';
    layer.dataset.pncOwned = 'true';
    layer.dataset.pncPreset = preset.id;
    layer.setAttribute('aria-hidden', 'true');
    const center = cardCenter(event.cards);
    Object.assign(layer.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh',
      pointerEvents: 'none', visibility: 'hidden', overflow: 'visible', zIndex: '2147483600', perspective: '1100px',
      perspectiveOrigin: `${center.x}px ${center.y}px`, transformStyle: 'preserve-3d' });
    this.host.append(layer);

    const leases: SourceLease[] = [];
    let timeline: Timeline | undefined, done = false, paused = false, progress = 0;
    let resolveFinished: () => void = () => {};
    const finished = new Promise<void>(resolve => { resolveFinished = resolve; });
    let watchdog = 0;
    const release = (): void => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      try { timeline?.stop(); } finally {
        for (const lease of leases) {
          try {
            if (lease.source.dataset.pncConcealed !== 'true') continue;
            // Restore only our own style, preserving any unrelated native updates.
            if (lease.source.style.getPropertyValue('visibility') === 'hidden' && lease.source.style.getPropertyPriority('visibility') === 'important') {
              if (lease.visibility) lease.source.style.setProperty('visibility', lease.visibility, lease.priority);
              else lease.source.style.removeProperty('visibility');
            }
            if (lease.marker === null) lease.source.removeAttribute('data-pnc-concealed');
            else lease.source.setAttribute('data-pnc-concealed', lease.marker);
          } catch { /* Continue restoring the other cards if a detached node changes. */ }
        }
        layer.remove();
        this.runs.delete(run);
        resolveFinished();
      }
    };
    const run: Run = { id: event.id, layer, cards: event.cards, cancel: release };
    this.runs.add(run);
    watchdog = window.setTimeout(release, 12000);
    const handle: AnimationHandle = {
      finished,
      get progress() { return progress; },
      pause() { paused = true; timeline?.pause(); },
      resume() { paused = false; if (!done) timeline?.start(); },
      cancel: release,
      finish() {
        if (done) return;
        if (timeline) timeline.finish(); else { progress = 1; release(); }
      },
    };
    let tracks: TimelineTrack[];
    try {
      tracks = preset.build({ event, theme, parameters, layer, center,
        intensity: clamp((parameters.intensity ?? 1) * (street === 'river' ? parameters.riverBoost ?? 1 : 1), 0.2, 2),
        card: card => cardObject(card, theme, layer) });
      if (!tracks.length || tracks.length > 512 || !layer.childElementCount || layer.querySelectorAll('*').length > 600
        || tracks.some(track => !Number.isFinite(track.start) || !Number.isFinite(track.end) || track.start < 0 || track.end > 1 || track.end <= track.start || typeof track.update !== 'function')) { release(); return handle; }
      // Prepare the initial frame before concealment; failed tracks never own a source.
      for (const track of tracks) track.update(0);
    } catch (error) { console.warn('[PokerNow Customizer] Animation preparation failed safely.', error); release(); return handle; }

    void prepareArtwork(event.cards, theme, layer).then(() => {
      if (done) return;
      if (!this.host.isConnected || !layer.isConnected || event.cards.some(card => card.source && !card.source.isConnected)) { release(); return; }
      try {
        for (const card of event.cards) {
          const source = card.source;
          if (!source) continue;
          if (source.matches('button,input,select,textarea') || source.querySelector('button,input,select,textarea')) { release(); return; }
          const lease: SourceLease = { source, visibility: source.style.getPropertyValue('visibility'), priority: source.style.getPropertyPriority('visibility'), marker: source.getAttribute('data-pnc-concealed') };
          leases.push(lease);
          source.dataset.pncConcealed = 'true';
          source.style.setProperty('visibility', 'hidden', 'important');
        }
        layer.style.visibility = 'visible';
        timeline = new Timeline(tracks, { duration,
          beforeFrame: () => !done && this.host.isConnected && layer.isConnected && event.cards.every(card => !card.source || card.source.isConnected),
          onProgress: value => { progress = value; options.onProgress?.(value); },
          onEnd: release,
          onError: error => { console.warn('[PokerNow Customizer] Animation recovered safely.', error); release(); },
        });
        if (!paused) timeline.start();
      } catch (error) { console.warn('[PokerNow Customizer] Source replacement recovered safely.', error); release(); }
    }, error => { console.warn('[PokerNow Customizer] Artwork unavailable; original cards remain visible.', error); release(); });
    return handle;
  }

  cancelAll(): void { for (const run of [...this.runs]) run.cancel(); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelAll();
    this.seen.clear();
    window.removeEventListener('resize', this.cancelForGeometry);
    window.removeEventListener('scroll', this.cancelForGeometry, true);
    window.removeEventListener('pagehide', this.cancelForGeometry);
    document.removeEventListener('visibilitychange', this.visibilityChanged);
    this.motionPreference?.removeEventListener?.('change', this.motionChanged);
  }
}

export type { AnimationHandle, PlayOptions } from './types';
