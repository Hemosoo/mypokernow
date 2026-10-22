import type { VisualEvent } from '../../types';
import { VisualDiffer } from './diff';
import { OWNED_SELECTOR } from './selectors';
import { takePresentationSnapshot, takeSnapshot, type TablePresentationSnapshot, type TableSnapshot } from './snapshot';

export interface PokerNowAdapterOptions {
  onEvent(event: VisualEvent): void;
  onPresentation?(snapshot: TablePresentationSnapshot | undefined): void;
  onSnapshot?(snapshot: TableSnapshot): void;
  onInvalidate?(): void;
  onUnsupported?(): void;
  allowFixture?: boolean;
}

export class PokerNowAdapter {
  private readonly differ = new VisualDiffer();
  private readonly identityCache = new WeakMap();
  private observer: MutationObserver | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private last: TableSnapshot | undefined;
  private active = false;
  private pathname = '';
  private unsupportedSince = 0;
  private routeTimer: ReturnType<typeof setInterval> | undefined;
  private readonly invalidate = () => {
    this.options.onInvalidate?.();
    this.differ.baseline();
    this.last = undefined;
    this.schedule();
  };
  private readonly visibility = () => {
    this.options.onInvalidate?.();
    this.differ.baseline();
    this.last = undefined;
    if (!this.document.hidden) this.schedule();
  };

  constructor(private readonly options: PokerNowAdapterOptions, private readonly document: Document = window.document) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.pathname = this.document.location.pathname;
    this.observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => this.ownedMutation(mutation))) return;
      this.schedule();
    });
    this.observer.observe(this.document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    window.addEventListener('resize', this.invalidate);
    window.addEventListener('scroll', this.invalidate, { passive: true, capture: true });
    this.document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('popstate', this.invalidate);
    this.routeTimer = setInterval(() => {
      if (this.pathname !== this.document.location.pathname) {
        this.pathname = this.document.location.pathname;
        this.invalidate();
      }
    }, 1000);
    this.scan();
  }

  stop(): void {
    this.active = false;
    this.observer?.disconnect();
    clearTimeout(this.timer);
    this.timer = undefined;
    clearInterval(this.routeTimer);
    this.routeTimer = undefined;
    window.removeEventListener('resize', this.invalidate);
    window.removeEventListener('scroll', this.invalidate, true);
    this.document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('popstate', this.invalidate);
    this.options.onInvalidate?.();
    this.options.onPresentation?.(undefined);
    this.last = undefined;
    this.unsupportedSince = 0;
    this.differ.baseline();
  }

  private ownedMutation(mutation: MutationRecord): boolean {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
    if (target?.closest(OWNED_SELECTOR)) return true;
    if (mutation.type === 'childList') {
      const changed = [...mutation.addedNodes, ...mutation.removedNodes];
      return changed.length > 0 && changed.every((node) => node instanceof Element && node.matches(OWNED_SELECTOR));
    }
    return false;
  }

  private schedule(): void {
    if (!this.active || this.document.hidden || this.timer) return;
    // A bounded batching window avoids three unrelated one-card flop effects.
    this.timer = setTimeout(() => { this.timer = undefined; this.scan(); }, 100);
  }

  /** Public for deterministic local fixture verification; normal callers use start/stop. */
  scan(): void {
    if (!this.active || this.document.hidden) return;
    if (!this.options.allowFixture && !/^\/games\/[^/]+/.test(this.document.location.pathname)) {
      if (this.last) this.options.onInvalidate?.();
      this.last = undefined;
      this.differ.baseline();
      this.options.onPresentation?.(undefined);
      this.options.onUnsupported?.();
      return;
    }
    try {
      this.options.onPresentation?.(takePresentationSnapshot(this.document, this.identityCache, this.options.allowFixture ?? false));
      if (this.unsupportedSince && Date.now() - this.unsupportedSince > 600) {
        this.last = undefined;
        this.differ.baseline();
      }
      const next = takeSnapshot(this.document, this.identityCache, this.options.allowFixture ?? false);
      if (!next) {
        this.unsupportedSince ||= Date.now();
        if (this.last) this.options.onInvalidate?.();
        // Retain a valid previous signature briefly across partially built ranks/flops.
        // A disconnected table must establish a new baseline when it reappears.
        if (this.last && !this.last.table.isConnected) { this.last = undefined; this.differ.baseline(); }
        this.options.onUnsupported?.();
        return;
      }
      this.unsupportedSince = 0;
      if (this.last) {
        const previous = [...this.last.board, ...this.last.holes];
        const current = [...next.board, ...next.holes];
        const geometryChanged = previous.some((card) => {
          const replacement = current.find((candidate) => candidate.id === card.id);
          return !replacement || replacement.source !== card.source ||
            ['x', 'y', 'width', 'height'].some((key) => Math.abs(replacement.target[key as keyof typeof card.target] - card.target[key as keyof typeof card.target]) > 0.75);
        });
        if (geometryChanged || next.table !== this.last.table) this.options.onInvalidate?.();
      }
      this.last = next;
      this.options.onSnapshot?.(next);
      for (const event of this.differ.observe(next)) this.options.onEvent(event);
    } catch {
      this.options.onInvalidate?.();
      this.options.onPresentation?.(undefined);
      this.options.onUnsupported?.();
    }
  }
}
