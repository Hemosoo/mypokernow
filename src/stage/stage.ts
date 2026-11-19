import { auraShadow, madeHand } from '../rendering/hand-aura';
import type { SeatState, TableState } from '../adapter/pokernow/table-state';
import { artOptions, cardDataUrl } from '../rendering/cards';
import { betArt, chipsFor, potArt, singleChipArt, type ChipArt, type ChipTone } from '../rendering/chips';
import { metal, rgba, safeHex, svgDataUrl } from '../rendering/color';
import { describeHand } from '../rendering/hand-name';
import { pixelText, pixelTextWidth } from '../rendering/motifs';
import { SKIN_ROOT } from '../skin/css';
import type { Skin } from '../skin';
import type { EffectSettings, Rect, TableMotif, Theme } from '../types';
import { diffTable, winTier, type TableAction, type WinTier } from './actions';
import type { StageDirector } from '../puppy/types';

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
.pnc-mote.petal{border-radius:0 100% 0 100%}
.pnc-mote.pixel{border-radius:0}
.pnc-mote.drop{border-radius:1px}
@keyframes pnc-rain{0%{transform:translate3d(0,-10%,0) rotate(8deg);opacity:0}8%{opacity:var(--o)}92%{opacity:var(--o)}100%{transform:translate3d(calc(var(--d)*-.25),var(--fall),0) rotate(8deg);opacity:0}}
@keyframes pnc-packet-x{0%{transform:translate3d(0,0,0);opacity:0}10%,85%{opacity:var(--o)}100%{transform:translate3d(var(--d),0,0);opacity:0}}
@keyframes pnc-packet-y{0%{transform:translate3d(0,0,0);opacity:0}10%,85%{opacity:var(--o)}100%{transform:translate3d(0,var(--d),0);opacity:0}}
@keyframes pnc-petal{0%{transform:translate3d(0,0,0) rotate(0);opacity:0}12%{opacity:var(--o)}50%{transform:translate3d(calc(var(--d)*.5),calc(var(--d)*1.2),0) rotate(160deg)}85%{opacity:var(--o)}100%{transform:translate3d(calc(var(--d)*-.2),calc(var(--d)*2.6),0) rotate(320deg);opacity:0}}
@keyframes pnc-pixel{0%,100%{opacity:0;transform:translate3d(0,0,0)}10%,30%{opacity:var(--o)}20%{opacity:calc(var(--o)*.3)}50%{opacity:var(--o);transform:translate3d(0,calc(var(--d)*-.8),0)}60%{opacity:0;transform:translate3d(0,calc(var(--d)*-.8),0)}}
@keyframes pnc-mote-a{0%{transform:translate3d(0,0,0);opacity:0}18%{opacity:var(--o)}55%{transform:translate3d(calc(var(--d)*.6),calc(var(--d)*-.9),0)}82%{opacity:var(--o)}100%{transform:translate3d(var(--d),calc(var(--d)*-1.6),0);opacity:0}}
@keyframes pnc-mote-b{0%{transform:translate3d(0,0,0);opacity:0}22%{opacity:var(--o)}50%{transform:translate3d(calc(var(--d)*-.7),calc(var(--d)*-.5),0)}78%{opacity:var(--o)}100%{transform:translate3d(calc(var(--d)*-.4),calc(var(--d)*-1.3),0);opacity:0}}
.pnc-badge{display:flex;align-items:center;justify-content:center;white-space:nowrap;font-weight:800;border-radius:99px;will-change:transform,opacity}
.pnc-banner{will-change:transform,opacity;padding:0 1em}
`;

/** The your-win banner in each room's own voice. */
interface BannerStyle { font: string; weight: number; tracking: string; upper?: boolean; radius: string; background: string; ink?: string; accent?: string; border?: string; glow?: string }
const SERIF = '"PNC Serif","Playfair Display",Georgia,serif', SANS = '"PNC Sans",Inter,system-ui,sans-serif', MONO = 'ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace';
const BANNER_STYLE: Partial<Record<TableMotif, BannerStyle>> = {
  classic: { font: SERIF, weight: 700, tracking: '.01em', radius: '12px', background: 'linear-gradient(180deg,rgba(28,22,12,.94),rgba(12,10,6,.94))' },
  puppy: { font: SANS, weight: 800, tracking: '0', radius: '999px', background: 'linear-gradient(180deg,rgba(60,36,20,.95),rgba(34,20,12,.95))' },
  cat: { font: SANS, weight: 800, tracking: '0', radius: '999px', background: 'linear-gradient(180deg,rgba(40,52,52,.95),rgba(22,30,30,.95))' },
  sakura: { font: SERIF, weight: 700, tracking: '.02em', radius: '14px', background: 'linear-gradient(180deg,rgba(43,26,32,.94),rgba(24,16,22,.94))' },
  neon: { font: SANS, weight: 800, tracking: '.12em', upper: true, radius: '6px', background: 'rgba(8,8,20,.9)', ink: '#bff8ff', accent: '#ff5fa8', border: '#43e3ff', glow: '#43e3ff' },
  arcade: { font: MONO, weight: 800, tracking: '.06em', upper: true, radius: '0', background: '#101040', ink: '#ffffff', accent: '#ffcc1a', border: '#ffcc1a', glow: '#ff4fd8' },
  rain: { font: SANS, weight: 700, tracking: '.14em', upper: true, radius: '4px', background: 'rgba(10,8,18,.9)', ink: '#ffd1e6', accent: '#ffb84a', border: '#ff3d8b', glow: '#ff3d8b' },
  breach: { font: MONO, weight: 700, tracking: '.08em', upper: true, radius: '2px', background: 'rgba(6,7,7,.94)', ink: '#c8ff6a', accent: '#ff4646', border: '#b7ff3c', glow: '#b7ff3c' },
};

export class Stage {
  private readonly root: HTMLDivElement;
  private readonly veil: HTMLDivElement;
  private readonly pressure: HTMLDivElement;
  private motes: HTMLDivElement | undefined;
  private motesKey = '';
  private theme: Theme | undefined;
  private effects: EffectSettings = { chips: true, celebrations: true, moments: true, ambience: true, winSize: 'balanced', othersWins: true };
  private reduced = false;
  private previous: TableState | undefined;
  private bigBlind = 0;
  private potShown = 0;
  private potAwarded = false;
  private potTimer = 0;
  /** A table companion that may ask chips and folded cards to wait until it reaches them. */
  private director: StageDirector | undefined;
  /** Your cards and the board as last read this hand, for naming your hand when you win. */
  private heroHand: TableState['heroHand'];
  private collectDelay = 0;
  private lastRules = '';
  private readonly art = new Map<string, ChipArt>();
  private disposed = false;
  private readonly animations = new Set<Animation>();
  private readonly timers = new Set<number>();
  private style: HTMLStyleElement;

  constructor(surface: HTMLElement, private readonly skin: Skin, private readonly document: Document) {
    const style = document.createElement('style');
    style.textContent = STAGE_CSS;
    this.style = style;
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

  setDirector(director: StageDirector | undefined): void { this.director = director; }

  configure(theme: Theme | undefined, effects: EffectSettings, reducedMotion: boolean): void {
    const themeChanged = theme !== this.theme;
    this.theme = theme;
    this.effects = effects;
    this.reduced = reducedMotion;
    if (themeChanged || !this.moving) this.clearSprites();
    if (themeChanged) { this.art.clear(); this.motesKey = ''; }
    if (!theme) this.reset();
    else if (this.previous) this.writeRules(this.previous);
    this.updateAmbience(this.previous);
    if (!this.moving || !effects.moments) this.pressure.classList.remove('on');
  }

  /** Forget the table: no chips drawn, nothing in flight. */
  reset(): void {
    this.previous = undefined;
    this.heroHand = undefined;
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
    if (state.heroHand) this.heroHand = state.heroHand;
    let collecting = false;
    if (before) {
      const actions = diffTable(before, state);
      for (const action of actions) {
        if (action.type === 'new-hand') { this.potAwarded = false; this.heroHand = state.heroHand; }
        if (action.type === 'collect') collecting = true;
        if (action.type === 'award') this.potAwarded = true;
        this.perform(action, before, state);
      }
    }
    // The pot pile grows when the swept bets arrive, not when the number changes.
    const pot = this.potAwarded ? 0 : state.pot ?? 0;
    clearTimeout(this.potTimer);
    if (collecting && this.moving && this.effects.chips && pot > this.potShown) {
      this.potTimer = (this.document.defaultView ?? window).setTimeout(() => { this.potShown = pot; if (this.previous) this.writeRules(this.previous); }, 460 + this.collectDelay + Math.max(0, state.seats.length - 1) * 38);
    } else this.potShown = pot;
    this.writeRules(state);
    this.updateAmbience(state);
    const hero = state.seats.find((seat) => seat.you);
    this.pressure.classList.toggle('on', Boolean(this.moving && this.effects.moments && hero?.deciding && hero.urgent));
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.potTimer);
    this.clearSprites();
    this.style.remove();
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
      art = kind === 'bet' ? betArt(units, this.theme!.table.trimColor, this.theme!.table.motif) : potArt(units, this.theme!.table.trimColor, this.theme!.table.motif);
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
        if (art.url) rules += `${SKIN_ROOT} .table-pot-size{--pnc-chips:url("${art.url}");--pnc-chips-w:${(art.width * CHIP_REM).toFixed(3)}rem;--pnc-chips-h:${(art.height * CHIP_REM).toFixed(3)}rem;--pnc-pot-pad:${(art.width * CHIP_REM + 0.75).toFixed(3)}rem}\n`;
      }
    }
    const hero=state.heroHand, aura=this.theme?.card.aura;
    if(hero&&aura?.enabled&&madeHand(hero.hole,hero.board)) {
      rules+=`${SKIN_ROOT} .table-player-${hero.position}.you-player .table-player-cards .card-container::after{content:"";position:absolute;inset:0;border-radius:${this.theme!.card.borderRadius}% / ${this.theme!.card.borderRadius*90/110}%;box-shadow:${auraShadow(aura.color,aura.strength)};pointer-events:none}`;
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
      this.animations.add(animation);
      let timer = 0;
      const done = (): void => { this.animations.delete(animation); clearTimeout(timer); this.timers.delete(timer); remove(); };
      animation.finished.then(done, done);
      timer = (this.document.defaultView ?? window).setTimeout(done, duration + delay + 400);
      this.timers.add(timer);
    } catch { remove(); }
  }

  private clearSprites(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
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
    const director = this.director;
    // A companion's wait is advisory and bounded: chips and cards it asks to hold are already resolved by the game.
    const wait = (ms: number | undefined): number => (Number.isFinite(ms) ? Math.min(450, Math.max(0, ms!)) : 0);
    try {
      switch (action.type) {
        case 'bet': director?.bet(seat(action.position), seat(action.position)?.betRect); if (this.effects.chips) this.pushBet(seat(action.position), action.added, action.amount); break;
        case 'collect': {
          if (!this.effects.chips) break;
          this.collectDelay = wait(director?.collect(action.bets.map((bet) => ({ position: bet.position, rect: bet.rect })), after.potRect));
          this.collect(action.bets, after, this.collectDelay);
          break;
        }
        case 'award': {
          this.award(action, before, after);
          const winners = action.winners.map(seat).filter((value): value is SeatState => Boolean(value));
          const size = this.winSize(action, winners.some((winner) => winner.you));
          director?.award(winners, before.potRect ?? after.potRect, size === 3 ? 'big' : size === 2 ? 'medium' : 'small');
          break;
        }
        case 'all-in': director?.allIn(seat(action.position)); if (this.effects.moments) this.allIn(seat(action.position)); break;
        case 'fold': if (this.effects.moments && !action.you) this.muck(action.cards, after, wait(director?.fold(action.cards, seat(action.position)))); break;
        case 'turn': director?.turn(seat(action.position)); if (this.effects.moments && action.you) this.cue(seat(action.position)); break;
        case 'new-hand': director?.newHand(); break;
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
      const travel = spring(t) / spring(1);
      return { x: lerp(from.x, to.x, travel) - width / 2, y: lerp(from.y, to.y, travel) - height / 2 - Math.sin(Math.PI * clamp(t * 1.4)) * rem * 0.22,
        scale: lerp(0.62, 1, easeOut(clamp(t * 1.6))), opacity: t < 0.12 ? t / 0.12 : t > 0.86 ? (1 - t) / 0.14 : 1 };
    }), 340);
  }

  /** The dealer's sweep: every live bet slides into the pot. */
  private collect(bets: { position: number; amount: number; rect: Rect }[], after: TableState, delay = 0): void {
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
      }), 460, delay + index * 38);
    });
  }

  /**
   * How grand a win gets, 1 to 3: the pot's size in big blinds, then the owner's
   * choice. Quiet never goes past a sweep of light; Loud lifts every win a step;
   * other players' wins can be kept to their chips sliding over.
   */
  private winSize(action: Extract<TableAction, { type: 'award' }>, hero: boolean): 1 | 2 | 3 {
    const tier = winTier(this.inBigBlinds(action.pot), action.allIn);
    let size = tier === 'big' ? 3 : tier === 'medium' ? 2 : 1;
    if (this.effects.winSize === 'quiet') size = Math.min(size, 2);
    if (this.effects.winSize === 'loud') size = Math.min(3, size + 1);
    if (!hero && !this.effects.othersWins) size = 1;
    return size as 1 | 2 | 3;
  }

  /**
   * The pot travels to whoever won it, and the win is celebrated in steps that grow
   * with what happened:
   *   1 a small pot: the chips slide over and the name plate glows softly;
   *   2 a medium pot: a sweep of light crosses the felt and the plate shines;
   *   3 a big pot: the room dims, a spotlight finds the winner, chips fountain over,
   *     and the room's own flourish plays;
   *   4 an all-in won: the winning cards light up for a beat before the chips move;
   *   5 your own win: a banner names your hand and what you won.
   * Everything stays over the table, never over PokerNow's controls, and is gone
   * within about two and a half seconds.
   */
  private award(action: Extract<TableAction, { type: 'award' }>, before: TableState, after: TableState): void {
    const winners = action.winners.map((position) => after.seats.find((seat) => seat.position === position)).filter((seat): seat is SeatState => Boolean(seat));
    if (!winners.length) return;
    const hero = winners.some((seat) => seat.you), size = this.winSize(action, hero);
    const celebrate = this.effects.celebrations;
    const winning = celebrate && action.allIn && (hero || this.effects.othersWins) && this.effects.winSize !== 'quiet' ? (after.winning ?? before.winning ?? []) : [];
    // The winning cards have their beat before any chip moves.
    const hold = winning.length ? 520 : 0;
    const potArtwork = this.cached('pot', Math.max(action.pot, 1));
    const source = center(this.potRect(before.potRect ? before : after, potArtwork) ?? after.potRect ?? after.table);
    const rem = this.rem;
    if (this.effects.chips) {
      const tonesList = chipsFor(this.inBigBlinds(action.pot), 18);
      const count = size === 3 ? 20 : size === 2 ? 11 : 6;
      for (let index = 0; index < count; index++) {
        const winner = winners[index % winners.length]!;
        const tone: ChipTone = tonesList[index % Math.max(1, tonesList.length)] ?? 'crimson';
        const art = singleChipArt(tone, this.theme!.table.trimColor, this.theme!.table.motif);
        const width = art.width * CHIP_REM * rem, height = art.height * CHIP_REM * rem;
        const element = this.sprite(art.url, width, height);
        if (!element) break;
        const to = center(winner.plate);
        const spread = rem * (size === 3 ? 1.5 : 0.9);
        const from = { x: source.x + (hash(index, 3) - 0.5) * spread, y: source.y + (hash(index, 5) - 0.5) * spread * 0.5 };
        const end = { x: to.x + (hash(index, 7) - 0.5) * winner.plate.width * 0.5, y: to.y + (hash(index, 9) - 0.5) * winner.plate.height * 0.3 };
        // Each chip takes its own arc; the bend is perpendicular to the direct line. A big pot fountains.
        const dx = end.x - from.x, dy = end.y - from.y, length = Math.hypot(dx, dy) || 1;
        const bend = (hash(index, 11) - 0.5) * length * 0.34, lift = rem * (0.8 + hash(index, 13) * (size === 3 ? 3.2 : 1.2));
        const duration = 620 + hash(index, 17) * 220 + (size === 3 ? 180 : 0);
        this.play(element, this.frames(20, (t) => {
          const travel = easeInOut(t), arc = Math.sin(Math.PI * travel);
          return { x: lerp(from.x, end.x, travel) + (-dy / length) * bend * arc - width / 2,
            y: lerp(from.y, end.y, travel) + (dx / length) * bend * arc - arc * lift - height / 2,
            scale: 1 + arc * 0.32, rotate: (hash(index, 19) - 0.5) * 40 * arc, opacity: t < 0.08 ? t / 0.08 : t > 0.88 ? (1 - t) / 0.12 : 1 };
        }), duration, hold + (before.seats.some(seat => (seat.bet ?? 0) > 0) ? 500 : 80) + index * (size === 3 ? 34 : 30));
      }
    }
    if (!celebrate) return;
    if (winning.length) this.lightCards(winning);
    for (const winner of winners) {
      const plate = center(winner.plate);
      if (size === 1) this.glow(plate, winner.plate.width * 1.4, hold + 420, 0.26, 900);
      else this.glow(plate, winner.plate.width * (size === 3 ? 2.6 : 1.8), hold + 520, size === 3 ? 0.5 : 0.34, 900);
    }
    if (size >= 2) this.feltSweep(after);
    if (size === 3) {
      this.spotlight(winners[0]!, hold);
      this.flourish(source, winners, action.pot, hold);
      this.flash(after);
    }
    if (hero) this.banner(action, before, after, hold);
  }

  /** Step 4: the cards that won light up and pulse twice before the chips move. */
  private lightCards(cards: Rect[]): void {
    const { trim, glow } = this.tones, rem = this.rem;
    for (const rect of cards.slice(0, 7)) {
      const element = this.sprite('', rect.width, rect.height);
      if (!element) return;
      element.style.borderRadius = `${(rem * 0.3).toFixed(1)}px`;
      element.style.boxShadow = `0 0 0 ${(rem * 0.08).toFixed(1)}px ${trim.spec}, 0 0 ${(rem * 1.4).toFixed(1)}px ${rgba(glow, 0.85)}`;
      const base = `translate3d(${rect.x.toFixed(1)}px,${rect.y.toFixed(1)}px,0)`;
      this.play(element, [
        { transform: `${base} scale(1)`, opacity: 0 }, { transform: `${base} scale(1.08)`, opacity: 1, offset: 0.18 },
        { transform: `${base} scale(1.02)`, opacity: 0.8, offset: 0.36 }, { transform: `${base} scale(1.08)`, opacity: 1, offset: 0.54 },
        { transform: `${base} scale(1.04)`, opacity: 0 },
      ], 1500);
    }
  }

  /** Step 3: the room dims around the winner for a moment, as if a spotlight found them. */
  private spotlight(winner: SeatState, delay: number): void {
    const rem = this.rem, at = center(winner.plate);
    this.veil.style.background = `radial-gradient(circle at ${at.x.toFixed(0)}px ${at.y.toFixed(0)}px,transparent 0,transparent ${(rem * 4.5).toFixed(0)}px,rgba(0,0,0,.5) ${(rem * 15).toFixed(0)}px)`;
    if (typeof this.veil.animate === 'function') {
      this.veil.animate([{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: 1700, delay, easing: 'ease-in-out', fill: 'both' });
    }
  }

  /** Step 3, the room's own flourish: leaf, petals, pixels, a sign, a stamp or a glitch. */
  private flourish(source: Point, winners: SeatState[], pot: number, delay: number): void {
    const motif = this.theme!.table.motif, rem = this.rem, plate = winners[0]!.plate, at = center(plate);
    if (motif === 'sakura') { this.petals(source, at, delay); return; }
    if (motif === 'arcade') { this.score(plate, pot, delay); return; }
    if (motif === 'rain') { this.sign(plate, delay); return; }
    if (motif === 'breach') { this.stamp(plate, delay); return; }
    if (motif === 'neon') { this.glitch(delay); }
    this.foil(source, 26, delay, rem);
    for (const winner of winners) this.foil(center(winner.plate), 30, delay + 560, rem);
  }

  /** Sakura: a gust of petals from the pot to the winner. */
  private petals(from: Point, to: Point, delay: number): void {
    const { trim } = this.tones, rem = this.rem;
    for (let index = 0; index < 26; index++) {
      const size = rem * (0.26 + hash(index, 23) * 0.2);
      const element = this.sprite('', size, size * 0.8);
      if (!element) return;
      element.style.borderRadius = '0 100% 0 100%';
      element.style.background = `linear-gradient(135deg,${trim.spec},${trim.high})`;
      const bend = (hash(index, 29) - 0.5) * rem * 8, lift = rem * (1 + hash(index, 31) * 3), spin = (hash(index, 37) - 0.5) * 720;
      const end = { x: to.x + (hash(index, 41) - 0.5) * rem * 4, y: to.y + (hash(index, 43) - 0.5) * rem * 2 };
      this.play(element, this.frames(18, (t) => {
        const u = easeOut(t), arc = Math.sin(Math.PI * u);
        return { x: lerp(from.x, end.x, u) + bend * arc - size / 2, y: lerp(from.y, end.y, u) - lift * arc - size / 2, rotate: spin * t, scale: 1, opacity: t < 0.1 ? t / 0.1 : t > 0.75 ? (1 - t) / 0.25 : 1 };
      }), 1300 + hash(index, 47) * 500, delay + index * 22);
    }
  }

  /** Arcade: the pot counts up in pixel digits over the winner, with stars thrown out in stepped frames. */
  private score(plate: Rect, pot: number, delay: number): void {
    const rem = this.rem, at = center(plate), digits = `+${Math.round(pot)}`;
    const art = (text: string): string => {
      const size = 4, width = (pixelTextWidth(text) + 2) * size, height = 9 * size;
      return svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges"><g fill="#6b3e00" transform="translate(${size * 1.5} ${size * 1.5})">${pixelText(text, 0, 0, size)}</g><g fill="#ffcc1a" transform="translate(${size} ${size})">${pixelText(text, 0, 0, size)}</g></svg>`);
    };
    const height = rem * 1.3, width = height * (pixelTextWidth(digits) + 2) / 9;
    // The count rolls up in four stepped frames.
    const steps = [0.25, 0.5, 0.75, 1].map((k) => art(`+${Math.round(pot * k)}`));
    const element = this.sprite(steps[0]!, width, height);
    if (element) {
      element.style.imageRendering = 'pixelated';
      const x = at.x - width / 2, y = plate.y - height - rem * 0.3;
      this.play(element, Array.from({ length: 13 }, (_, step) => {
        const t = step / 12;
        return { offset: t, opacity: t < 0.9 ? 1 : 0, transform: `translate3d(${x.toFixed(0)}px,${(y - Math.min(4, Math.floor(t * 8)) * rem * 0.12).toFixed(0)}px,0)`,
          backgroundImage: `url("${steps[Math.min(3, Math.floor(t * 6))]}")`, easing: 'steps(1)' } as Keyframe;
      }), 1900, delay);
    }
    for (let index = 0; index < 12; index++) {
      const size = rem * 0.22, star = this.sprite('', size, size);
      if (!star) return;
      star.style.background = ['#ffcc1a', '#ff4fd8', '#5cf2ff'][index % 3]!;
      const angle = (index / 12) * Math.PI * 2, reach = rem * (2.4 + hash(index, 53) * 1.6);
      this.play(star, Array.from({ length: 7 }, (_, step) => {
        const t = step / 6;
        return { offset: t, opacity: t < 1 ? 1 : 0, transform: `translate3d(${(at.x + Math.cos(angle) * reach * t - size / 2).toFixed(0)}px,${(at.y + Math.sin(angle) * reach * t * 0.7 - size / 2).toFixed(0)}px,0)`, easing: 'steps(1)' } as Keyframe;
      }), 700, delay + 120 + (index % 3) * 90);
    }
  }

  /** Rain District: a neon WINNER sign buzzes on above the winner, flickering before it holds. */
  private sign(plate: Rect, delay: number): void {
    const rem = this.rem, { trim } = this.tones, width = rem * 5.4, height = rem * 1.5;
    const element = this.sprite('', width, height, 'pnc-badge');
    if (!element) return;
    element.textContent = 'WINNER';
    Object.assign(element.style, { fontSize: `${(rem * 0.82).toFixed(1)}px`, letterSpacing: '.32em', textIndent: '.32em', color: trim.spec, fontWeight: '700',
      textShadow: `0 0 ${(rem * 0.2).toFixed(1)}px ${trim.high}, 0 0 ${(rem * 0.6).toFixed(1)}px ${trim.mid}`, border: `${Math.max(1, rem * 0.07).toFixed(1)}px solid ${rgba(trim.high, 0.8)}`,
      borderRadius: `${(rem * 0.25).toFixed(1)}px`, background: 'rgba(8,6,14,.82)', boxShadow: `0 0 ${(rem * 0.8).toFixed(1)}px ${rgba(trim.mid, 0.6)}` });
    const above = plate.y - height - rem * 0.4 >= rem * 0.2;
    const x = plate.x + plate.width / 2 - width / 2, y = above ? plate.y - height - rem * 0.4 : plate.y + plate.height + rem * 0.4;
    const flicker = [0, 1, 0.15, 1, 0.3, 1, 1, 1, 1, 0.5, 1, 1, 1, 0];
    this.play(element, flicker.map((opacity, step) => ({ offset: step / (flicker.length - 1), opacity, transform: `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`, easing: 'steps(1)' } as Keyframe)), 2300, delay);
  }

  /** Breach: ACCESS GRANTED is stamped onto the winner's plate with a glitch tear across the table. */
  private stamp(plate: Rect, delay: number): void {
    const rem = this.rem, { trim } = this.tones, width = Math.max(plate.width, rem * 7), height = rem * 1.15;
    const element = this.sprite('', width, height, 'pnc-badge');
    if (element) {
      element.textContent = 'ACCESS GRANTED';
      Object.assign(element.style, { fontSize: `${(rem * 0.5).toFixed(1)}px`, letterSpacing: '.22em', textIndent: '.22em', color: '#ff4646', fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        border: `${Math.max(1, rem * 0.08).toFixed(1)}px solid #ff4646`, borderRadius: '2px', background: 'rgba(8,8,8,.88)', boxShadow: '0 0 12px rgba(255,70,70,.45)' });
      const x = plate.x + plate.width / 2 - width / 2, y = plate.y + plate.height / 2 - height / 2;
      this.play(element, [
        { offset: 0, opacity: 0, transform: `translate3d(${x}px,${y}px,0) scale(1.7)` },
        { offset: 0.1, opacity: 1, transform: `translate3d(${x}px,${y}px,0) scale(1)` },
        { offset: 0.14, opacity: 1, transform: `translate3d(${x + rem * 0.25}px,${y}px,0) scale(1)` },
        { offset: 0.18, opacity: 1, transform: `translate3d(${x}px,${y}px,0) scale(1)` },
        { offset: 0.85, opacity: 1, transform: `translate3d(${x}px,${y}px,0) scale(1)` },
        { offset: 1, opacity: 0, transform: `translate3d(${x}px,${y}px,0) scale(1)` },
      ], 2200, delay + 200);
    }
    this.glitch(delay, trim.spec, '#ff4646');
  }

  /** Neon and Breach: a few bright bars tear across the table for an instant. */
  private glitch(delay: number, a = '#5cf2ff', b = '#ff4fd8'): void {
    const table = this.previous?.table;
    if (!table) return;
    for (let index = 0; index < 4; index++) {
      const height = Math.max(2, table.height * (0.008 + hash(index, 61) * 0.02)), width = table.width * (0.4 + hash(index, 67) * 0.5);
      const element = this.sprite('', width, height);
      if (!element) return;
      element.style.background = index % 2 ? a : b;
      element.style.mixBlendMode = 'screen';
      const x = table.x + (table.width - width) * hash(index, 71), y = table.y + table.height * (0.2 + hash(index, 73) * 0.6);
      this.play(element, [0, 0.9, 0, 0.7, 0].map((opacity, step) => ({ offset: step / 4, opacity, transform: `translate3d(${(x + (step % 2 ? 8 : -8)).toFixed(0)}px,${y.toFixed(0)}px,0)`, easing: 'steps(1)' } as Keyframe)), 360, delay + index * 70);
    }
  }

  /**
   * Step 5, your own win: a banner under the board names your hand ("Full house,
   * kings over sevens") and what you won, in the room's own style.
   */
  private banner(action: Extract<TableAction, { type: 'award' }>, before: TableState, after: TableState, delay: number): void {
    const rem = this.rem, { trim } = this.tones, motif = this.theme!.table.motif;
    // At showdown the site may be redrawing your cards; the last reading this hand still names them.
    const hand = after.heroHand ?? before.heroHand ?? this.heroHand;
    const named = hand && hand.board.length >= 3 ? describeHand([...hand.hole, ...hand.board])?.name : undefined;
    const amount = `+${Number.isInteger(action.pot) ? action.pot.toLocaleString('en-US') : action.pot.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    const board = after.board ?? before.board, table = after.table;
    const width = Math.min(table.width * 0.6, Math.max(rem * 13, (board?.width ?? rem * 14) * 0.95)), height = rem * 2.5;
    const element = this.sprite('', width, height, 'pnc-banner');
    if (!element) return;
    const style = BANNER_STYLE[motif] ?? BANNER_STYLE.classic!;
    const title = this.document.createElement('b'), sub = this.document.createElement('small');
    title.textContent = named ?? 'You win the pot';
    sub.textContent = amount;
    for (const part of [title, sub]) part.style.position = 'static';
    Object.assign(title.style, { font: `${style.weight} ${(rem * 0.66).toFixed(1)}px ${style.font}`, letterSpacing: style.tracking, color: style.ink ?? trim.spec, textTransform: style.upper ? 'uppercase' : 'none' });
    Object.assign(sub.style, { font: `700 ${(rem * 0.46).toFixed(1)}px ${style.font}`, letterSpacing: '.08em', color: style.accent ?? trim.high, marginTop: `${(rem * 0.08).toFixed(1)}px` });
    element.append(title, sub);
    Object.assign(element.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'nowrap',
      borderRadius: style.radius, background: style.background, border: `${Math.max(1, rem * 0.06).toFixed(1)}px solid ${style.border ?? rgba(trim.high, 0.75)}`,
      boxShadow: `0 ${(rem * 0.3).toFixed(1)}px ${(rem * 1).toFixed(1)}px rgba(0,0,0,.55), 0 0 ${(rem * 1.2).toFixed(1)}px ${rgba(style.glow ?? trim.mid, 0.4)}` });
    const centreX = board ? board.x + board.width / 2 : table.x + table.width / 2;
    const top = board ? board.y + board.height + rem * 0.5 : table.y + table.height * 0.62;
    const x = centreX - width / 2;
    this.play(element, Array.from({ length: 25 }, (_, step) => {
      const t = step / 24, enter = spring(clamp(t / 0.22)), exit = clamp((t - 0.86) / 0.14);
      return { offset: t, opacity: Math.min(clamp(t / 0.06), 1 - exit), transform: `translate3d(${x.toFixed(1)}px,${(top - exit * rem * 0.3).toFixed(1)}px,0) scale(${lerp(0.7, 1, enter).toFixed(4)})` };
    }), 2600, delay + 300);
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
    // Above the plate, unless the seat is at the top edge of the window; then beneath it.
    const above = seat.plate.y - rem * 0.56 >= rem * 0.2;
    const x = at.x - rem * 1.75, y = above ? seat.plate.y - rem * 0.56 : seat.plate.y + seat.plate.height - rem * 0.36;
    this.play(badge, Array.from({ length: 25 }, (_, step) => {
      const t = step / 24, enter = spring(clamp(t / 0.28)), exit = clamp((t - 0.82) / 0.18);
      return { offset: t, opacity: Math.min(clamp(t / 0.06), 1 - exit),
        transform: `translate3d(${x.toFixed(1)}px,${(y - exit * rem * 0.3).toFixed(1)}px,0) scale(${lerp(0.5, 1, enter).toFixed(4)})` };
    }), 1900, 60);
  }

  /** A fold is quick and quiet: the cards slide toward the muck and are gone. */
  /** A fold: quick and quiet; when a companion bats the cards (`delay`), they tumble further. */
  private muck(cards: Rect[], state: TableState, delay = 0): void {
    if (!cards.length) return;
    const url = cardDataUrl(undefined, this.theme!.card, artOptions(this.theme!));
    const to = center(state.board ?? state.potRect ?? state.table);
    cards.slice(0, 5).forEach((rect, index) => {
      const element = this.sprite(url, rect.width, rect.height);
      if (!element) return;
      element.style.borderRadius = '7%';
      element.style.boxShadow = '0 2px 8px rgba(0,0,0,.4)';
      const batted = delay > 0, reach = batted ? 0.55 : 0.24;
      const from = { x: rect.x, y: rect.y }, dx = (to.x - rect.x - rect.width / 2) * reach, dy = (to.y - rect.y - rect.height / 2) * reach;
      const tilt = (index % 2 ? 1 : -1) * 7, turn = batted ? (index % 2 ? 1 : -1) * 220 : (index % 2 ? 16 : -16);
      this.play(element, this.frames(batted ? 16 : 10, (t) => {
        const travel = batted ? easeOut(t) : easeIn(t);
        return { x: from.x + dx * travel, y: from.y + dy * travel - (batted ? Math.sin(Math.PI * t) * rect.height * 0.35 : 0), rotate: tilt + turn * travel,
          scale: lerp(1, batted ? 0.7 : 0.84, travel), opacity: 1 - easeIn(clamp(t * 1.05)) };
      }), batted ? 380 : 260, delay + index * 24);
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
    const motif = this.theme!.table.motif;
    const key = `${Math.round(table.x)}:${Math.round(table.y)}:${Math.round(table.width)}:${Math.round(table.height)}:${this.theme!.table.trimColor}:${motif}`;
    if (key === this.motesKey && this.motes?.isConnected) return;
    this.motes?.remove();
    this.motesKey = key;
    const layer = this.document.createElement('div');
    layer.className = 'pnc-motes';
    layer.style.transform = `translate3d(${table.x.toFixed(1)}px,${table.y.toFixed(1)}px,0)`;
    layer.style.width = `${table.width.toFixed(1)}px`;
    layer.style.height = `${table.height.toFixed(1)}px`;
    const rem = this.rem, tint = this.tones.trim.spec, high = this.tones.trim.high;
    // Sakura rooms drift petals down; Neon rooms flicker pixels; every other room has dust in the light.
    const petals = motif === 'sakura', pixels = motif === 'neon';
    if (motif === 'arcade' || motif === 'rain' || motif === 'breach') { this.roomAmbience(layer, motif, table, rem); this.motes = layer; this.root.prepend(layer); return; }
    for (let index = 0; index < 14; index++) {
      const mote = this.document.createElement('div');
      const size = rem * (petals ? 0.16 + hash(index, 71) * 0.12 : pixels ? 0.05 + hash(index, 71) * 0.05 : 0.06 + hash(index, 71) * 0.1);
      mote.className = petals ? 'pnc-mote petal' : pixels ? 'pnc-mote pixel' : 'pnc-mote';
      Object.assign(mote.style, {
        left: `${(14 + hash(index, 73) * 72).toFixed(1)}%`, top: `${(petals ? 4 + hash(index, 79) * 50 : 18 + hash(index, 79) * 62).toFixed(1)}%`,
        width: `${size.toFixed(2)}px`, height: `${(petals ? size * 0.8 : size).toFixed(2)}px`,
        background: petals ? `linear-gradient(135deg,${rgba(high, 0.95)},${rgba(tint, 0.6)})`
          : pixels ? (index % 3 ? tint : '#ff5fa8') : `radial-gradient(circle,${rgba(tint, 0.95)} 0%,${rgba(tint, 0.3)} 45%,transparent 72%)`,
        boxShadow: pixels ? `0 0 ${(size * 2).toFixed(1)}px ${index % 3 ? tint : '#ff5fa8'}` : '',
        animationName: petals ? 'pnc-petal' : pixels ? 'pnc-pixel' : index % 2 ? 'pnc-mote-b' : 'pnc-mote-a',
        animationDuration: `${((petals ? 11 : pixels ? 5 : 16) + hash(index, 83) * (pixels ? 6 : 20)).toFixed(1)}s`,
        animationDelay: `${(-hash(index, 89) * 30).toFixed(1)}s`,
      });
      mote.style.setProperty('--o', ((petals ? 0.4 : pixels ? 0.45 : 0.14) + hash(index, 97) * 0.26).toFixed(2));
      mote.style.setProperty('--d', `${(rem * (2 + hash(index, 101) * 3)).toFixed(1)}px`);
      layer.append(mote);
    }
    this.motes = layer;
    this.root.prepend(layer);
  }

  /**
   * Arcade twinkles gold, magenta and cyan pixels in stepped frames; Rain District
   * has rain falling through the light; Breach sends data packets along the traces.
   */
  private roomAmbience(layer: HTMLDivElement, motif: 'arcade' | 'rain' | 'breach', table: Rect, rem: number): void {
    const count = motif === 'rain' ? 26 : motif === 'breach' ? 12 : 16;
    for (let index = 0; index < count; index++) {
      const mote = this.document.createElement('div');
      const style: Partial<CSSStyleDeclaration> = {
        left: `${(12 + hash(index, 73) * 76).toFixed(1)}%`, top: `${(motif === 'rain' ? -4 + hash(index, 79) * 30 : 16 + hash(index, 79) * 66).toFixed(1)}%`,
        animationDelay: `${(-hash(index, 89) * 20).toFixed(1)}s`,
      };
      if (motif === 'arcade') {
        const size = rem * (0.12 + (index % 3) * 0.05), color = ['#ffcc1a', '#ff4fd8', '#5cf2ff'][index % 3]!;
        mote.className = 'pnc-mote pixel';
        Object.assign(style, { width: `${size.toFixed(1)}px`, height: `${size.toFixed(1)}px`, background: color, boxShadow: `0 0 ${(size * 1.5).toFixed(1)}px ${color}`,
          animationName: 'pnc-pixel', animationDuration: `${(3 + hash(index, 83) * 4).toFixed(1)}s`, animationTimingFunction: 'steps(6)' });
        mote.style.setProperty('--o', '.85');
        mote.style.setProperty('--d', `${(rem * 0.6).toFixed(1)}px`);
      } else if (motif === 'rain') {
        const length = rem * (0.7 + hash(index, 71) * 0.7);
        mote.className = 'pnc-mote drop';
        Object.assign(style, { width: '1px', height: `${length.toFixed(1)}px`, background: 'linear-gradient(180deg,transparent,rgba(190,215,255,.9))',
          animationName: 'pnc-rain', animationDuration: `${(0.9 + hash(index, 83) * 0.6).toFixed(2)}s`, animationDelay: `${(-hash(index, 89) * 2).toFixed(2)}s` });
        mote.style.setProperty('--o', (0.18 + hash(index, 97) * 0.22).toFixed(2));
        mote.style.setProperty('--d', `${(rem * 4).toFixed(1)}px`);
        mote.style.setProperty('--fall', `${(table.height * 0.8).toFixed(0)}px`);
      } else {
        const horizontal = index % 2 === 0, size = rem * 0.14, tint = this.tones.trim.spec;
        mote.className = 'pnc-mote pixel';
        Object.assign(style, { width: `${(horizontal ? size * 2.4 : size).toFixed(1)}px`, height: `${(horizontal ? size : size * 2.4).toFixed(1)}px`, background: index % 5 === 0 ? '#ff4646' : tint,
          boxShadow: `0 0 ${(size * 3).toFixed(1)}px ${index % 5 === 0 ? '#ff4646' : tint}`, animationName: horizontal ? 'pnc-packet-x' : 'pnc-packet-y',
          animationDuration: `${(2.4 + hash(index, 83) * 3).toFixed(1)}s` });
        mote.style.setProperty('--o', '.75');
        mote.style.setProperty('--d', `${((hash(index, 101) > 0.5 ? 1 : -1) * rem * (5 + hash(index, 103) * 6)).toFixed(1)}px`);
      }
      Object.assign(mote.style, style);
      layer.append(mote);
    }
  }
}

export type { WinTier };
