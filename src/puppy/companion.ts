import {
  ACESFilmicToneMapping, Box3, DirectionalLight, HemisphereLight, PerspectiveCamera, Plane, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three';
import type { AnimationHandle } from '../animation/core/coordinator';
import type { SeatState, TableState } from '../adapter/pokernow/table-state';
import { paw } from '../rendering/puppy-art';
import { metal, rgba, svgDataUrl } from '../rendering/color';
import { streetForEvent, type CompanionSettings, type Rect, type Settings, type Theme, type VisualEvent } from '../types';
import { buildPuppy, type PuppyRig } from './model';
import { planForEvent, type Choreography, type Pt, type PuppyCue } from './plan';
import { applyPose, neutralPose, type PuppyPose } from './pose';
import type { Companion, StageDirector } from './types';

/**
 * The puppy: one persistent Three.js scene on a transparent, click-through canvas
 * over the table. All behaviour is decided in screen pixels (where PokerNow's
 * cards, seats and chips are measured) and mapped onto a floor plane only to
 * render, so it follows the real table at any size or layout.
 */

/** The states the brain moves between; exposed for debugging and tests. */
export type PuppyState = 'IDLE' | 'WALKING' | 'RUNNING' | 'GRABBING_CARD' | 'PUSHING_CARD' | 'DEALING' | 'FOLDING' | 'PUSHING_CHIPS' | 'CELEBRATING' | 'SLEEPING' | 'STARTLED' | 'RETURNING_TO_IDLE' | 'AWAY';

const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => { const u = clamp(t); return u * u * (3 - 2 * u); };
const range = (t: number, a: number, b: number): number => clamp((t - a) / Math.max(1e-6, b - a));
const wrap = (a: number): number => { let x = a; while (x > Math.PI) x -= Math.PI * 2; while (x < -Math.PI) x += Math.PI * 2; return x; };
const centre = (r: Rect): Pt => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
/** Frame-rate independent exponential approach. */
const approach = (current: number, target: number, rate: number, dt: number): number => current + (target - current) * (1 - Math.exp(-rate * dt));

/** A player thinking this long sends the puppy to sleep (until the clock runs low). */
const SLEEP_AFTER = 7000;
const DEFAULT_SETTINGS: CompanionSettings = { kind: 'puppy', animations: true, intensity: 'normal', scale: 'medium' };
const easeOutBack = (t: number): number => { const u = clamp(t) - 1; return 1 + 2.4 * u * u * u + 1.4 * u * u; };

const SCALE: Record<CompanionSettings['scale'], number> = { small: 0.66, medium: 0.86, large: 1.12 };
const INTENSITY: Record<CompanionSettings['intensity'], number> = { subtle: 0.55, normal: 1, playful: 1.45 };

/** A table moment the puppy acts out with its own clock (not a card animation). */
interface Task {
  kind: 'nose-chips' | 'bat-fold' | 'celebrate' | 'nudge-bet' | 'perk' | 'startle';
  started: number;
  /** Where to be, when to arrive (ms after start), how long to act after arriving. */
  to: Pt; face: Pt; arrive: number; act: number;
  /** Second leg for nose-chips: follow the chips toward the pot. */
  then?: Pt;
  tier?: 'small' | 'medium' | 'big';
  part: 'nose' | 'paw' | 'body';
  /** Celebration bookkeeping: the landing ring has played; when the next heart floats up. */
  landed?: boolean;
  heartAt?: number;
}

interface Layout {
  table: Rect;
  cardH: number;
  occupied: Rect[];
  board?: Rect;
  pot?: Rect;
  hero?: SeatState;
  seats: SeatState[];
}

class Mapper {
  readonly camera = new PerspectiveCamera(24, 1, 0.1, 400);
  private readonly ray = new Raycaster();
  private readonly floor = new Plane(new Vector3(0, 1, 0), 0);
  private readonly ndc = new Vector2();
  private readonly hit = new Vector3();
  width = 1; height = 1;

  constructor() {
    // A three-quarter view from the player's side of the table.
    const elevation = 54 * Math.PI / 180, distance = 60;
    this.camera.position.set(0, Math.sin(elevation) * distance, Math.cos(elevation) * distance);
    this.camera.lookAt(0, 0, 0);
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /** Screen pixel → point on the floor plane. */
  toFloor(x: number, y: number, out = new Vector3()): Vector3 {
    this.ndc.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return this.ray.ray.intersectPlane(this.floor, this.hit) ? out.copy(this.hit) : out.set(0, 0, 0);
  }

  toScreen(point: Vector3): Pt {
    const v = point.clone().project(this.camera);
    return { x: (v.x + 1) / 2 * this.width, y: (1 - v.y) / 2 * this.height };
  }
}

/**
 * The pose at the instant of contact for each action. The body is placed from this
 * fixed pose, so it stays planted while the head dips or a paw winds up and strikes.
 */
function contactPose(action: PuppyCue['action']): Partial<PuppyPose> {
  switch (action) {
    case 'paw-strike': return { pawR: 0.95, reachR: 0.48, headPitch: 0.25, lean: 0.1, stretch: 1, sit: 0 };
    case 'nose-push': return { headPitch: 0.62, lean: 0.18, bow: 0.25, sit: 0 };
    case 'mouth-grab': return { headPitch: 0.7, lean: 0.15, mouth: 1, sit: 0 };
    case 'mouth-carry': return { headPitch: -0.05, lean: 0.04, mouth: 0.15, sit: 0 };
    case 'drop': return { headPitch: 0.25, mouth: 0.9, sit: 0 };
    case 'paw-slide': return { pawR: 0.35, reachR: 0.85, headPitch: 0.35, lean: 0.1, sit: 0 };
    case 'paw-flick': return { pawR: 0.35, reachR: 0.85, headPitch: 0.2, sit: 0 };
    case 'run': return { pawR: 0, reachR: 0, headPitch: 0.1, lean: 0.05, sit: 0 };
    default: return { pawR: 0, reachR: 0, sit: 0.85, lift: 0, spin: 0 };
  }
}

export class PuppyCompanion implements Companion {
  readonly director: StageDirector;
  private readonly canvas: HTMLCanvasElement;
  private readonly effects: HTMLDivElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly mapper = new Mapper();
  private readonly rig: PuppyRig;
  private readonly pose: PuppyPose = neutralPose();
  private theme: Theme | undefined;
  private settings: CompanionSettings = DEFAULT_SETTINGS;
  /**
   * Resident: the room is the Puppy room and the puppy lives on the table. Visiting:
   * another room uses a puppy card animation, so the puppy pops in for it and leaves.
   */
  private resident = true;
  /** 0 absent … 1 fully present; a visitor scales in and out of the room. */
  private presence = 1;
  private presenceGoal = 1;
  /** 0 awake … 1 fast asleep. */
  private sleep = 0;
  private zzzNext = 0;
  /** The seat currently deciding, since when, and whether its clock has run low. */
  private decider: number | undefined;
  private decidingSince = 0;
  private urgent = false;
  private alarmed = false;
  private reduced = false;
  private layout: Layout | undefined;
  private home: Pt | undefined;
  /** Where the puppy stands (screen px) and which way it faces (screen radians). */
  private at: Pt = { x: 0, y: 0 };
  private heading = Math.PI / 2;
  private placed = false;
  private state: PuppyState = 'IDLE';
  private stateSince = 0;
  private scaleWorld = 1;
  private pxPerUnit = 100;
  private card: { handle: AnimationHandle; plan: Choreography; from: Pt; started: number; done: boolean; held: number; holdSince: number } | undefined;
  private tasks: Task[] = [];
  private look: Pt | undefined;
  private lookUntil = 0;
  private excite = 0;
  private wag = 0;
  private blinkAt = 0;
  private blinkPhase = 0;
  private idleAction: { kind: 'scratch' | 'tilt' | 'look' | 'stretch'; until: number; target?: Pt } | undefined;
  private idleNext = 0;
  private earVelocity = [0, 0];
  private ears = [0, 0];
  private lastY = 0;
  private frame = 0;
  private lastTime = 0;
  private lastRender = 0;
  private disposed = false;
  private readonly onVisibility = (): void => { if (!this.document.hidden) this.schedule(); };
  private readonly view: Window;

  constructor(surface: HTMLElement, private readonly document: Document) {
    this.view = document.defaultView ?? window;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('data-pnc-overlay', 'puppy');
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: '0' });
    this.effects = document.createElement('div');
    this.effects.setAttribute('data-pnc-overlay', 'puppy-effects');
    Object.assign(this.effects.style, { position: 'fixed', inset: '0', pointerEvents: 'none', overflow: 'hidden', zIndex: '0' });
    // Below the card and chip overlays: a card in the puppy's mouth or under its paw shows in front.
    surface.prepend(this.effects);
    surface.prepend(this.canvas);
    this.renderer = new WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, powerPreference: 'low-power', premultipliedAlpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.add(new HemisphereLight('#fff4e0', '#4a3424', 1.15));
    const key = new DirectionalLight('#fff1db', 2.1); key.position.set(-20, 40, 30); this.scene.add(key);
    const rim = new DirectionalLight('#ffd79a', 1.5); rim.position.set(20, 25, -30); this.scene.add(rim);
    this.rig = buildPuppy();
    this.rig.root.visible = false;
    this.scene.add(this.rig.root);
    this.canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); this.dispose(); });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.geometry();
    this.director = this.makeDirector();
    this.schedule();
  }

  // ───────────────────────────────────────────────────────────── public

  configure(theme: Theme, settings: Settings): void {
    this.theme = theme;
    this.settings = theme.companion ?? DEFAULT_SETTINGS;
    const resident = Boolean(theme.companion);
    if (resident !== this.resident) {
      this.resident = resident;
      this.tasks = [];
      this.sleep = 0;
      this.home = undefined;
      // A visitor waits off stage; a resident appears at home on the next table reading.
      this.presence = this.presenceGoal = resident ? 1 : 0;
      this.placed = false;
      if (!resident) this.setState('AWAY');
    }
    this.reduced = settings.reducedMotion || (typeof this.view.matchMedia === 'function' && this.view.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.computeScale();
    this.schedule();
  }

  table(state: TableState | undefined): void {
    if (!state || state.table.width < 50) { this.layout = undefined; this.rig.root.visible = false; return; }
    const cardH = state.table.height * 0.21;
    const occupied: Rect[] = [];
    for (const seat of state.seats) {
      occupied.push(seat.plate);
      if (seat.betRect) occupied.push(seat.betRect);
      for (const card of seat.cards) occupied.push(card);
    }
    if (state.potRect) occupied.push(state.potRect);
    if (state.board) occupied.push({ ...state.board, height: Math.max(state.board.height, cardH) });
    const changed = !this.layout || Math.abs(this.layout.table.x - state.table.x) > 1 || Math.abs(this.layout.table.width - state.table.width) > 1 || Math.abs(this.layout.table.y - state.table.y) > 1;
    this.layout = { table: state.table, cardH, occupied, board: state.board, pot: state.potRect, hero: state.seats.find((seat) => seat.you), seats: state.seats };
    if (changed) { this.computeScale(); this.home = undefined; }
    if (this.resident) {
      if (!this.home || (this.state === 'IDLE' && this.homeBlocked())) this.home = this.chooseHome();
      if (!this.placed && this.home) { this.at = { ...this.home }; this.heading = Math.PI / 2; this.placed = true; }
    } else if (!this.card) this.home = this.edge(this.at);
    this.rig.root.visible = this.presence > 0.01;
    this.watchClock(state);
    this.schedule();
  }

  /** Whether a puppy card animation can be performed right now (otherwise another preset plays). */
  ready(): boolean {
    return !this.disposed && Boolean(this.layout) && this.settings.animations && !this.reduced;
  }

  /**
   * Who is thinking, and for how long. A long think sends the puppy to sleep; when
   * the clock runs low (PokerNow turns the timer red and starts beeping) it jumps up.
   */
  private watchClock(state: TableState): void {
    const seat = state.seats.find((candidate) => candidate.deciding);
    const now = performance.now();
    if (seat?.position !== this.decider) { this.decider = seat?.position; this.decidingSince = now; this.alarmed = false; }
    this.urgent = Boolean(seat?.urgent);
    if (!this.urgent || this.alarmed || !this.resident || !seat) return;
    this.alarmed = true;
    if (this.card || this.reduced || !this.settings.animations) { this.glance(centre(seat.plate), 2200); return; }
    const asleep = this.sleep > 0.25;
    this.tasks = [{ kind: asleep ? 'startle' : 'perk', started: now, to: this.at, face: centre(seat.plate), arrive: 0, act: asleep ? 1500 : 900, part: 'body' }];
    if (asleep) this.exclaim();
    this.excite = 1;
    this.glance(centre(seat.plate), 2600);
  }

  /** A point on the rail nearest `near`: where a visitor enters and leaves. */
  private edge(near: Pt): Pt {
    if (!this.layout) return near;
    const t = this.layout.table, c = centre(t);
    let dx = (near.x - c.x) / (t.width / 2), dy = (near.y - c.y) / (t.height / 2);
    const l = Math.hypot(dx, dy);
    if (l < 1e-3) { dx = 0.6; dy = 0.8; } else { dx /= l; dy /= l; }
    return { x: c.x + dx * t.width * 0.43, y: c.y + dy * t.height * 0.4 };
  }

  animation(handle: AnimationHandle, event: VisualEvent, given?: Choreography): void {
    const street = streetForEvent(event.type);
    const plan = given ?? planForEvent(event.id);
    if (!street || !plan) {
      // Another preset is running: watch the cards land.
      const first = event.cards[0];
      if (first) this.glance(centre(first.target), 1400);
      return;
    }
    if (!this.settings.animations || this.reduced) { this.glance(centre(event.cards[0]!.target), 1600); return; }
    // A card animation takes priority over any chip or fold errand.
    this.tasks = [];
    this.releaseHold();
    if (!this.resident && this.presence < 0.5) {
      // A visitor pops in on the rail nearest its first mark, facing into the table.
      const mark = plan.puppy(0).point;
      this.at = this.edge(mark);
      this.heading = Math.atan2(mark.y - this.at.y, mark.x - this.at.x);
      this.pose.sit = 0; this.pose.lie = 0; this.sleep = 0;
      this.placed = true;
      this.poof(this.at);
    }
    this.presenceGoal = 1;
    this.rig.root.visible = true;
    this.card = { handle, plan, from: { ...this.at }, started: performance.now(), done: false, held: 0, holdSince: 0 };
    this.clock = { raw: -1, at: 0, rate: 0, value: 0 };
    const finish = (): void => {
      if (this.card?.handle === handle) {
        this.releaseHold(); this.card.done = true; this.card = undefined; this.setState('RETURNING_TO_IDLE');
        // A visitor trots off to the nearest rail and leaves.
        if (!this.resident) this.home = this.edge(this.at);
      }
      this.schedule();
    };
    void handle.finished.then(finish, finish);
    this.schedule();
  }

  geometry(): void {
    const width = this.view.innerWidth, height = this.view.innerHeight;
    this.renderer.setPixelRatio(Math.min(1.5, this.view.devicePixelRatio || 1));
    this.renderer.setSize(width, height, false);
    this.mapper.resize(width, height);
    this.computeScale();
    this.schedule();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.view.cancelAnimationFrame(this.frame);
    this.document.removeEventListener('visibilitychange', this.onVisibility);
    this.rig.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.canvas.remove();
    this.effects.remove();
    this.tasks = [];
    this.releaseHold();
    this.card = undefined;
  }

  /**
   * The cards never get ahead of the puppy. If it is still on its way when a paw,
   * nose or mouth is due to touch a card, the card waits for it, for a little while
   * at most: the real cards are hidden during the wait, so it is kept short.
   */
  private static readonly HOLD_BUDGET = 900;
  private keepPace(now: number, cue: PuppyCue | undefined): void {
    const card = this.card;
    if (!card || card.done || !cue || !this.layout) return;
    const due = cue.phase !== 'approach' || cue.approach > 0.82;
    const behind = this.lag > Math.max(14, this.layout.cardH * 0.3), caughtUp = this.lag < Math.max(6, this.layout.cardH * 0.12);
    if (!card.holdSince && due && behind && card.held < PuppyCompanion.HOLD_BUDGET && card.handle.progress < 1) {
      card.holdSince = now;
      card.handle.pause();
    } else if (card.holdSince && (caughtUp || card.held + (now - card.holdSince) >= PuppyCompanion.HOLD_BUDGET)) {
      this.releaseHold(now);
    }
  }
  private releaseHold(now = performance.now()): void {
    const card = this.card;
    if (!card?.holdSince) return;
    card.held += now - card.holdSince;
    card.holdSince = 0;
    card.handle.resume();
  }

  private renders = 0;
  /** How far the body was from where the plan needed it on the last frame (px). */
  private lag = 0;
  debug(): { state: PuppyState; since: number; at: Pt; heading: number; yaw: number; home: Pt | undefined; visible: boolean; renders: number; lag: number } {
    return { state: this.state, since: this.stateSince, at: { ...this.at }, heading: this.heading, yaw: this.rig.root.rotation.y, home: this.home && { ...this.home }, visible: this.rig.root.visible, renders: this.renders, lag: this.lag };
  }

  // ───────────────────────────────────────────────────────────── layout

  private get intensity(): number { return INTENSITY[this.settings.intensity] ?? 1; }

  /** World scale so the puppy stands about two card-heights tall, whatever the window size. */
  private computeScale(): void {
    if (!this.layout) return;
    const c = centre(this.layout.table);
    const base = this.mapper.toFloor(c.x, c.y), top = base.clone().add(new Vector3(0, 1, 0));
    const a = this.mapper.toScreen(base), b = this.mapper.toScreen(top);
    this.pxPerUnit = Math.max(1e-3, dist(a, b));
    const targetPx = this.layout.cardH * (SCALE[this.settings.scale] ?? 1.05);
    this.scaleWorld = targetPx / (1.3 * this.pxPerUnit);
    this.rig.root.scale.setScalar(this.scaleWorld);
    this.outline = undefined;
  }

  /**
   * The puppy's real outline on screen, relative to where it stands: its 3D bounds
   * projected through the camera, measured once per size change.
   */
  private outline: Rect | undefined;
  private measureOutline(): void {
    if (!this.layout) return;
    const at = centre(this.layout.table);
    this.transform(at, Math.PI / 2);
    this.rig.root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(this.rig.body, true), corners: Pt[] = []; // body and head; not the shadow disc
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(this.mapper.toScreen(new Vector3(x, y, z)));
    const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
    // Allow for turning: use the wider of the two horizontal extents.
    const half = Math.max(at.x - Math.min(...xs), Math.max(...xs) - at.x);
    this.outline = { x: -half, y: Math.min(...ys) - at.y, width: half * 2, height: Math.max(...ys) - Math.min(...ys) };
    this.transform(this.at, this.heading);
  }

  /** The puppy's own footprint on screen around a standing point. */
  private footprint(at: Pt): Rect {
    if (!this.outline) this.measureOutline();
    const o = this.outline ?? { x: -60, y: -120, width: 120, height: 130 };
    return { x: at.x + o.x, y: at.y + o.y, width: o.width, height: o.height };
  }

  private overlap(a: Rect, b: Rect): number {
    const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x), y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    return x > 0 && y > 0 ? x * y : 0;
  }

  private blockedArea(at: Pt): number {
    const foot = this.footprint(at);
    return (this.layout?.occupied ?? []).reduce((sum, rect) => sum + this.overlap(foot, rect), 0);
  }

  private homeBlocked(): boolean {
    if (!this.home || !this.layout) return true;
    const foot = this.footprint(this.home);
    return this.blockedArea(this.home) > foot.width * foot.height * 0.12;
  }

  /**
   * A resting spot on the felt that covers none of the cards, chips or name plates:
   * a grid search inside the felt ellipse, preferring clear spots near the middle
   * and staying put when the current spot is still fine.
   */
  private chooseHome(): Pt | undefined {
    if (!this.layout) return undefined;
    const t = this.layout.table, middle = centre(t);
    let best: Pt | undefined, score = Infinity;
    for (let gx = 0; gx <= 12; gx++) {
      for (let gy = 0; gy <= 8; gy++) {
        const fx = 0.16 + gx * (0.68 / 12), fy = 0.2 + gy * (0.66 / 8);
        // Felt ellipse (centre .5,.47; radii .32,.33 of the table box), with a margin.
        if (((fx - 0.5) / 0.27) ** 2 + ((fy - 0.48) / 0.27) ** 2 > 1) continue;
        const candidate = { x: t.x + t.width * fx, y: t.y + t.height * fy };
        // Covering information costs far more than walking a little further from the middle.
        const s = this.blockedArea(candidate) * 20 + dist(candidate, middle) * 0.6 + (this.home ? dist(candidate, this.home) * 0.25 : 0);
        if (s < score) { score = s; best = candidate; }
      }
    }
    return best;
  }


  /** The clear spot on the felt nearest to `near`, so a celebration never sits on cards. */
  private clearSpot(near: Pt): Pt {
    if (!this.layout) return near;
    const t = this.layout.table, foot = this.footprint(near), budget = foot.width * foot.height * 0.08;
    let best = near, score = Infinity;
    for (let gx = 0; gx <= 16; gx++) {
      for (let gy = 0; gy <= 10; gy++) {
        const fx = 0.14 + gx * (0.72 / 16), fy = 0.18 + gy * (0.68 / 10);
        if (((fx - 0.5) / 0.29) ** 2 + ((fy - 0.48) / 0.29) ** 2 > 1) continue;
        const candidate = { x: t.x + t.width * fx, y: t.y + t.height * fy };
        const blocked = this.blockedArea(candidate);
        const s = (blocked > budget ? blocked * 20 : 0) + dist(candidate, near);
        if (s < score) { score = s; best = candidate; }
      }
    }
    return best;
  }

  // ───────────────────────────────────────────────────────────── table moments

  private makeDirector(): StageDirector {
    const busy = (): boolean => Boolean(this.card) || !this.layout || !this.settings.animations || this.reduced || !this.resident;
    const runMs = (to: Pt): number => clamp(dist(this.at, to) / Math.max(1, (this.layout?.table.width ?? 800) * 1.6) * 1000, 160, 420);
    return {
      collect: (bets, pot) => {
        if (busy() || !bets.length || !pot) { if (pot) this.glance(centre(pot), 900); return 0; }
        // Nose the biggest-looking stack (the one nearest the middle) toward the pot.
        const target = bets.map((bet) => centre(bet.rect)).sort((a, b) => dist(a, centre(pot)) - dist(b, centre(pot)))[0]!;
        const potC = centre(pot), dir = { x: potC.x - target.x, y: potC.y - target.y }, l = Math.hypot(dir.x, dir.y) || 1;
        const behind = { x: target.x - dir.x / l * (this.layout!.cardH * 0.35), y: target.y - dir.y / l * (this.layout!.cardH * 0.35) };
        const arrive = runMs(behind);
        this.tasks = [{ kind: 'nose-chips', started: performance.now(), to: behind, face: potC, arrive, act: 520, then: { x: mix(behind.x, potC.x, 0.55), y: mix(behind.y, potC.y, 0.55) }, part: 'nose' }];
        this.setState('RUNNING');
        this.schedule();
        return arrive;
      },
      fold: (cards, seat) => {
        if (busy() || !cards.length) { if (cards[0]) this.glance(centre(cards[0]), 700); return 0; }
        const at = centre(cards[0]!), mid = this.layout ? centre(this.layout.table) : at;
        const dir = { x: at.x - mid.x, y: at.y - mid.y }, l = Math.hypot(dir.x, dir.y) || 1;
        // Stand on the felt side of the folded cards and bat them away.
        const stand = { x: at.x - dir.x / l * this.layout!.cardH * 0.55, y: at.y - dir.y / l * this.layout!.cardH * 0.55 };
        const arrive = runMs(stand);
        this.tasks = [{ kind: 'bat-fold', started: performance.now(), to: stand, face: at, arrive, act: 420, part: 'paw' }];
        void seat;
        this.setState('RUNNING');
        this.schedule();
        return arrive;
      },
      bet: (seat, at) => {
        if (!at) return;
        this.glance(centre(at), 900);
        // Now and then a playful pup gives a fresh stack a little push.
        if (!busy() && !this.tasks.length && this.state === 'IDLE' && Math.random() < 0.18 * this.intensity && dist(this.at, centre(at)) < (this.layout?.table.width ?? 0) * 0.3) {
          const c = centre(at);
          this.tasks = [{ kind: 'nudge-bet', started: performance.now(), to: { x: c.x, y: c.y + (this.layout?.cardH ?? 80) * 0.3 }, face: c, arrive: runMs(c), act: 380, part: 'paw' }];
          this.setState('WALKING');
        }
        void seat;
        this.schedule();
      },
      award: (winners, pot, tier) => {
        const target = winners[0] ? centre(winners[0].plate) : pot ? centre(pot) : this.at;
        this.excite = 1;
        if (busy()) { this.glance(target, 2000); return; }
        // Chase the chips toward the winner, then celebrate on clear felt beside them.
        const mid = this.layout ? centre(this.layout.table) : target;
        // Out on the open felt between the pot and the winner, where the dance can be seen.
        const to = this.clearSpot({ x: mix(mid.x, target.x, 0.38), y: mix(mid.y, target.y, 0.3) + (this.layout?.cardH ?? 80) * 0.4 });
        const arrive = clamp(dist(this.at, to) / Math.max(1, (this.layout?.table.width ?? 800) * 1.1) * 1000, 260, 900);
        this.tasks = [{ kind: 'celebrate', started: performance.now(), to, face: target, arrive, act: tier === 'big' ? 3400 : tier === 'medium' ? 2800 : 2300, tier, part: 'body' }];
        this.setState('CELEBRATING');
        this.burst(target, tier);
        this.schedule();
      },
      allIn: (seat) => { if (seat) { this.glance(centre(seat.plate), 1500); this.excite = Math.max(this.excite, 0.85); this.tasks.length || this.tasks.push({ kind: 'perk', started: performance.now(), to: this.at, face: centre(seat.plate), arrive: 0, act: 900, part: 'body' }); } this.schedule(); },
      turn: (seat) => { if (seat) this.glance(centre(seat.plate), seat.you ? 1800 : 1100); this.schedule(); },
      newHand: () => { this.excite = 0.2; this.schedule(); },
    };
  }

  private glance(at: Pt, ms: number): void {
    this.look = at;
    this.lookUntil = performance.now() + ms;
    this.schedule();
  }

  private setState(state: PuppyState): void {
    if (state === this.state) return;
    this.state = state;
    this.stateSince = performance.now();
  }

  // ───────────────────────────────────────────────────────────── celebration particles (2D, light)

  private burst(at: Pt, tier: 'small' | 'medium' | 'big'): void {
    if (this.reduced || typeof this.effects.animate !== 'function') return;
    const accent = metal(this.theme?.table.trimColor ?? '#e8b86a');
    const pawUrl = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 2 2" width="40" height="40"><g fill="${accent.high}">${paw(0, 0, 1.6)}</g></svg>`);
    const count = Math.round((tier === 'big' ? 18 : tier === 'medium' ? 11 : 7) * this.intensity);
    const size = (this.layout?.cardH ?? 80) * 0.24;
    for (let index = 0; index < count; index++) {
      const node = this.document.createElement('div');
      const sparkle = index % 3 === 2;
      Object.assign(node.style, { position: 'absolute', left: '0', top: '0', width: `${size}px`, height: `${size}px`, pointerEvents: 'none',
        background: sparkle ? `radial-gradient(circle, #fff 0%, ${rgba(accent.spec, 0.9)} 30%, transparent 70%)` : `url("${pawUrl}") center/contain no-repeat`,
        filter: `drop-shadow(0 0 ${size * 0.25}px ${rgba(accent.high, 0.8)})` });
      this.effects.append(node);
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.5, reach = size * (2.4 + Math.random() * 2.6);
      const x = at.x + Math.cos(angle) * reach, y = at.y + Math.sin(angle) * reach * 0.7 - size * 1.2, spin = (Math.random() - 0.5) * 120;
      const animation = node.animate([
        { transform: `translate3d(${at.x - size / 2}px,${at.y - size / 2}px,0) scale(.2) rotate(0deg)`, opacity: 0 },
        { transform: `translate3d(${mix(at.x, x, 0.6) - size / 2}px,${mix(at.y, y, 0.6) - size / 2}px,0) scale(1) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate3d(${x - size / 2}px,${y - size / 2 + size}px,0) scale(.7) rotate(${spin}deg)`, opacity: 0 },
      ], { duration: 1100 + Math.random() * 700, delay: 120 + index * 40, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
      const remove = (): void => node.remove();
      animation.finished.then(remove, remove);
    }
  }

  /** Where the puppy's head is on screen, for thought bubbles and hearts. */
  private headPoint(): Pt {
    const world = new Vector3();
    this.rig.root.updateMatrixWorld(true);
    this.rig.sockets.nose.getWorldPosition(world);
    const nose = this.mapper.toScreen(world);
    return { x: nose.x, y: nose.y - (this.layout?.cardH ?? 80) * 0.2 };
  }

  /** One light 2D flourish on the effects layer, removed when it finishes. */
  private flourish(style: Partial<CSSStyleDeclaration>, content: string, frames: Keyframe[], duration: number, delay = 0): void {
    if (this.reduced || typeof this.effects.animate !== 'function') return;
    const node = this.document.createElement('div');
    Object.assign(node.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', willChange: 'transform, opacity' }, style);
    if (content) node.textContent = content;
    this.effects.append(node);
    const animation = node.animate(frames, { duration, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    const remove = (): void => node.remove();
    animation.finished.then(remove, remove);
  }

  private zzzCount = 0;
  private zzz(): void {
    const at = this.headPoint(), size = (this.layout?.cardH ?? 80) * (0.3 + (this.zzzCount++ % 3) * 0.06);
    const x = at.x + size * 0.3, y = at.y - size * 0.6;
    this.flourish({ font: `italic 800 ${size}px Georgia, 'Times New Roman', serif`, color: '#ffffff', webkitTextStroke: `${Math.max(1, size * 0.05)}px #3b2a1a`, textShadow: `0 0 ${size * 0.35}px rgba(170,210,255,.95), 0 2px 4px rgba(0,0,0,.5)` }, 'Z', [
      { transform: `translate3d(${x}px,${y}px,0) scale(.4) rotate(-12deg)`, opacity: 0 },
      { transform: `translate3d(${x + size * 0.5}px,${y - size * 0.8}px,0) scale(.9) rotate(4deg)`, opacity: 1, offset: 0.3 },
      { transform: `translate3d(${x + size * 1.3}px,${y - size * 2.4}px,0) scale(1.35) rotate(14deg)`, opacity: 0 },
    ], 2200);
  }

  private exclaim(): void {
    const at = this.headPoint(), size = (this.layout?.cardH ?? 80) * 0.5;
    // Above where the head will be at the top of the leap.
    const leap = 0.7 * this.scaleWorld * this.pxPerUnit;
    const side = this.layout && at.x > centre(this.layout.table).x ? -1 : 1;
    const x = at.x + side * size * 1.1 - size * 0.18, y = at.y - size * 1.2 - leap;
    this.flourish({ font: `900 ${size}px Georgia, 'Times New Roman', serif`, color: '#ffd76a', textShadow: `0 0 ${size * 0.25}px rgba(255,190,80,.95), 0 3px 4px rgba(0,0,0,.5)` }, '!', [
      { transform: `translate3d(${x}px,${y + size * 0.5}px,0) scale(.2)`, opacity: 0 },
      { transform: `translate3d(${x}px,${y}px,0) scale(1.35)`, opacity: 1, offset: 0.14 },
      { transform: `translate3d(${x}px,${y}px,0) scale(1)`, opacity: 1, offset: 0.24 },
      { transform: `translate3d(${x}px,${y}px,0) scale(1)`, opacity: 1, offset: 0.8 },
      { transform: `translate3d(${x}px,${y - size * 0.3}px,0) scale(.9)`, opacity: 0 },
    ], 1500);
    // Little surprise strokes around the head.
    for (const angle of [-2.4, -1.57, -0.74]) {
      const len = size * 0.4, sx = at.x + Math.cos(angle) * size * 0.95, sy = at.y - size * 0.5 - leap + Math.sin(angle) * size * 0.95;
      this.flourish({ width: `${len}px`, height: `${Math.max(2, size * 0.07)}px`, borderRadius: '9px', background: '#ffe2a0', boxShadow: '0 0 6px rgba(255,200,90,.9)', transformOrigin: '0 50%' }, '', [
        { transform: `translate3d(${sx}px,${sy}px,0) rotate(${angle}rad) scaleX(0)`, opacity: 0 },
        { transform: `translate3d(${sx}px,${sy}px,0) rotate(${angle}rad) scaleX(1)`, opacity: 1, offset: 0.3 },
        { transform: `translate3d(${sx + Math.cos(angle) * len * 0.6}px,${sy + Math.sin(angle) * len * 0.6}px,0) rotate(${angle}rad) scaleX(.3)`, opacity: 0 },
      ], 600);
    }
  }

  private heart(): void {
    const at = this.headPoint(), size = (this.layout?.cardH ?? 80) * (0.2 + Math.random() * 0.12);
    const url = svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 30" width="32" height="30"><path d="M16 29C7 22 1 16.5 1 9.6 1 4.8 4.7 1 9.3 1c2.8 0 5.2 1.4 6.7 3.6C17.5 2.4 19.9 1 22.7 1 27.3 1 31 4.8 31 9.6 31 16.5 25 22 16 29Z" fill="#ff5d7e" stroke="#fff" stroke-width="2"/><ellipse cx="9" cy="8" rx="3.4" ry="2.2" fill="#fff" fill-opacity=".55"/></svg>');
    const x = at.x - size / 2 + (Math.random() - 0.5) * size * 1.4, y = at.y - size, drift = (Math.random() - 0.5) * size * 2;
    this.flourish({ width: `${size}px`, height: `${size}px`, background: `url("${url}") center/contain no-repeat`, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' }, '', [
      { transform: `translate3d(${x}px,${y}px,0) scale(.3)`, opacity: 0 },
      { transform: `translate3d(${x + drift * 0.3}px,${y - size * 1.2}px,0) scale(1.1)`, opacity: 1, offset: 0.25 },
      { transform: `translate3d(${x + drift}px,${y - size * 4}px,0) scale(.8)`, opacity: 0 },
    ], 1500);
  }

  /** A gold shock ring on the felt where the puppy lands its leap. */
  private ring(at: Pt, tier: 'small' | 'medium' | 'big'): void {
    const accent = metal(this.theme?.table.trimColor ?? '#e8b86a'), size = (this.layout?.cardH ?? 80) * (tier === 'big' ? 3.2 : tier === 'medium' ? 2.6 : 2);
    for (const [delay, width] of [[0, 4], [140, 2]] as const) {
      this.flourish({ width: `${size}px`, height: `${size}px`, borderRadius: '50%', border: `${width}px solid ${accent.high}`, boxShadow: `0 0 18px ${rgba(accent.high, 0.8)}, inset 0 0 12px ${rgba(accent.high, 0.6)}` }, '', [
        { transform: `translate3d(${at.x - size / 2}px,${at.y - size / 2}px,0) scale(.15, .07)`, opacity: 0.95 },
        { transform: `translate3d(${at.x - size / 2}px,${at.y - size / 2}px,0) scale(1, .46)`, opacity: 0 },
      ], 900, delay);
    }
    this.burst(at, tier);
  }

  /** A soft puff where a visitor appears or leaves. */
  private poof(at: Pt): void {
    const size = (this.layout?.cardH ?? 80) * 0.38;
    for (let index = 0; index < 7; index++) {
      const angle = (index / 7) * Math.PI * 2, reach = size * 1.3;
      const x = at.x - size / 2, y = at.y - size * 0.9;
      this.flourish({ width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #fffaf0, rgba(255,240,215,.75) 55%, rgba(255,235,200,0) 72%)' }, '', [
        { transform: `translate3d(${x}px,${y}px,0) scale(.3)`, opacity: 0.95 },
        { transform: `translate3d(${x + Math.cos(angle) * reach}px,${y + Math.sin(angle) * reach * 0.6}px,0) scale(1.15)`, opacity: 0 },
      ], 620, index * 12);
    }
  }

  // ───────────────────────────────────────────────────────────── the loop

  private schedule(): void {
    if (this.disposed || this.frame || this.document.hidden) return;
    this.frame = this.view.requestAnimationFrame(this.tick);
  }

  private drawn = false;
  private readonly tick = (now: number): void => {
    this.frame = 0;
    if (this.disposed || this.document.hidden) return;
    const dt = Math.min(0.05, this.lastTime ? (now - this.lastTime) / 1000 : 0.016);
    this.lastTime = now;
    const active = Boolean(this.card || this.tasks.length || this.state !== 'IDLE' || this.look);
    // Idle breathing and wagging need far fewer frames than a run across the felt.
    const interval = this.reduced ? 1000 / 12 : active ? 0 : 1000 / 30;
    if (now - this.lastRender >= interval - 1) {
      this.update(now, Math.max(dt, (now - this.lastRender) / 1000 > 0.2 ? 0.016 : (now - this.lastRender) / 1000));
      this.lastRender = now;
      if (this.rig.root.visible) { this.renderer.render(this.scene, this.mapper.camera); this.renders++; this.drawn = true; }
      else if (this.drawn) { this.renderer.clear(); this.drawn = false; }
    }
    // A visitor that has left needs no frames until it is called back.
    if (!this.resident && this.presence <= 0 && !this.card) { this.lastTime = 0; return; }
    this.frame = this.view.requestAnimationFrame(this.tick);
  };

  private update(now: number, dt: number): void {
    if (!this.layout || !this.home) return;
    // A visitor that has left does nothing until its next card animation calls it in.
    if (!this.resident && !this.card && this.presence <= 0) { this.setState('AWAY'); return; }
    const p = this.pose, intensity = this.intensity;
    Object.assign(p, { lift: 0, spin: 0, lean: 0, roll: 0, bow: 0, lie: 0, stretch: 1, blink: 0, pawL: 0, pawR: 0, reachL: 0, reachR: 0, mouth: 0, tongue: 0, scratch: 0, headPitch: 0.1, headTilt: 0 });
    let target: Pt = this.home, part: 'body' | 'paw' | 'nose' | 'mouth' = 'body', face: Pt | undefined, speed = 0, sitGoal = 1, look: Pt | undefined;
    let follow = false; // true: `target` is exact (contact), not a destination to walk to
    // When set, the puppy turns toward this heading rather than the way it happens to be moving.
    let headingGoal: number | undefined;
    let cue: PuppyCue | undefined;

    if (this.card && !this.card.done) {
      // ── a card animation: sample the shared plan at the animation's own progress
      const progress = this.smoothProgress(now);
      cue = this.card.plan.puppy(progress);
      sitGoal = cue.action === 'proud' ? 0.85 : 0;
      look = cue.look;
      // The heading the puppy will work with: from the touch point toward where the card goes.
      const working = Math.atan2(cue.face.y - cue.point.y, cue.face.x - cue.point.x);
      if (cue.phase === 'approach') {
        // Run straight from wherever it was to its mark, solved for the heading it will
        // have on arrival, and turn into that heading only over the last stretch.
        const from = this.card.from, to = this.solve(cue.part, cue.point, working, contactPose(cue.action));
        target = { x: mix(from.x, to.x, cue.approach), y: mix(from.y, to.y, cue.approach) };
        follow = true;
        const run = dist(from, to) > 4 ? Math.atan2(to.y - from.y, to.x - from.x) : working;
        headingGoal = run + wrap(working - run) * smooth(range(cue.approach, 0.7, 1));
        speed = cue.approach < 1 ? 1 : 0;
        this.setState('RUNNING');
      } else {
        part = cue.part; target = cue.point; face = cue.face; follow = true; headingGoal = working;
        this.setState(({ 'paw-strike': 'DEALING', 'nose-push': 'PUSHING_CARD', 'mouth-grab': 'GRABBING_CARD', 'mouth-carry': 'WALKING', drop: 'PUSHING_CARD', 'paw-slide': 'PUSHING_CARD', 'paw-flick': 'PUSHING_CARD', proud: 'CELEBRATING', hop: 'CELEBRATING', spin: 'CELEBRATING', run: 'RUNNING' } as const)[cue.action]);
      }
      this.excite = Math.max(this.excite, cue.excite);
      this.actionPose(cue, intensity);
    } else if (this.tasks.length) {
      // ── a table moment on the puppy's own clock
      const task = this.tasks[0]!, elapsed = now - task.started;
      if (elapsed < task.arrive) {
        target = task.to; face = task.face; speed = 1; sitGoal = 0; look = task.face;
        this.setState(task.kind === 'celebrate' ? 'CELEBRATING' : 'RUNNING');
      } else if (elapsed < task.arrive + task.act) {
        const u = (elapsed - task.arrive) / task.act;
        face = task.face; look = task.face; sitGoal = 0;
        if (task.kind === 'nose-chips') {
          this.setState('PUSHING_CHIPS');
          target = task.then ? { x: mix(task.to.x, task.then.x, smooth(u)), y: mix(task.to.y, task.then.y, smooth(u)) } : task.to; part = 'body'; follow = true;
          p.headPitch = 0.55; p.lean = 0.16; p.mouth = 0.1; speed = 0.5;
        } else if (task.kind === 'bat-fold' || task.kind === 'nudge-bet') {
          this.setState('FOLDING');
          target = task.to;
          const swipe = Math.sin(Math.PI * clamp(u * 1.6));
          p.pawR = swipe * 0.95; p.reachR = clamp(u * 2.2) * swipe; p.headPitch = 0.3; p.lean = 0.08;
        } else if (task.kind === 'celebrate') {
          // Three clear beats: a big spinning leap, a happy dance up on its hind legs
          // with both paws waving, then little bounces and a proud sit.
          this.setState('CELEBRATING');
          target = task.to;
          // Dance for the room: face the viewer, glancing at the winner now and then.
          face = { x: this.at.x, y: this.at.y + 400 };
          look = Math.sin(u * 9) > 0.4 ? task.face : face;
          const big = task.tier === 'big', leap = 0.28, dance = 0.74, lively = Math.min(1.3, 0.6 + intensity * 0.45);
          p.mouth = 0.85; p.tongue = 1; this.excite = 1;
          if (u < leap) {
            const k = u / leap, air = Math.sin(Math.PI * range(k, 0.12, 0.88));
            p.lift = air * 0.78 * lively;
            p.stretch = k < 0.12 ? 1 - Math.sin(Math.PI * k / 0.12) * 0.18 : k > 0.88 ? 1 - Math.sin(Math.PI * (k - 0.88) / 0.12) * 0.16 : 1 + air * 0.14;
            p.spin = smooth(range(k, 0.1, 0.9)) * Math.PI * 2 * (big ? 2 : 1);
            p.pawL = p.pawR = air * 0.6;
            if (!task.landed && k > 0.9) { task.landed = true; this.ring(this.at, task.tier ?? 'small'); }
          } else if (u < dance) {
            const k = (u - leap) / (dance - leap), beat = k * Math.PI * (big ? 10 : 8);
            sitGoal = 1;
            const up = smooth(range(k, 0, 0.12)) * (1 - smooth(range(k, 0.9, 1)));
            p.pawL = up * (0.8 + Math.sin(beat) * 0.3); p.pawR = up * (0.8 + Math.sin(beat + Math.PI) * 0.3);
            p.reachL = up * Math.max(0, Math.sin(beat)) * 0.4; p.reachR = up * Math.max(0, Math.sin(beat + Math.PI)) * 0.4;
            p.lift = Math.abs(Math.sin(beat * 0.5)) * 0.2 * lively * up;
            p.headTilt = Math.sin(beat * 0.5) * 0.3 * up; p.roll = Math.sin(beat * 0.5) * 0.1 * up;
            if (now > (task.heartAt ?? 0)) { task.heartAt = now + (big ? 260 : 380); this.heart(); }
          } else {
            const k = (u - dance) / (1 - dance), hop = (k * 2) % 1;
            p.lift = k < 0.7 ? Math.abs(Math.sin(Math.PI * hop)) * 0.3 * lively : 0;
            sitGoal = k > 0.7 ? 1 : 0;
            p.headPitch = -0.15;
          }
        } else if (task.kind === 'startle') {
          // Asleep when the clock started beeping: jolts awake, leaps, then barks at the clock.
          this.setState('STARTLED');
          target = this.at; this.sleep = 0; this.excite = 1;
          p.lie = Math.max(0, 1 - u / 0.05);
          const air = Math.sin(Math.PI * range(u, 0.04, 0.36));
          p.lift = air * 0.62 * Math.min(1.25, 0.7 + intensity * 0.4);
          p.stretch = u < 0.04 ? 0.82 : 1 + air * 0.16;
          p.roll = u < 0.4 ? Math.sin(u * 90) * 0.1 * (1 - u / 0.4) : 0;
          p.pawL = p.pawR = air * 0.7;
          p.headPitch = -0.35 * air - 0.1;
          p.blink = 0;
          // Bark, bark, bark — one for each beep.
          p.mouth = u > 0.45 && u < 0.9 ? 0.25 + 0.7 * Math.max(0, Math.sin((u - 0.45) * Math.PI * 6.6)) : 0.35;
          p.lean = u > 0.45 && u < 0.9 ? -0.08 * Math.max(0, Math.sin((u - 0.45) * Math.PI * 6.6)) : 0;
        } else {
          target = this.at; p.headPitch = -0.2; this.excite = 0.9;
        }
      } else {
        this.tasks.shift();
        this.setState('RETURNING_TO_IDLE');
      }
    } else {
      // ── idle at home, or on the way back
      const away = dist(this.at, this.home);
      if (away > 3) { target = this.home; speed = away > (this.layout.table.width * 0.12) || !this.resident ? 1 : 0.45; sitGoal = 0; this.setState(speed > 0.6 ? 'RUNNING' : 'WALKING'); }
      else if (!this.resident) {
        // A visitor has reached the rail: it bows out.
        this.presenceGoal = 0;
        this.setState('AWAY');
      } else {
        const drowsy = this.decider !== undefined && !this.alarmed && !this.urgent && now - this.decidingSince > SLEEP_AFTER;
        this.sleep = approach(this.sleep, drowsy ? 1 : 0, drowsy ? 1.1 : 5, dt);
        this.setState(this.sleep > 0.5 ? 'SLEEPING' : 'IDLE');
        if (this.sleep < 0.05) this.idle(now, p);
        else this.idleAction = undefined;
        // At rest the puppy turns to face the player (its own seat), or the room.
        const player = this.layout.hero ? centre(this.layout.hero.plate) : { x: this.at.x, y: this.at.y + 100 };
        face = { x: mix(player.x, this.at.x, 0.35), y: Math.max(player.y, this.at.y + 40) };
      }
    }

    // ── sleep: lying down, eyes shut, slow deep breaths and the odd "z"
    if (this.state !== 'SLEEPING' && this.state !== 'IDLE') this.sleep = approach(this.sleep, 0, 9, dt);
    if (this.sleep > 0.01) {
      const z = this.sleep;
      p.lie = Math.max(p.lie, z);
      p.blink = Math.max(p.blink, smooth(range(z, 0.35, 0.85)));
      p.bob += Math.sin(now / 950) * 0.018 * z;
      p.stretch *= 1 + Math.sin(now / 950) * 0.025 * z;
      sitGoal *= 1 - z;
      this.excite = Math.min(this.excite, 0.6 - z * 0.5);
      if (z > 0.75 && now > this.zzzNext) { this.zzzNext = now + 1150; this.zzz(); }
    }

    // ── locomotion
    const before = { ...this.at };
    // Up on its feet before it goes anywhere: no sliding along the felt while still
    // sitting or lying down, which is what made a first step from rest look wrong.
    const ready = Math.max(0.08, clamp(1 - Math.max(p.sit, p.lie) * 1.6));
    if (headingGoal !== undefined) this.heading += wrap(headingGoal - this.heading) * (1 - Math.exp(-12 * dt));
    if (follow) {
      const solved = part === 'body' ? target : this.solve(part, target, this.heading, cue ? contactPose(cue.action) : {});
      // A body never moves faster than the puppy can run. Plan motion is well below this,
      // so contacts stay exact; a discontinuity (switching from nose to paw, a new street
      // interrupting the last) becomes a quick glide instead of a jump.
      const step = dist(this.at, solved), cap = this.layout.table.width * 1.8 * dt * ready;
      this.lag = Math.max(0, step - cap);
      this.at = step <= cap ? solved : { x: mix(this.at.x, solved.x, cap / step), y: mix(this.at.y, solved.y, cap / step) };
    } else {
      // Ease into a run and slow on arrival, rather than starting and stopping dead.
      const d = dist(this.at, target), top = this.layout.table.width * (speed >= 1 ? 1.25 : 0.45);
      const arriving = Math.min(1, d / Math.max(1, this.layout.cardH * 1.2));
      this.freeSpeed = approach(this.freeSpeed, d > 0.5 ? top * Math.max(0.25, arriving) : 0, 7, dt);
      const max = this.freeSpeed * dt * ready;
      if (d > 0.5) { const k = Math.min(1, max / d); this.at = { x: mix(this.at.x, target.x, k), y: mix(this.at.y, target.y, k) }; }
    }
    if (follow) this.keepPace(now, cue); else this.lag = 0;
    const moved = dist(before, this.at), velocity = moved / Math.max(dt, 1e-3);
    // Face the way it travels; at rest, face the thing it is attending to.
    if (headingGoal === undefined) {
      // Free movement (errands, going home): face the way it travels, or what it attends to.
      const desired = moved > 0.6 ? Math.atan2(this.at.y - before.y, this.at.x - before.x) : face ? Math.atan2(face.y - this.at.y, face.x - this.at.x) : this.heading;
      this.heading += wrap(desired - this.heading) * (1 - Math.exp(-(this.state === 'IDLE' ? 3 : 9) * dt));
    }
    // Gait follows real distance covered, so the legs never slide.
    const strideUnits = 0.42 * this.scaleWorld * this.pxPerUnit;
    p.gait += (moved / Math.max(1, strideUnits)) * Math.PI;
    p.stride = approach(p.stride, clamp(velocity / Math.max(1, this.layout.table.width * 0.35)), 12, dt);
    p.bob = Math.abs(Math.sin(p.gait)) * 0.035 * p.stride;
    p.lean += p.stride * 0.07;
    p.sit = approach(p.sit, sitGoal * (p.stride > 0.2 ? 0 : 1), 7, dt);

    // ── attention: head follows whatever matters
    if (this.look && now > this.lookUntil) this.look = undefined;
    const gaze = this.sleep > 0.4 ? undefined : look ?? this.look ?? this.idleAction?.target;
    this.aim(gaze, p, dt);

    // ── personality: tail, ears, blinking
    this.excite = approach(this.excite, 0.25, 0.6, dt);
    const wagSpeed = mix(5, 19, this.excite) * (this.reduced ? 0.35 : 1);
    this.wag += dt * wagSpeed;
    p.tailWag = Math.sin(this.wag) * mix(0.25, 0.85, this.excite) * Math.min(1.3, intensity) * (this.reduced ? 0.4 : 1) * (1 - this.sleep * 0.9);
    p.tailLift = this.excite;
    if (this.excite > 0.6 && !p.mouth && this.sleep < 0.2) { p.mouth = 0.45; p.tongue = 0.6; }
    this.blink(now, p);
    const vy = (p.bob + p.lift - this.lastY) / Math.max(dt, 1e-3);
    this.lastY = p.bob + p.lift;
    [0, 1].forEach((i) => {
      // A damped spring: ears lag and bounce with the body.
      const force = -this.ears[i]! * 160 - this.earVelocity[i]! * 9 + vy * 4 + (i ? 1 : -1) * Math.sin(this.wag * 0.5) * 2 * this.excite;
      this.earVelocity[i] = this.earVelocity[i]! + force * dt;
      this.ears[i] = clamp(this.ears[i]! + this.earVelocity[i]! * dt, -0.6, 0.8);
    });
    p.earL = this.ears[0]! - this.excite * 0.12 - this.sleep * 0.25; p.earR = this.ears[1]! - this.excite * 0.12 - this.sleep * 0.25;

    // ── presence: a visitor pops in for its card animation and bows out after
    if (this.presenceGoal === 0 && this.presence > 0.98 && this.state === 'AWAY') this.poof(this.at);
    this.presence = approach(this.presence, this.presenceGoal, this.presenceGoal > this.presence ? 10 : 8, dt);
    if (this.presenceGoal === 0 && this.presence < 0.02) { this.presence = 0; this.placed = false; }

    this.place(p);
  }

  /**
   * The animation's progress, read through a steady clock. The card timeline and the
   * puppy run in separate frame callbacks whose order can change, so the raw value
   * can stand still for one frame and jump the next. Between updates the clock moves
   * on at the observed rate, never ahead of where the next update could be.
   */
  private clock = { raw: -1, at: 0, rate: 0, value: 0 };
  private smoothProgress(now: number): number {
    const raw = clamp(this.card!.handle.progress), c = this.clock;
    if (raw !== c.raw) {
      if (c.raw >= 0 && raw > c.raw && now > c.at) {
        const rate = (raw - c.raw) / (now - c.at);
        c.rate = c.rate ? c.rate * 0.7 + rate * 0.3 : rate;
      }
      if (raw < c.raw) { c.rate = 0; c.value = raw; }
      c.raw = raw; c.at = now;
    }
    // Extrapolate at most two frames past the last real value; hold if paused or stalled.
    const ahead = now - c.at > 120 ? 0 : Math.min(now - c.at, 34) * c.rate;
    const ceiling = raw + ahead;
    // Never step backwards within a run (unless the animation itself went back).
    c.value = raw >= 1 ? 1 : clamp(Math.min(ceiling, Math.max(c.value, raw, ceiling)));
    return c.value;
  }

  /** Body language for each beat of a card choreography. */
  private actionPose(cue: PuppyCue, intensity: number): void {
    const p = this.pose, t = cue.actionT;
    p.mouth = cue.mouth;
    switch (cue.action) {
      case 'paw-strike': {
        // Wind up (raise), strike (reach), recover. Contact is at t = 0.5.
        const raise = t < 0.5 ? smooth(t / 0.5) : 1 - smooth((t - 0.5) / 0.5);
        p.pawR = raise * 0.95; p.reachR = t < 0.42 ? 0 : Math.sin(Math.PI * clamp((t - 0.42) / 0.5)); p.headPitch = 0.25; p.lean = 0.06 + raise * 0.04;
        p.stretch = 1 + (t > 0.45 && t < 0.6 ? -0.05 : 0);
        break;
      }
      case 'nose-push': p.headPitch = 0.62; p.lean = 0.18; p.bow = 0.25; break;
      case 'mouth-grab': p.headPitch = mix(0.2, 0.7, Math.sin(Math.PI * t)); p.lean = 0.15 * Math.sin(Math.PI * t); break;
      case 'mouth-carry': p.headPitch = -0.05; p.lean = 0.04; break;
      case 'drop': p.headPitch = 0.25; p.mouth = Math.max(p.mouth, 0.9); break;
      case 'paw-slide': p.pawR = 0.35; p.reachR = 0.85; p.headPitch = 0.35; p.lean = 0.1; break;
      case 'paw-flick': { const s = Math.sin(Math.PI * t); p.pawR = 0.4 + s * 0.6; p.reachR = 1 - s * 0.6; p.headPitch = 0.2 - s * 0.3; break; }
      case 'proud': p.headPitch = -0.12; p.headTilt = Math.sin(t * Math.PI * 2) * 0.12; p.tongue = 0.8; break;
      case 'hop': p.lift = Math.abs(Math.sin(Math.PI * t * 2)) * 0.32 * intensity; p.stretch = 1 + Math.abs(Math.sin(Math.PI * t * 2)) * 0.1; p.tongue = 1; break;
      case 'spin': p.spin = smooth(clamp(t * 1.5)) * Math.PI * 2; p.lift = Math.sin(Math.PI * clamp(t * 1.5)) * 0.4 * intensity; p.tongue = 1; break;
      default: break;
    }
  }

  /** Little things a puppy does while it waits. */
  private idle(now: number, p: PuppyPose): void {
    if (this.reduced) return;
    if (!this.idleAction && now > this.idleNext && this.layout) {
      const roll = Math.random(), t = this.layout.table;
      const sights = [centre(t), ...(this.layout.seats.map((seat) => centre(seat.plate))), ...(this.layout.pot ? [centre(this.layout.pot)] : [])];
      if (roll < 0.12 * this.intensity) this.idleAction = { kind: 'scratch', until: now + 2200 };
      else if (roll < 0.35) this.idleAction = { kind: 'tilt', until: now + 1600 };
      else if (roll < 0.43 * Math.min(1.2, this.intensity)) this.idleAction = { kind: 'stretch', until: now + 1700 };
      else this.idleAction = { kind: 'look', until: now + 1500 + Math.random() * 1800, target: sights[Math.floor(Math.random() * sights.length)] };
    }
    const action = this.idleAction;
    if (action) {
      const left = action.until - now;
      if (left <= 0) { this.idleAction = undefined; this.idleNext = now + 1200 + Math.random() * 3800 / this.intensity; return; }
      const u = 1 - left / ({ scratch: 2200, tilt: 1600, stretch: 1700, look: 2500 }[action.kind]);
      const env = Math.sin(Math.PI * clamp(u));
      if (action.kind === 'scratch') { p.scratch = smooth(clamp(env * 1.6)); p.scratchPhase = now / 45; p.headTilt = -0.45 * env; p.blink = env > 0.5 ? 0.85 : 0; p.headPitch = 0.05; }
      else if (action.kind === 'tilt') { p.headTilt = 0.38 * env * (Math.sin(action.until) > 0 ? 1 : -1); p.earL += 0.15 * env; }
      else if (action.kind === 'stretch') { p.bow = env; p.mouth = 0.65 * env; p.tongue = 0.6 * env; p.tailLift = 1; }
    }
    // Breathing.
    p.bob += Math.sin(now / 520) * 0.008;
  }

  private blink(now: number, p: PuppyPose): void {
    if (!this.blinkAt) this.blinkAt = now + 1500;
    if (now > this.blinkAt) {
      this.blinkPhase = (now - this.blinkAt) / 140;
      if (this.blinkPhase >= 1) { this.blinkAt = now + 1800 + Math.random() * 3600; this.blinkPhase = 0; }
    }
    p.blink = Math.max(p.blink, this.blinkPhase > 0 ? Math.sin(Math.PI * this.blinkPhase) : 0);
  }

  /** Turn the head toward a screen point, within what a neck can do. */
  private aim(target: Pt | undefined, p: PuppyPose, dt: number): void {
    let yaw = 0, pitch = p.headPitch;
    if (target) {
      const rootW = this.mapper.toFloor(this.at.x, this.at.y), targetW = this.mapper.toFloor(target.x, target.y);
      const dx = targetW.x - rootW.x, dz = targetW.z - rootW.z, y = this.rig.root.rotation.y;
      const lx = dx * Math.cos(-y) + dz * Math.sin(-y), lz = -dx * Math.sin(-y) + dz * Math.cos(-y);
      yaw = clamp(Math.atan2(lx, lz), -1.15, 1.15);
      const far = Math.hypot(dx, dz) / Math.max(1e-3, this.scaleWorld);
      pitch = p.headPitch + clamp(0.35 - far * 0.08, -0.2, 0.35) * 0.5;
    }
    this.headYaw = approach(this.headYaw, yaw, 8, dt);
    p.headYaw = this.headYaw;
    p.headPitch = pitch;
  }
  private headYaw = 0;
  private freeSpeed = 0;

  /** Where the puppy must stand so that `part` touches `point` while facing `heading`. */
  private solve(part: 'body' | 'paw' | 'nose' | 'mouth', point: Pt, heading: number, reference: Partial<PuppyPose> = {}): Pt {
    if (part === 'body') return point;
    let root = { ...point };
    const socket = part === 'paw' ? this.rig.sockets.pawR : part === 'nose' ? this.rig.sockets.nose : this.rig.sockets.mouth;
    // Solve against the pose without its walking stride: the stride swings the paws and
    // bobs the head every step, which would otherwise shake the whole puppy.
    // The head's glances and the action's own wind-up are excluded too: the body is
    // placed for the moment of contact and holds still while the head and paws move.
    applyPose(this.rig, { ...this.pose, stride: 0, bob: 0, lift: 0, headYaw: 0, ...reference });
    const world = new Vector3();
    for (let iteration = 0; iteration < 3; iteration++) {
      this.transform(root, heading);
      this.rig.root.updateMatrixWorld(true);
      socket.getWorldPosition(world);
      // The contact is measured where the part meets the felt beneath it, not in the air above it.
      const contact = this.mapper.toScreen(world.setY(Math.min(world.y, 0.06 * this.scaleWorld)));
      root = { x: root.x + (point.x - contact.x), y: root.y + (point.y - contact.y) };
    }
    return root;
  }

  private transform(at: Pt, heading: number): void {
    const root = this.rig.root, w = this.mapper.toFloor(at.x, at.y);
    root.position.copy(w);
    const ahead = this.mapper.toFloor(at.x + Math.cos(heading) * 30, at.y + Math.sin(heading) * 30);
    root.rotation.y = Math.atan2(ahead.x - w.x, ahead.z - w.z) + this.pose.spin;
  }

  private place(p: PuppyPose): void {
    applyPose(this.rig, p);
    this.transform(this.at, this.heading);
    this.rig.root.scale.setScalar(this.scaleWorld * Math.max(0, this.presence >= 1 ? 1 : easeOutBack(this.presence)));
    this.rig.root.visible = Boolean(this.layout) && this.presence > 0.01;
  }
}

export function createCompanion(surface: HTMLElement, document: Document): Companion | undefined {
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') ?? probe.getContext('webgl'))) return undefined;
    return new PuppyCompanion(surface, document);
  } catch {
    return undefined;
  }
}
