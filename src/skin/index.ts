import type { Theme } from '../types';
import { buildSkinCss, SKIN_ATTRIBUTE, type SkinOptions } from './css';

/**
 * Owns the two style elements the extension adds to the page and the single
 * attribute that switches the skin on. No PokerNow node is modified.
 */
export class Skin {
  private sheet: HTMLStyleElement | undefined;
  private live: HTMLStyleElement | undefined;
  private signature = '';
  private liveRules = '';

  constructor(private readonly document: Document, private readonly options: SkinOptions = {}) {}

  get active(): boolean { return this.document.documentElement.hasAttribute(SKIN_ATTRIBUTE); }

  apply(theme: Theme, reducedMotion = false): void {
    const root = this.document.documentElement;
    const signature = JSON.stringify([theme.card, theme.table, theme.board]);
    if (!this.sheet || !this.sheet.isConnected) {
      this.sheet = this.create('skin');
      this.signature = '';
    }
    if (signature !== this.signature) {
      this.sheet.textContent = buildSkinCss(theme, this.options);
      this.signature = signature;
    }
    if (root.getAttribute(SKIN_ATTRIBUTE) !== 'on') root.setAttribute(SKIN_ATTRIBUTE, 'on');
    const motion = reducedMotion ? 'reduced' : 'full';
    if (root.getAttribute('data-pnc-motion') !== motion) root.setAttribute('data-pnc-motion', motion);
  }

  /** Per-seat rules that change during play (chip stacks); kept apart so the main sheet is parsed once. */
  setLiveRules(rules: string): void {
    if (rules === this.liveRules && this.live?.isConnected) return;
    if (!this.live || !this.live.isConnected) this.live = this.create('live');
    this.live.textContent = rules;
    this.liveRules = rules;
  }

  clear(): void {
    const root = this.document.documentElement;
    root.removeAttribute(SKIN_ATTRIBUTE);
    root.removeAttribute('data-pnc-motion');
    this.sheet?.remove();
    this.live?.remove();
    this.sheet = undefined;
    this.live = undefined;
    this.signature = '';
    this.liveRules = '';
  }

  private create(kind: string): HTMLStyleElement {
    const style = this.document.createElement('style');
    style.setAttribute('data-pnc-owned', kind);
    (this.document.head ?? this.document.documentElement).append(style);
    return style;
  }
}

export { buildSkinCss, SKIN_ATTRIBUTE, type SkinOptions } from './css';
