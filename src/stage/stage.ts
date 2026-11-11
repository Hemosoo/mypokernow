import type { SeatState, TableState } from '../adapter/pokernow/table-state';
import { artOptions, cardDataUrl } from '../rendering/cards';
import { betArt, chipsFor, potArt, singleChipArt, type ChipArt, type ChipTone } from '../rendering/chips';
import { metal, rgba, safeHex } from '../rendering/color';
import { SKIN_ROOT } from '../skin/css';
import type { Skin } from '../skin';
import type { EffectSettings, Rect, Theme } from '../types';
import { diffTable, winTier, type TableAction, type WinTier } from './actions';

/**
 * The stage sits above the table and adds what a web page of numbers lacks:
 * chips that travel, a beat when someone moves all in, a win that scales with
 * the pot. Everything here is drawn in the extension's own overlay with
 * compositor-driven animations; PokerNow's elements are only measured.
 *
 * Resting chip stacks are not overlay objects at all. They are pseudo-elements
 * attached to PokerNow's own bet and pot labels through a small live
 * stylesheet, so they can never drift from the numbers they illustrate.
 */

/** Size of one chip-art unit in rem. Shared with the stylesheet through custom properties. */
export const CHIP_REM = 0.058;
const MAX_SPRITES = 140;

interface Point { x: number; y: number }
const center = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeIn = (t: number): number => t * t * t;
/** Under-damped spring normalised to settle at 1; overshoots by roughly a tenth. */
const spring = (t: number): number => 1 - Math.exp(-7.2 * t) * (Math.cos(11.5 * t) + 0.62 * Math.sin(11.5 * t)) * (1 - t * t * 0.06);
/** Deterministic variation, so a replayed moment looks the same. */
const hash = (index: number, seed: number): number => { const x = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };

const STAGE_CSS = `
.pnc-stage{position:fixed;inset:0;pointer-events:none;overflow:hidden;contain:layout style;font-family:"PNC Sans",Inter,system-ui,sans-serif}
.pnc-stage *{position:absolute;left:0;top:0;pointer-events:none;box-sizing:border-box}
.pnc-sprite{background-repeat:no-repeat;background-size:100% 100%;will-change:transform,opacity;backface-visibility:hidden}
.pnc-veil{inset:0;width:100%;height:100%;opacity:0}
.pnc-pressure{inset:0;width:100%;height:100%;opacity:0;background:radial-gradient(ellipse 72% 68% at 50% 50%,transparent 56%,rgba(190,40,34,.34) 100%)}
.pnc-pressure.on{animation:pnc-heart 1.15s ease-in-out infinite}
@keyframes pnc-heart{0%,100%{opacity:.18}12%{opacity:.85}24%{opacity:.3}36%{opacity:.7}60%{opacity:.18}}
.pnc-motes{overflow:visible}
.pnc-mote{border-radius:50%;opacity:0;will-change:transform,opacity;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes pnc-mote-a{0%{transform:translate3d(0,0,0);opacity:0}18%{opacity:var(--o)}55%{transform:translate3d(calc(var(--d)*.6),calc(var(--d)*-.9),0)}82%{opacity:var(--o)}100%{transform:translate3d(var(--d),calc(var(--d)*-1.6),0);opacity:0}}
@keyframes pnc-mote-b{0%{transform:translate3d(0,0,0);opacity:0}22%{opacity:var(--o)}50%{transform:translate3d(calc(var(--d)*-.7),calc(var(--d)*-.5),0)}78%{opacity:var(--o)}100%{transform:translate3d(calc(var(--d)*-.4),calc(var(--d)*-1.3),0);opacity:0}}
.pnc-badge{display:flex;align-items:center;justify-content:center;white-space:nowrap;font-weight:800;border-radius:99px;will-change:transform,opacity}
`;

export class Stage {
  private readonly root: HTMLDivElement;
  private readonly veil: HTMLDivElement;
  private readonly pressure: HTMLDivElement;
  private motes: HTMLDivElement | undefined;
  private motesKey = '';
  private theme: Theme | undefined;
  private effects: EffectSettings = { chips: true, celebrations: true, moments: true, ambience: true };
  private reduced = false;
  private previous: TableState | undefined;
  private bigBlind = 0;
  private potShown = 0;
  private potAwarded = false;
  private potTimer = 0;
  private lastRules = '';
  private readonly art = new Map<string, ChipArt>();
  private disposed = false;

  constructor(surface: HTMLElement, private readonly skin: Skin, private readonly document: Document) {
    const style = document.createElement('style');
    style.textContent = STAGE_CSS;
    this.root = document.createElement('div');
    this.root.className = 'pnc-stage';
    this.root.setAttribute('data-pnc-overlay', 'stage');
    this.root.setAttribute('aria-hidden', 'true');
    this.veil = document.createElement('div');
    this.veil.className = 'pnc-veil';
    this.pressure = document.createElement('div');
    this.pressure.className = 'pnc-pressure';
    this.root.append(this.veil, this.pressure);
    surface.append(style, this.root);
  }

  configure(theme: Theme | undefined, effects: EffectSettings, reducedMotion: boolean): void {
    const themeChanged = theme !== this.theme;
    this.theme = theme;
    this.effects = effects;
    this.reduced = reducedMotion;
    if (themeChanged) { this.art.clear(); this.motesKey = ''; }
    if (!theme) this.reset();
    else if (this.previous) this.writeRules(this.previous);
    this.updateAmbience(this.previous);
    if (!this.moving || !effects.moments) this.pressure.classList.remove('on');
  }

  /** Forget the table: no chips drawn, nothing in flight. */
  reset(): void {
    this.previous = undefined;
    this.potShown = 0;
    this.potAwarded = false;
    clearTimeout(this.potTimer);
    this.clearSprites();
    this.pressure.classList.remove('on');
    this.lastRules = '';
    this.skin.setLiveRules('');
    this.updateAmbience(undefined);
  }

  /** Drop whatever is in flight (resize, scroll, tab change) but keep resting chips. */
  settle(): void {
    this.clearSprites();
    this.previous = undefined;
  }

  sync(state: TableState | undefined): void {
    if (this.disposed) return;
    if (!state || !this.theme) { if (this.previous || this.lastRules) this.reset(); return; }
    if (state.bigBlind && state.bigBlind > 0) this.bigBlind = state.bigBlind;
    else if (!this.bigBlind) this.bigBlind = this.inferBigBlind(state);
    const before = this.previous;
    this.previous = state;
    let collecting = false;
    if (before) {
      const actions = diffTable(before, state);
      for (const action of actions) {
        if (action.type === 'new-hand') { this.potAwarded = false; }
        if (action.type === 'collect') collecting = true;
        if (action.type === 'award') this.potAwarded = true;
        this.perform(action, before, state);
      }
    }
    // The pot pile grows when the swept bets arrive, not when the number changes.
    const pot = this.potAwarded ? 0 : state.pot ?? 0;
    clearTimeout(this.potTimer);
    if (collecting && this.moving && this.effects.chips && pot > this.potShown) {
      this.potTimer = (this.document.defaultView ?? window).setTimeout(() => { this.potShown = pot; if (this.previous) this.writeRules(this.previous); }, 430);
    } else this.potShown = pot;
    this.writeRules(state);
    this.updateAmbience(state);
    const hero = state.seats.find((seat) => seat.you);
    this.pressure.classList.toggle('on', Boolean(this.moving && this.effects.moments && hero?.deciding && hero.urgent));
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.potTimer);
    this.root.remove();
    this.skin.setLiveRules('');
  }

  // ───────────────────────────────────────────────────────────── helpers

  private get moving(): boolean {
    const view = this.document.defaultView ?? window;
    return !this.reduced && !(typeof view.matchMedia === 'function' && view.matchMedia('(prefers-reduced-motion: reduce)').matches) && this.document.visibilityState !== 'hidden';
  }
  private get rem(): number {
    const size = Number.parseFloat((this.document.defaultView ?? window).getComputedStyle(this.document.documentElement).fontSize);
    return Number.isFinite(size) && size > 0 ? size : 16;
  }
  private get tones(): { trim: ReturnType<typeof metal>; glow: string } {
    return { trim: metal(this.theme!.table.trimColor), glow: safeHex(this.theme!.board.highlight, '#f2d08a') };
  }
  private inBigBlinds(amount: number): number { return amount / (this.bigBlind > 0 ? this.bigBlind : 1); }

  /** Without a blind readout, the smallest live bet is a fair stand-in for the big blind. */
  private inferBigBlind(state: TableState): number {
    const bets = state.seats.map((seat) => seat.bet ?? 0).filter((bet) => bet > 0).sort((a, b) => a - b);
    // Two blinds on the felt: the larger is the big blind, unless it is already a raise.
    if (bets.length >= 2) return bets[1]! <= bets[0]! * 2.5 ? bets[1]! : bets[0]!;
    if (bets.length === 1) return bets[0]!;
    return state.pot && state.pot > 0 ? state.pot / 3 : 0;
  }

  private cached(kind: 'bet' | 'pot', amount: number): ChipArt {
    const units = Math.round(this.inBigBlinds(amount) * 4) / 4;
    const key = `${kind}:${units}`;
    let art = this.art.get(key);
    if (!art) {
      art = kind === 'bet' ? betArt(units, this.theme!.table.trimColor) : potArt(units, this.theme!.table.trimColor);
      if (this.art.size > 80) this.art.delete(this.art.keys().next().value!);
      this.art.set(key, art);
    }
    return art;
  }

  private writeRules(state: TableState): void {
    let rules = '';
    if (this.theme && this.effects.chips) {
      const delay = this.moving ? '.22s' : '0s';
      for (const seat of state.seats) {
        if (!seat.bet || seat.bet <= 0) continue;
        const art = this.cached('bet', seat.bet);
        if (!art.url) continue;
        rules += `${SKIN_ROOT} .table-player-${seat.position} .table-player-bet-value{--pnc-chips:url("${art.url}");--pnc-chips-w:${(art.width * CHIP_REM).toFixed(3)}rem;--pnc-chips-h:${(art.height * CHIP_REM).toFixed(3)}rem;--pnc-chips-delay:${delay}}\n`;
      }
      if (this.potShown > 0) {
        const art = this.cached('pot', this.potShown);
        if (art.url) rules += `${SKIN_ROOT} .table-pot-size{--pnc-chips:url("${art.url}");--pnc-chips-w:${(art.width * CHIP_REM).toFixed(3)}rem;--pnc-chips-h:${(art.height * CHIP_REM).toFixed(3)}rem;--pnc-pot-pad:${(art.width * CHIP_REM * 0.94).toFixed(3)}rem}\n`;
      }
    }
    if (rules === this.lastRules) return;
    this.lastRules = rules;
    this.skin.setLiveRules(rules);
  }

  /** Where a seat's resting stack sits, mirroring the stylesheet's placement beside the bet label. */
  private stackRect(position: number, bet: Rect, art: ChipArt): Rect {
    const rem = this.rem, width = art.width * CHIP_REM * rem, height = art.height * CHIP_REM * rem, gap = 0.14 * rem;
    const right = position >= 3 && position <= 5;
    return { x: right ? bet.x + bet.width + gap : bet.x - gap - width, y: bet.y + bet.height + gap - height, width, height };
  }
  private potRect(state: TableState, art: ChipArt): Rect | undefined {
    if (!state.potRect) return undefined;
    const rem = this.rem, width = art.width * CHIP_REM * rem, height = art.height * CHIP_REM * rem;
    return { x: state.potRect.x + 0.42 * rem, y: state.potRect.y + state.potRect.height - 0.2 * rem - height, width, height };
  }

  private sprite(url: string, width: number, height: number, className = 'pnc-sprite'): HTMLDivElement | undefined {
    if (this.root.childElementCount > MAX_SPRITES) return undefined;
    const element = this.document.createElement('div');
    element.className = className;
    element.style.width = `${width.toFixed(2)}px`;
    element.style.height = `${height.toFixed(2)}px`;
    if (url) element.style.backgroundImage = `url("${url}")`;
    this.root.append(element);
    return element;
  }

  /** Run keyframes on the compositor and remove the element afterwards, whatever happens. */
  private play(element: HTMLElement, frames: Keyframe[], duration: number, delay = 0): void {
    const remove = (): void => element.remove();
    if (typeof element.animate !== 'function') { remove(); return; }
    try {
      const animation = element.animate(frames, { duration, delay, fill: 'both', easing: 'linear' });
      animation.finished.then(remove, remove);
      (this.document.defaultView ?? window).setTimeout(remove, duration + delay + 400);
    } catch { remove(); }
  }

  private clearSprites(): void {
    for (const child of Array.from(this.root.children)) {
      if (child !== this.veil && child !== this.pressure && child !== this.motes) child.remove();
    }
  }

  private frames(steps: number, build: (t: number) => { x: number; y: number; scale?: number; rotate?: number; opacity?: number }): Keyframe[] {
    return Array.from({ length: steps + 1 }, (_, index) => {
      const pose = build(index / steps);
      return { offset: index / steps, opacity: clamp(pose.opacity ?? 1),
        transform: `translate3d(${pose.x.toFixed(2)}px,${pose.y.toFixed(2)}px,0) rotate(${(pose.rotate ?? 0).toFixed(2)}deg) scale(${(pose.scale ?? 1).toFixed(4)})` };
    });
  }

  // ───────────────────────────────────────────────────────────── moments

  private perform(action: TableAction, before: TableState, after: TableState): void {
    if (!this.moving || !this.theme) return;
    const seat = (position: number): SeatState | undefined => after.seats.find((candidate) => candidate.position === position);
    try {
      switch (action.type) {
        case 'bet': if (this.effects.chips) this.pushBet(seat(action.position), action.added, action.amount); break;
        case 'collect': if (this.effects.chips) this.collect(action.bets, after); break;
        case 'award': this.award(action, before, after); break;
        case 'all-in': if (this.effects.moments) this.allIn(seat(action.position)); break;
        case 'fold': if (this.effects.moments && !action.you) this.muck(action.cards, after); break;
        case 'turn': if (this.effects.moments && action.you) this.cue(seat(action.position)); break;
        default: break;
      }
    } catch { /* A decorative moment must never interrupt the table. */ }
  }

  /** Chips leave the player's plate and land beside the bet label. */
  private pushBet(seat: SeatState | undefined, added: number, total: number): void {
    if (!seat?.betRect) return;
    const art = this.cached('bet', added), resting = this.cached('bet', total);
    if (!art.url) return;
    const target = this.stackRect(seat.position, seat.betRect, resting);
    const rem = this.rem, width = art.width * CHIP_REM * rem, height = art.height * CHIP_REM * rem;
    const from = center(seat.plate), to = { x: target.x + target.width / 2, y: target.y + target.height - height / 2 };
    const element = this.sprite(art.url, width, height);
    if (!element) return;
    this.play(element, this.frames(18, (t) => {
      const travel = spring(t * 0.92);
      return { x: lerp(from.x, to.x, travel) - width / 2, y: lerp(from.y, to.y, travel) - height / 2 - Math.sin(Math.PI * clamp(t * 1.4)) * rem * 0.22,
        scale: lerp(0.62, 1, easeOut(clamp(t * 1.6))), opacity: t < 0.12 ? t / 0.12 : t > 0.86 ? (1 - t) / 0.14 : 1 };
    }), 340);
  }

  /** The dealer's sweep: every live bet slides into the pot. */
  private collect(bets: { position: number; amount: number; rect: Rect }[], after: TableState): void {
    const potArtwork = this.cached('pot', Math.max(after.pot ?? 0, 1));
    const pot = this.potRect(after, potArtwork);
    if (!pot) return;
    const to = center(pot);
    bets.forEach((bet, index) => {
      const art = this.cached('bet', bet.amount);
      if (!art.url) return;
      const start = this.stackRect(bet.position, bet.rect, art);
      const element = this.sprite(art.url, start.width, start.height);
      if (!element) return;
      const from = center(start);
      this.play(element, this.frames(16, (t) => {
        const travel = easeInOut(t);
        return { x: lerp(from.x, to.x, travel) - start.width / 2, y: lerp(from.y, to.y, travel) - start.height / 2,
          scale: lerp(1, 0.78, travel), opacity: t > 0.84 ? (1 - t) / 0.16 : 1 };
      }), 460, index * 38);
    });
  }

  /** The pot travels to whoever won it; how grandly depends on its size. */
  private award(action: Extract<TableAction, { type: 'award' }>, before: TableState, after: TableState): void {
    const winners = action.winners.map((position) => after.seats.find((seat) => seat.position === position)).filter((seat): seat is SeatState => Boolean(seat));
    if (!winners.length) return;
    const tier = winTier(this.inBigBlinds(action.pot), action.allIn);
    const potArtwork = this.cached('pot', Math.max(action.pot, 1));
    const source = center(this.potRect(before.potRect ? before : after, potArtwork) ?? after.potRect ?? after.table);
    const rem = this.rem;
    if (this.effects.chips) {
      const tonesList = chipsFor(this.inBigBlinds(action.pot), 18);
      const count = tier === 'big' ? 20 : tier === 'medium' ? 11 : 6;
      for (let index = 0; index < count; index++) {
        const winner = winners[index % winners.length]!;
        const tone: ChipTone = tonesList[index % Math.max(1, tonesList.length)] ?? 'crimson';
        const art = singleChipArt(tone, this.theme!.table.trimColor);
        const width = art.width * CHIP_REM * rem, height = art.height * CHIP_REM * rem;
        const element = this.sprite(art.url, width, height);
        if (!element) break;
        const to = center(winner.plate);
        const spread = rem * (tier === 'big' ? 1.5 : 0.9);
        const from = { x: source.x + (hash(index, 3) - 0.5) * spread, y: source.y + (hash(index, 5) - 0.5) * spread * 0.5 };
        const end = { x: to.x + (hash(index, 7) - 0.5) * winner.plate.width * 0.5, y: to.y + (hash(index, 9) - 0.5) * winner.plate.height * 0.3 };
        // Each chip takes its own arc; the bend is perpendicular to the direct line.
        const dx = end.x - from.x, dy = end.y - from.y, length = Math.hypot(dx, dy) || 1;
        const bend = (hash(index, 11) - 0.5) * length * 0.34, lift = rem * (0.8 + hash(index, 13) * (tier === 'big' ? 2.2 : 1.2));
        const duration = 620 + hash(index, 17) * 220 + (tier === 'big' ? 120 : 0);
        this.play(element, this.frames(20, (t) => {
          const travel = easeInOut(t), arc = Math.sin(Math.PI * travel);
          return { x: lerp(from.x, end.x, travel) + (-dy / length) * bend * arc - width / 2,
            y: lerp(from.y, end.y, travel) + (dx / length) * bend * arc - arc * lift - height / 2,
            scale: 1 + arc * 0.32, rotate: (hash(index, 19) - 0.5) * 40 * arc, opacity: t < 0.08 ? t / 0.08 : t > 0.88 ? (1 - t) / 0.12 : 1 };
        }), duration, index * (tier === 'big' ? 34 : 30));
      }
    }
    if (!this.effects.celebrations) return;
    if (tier !== 'small') {
      this.feltSweep(after);
      for (const winner of winners) this.glow(center(winner.plate), winner.plate.width * (tier === 'big' ? 2.6 : 1.8), 520, tier === 'big' ? 0.5 : 0.34, 900);
    }
    if (tier === 'big') {
      this.foil(source, 26, 0, rem);
      for (const winner of winners) this.foil(center(winner.plate), 30, 560, rem);
      this.flash(after);
    }
  }

  /** A band of light crossing the felt: the table acknowledging a real pot. */
  private feltSweep(state: TableState): void {
    const table = state.table, portrait = this.document.documentElement.classList.contains('portrait');
    const box = portrait
      ? { x: table.x + table.width * 0.1, y: table.y + table.height * 0.095, width: table.width * 0.72, height: table.height * 0.755 }
      : { x: table.x + table.width * 0.1826, y: table.y + table.height * 0.141, width: table.width * 0.6353, height: table.height * 0.6547 };
    const holder = this.sprite('', box.width, box.height, 'pnc-sprite');
    if (!holder) return;
    holder.style.transform = `translate3d(${box.x.toFixed(1)}px,${box.y.toFixed(1)}px,0)`;
    holder.style.clipPath = portrait ? 'inset(0 round 10%)' : 'ellipse(50% 50% at 50% 50%)';
    holder.style.overflow = 'hidden';
    const band = this.document.createElement('div');
    band.className = 'pnc-sprite';
    band.style.width = `${(box.width * 0.5).toFixed(1)}px`;
    band.style.height = `${(box.height * 1.6).toFixed(1)}px`;
    band.style.top = `${(-box.height * 0.3).toFixed(1)}px`;
    band.style.background = `linear-gradient(90deg,transparent,${rgba(this.tones.trim.spec, 0.2)} 45%,${rgba('#ffffff', 0.16)} 50%,${rgba(this.tones.trim.spec, 0.2)} 55%,transparent)`;
    holder.append(band);
    const remove = (): void => holder.remove();
    if (typeof band.animate !== 'function') { remove(); return; }
    const animation = band.animate([
      { transform: `translate3d(${(-box.width * 0.6).toFixed(1)}px,0,0) skewX(-18deg)`, opacity: 0 },
      { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 },
      { transform: `translate3d(${(box.width * 1.1).toFixed(1)}px,0,0) skewX(-18deg)`, opacity: 0 },
    ], { duration: 1100, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'both' });
    animation.finished.then(remove, remove);
    (this.document.defaultView ?? window).setTimeout(remove, 1600);
  }

  private glow(at: Point, size: number, delay: number, strength: number, duration: number): void {
    const element = this.sprite('', size, size);
    if (!element) return;
    element.style.borderRadius = '50%';
    element.style.background = `radial-gradient(circle,${rgba(this.tones.glow, strength)} 0%,${rgba(this.tones.glow, strength * 0.35)} 36%,transparent 68%)`;
    const base = `translate3d(${(at.x - size / 2).toFixed(1)}px,${(at.y - size / 2).toFixed(1)}px,0)`;
    this.play(element, [
      { transform: `${base} scale(.4)`, opacity: 0 }, { transform: `${base} scale(1)`, opacity: 1, offset: 0.28 },
      { transform: `${base} scale(1.25)`, opacity: 0 },
    ], duration, delay);
  }

  /** Flakes of metal leaf thrown up and falling back: reserved for the biggest pots. */
  private foil(at: Point, count: number, delay: number, rem: number): void {
    const { trim } = this.tones;
    for (let index = 0; index < count; index++) {
      const size = rem * (0.12 + hash(index, 23) * 0.16);
      const element = this.sprite('', size, size * (1.2 + hash(index, 29) * 0.9));
      if (!element) return;
      const tone = hash(index, 31);
      element.style.background = `linear-gradient(${Math.round(hash(index, 37) * 180)}deg,${tone > 0.6 ? trim.spec : trim.high},${tone > 0.3 ? trim.mid : trim.low})`;
      element.style.borderRadius = `${(size * 0.18).toFixed(1)}px`;
      const angle = -Math.PI / 2 + (hash(index, 41) - 0.5) * Math.PI * 1.25;
      const speed = rem * (5 + hash(index, 43) * 7), gravity = rem * 15, spin = (hash(index, 47) - 0.5) * 900, flip = 3 + hash(index, 53) * 5;
      const life = 1.0 + hash(index, 59) * 0.7;
      this.play(element, Array.from({ length: 17 }, (_, step) => {
        const t = step / 16, time = t * life;
        const x = at.x + Math.cos(angle) * speed * time * (1 - time * 0.22), y = at.y + Math.sin(angle) * speed * time + gravity * time * time * 0.5;
        // A flake turning in the air shows edge-on, then flat: scale one axis through zero.
        const turn = Math.cos(time * flip * Math.PI);
        return { offset: t, opacity: t < 0.08 ? t / 0.08 : clamp((1 - t) / 0.35),
          transform: `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(spin * time).toFixed(1)}deg) scale(1,${turn.toFixed(3)})` };
      }), life * 1000, delay + hash(index, 61) * 110);
    }
  }

  /** One warm breath of light over the whole table. */
  private flash(state: TableState): void {
    const at = center(state.table), size = Math.max(state.table.width, state.table.height) * 1.1;
    this.glow(at, size, 80, 0.2, 1200);
  }

  /** All in: the room narrows to one seat for a moment. */
  private allIn(seat: SeatState | undefined): void {
    if (!seat) return;
    const rem = this.rem, { trim, glow } = this.tones, at = center(seat.plate);
    // The veil darkens everything but the player; brief enough never to hide a decision.
    this.veil.style.background = `radial-gradient(circle at ${at.x.toFixed(0)}px ${at.y.toFixed(0)}px,transparent 0,transparent ${(rem * 5).toFixed(0)}px,rgba(0,0,0,.46) ${(rem * 17).toFixed(0)}px)`;
    if (typeof this.veil.animate === 'function') {
      this.veil.animate([{ opacity: 0 }, { opacity: 1, offset: 0.16 }, { opacity: 1, offset: 0.58 }, { opacity: 0 }], { duration: 1250, easing: 'ease-in-out', fill: 'both' });
    }
    for (let ring = 0; ring < 2; ring++) {
      const element = this.sprite('', seat.plate.width, seat.plate.height);
      if (!element) break;
      element.style.borderRadius = `${(rem * 0.52).toFixed(1)}px`;
      element.style.boxShadow = `0 0 0 ${(rem * 0.07).toFixed(1)}px ${trim.spec}, 0 0 ${(rem * 1.2).toFixed(1)}px ${rgba(glow, 0.7)}`;
      const base = `translate3d(${seat.plate.x.toFixed(1)}px,${seat.plate.y.toFixed(1)}px,0)`;
      this.play(element, [
        { transform: `${base} scale(1)`, opacity: 0.95 }, { transform: `${base} scale(${ring ? 1.34 : 1.2},${ring ? 1.9 : 1.55})`, opacity: 0 },
      ], 720, ring * 130);
    }
    const badge = this.sprite('', rem * 3.5, rem * 0.92, 'pnc-badge');
    if (!badge) return;
    badge.textContent = 'ALL IN';
    Object.assign(badge.style, {
      fontSize: `${(rem * 0.44).toFixed(1)}px`, letterSpacing: '.3em', textIndent: '.3em', color: '#1a150b',
      background: `linear-gradient(180deg,${trim.spec},${trim.mid} 85%)`, boxShadow: `0 ${(rem * 0.2).toFixed(1)}px ${(rem * 0.7).toFixed(1)}px rgba(0,0,0,.55), 0 0 ${(rem * 1.1).toFixed(1)}px ${rgba(glow, 0.55)}`,
    });
    const x = at.x - rem * 1.75, y = seat.plate.y - rem * 0.56;
    this.play(badge, Array.from({ length: 25 }, (_, step) => {
      const t = step / 24, enter = spring(clamp(t / 0.28)), exit = clamp((t - 0.82) / 0.18);
      return { offset: t, opacity: Math.min(clamp(t / 0.06), 1 - exit),
        transform: `translate3d(${x.toFixed(1)}px,${(y - exit * rem * 0.3).toFixed(1)}px,0) scale(${lerp(0.5, 1, enter).toFixed(4)})` };
    }), 1900, 60);
  }

  /** A fold is quick and quiet: the cards slide toward the muck and are gone. */
  private muck(cards: Rect[], state: TableState): void {
    if (!cards.length) return;
    const url = cardDataUrl(undefined, this.theme!.card, artOptions(this.theme!));
    const to = center(state.board ?? state.potRect ?? state.table);
    cards.slice(0, 5).forEach((rect, index) => {
      const element = this.sprite(url, rect.width, rect.height);
      if (!element) return;
      element.style.borderRadius = '7%';
      element.style.boxShadow = '0 2px 8px rgba(0,0,0,.4)';
      const from = { x: rect.x, y: rect.y }, dx = (to.x - rect.x - rect.width / 2) * 0.24, dy = (to.y - rect.y - rect.height / 2) * 0.24;
      const tilt = (index % 2 ? 1 : -1) * 7;
      this.play(element, this.frames(10, (t) => {
        const travel = easeIn(t);
        return { x: from.x + dx * travel, y: from.y + dy * travel, rotate: tilt + (index % 2 ? 16 : -16) * travel, scale: lerp(1, 0.84, travel), opacity: 1 - easeIn(clamp(t * 1.05)) };
      }), 260, index * 24);
    });
  }

  /** Your move: a single ring leaves your plate. */
  private cue(seat: SeatState | undefined): void {
    if (!seat) return;
    const rem = this.rem, { trim, glow } = this.tones;
    const element = this.sprite('', seat.plate.width, seat.plate.height);
    if (!element) return;
    element.style.borderRadius = `${(rem * 0.52).toFixed(1)}px`;
    element.style.boxShadow = `0 0 0 ${(rem * 0.05).toFixed(1)}px ${trim.high}, 0 0 ${(rem * 0.9).toFixed(1)}px ${rgba(glow, 0.5)}`;
    const base = `translate3d(${seat.plate.x.toFixed(1)}px,${seat.plate.y.toFixed(1)}px,0)`;
    this.play(element, [{ transform: `${base} scale(1)`, opacity: 0.9 }, { transform: `${base} scale(1.16,1.5)`, opacity: 0 }], 640);
  }

  // ───────────────────────────────────────────────────────────── ambience

  /** A few motes of dust drifting through the light above the felt. */
  private updateAmbience(state: TableState | undefined): void {
    const wanted = Boolean(state && this.theme && this.effects.ambience && this.moving);
    if (!wanted) { this.motes?.remove(); this.motes = undefined; this.motesKey = ''; return; }
    const table = state!.table;
    const key = `${Math.round(table.x)}:${Math.round(table.y)}:${Math.round(table.width)}:${Math.round(table.height)}:${this.theme!.table.trimColor}`;
    if (key === this.motesKey && this.motes?.isConnected) return;
    this.motes?.remove();
    this.motesKey = key;
    const layer = this.document.createElement('div');
    layer.className = 'pnc-motes';
    layer.style.transform = `translate3d(${table.x.toFixed(1)}px,${table.y.toFixed(1)}px,0)`;
    layer.style.width = `${table.width.toFixed(1)}px`;
    layer.style.height = `${table.height.toFixed(1)}px`;
    const rem = this.rem, tint = this.tones.trim.spec;
    for (let index = 0; index < 14; index++) {
      const mote = this.document.createElement('div');
      const size = rem * (0.06 + hash(index, 71) * 0.1);
      mote.className = 'pnc-mote';
      Object.assign(mote.style, {
        left: `${(14 + hash(index, 73) * 72).toFixed(1)}%`, top: `${(18 + hash(index, 79) * 62).toFixed(1)}%`,
        width: `${size.toFixed(2)}px`, height: `${size.toFixed(2)}px`,
        background: `radial-gradient(circle,${rgba(tint, 0.95)} 0%,${rgba(tint, 0.3)} 45%,transparent 72%)`,
        animationName: index % 2 ? 'pnc-mote-b' : 'pnc-mote-a', animationDuration: `${(16 + hash(index, 83) * 20).toFixed(1)}s`,
        animationDelay: `${(-hash(index, 89) * 30).toFixed(1)}s`,
      });
      mote.style.setProperty('--o', (0.14 + hash(index, 97) * 0.26).toFixed(2));
      mote.style.setProperty('--d', `${(rem * (2 + hash(index, 101) * 3)).toFixed(1)}px`);
      layer.append(mote);
    }
    this.motes = layer;
    this.root.prepend(layer);
  }
}

export type { WinTier };
