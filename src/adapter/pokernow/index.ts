import type { VisualEvent } from '../../types';
import { VisualDiffer } from './diff';
import { OWNED_SELECTOR } from './selectors';
import { locateTable, takePresentationSnapshot, takeSnapshot, type TablePresentationSnapshot, type TableSnapshot } from './snapshot';
import { readTableState, type TableState } from './table-state';

export interface PokerNowAdapterOptions {
  onEvent(event: VisualEvent): void;
  onPresentation?(snapshot: TablePresentationSnapshot | undefined): void;
  onSnapshot?(snapshot: TableSnapshot): void;
  /** Seats, bets and pot as currently shown; undefined when no live table is recognised. */
  onTable?(state: TableState | undefined): void;
  onInvalidate?(): void;
  onUnsupported?(): void;
  /** After every scan, once its events (if any) have been delivered. */
  onScanEnd?(): void;
  allowFixture?: boolean;
  /** The studio's preview table lives outside a /games/ address. */
  allowAnyLocation?: boolean;
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
    const Observer = (this.document.defaultView ?? window).MutationObserver ?? MutationObserver;
    this.observer = new Observer((mutations) => {
      if (mutations.every((mutation) => this.ownedMutation(mutation) || this.clockTick(mutation))) return;
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
    this.options.onTable?.(undefined);
    this.last = undefined;
    this.unsupportedSince = 0;
    this.differ.baseline();
  }

  private ownedMutation(mutation: MutationRecord): boolean {
    const target = mutation.target.nodeType === 1 ? mutation.target as Element : mutation.target.parentElement;
    if (target?.closest(OWNED_SELECTOR)) return true;
    if (mutation.type === 'childList') {
      const changed = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
      return changed.length > 0 && changed.every((node) => node.nodeType === 1 && (node as Element).matches(OWNED_SELECTOR));
    }
    return false;
  }

  /** The action clock repaints its width many times a second; that alone changes nothing we present. */
  private clockTick(mutation: MutationRecord): boolean {
    return mutation.type === 'attributes' && mutation.attributeName === 'style' &&
      Boolean((mutation.target as Element).parentElement?.classList.contains('time-to-talk'));
  }

  private schedule(): void {
    if (!this.active || this.document.hidden || this.timer) return;
    // A bounded batching window avoids three unrelated one-card flop effects.
    this.timer = setTimeout(() => { this.timer = undefined; this.scan(); }, 45);
  }

  /** Public for deterministic local fixture verification; normal callers use start/stop. */
  scan(): void {
    if (!this.active || this.document.hidden) return;
    try { this.scanOnce(); } finally { if (this.active) this.options.onScanEnd?.(); }
  }

  private scanOnce(): void {
    if (!this.options.allowFixture && !this.options.allowAnyLocation && !/^\/games\/[^/]+/.test(this.document.location.pathname)) {
      if (this.last) this.options.onInvalidate?.();
      this.last = undefined;
      this.differ.baseline();
      this.options.onPresentation?.(undefined);
      this.options.onTable?.(undefined);
      this.options.onUnsupported?.();
      return;
    }
    try {
      this.options.onPresentation?.(takePresentationSnapshot(this.document, this.identityCache, this.options.allowFixture ?? false));
      if (this.options.onTable) {
        const located = locateTable(this.document, this.options.allowFixture ?? false);
        this.options.onTable(located?.profile.id === 'pokernow' ? readTableState(located.table) : undefined);
      }
      // A street the site is still turning over (three flips 150 ms apart, plus page work on a busy
      // machine) must not be mistaken for a new table; only a long gap starts a fresh baseline.
      if (this.unsupportedSince && Date.now() - this.unsupportedSince > 1800) {
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
      this.options.onTable?.(undefined);
      this.options.onUnsupported?.();
    }
  }
}
