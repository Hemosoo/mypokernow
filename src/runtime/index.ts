import { PokerNowAdapter } from '../adapter/pokernow';
import { describeUnsupported, inspectLayout, type ObservedLayout } from '../adapter/pokernow/diagnostics';
import { AnimationCoordinator, type AnimationHandle } from '../animation/core/coordinator';
import { Skin } from '../skin';
import { Stage } from '../stage/stage';
import type { Settings, Theme, VisualEvent } from '../types';

/** Marks a card the extension has finished deciding about; see `pnc-hold` in the skin. */
const RELEASED = 'data-pnc-released';
const release = (card: HTMLElement): void => { if (card.isConnected && !card.hasAttribute(RELEASED)) card.setAttribute(RELEASED, ''); };

export type RuntimeState = 'starting' | 'ready' | 'unsupported' | 'disabled' | 'error';

export interface RuntimeOptions {
  document: Document;
  /** Where the bundled fonts are served from; omit to fall back to system fonts. */
  fontBase?: string;
  /** The studio preview is not a /games/ address. */
  allowAnyLocation?: boolean;
  onStatus?(state: RuntimeState, reason: string, layout: ObservedLayout): void;
  /** Called when a card animation starts, so a host can offer pause, progress and replay. */
  onAnimation?(handle: AnimationHandle, event: VisualEvent): void;
}

/**
 * One table, fully dressed: the skin stylesheet, the animation engine and the
 * stage, driven by a single observer. The content script runs this against
 * PokerNow; the studio runs the very same code against its preview table.
 */
export class Runtime {
  private readonly host: HTMLDivElement;
  private readonly coordinator: AnimationCoordinator;
  private readonly skin: Skin;
  private readonly stage: Stage;
  private readonly adapter: PokerNowAdapter;
  private theme: Theme | undefined;
  private settings: Settings | undefined;
  private appearanceActive = false;
  private table: HTMLElement | undefined;
  /** Cards handed to an accepted animation; the animation conceals and then restores them. */
  private readonly awaiting = new Set<HTMLElement>();
  private disposed = false;
  private readonly onGeometry = (): void => this.stage.settle();

  constructor(private readonly options: RuntimeOptions) {
    const document = options.document;
    this.host = document.createElement('div');
    this.host.setAttribute('data-pnc-overlay', 'runtime');
    this.host.setAttribute('aria-hidden', 'true');
    this.host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;pointer-events:none;overflow:visible;';
    const shadow = this.host.attachShadow({ mode: 'closed' });
    const surface = document.createElement('div');
    surface.setAttribute('data-pnc-overlay', 'surface');
    surface.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:visible;';
    shadow.append(surface);
    document.documentElement.append(this.host);
    this.skin = new Skin(document, { fontBase: options.fontBase });
    this.stage = new Stage(surface, this.skin, document);
    this.coordinator = new AnimationCoordinator(surface);
    this.adapter = new PokerNowAdapter({
      allowAnyLocation: options.allowAnyLocation,
      onInvalidate: () => this.coordinator.cancelAll(),
      onPresentation: (snapshot) => { this.appearanceActive = Boolean(snapshot && this.theme); this.table = snapshot?.table; },
      onScanEnd: () => this.releaseCards(),
      onTable: (state) => this.stage.sync(state),
      onUnsupported: () => this.report('unsupported', describeUnsupported(inspectLayout(document), this.appearanceActive)),
      onSnapshot: (snapshot) => this.report('ready', 'The skin is active and the table is being followed. Cards already on the felt are not replayed.',
        { profile: snapshot.profile, tableCount: 1, boardCount: 1, seatCount: snapshot.seats.length, cardCount: snapshot.board.length + snapshot.holes.length }),
      onEvent: (event) => this.animate(event),
    }, document);
    const view = document.defaultView ?? window;
    view.addEventListener('resize', this.onGeometry);
    view.addEventListener('scroll', this.onGeometry, { passive: true, capture: true });
  }

  get state(): { theme: Theme | undefined; settings: Settings | undefined } { return { theme: this.theme, settings: this.settings }; }

  /** Apply a theme and settings; pass no theme (or disabled settings) to restore the original page. */
  configure(theme: Theme | undefined, settings: Settings | undefined): void {
    if (this.disposed) return;
    this.coordinator.cancelAll();
    this.theme = theme && settings?.enabled ? theme : undefined;
    this.settings = settings;
    const root = this.options.document.documentElement;
    if (!this.theme || !settings) {
      this.adapter.stop();
      this.stage.configure(undefined, settings?.effects ?? { chips: false, celebrations: false, moments: false, ambience: false }, true);
      this.skin.clear();
      root.removeAttribute('data-pnc-cards');
      this.appearanceActive = false;
      return;
    }
    this.skin.apply(this.theme, settings.reducedMotion);
    this.stage.configure(this.theme, settings.effects, settings.reducedMotion);
    // Cards hold for a beat on entry only while an animation could take them over.
    if (settings.reducedMotion) root.removeAttribute('data-pnc-cards');
    else root.setAttribute('data-pnc-cards', 'animated');
    this.adapter.start();
    this.adapter.scan();
  }

  scan(): void { if (this.theme) this.adapter.scan(); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const view = this.options.document.defaultView ?? window;
    view.removeEventListener('resize', this.onGeometry);
    view.removeEventListener('scroll', this.onGeometry, true);
    this.adapter.stop();
    this.coordinator.dispose();
    this.stage.dispose();
    this.skin.clear();
    this.options.document.documentElement.removeAttribute('data-pnc-cards');
    for (const card of this.options.document.querySelectorAll(`[${RELEASED}]`)) card.removeAttribute(RELEASED);
    this.awaiting.clear();
    this.host.remove();
  }

  private report(state: RuntimeState, reason: string, layout: ObservedLayout = inspectLayout(this.options.document)): void {
    this.options.onStatus?.(state, reason, layout);
  }

  private animate(event: VisualEvent): void {
    if (!this.theme || !this.settings) return;
    if (event.type === 'TABLE_READY' || event.type === 'HAND_VISUAL_RESET') { this.coordinator.cancelAll(); return; }
    const sources = event.cards.map((card) => card.source).filter((source): source is HTMLElement => Boolean(source));
    try {
      const handle = this.coordinator.play(event, this.theme, { speed: this.settings.speed, reducedMotion: this.settings.reducedMotion });
      this.options.onAnimation?.(handle, event);
      // A declined event completes at once; its cards are released at the end of this scan.
      if (handle.progress < 1) {
        for (const source of sources) this.awaiting.add(source);
        const settle = (): void => { for (const source of sources) { this.awaiting.delete(source); release(source); } };
        void handle.finished.then(settle, () => { settle(); this.coordinator.cancelAll(); });
      }
    } catch {
      this.coordinator.cancelAll();
      this.report('error', 'An animation could not start; the original cards remain available.');
    }
  }

  /**
   * New cards stay hidden (see `pnc-hold` in the skin) until the extension has
   * decided their fate: an animation takes them over, or they are shown now.
   * Board cards still being turned over by the site wait for the whole street,
   * so a flop never shows one card early. The stylesheet caps the wait at one
   * second, so a card can never stay hidden if this code does not run.
   */
  private releaseCards(): void {
    const table = this.table;
    if (!table || !table.isConnected) return;
    const boardCards = Array.from(table.querySelectorAll<HTMLElement>('.table-cards .card-container:not(.not-visible)'));
    const turning = boardCards.some((card) => !card.classList.contains('flipped'));
    for (const card of table.querySelectorAll<HTMLElement>(`.table-cards .card-container, .table-player-cards .card-container`)) {
      if (card.hasAttribute(RELEASED) || this.awaiting.has(card)) continue;
      if (turning && boardCards.includes(card)) continue;
      release(card);
    }
  }
}
