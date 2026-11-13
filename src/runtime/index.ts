import { PokerNowAdapter } from '../adapter/pokernow';
import { describeUnsupported, inspectLayout, type ObservedLayout } from '../adapter/pokernow/diagnostics';
import { AnimationCoordinator, warmArtwork, type AnimationHandle } from '../animation/core/coordinator';
import { Skin } from '../skin';
import { Stage } from '../stage/stage';
import type { Settings, Theme, VisualCard, VisualEvent } from '../types';
import type { Companion, CompanionModule } from '../puppy/types';
import { planForEvent } from '../puppy/plan';
import { isCompanionPreset } from '../animation/presets/puppy';

/** Marks a card the extension has finished deciding about; see `pnc-hold` in the skin. */
const RELEASED = 'data-pnc-released';
/** Longest a card waits to be taken in by the table reading (the stylesheet's own cap is longer). */
const HOLD_LIMIT = 2200;
/** What a card shows: a released card that starts showing something else is held again. */
const showing = (card: Element): string => `${card.classList.contains('flipped') ? 'u' : 'd'}${card.classList.contains('not-visible') ? 'n' : 'v'}`
  + `${card.querySelector('.value')?.textContent ?? ''}${card.querySelector('.suit')?.textContent ?? ''}`;
const release = (card: HTMLElement): void => { if (card.isConnected && !card.hasAttribute(RELEASED)) card.setAttribute(RELEASED, showing(card)); };

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
  /**
   * Loads the table-companion module (the 3D puppy) on demand. Only themes with a
   * companion call it, so other skins never download or run the 3D renderer.
   */
  loadCompanion?(): Promise<CompanionModule>;
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
  /** Cards in the latest accepted table reading, by element. */
  private accounted = new Map<HTMLElement, VisualCard>();
  private readonly heldSince = new WeakMap<HTMLElement, number>();
  private disposed = false;
  private readonly surface: HTMLElement;
  private companion: Companion | undefined;
  private companionModule: Promise<CompanionModule> | undefined;
  private companionRevision = 0;
  private readonly onGeometry = (): void => { this.stage.settle(); this.companion?.geometry(); };

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
    this.surface = surface;
    document.documentElement.append(this.host);
    this.skin = new Skin(document, { fontBase: options.fontBase });
    this.stage = new Stage(surface, this.skin, document);
    this.coordinator = new AnimationCoordinator(surface);
    this.adapter = new PokerNowAdapter({
      allowAnyLocation: options.allowAnyLocation,
      onInvalidate: () => this.coordinator.cancelAll(),
      onPresentation: (snapshot) => { this.appearanceActive = Boolean(snapshot && this.theme); this.table = snapshot?.table; },
      onScanEnd: () => this.releaseCards(),
      onTable: (state) => { this.stage.sync(state); this.companion?.table(state); },
      onUnsupported: () => this.report('unsupported', describeUnsupported(inspectLayout(document), this.appearanceActive)),
      onSnapshot: (snapshot) => {
        this.accounted = new Map([...snapshot.board, ...snapshot.holes].flatMap((card) => card.source ? [[card.source, card] as const] : []));
        this.report('ready', 'The skin is active and the table is being followed. Cards already on the felt are not replayed.',
          { profile: snapshot.profile, tableCount: 1, boardCount: 1, seatCount: snapshot.seats.length, cardCount: snapshot.board.length + snapshot.holes.length });
      },
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
      this.watchCards(false);
      this.appearanceActive = false;
      this.releaseCompanion();
      return;
    }
    this.skin.apply(this.theme, settings.reducedMotion);
    this.stage.configure(this.theme, settings.effects, settings.reducedMotion);
    this.syncCompanion(this.theme, settings);
    // Cards hold for a beat on entry only while an animation could take them over.
    if (settings.reducedMotion) { root.removeAttribute('data-pnc-cards'); this.watchCards(false); }
    else { root.setAttribute('data-pnc-cards', 'animated'); this.watchCards(true); warmArtwork(this.theme); }
    this.adapter.start();
    this.adapter.scan();
  }

  scan(): void { if (this.theme) this.adapter.scan(); }

  /** The table companion's state, for tests and diagnostics; undefined when none is present. */
  companionDebug(): ReturnType<NonNullable<Companion['debug']>> | undefined { return this.companion?.debug?.(); }

  /** Create, update or remove the table companion to match the theme. */
  private syncCompanion(theme: Theme, settings: Settings): void {
    // The Puppy room keeps its puppy on the table. Any other room that uses a puppy card
    // animation gets a visitor, who appears for those animations only and then leaves.
    const wanted = Boolean(theme.companion) || Object.values(theme.animations).some((assignment) => isCompanionPreset(assignment.preset));
    if (!wanted || !this.options.loadCompanion) { this.releaseCompanion(); return; }
    if (this.companion) { this.companion.configure(theme, settings); this.stage.setDirector(theme.companion ? this.companion.director : undefined); return; }
    const revision = ++this.companionRevision;
    this.companionModule ??= this.options.loadCompanion();
    this.companionModule.then((module) => {
      // The theme may have changed (or the runtime gone) while the module loaded.
      if (this.disposed || revision !== this.companionRevision || !this.theme || this.companion) return;
      const companion = module.createCompanion(this.surface, this.options.document);
      if (!companion) return;
      this.companion = companion;
      companion.configure(this.theme, this.settings!);
      this.stage.setDirector(this.theme.companion ? companion.director : undefined);
      this.adapter.scan();
    }, () => { this.companionModule = undefined; });
  }

  /**
   * The site may reuse a board card's element for the next street (an empty slot
   * that is filled and turned over) instead of inserting a new one. Mutation
   * callbacks run before the page is painted, so a released board card that starts
   * showing something new is held again in time, exactly like a new card.
   */
  private cardWatch: MutationObserver | undefined;
  private watchCards(on: boolean): void {
    if (!on) { this.cardWatch?.disconnect(); this.cardWatch = undefined; return; }
    if (this.cardWatch || typeof MutationObserver === 'undefined') return;
    this.cardWatch = new MutationObserver((records) => {
      const seen = new Set<Element>();
      for (const record of records) {
        const node = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
        const card = node?.closest('.table-cards .card-container');
        if (!card || seen.has(card)) continue;
        seen.add(card);
        const was = card.getAttribute(RELEASED);
        if (was !== null && was !== showing(card) && !card.hasAttribute('data-pnc-concealed')) card.removeAttribute(RELEASED);
      }
    });
    this.cardWatch.observe(this.options.document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  }

  private releaseCompanion(): void {
    this.companionRevision++;
    this.stage.setDirector(undefined);
    this.companion?.dispose();
    this.companion = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const view = this.options.document.defaultView ?? window;
    view.removeEventListener('resize', this.onGeometry);
    view.removeEventListener('scroll', this.onGeometry, true);
    this.adapter.stop();
    this.releaseCompanion();
    this.coordinator.dispose();
    this.stage.dispose();
    this.skin.clear();
    this.options.document.documentElement.removeAttribute('data-pnc-cards');
    this.watchCards(false);
    for (const card of this.options.document.querySelectorAll(`[${RELEASED}]`)) card.removeAttribute(RELEASED);
    this.awaiting.clear();
    clearTimeout(this.recheckTimer);
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
      const handle = this.coordinator.play(event, this.theme, { speed: this.settings.speed, reducedMotion: this.settings.reducedMotion,
        // Once the overlay has taken over, the hold on the originals is no longer needed.
        onConcealed: (concealed) => { for (const source of concealed) release(source); },
        companionReady: Boolean(this.companion?.ready()) });
      this.options.onAnimation?.(handle, event);
      if (handle.progress < 1) this.companion?.animation(handle, event, planForEvent(event.id));
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
   * so a flop never shows one card early. The stylesheet caps the wait at two and a half seconds,
   * so a card can never stay hidden if this code does not run.
   */
  private releaseCards(): void {
    const table = this.table;
    if (!table || !table.isConnected) return;
    const boardCards = Array.from(table.querySelectorAll<HTMLElement>('.table-cards .card-container:not(.not-visible)'));
    const turning = boardCards.some((card) => !card.classList.contains('flipped'));
    const now = Date.now();
    for (const card of table.querySelectorAll<HTMLElement>(`.table-cards .card-container, .table-player-cards .card-container`)) {
      if (card.hasAttribute(RELEASED) || this.awaiting.has(card)) continue;
      // Nothing to see yet: an empty slot, or a hand the site keeps hidden.
      const unseen = card.classList.contains('not-visible') || Boolean(card.closest('.hide-cards'));
      if (!unseen) {
        // A card is shown only once the table reading has taken it in: while it is still
        // sliding in, turning over or being filled in, a reading can miss it, and showing it
        // then would give it away a moment before its animation starts.
        const known = this.accounted.get(card);
        const pending = (turning && boardCards.includes(card)) || !known || (card.classList.contains('flipped') && !known.identity);
        if (pending) {
          const since = this.heldSince.get(card) ?? now;
          this.heldSince.set(card, since);
          // Never hold for good: a card the reading cannot take in is shown after a short wait.
          if (now - since < HOLD_LIMIT) { this.recheck(); continue; }
        }
      }
      release(card);
    }
  }

  /** While a card is held, look again shortly even if the page goes quiet. */
  private recheckTimer: ReturnType<typeof setTimeout> | undefined;
  private recheck(): void {
    if (this.recheckTimer) return;
    this.recheckTimer = setTimeout(() => { this.recheckTimer = undefined; if (!this.disposed) this.adapter.scan(); }, 120);
  }
}
