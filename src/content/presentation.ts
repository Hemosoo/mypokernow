import type { Theme, VisualCard } from '../types';
import { cardDataUrl } from '../rendering/cards';
import type { TablePresentationSnapshot } from '../adapter/pokernow/snapshot';

interface PropertyLease { before: string; priority: string; applied: string; appliedPriority: string; requested?: string; requestedPriority?: string }

/** Restore only properties still owned by this extension; site updates win. */
export class StyleLedger {
  private readonly leases = new Map<HTMLElement, Map<string, PropertyLease>>();

  set(element: HTMLElement, property: string, value: string, priority = ''): void {
    let properties = this.leases.get(element);
    if (!properties) { properties = new Map(); this.leases.set(element, properties); }
    let lease = properties.get(property);
    if (!lease) {
      lease = { before: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property), applied: '', appliedPriority: '' };
      properties.set(property, lease);
    } else if (element.style.getPropertyValue(property) !== lease.applied || element.style.getPropertyPriority(property) !== lease.appliedPriority) {
      // Preserve the site's latest value if it updated a style while customization was active.
      lease.before = element.style.getPropertyValue(property);
      lease.priority = element.style.getPropertyPriority(property);
    }
    // CSSOM normalizes values (for example #234b43 → rgb(...)). Compare the
    // requested value as well as the resulting owned style to avoid observer loops.
    if (lease.requested === value && lease.requestedPriority === priority &&
      element.style.getPropertyValue(property) === lease.applied && element.style.getPropertyPriority(property) === lease.appliedPriority) return;
    if (element.style.getPropertyValue(property) !== value || element.style.getPropertyPriority(property) !== priority) element.style.setProperty(property, value, priority);
    lease.applied = element.style.getPropertyValue(property);
    lease.appliedPriority = element.style.getPropertyPriority(property);
    lease.requested = value;
    lease.requestedPriority = priority;
  }

  restore(element?: HTMLElement): void {
    for (const [target, properties] of this.leases) {
      if (element && target !== element) continue;
      for (const [property, lease] of properties) {
        if (target.style.getPropertyValue(property) === lease.applied && target.style.getPropertyPriority(property) === lease.appliedPriority) {
          if (lease.before) target.style.setProperty(property, lease.before, lease.priority);
          else target.style.removeProperty(property);
        }
      }
      this.leases.delete(target);
    }
  }
}

function safeImage(value: string | undefined): string | undefined {
  return value && /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(value) ? value : undefined;
}

/** Static local presentation. Artwork layers have no gameplay handlers or accessible focus. */
export class TablePresentation {
  private readonly styles = new StyleLedger();
  private readonly cards = new Map<HTMLElement, { image: HTMLImageElement; signature: string }>();
  private table: HTMLElement | undefined;
  private board: HTMLElement | undefined;

  apply(snapshot: TablePresentationSnapshot, theme: Theme): void {
    if (this.table && this.table !== snapshot.table) this.clear();
    if (this.board && this.board !== snapshot.boardElement) this.styles.restore(this.board);
    this.table = snapshot.table;
    this.board = snapshot.boardElement;
    // Native themes use !important in some layouts. Every override remains
    // leased so disabling restores the exact previous value and priority.
    this.styles.set(snapshot.table, 'background-color', theme.table.feltColor, 'important');
    this.styles.set(snapshot.table, 'border-color', theme.table.railColor, 'important');
    const background = safeImage(theme.table.backgroundImage);
    this.styles.set(snapshot.table, 'background-image', background ? `url("${background}")` : 'none', 'important');
    if (background) { this.styles.set(snapshot.table, 'background-size', 'cover', 'important'); this.styles.set(snapshot.table, 'background-position', 'center', 'important'); }
    this.styles.set(snapshot.table.ownerDocument.body, 'background-color', theme.table.backgroundColor, 'important');
    if (snapshot.boardElement) {
      this.styles.set(snapshot.boardElement, 'background-color', theme.board.color, 'important');
      this.styles.set(snapshot.boardElement, 'box-shadow', `0 0 ${theme.board.shadow * 24}px ${theme.board.highlight}`, 'important');
    }
    // Layout-dependent spacing is preview-only until actual PokerNow layout behavior is verified.
    const visible = new Set([...snapshot.board, ...snapshot.holes].map((card) => card.source).filter((element): element is HTMLElement => Boolean(element)));
    for (const [source, entry] of this.cards) {
      if (!visible.has(source)) { entry.image.remove(); this.cards.delete(source); this.styles.restore(source); }
    }
    for (const card of [...snapshot.board, ...snapshot.holes]) this.applyCard(card, theme);
  }

  private applyCard(card: VisualCard, theme: Theme): void {
    const source = card.source;
    if (!source) return;
    // "native" retains the site's visible face. Backs can still be customized independently.
    if (card.identity && theme.card.face === 'native') {
      this.cards.get(source)?.image.remove();
      this.cards.delete(source);
      this.styles.restore(source);
      return;
    }
    const signature = JSON.stringify([card.identity, theme.card]);
    let entry = this.cards.get(source);
    if (!entry) {
      const image = document.createElement('img');
      image.setAttribute('data-pnc-owned', 'card-artwork');
      image.setAttribute('aria-hidden', 'true');
      image.alt = '';
      image.draggable = false;
      image.style.cssText = 'all:initial!important;position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;display:block!important;pointer-events:none!important;z-index:2!important;object-fit:fill!important;visibility:inherit!important;';
      entry = { image, signature: '' };
      this.cards.set(source, entry);
      if (getComputedStyle(source).position === 'static') this.styles.set(source, 'position', 'relative', 'important');
      source.append(image);
    }
    if (entry.signature !== signature) {
      entry.image.src = cardDataUrl(card.identity, theme.card);
      entry.signature = signature;
    }
    this.styles.set(source, 'border-radius', `${theme.card.borderRadius}px`, 'important');
    this.styles.set(source, 'box-shadow', `0 ${theme.card.shadow * 3}px ${theme.card.shadow * 10}px #0008`, 'important');
  }

  clear(): void {
    for (const { image } of this.cards.values()) image.remove();
    this.cards.clear();
    this.styles.restore();
    this.table = undefined;
    this.board = undefined;
  }
}
