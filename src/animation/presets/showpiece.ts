import type { Point3, VisualCard } from '../../types';
import type { AnimationContext, AnimationPreset, TimelineTrack, VisualObject } from '../core/types';
import { metal, rgba } from '../../rendering/color';
import { object } from '../primitives/objects';
import { clamp, cubic, mix, noise, point, range, rectCenter, smooth, smoother } from '../primitives/motion';
import { dealOrder, parameter, settleObject, track } from './shared';

/**
 * Showpieces: the house choreography at full volume. Every card still ends
 * exactly on its measured resting pose; everything else here is light, shadow
 * and debris drawn in the animation's own overlay layer.
 */

const easeOutCubic = (t: number): number => 1 - (1 - clamp(t)) ** 3;
/** Effects must be fully faded by the end, or removing the layer would cut them off mid-frame. */
const within = (start: number, length: number): number => Math.max(0.01, Math.min(length, 0.995 - start));
const easeOutQuint = (t: number): number => 1 - (1 - clamp(t)) ** 5;
const easeInCubic = (t: number): number => clamp(t) ** 3;
const easeInQuad = (t: number): number => clamp(t) ** 2;
/** Damped landing oscillation: 0 at impact, settles to 0. */
const settle = (t: number, cycles = 2.2, decay = 5.5): number => Math.sin(clamp(t) * Math.PI * cycles) * Math.exp(-decay * clamp(t)) * (1 - clamp(t));

const showpieceParameters = (duration: number) => [
  // Wide limits so tuned values from other presets are always valid here.
  parameter('duration', 'Duration', 600, 4800, 50, duration, 'ms'),
  parameter('speed', 'Preset speed', 0.4, 2, 0.1, 1, '×'),
  parameter('intensity', 'Intensity', 0.3, 1.7, 0.05, 1, '×'),
];

interface Palette { spec: string; high: string; mid: string; low: string; glow: string }
const palette = (context: AnimationContext): Palette => {
  const m = metal(context.theme.table.trimColor);
  return { spec: m.spec, high: m.high, mid: m.mid, low: m.low, glow: context.theme.board.highlight };
};

function element(context: AnimationContext, css: Partial<CSSStyleDeclaration>, z: number): HTMLDivElement {
  const node = document.createElement('div');
  Object.assign(node.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', opacity: '0', willChange: 'transform, opacity' }, css);
  node.style.zIndex = String(z);
  context.layer.append(node);
  return node;
}

/**
 * A soft shadow cast on the felt by a card in the air. It sits behind every card in
 * depth (cards share one 3D context, where z-index does not apply) and fades out as the
 * card touches down, because the resting card carries its own shadow.
 */
function contactShadow(context: AnimationContext, card: VisualCard): (x: number, y: number, height: number, visible: number) => void {
  const w = card.target.width, h = card.target.height;
  const node = element(context, { width: `${w}px`, height: `${h}px`, borderRadius: '12%', background: 'rgba(0,0,0,.55)', filter: `blur(${Math.max(3, w * 0.08).toFixed(1)}px)` }, 400);
  context.layer.prepend(node);
  const shadow = object(node);
  return (x, y, height, visible) => {
    const lift = clamp(height / (h * 2.4)), airborne = smooth(clamp(height / (h * 0.25)));
    shadow.set({ x: x - w / 2 + lift * w * 0.35, y: y - h / 2 + lift * h * 0.55, z: -4, scale: 1 + lift * 0.35, rz: (card.rotation ?? 0),
      opacity: visible * airborne * mix(0.55, 0.12, lift) });
  };
}

/** An expanding ring on the felt where a card hits it. */
function shockwave(context: AnimationContext, at: Point3, size: number, color: string, start: number, length: number, strength = 1): TimelineTrack {
  const node = element(context, { width: `${size}px`, height: `${size * 0.42}px`, borderRadius: '50%', border: `${Math.max(1.5, size * 0.018).toFixed(1)}px solid ${color}`,
    boxShadow: `0 0 ${(size * 0.12).toFixed(1)}px ${color}, inset 0 0 ${(size * 0.08).toFixed(1)}px ${color}` }, 450);
  const ring = object(node);
  length = within(start, length);
  return track((t) => {
    const u = range(t, start, start + length);
    ring.set({ x: at.x - size / 2, y: at.y - size * 0.21, scale: mix(0.25, 1.6, easeOutCubic(u)), opacity: t < start || u >= 1 ? 0 : (1 - u) ** 1.6 * 0.9 * strength });
  });
}

/** A bloom of light; `size` is its diameter. */
function flare(context: AnimationContext, at: Point3, size: number, color: string, start: number, length: number, strength = 1): TimelineTrack {
  const node = element(context, { width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    background: `radial-gradient(circle, rgba(255,255,255,.95) 0%, ${rgba(color, 0.75)} 18%, ${rgba(color, 0.22)} 42%, transparent 68%)`, mixBlendMode: 'screen' }, 3200);
  const bloom = object(node);
  length = within(start, length);
  return track((t) => {
    const u = range(t, start, start + length);
    bloom.set({ x: at.x - size / 2, y: at.y - size / 2, scale: mix(0.35, 1.25, easeOutQuint(u)), opacity: t < start || u >= 1 ? 0 : Math.min(1, u * 9) * (1 - u) ** 1.3 * strength });
  });
}

/** Gold sparks thrown from an impact; they arc up, fall and cool. */
function sparks(context: AnimationContext, at: Point3, count: number, reach: number, colors: Palette, start: number, length: number, seed: number): TimelineTrack[] {
  return Array.from({ length: count }, (_, index) => {
    const size = reach * (0.025 + noise(index, seed + 1) * 0.035);
    const hot = noise(index, seed + 2) > 0.55;
    const node = element(context, { width: `${size.toFixed(1)}px`, height: `${(size * (2.2 + noise(index, seed + 3) * 2)).toFixed(1)}px`, borderRadius: '50%',
      background: `linear-gradient(180deg, #fff, ${hot ? colors.spec : colors.high} 40%, ${colors.mid})`, boxShadow: `0 0 ${(size * 2.4).toFixed(1)}px ${rgba(colors.glow, 0.9)}` }, 3100);
    const spark = object(node);
    const angle = -Math.PI / 2 + (noise(index, seed + 4) - 0.5) * Math.PI * 1.35;
    const speed = reach * (0.7 + noise(index, seed + 5) * 0.9);
    const life = within(start, length * (0.55 + noise(index, seed + 6) * 0.45));
    return track((t) => {
      const u = range(t, start, start + life);
      const x = at.x + Math.cos(angle) * speed * u * (1 - u * 0.25);
      const y = at.y + Math.sin(angle) * speed * 0.62 * u + reach * 0.95 * u * u;
      // Orient each streak along its direction of travel.
      const vx = Math.cos(angle) * (1 - u * 0.5), vy = Math.sin(angle) * 0.62 + 1.9 * u;
      spark.set({ x: x - size / 2, y: y - size, rz: Math.atan2(vy, vx) * 180 / Math.PI - 90, scale: mix(1.1, 0.35, u),
        opacity: t < start || u >= 1 ? 0 : Math.min(1, u * 14) * (1 - u) ** 0.8 });
    });
  });
}

/** Darkens the room while leaving a pool of light on the slot. Never fully opaque. */
function spotlight(context: AnimationContext, at: Point3, radius: number, depth: number, fadeIn: [number, number], fadeOut: [number, number]): TimelineTrack {
  const node = element(context, { width: '100vw', height: '100vh', position: 'fixed',
    background: `radial-gradient(circle at ${at.x.toFixed(0)}px ${at.y.toFixed(0)}px, transparent 0, transparent ${(radius * 0.55).toFixed(0)}px, rgba(4,4,6,${depth.toFixed(2)}) ${(radius * 2.4).toFixed(0)}px)` }, 1);
  return track((t) => {
    node.style.opacity = String(smooth(range(t, fadeIn[0], fadeIn[1])) * (1 - smooth(range(t, fadeOut[0], fadeOut[1]))));
  });
}

/** A light pool behind a hovering card. */
function halo(context: AnimationContext, size: number, colors: Palette): VisualObject {
  return object(element(context, { width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    background: `radial-gradient(circle, ${rgba(colors.glow, 0.55)} 0%, ${rgba(colors.glow, 0.18)} 38%, transparent 68%)`, mixBlendMode: 'screen' }, 900));
}

/** A band of light crossing a card that has just landed. */
function glint(context: AnimationContext, card: VisualCard, start: number, length: number): TimelineTrack {
  const w = card.target.width, h = card.target.height;
  const frame = element(context, { width: `${w}px`, height: `${h}px`, borderRadius: '8%', overflow: 'hidden', opacity: '1' }, 2900);
  frame.style.transform = `translate3d(${card.target.x.toFixed(2)}px,${card.target.y.toFixed(2)}px,0) rotate(${(card.rotation ?? 0).toFixed(2)}deg)`;
  const band = document.createElement('div');
  Object.assign(band.style, { position: 'absolute', top: '-30%', left: '0', width: '55%', height: '160%', opacity: '0',
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.65) 50%, transparent)', mixBlendMode: 'screen' });
  frame.append(band);
  length = within(start, length);
  return track((t) => {
    const u = range(t, start, start + length);
    band.style.opacity = t < start || u >= 1 ? '0' : String(Math.sin(Math.PI * u));
    band.style.transform = `translateX(${mix(-w * 0.7, w * 1.3, smoother(u)).toFixed(1)}px) skewX(-18deg)`;
  });
}

// ─────────────────────────────────────────────────────────────── the deal

export const dealersStorm: AnimationPreset = {
  id: 'deal.storm', name: "Dealer's Storm", category: 'deal', supportedEvents: ['deal'], duration: 1750, reducedMotion: 'immediate',
  description: 'Cards burst from the button on high spinning arcs, cast real shadows, and slap down with a puff of light.',
  parameters: showpieceParameters(1750),
  build(context) {
    const cards = context.event.cards, order = dealOrder(context), count = cards.length, colors = palette(context), power = context.intensity;
    const origin = point(context.event.origin.x, context.event.origin.y);
    const spread = Math.min(0.42, 0.018 * Math.max(1, count - 1) + 0.1);
    return cards.flatMap((card) => {
      const visual = context.card(card), shadow = contactShadow(context, card);
      const target = rectCenter(card.target), w = card.target.width, h = card.target.height;
      const rank = order.get(card.id) ?? 0, start = count > 1 ? rank / (count - 1) * spread : 0, span = 0.9 - spread;
      const dx = target.x - origin.x, dy = target.y - origin.y, length = Math.hypot(dx, dy) || 1;
      const side = noise(rank, 3) > 0.5 ? 1 : -1;
      const bend = length * 0.18 * side * power;
      const c1 = point(origin.x + dx * 0.3 - dy / length * bend, origin.y + dy * 0.3 + dx / length * bend - h * 1.4 * power);
      const c2 = point(origin.x + dx * 0.78 - dy / length * bend * 0.4, origin.y + dy * 0.78 + dx / length * bend * 0.4 - h * 0.6 * power);
      const spin = side * (360 + 180 * Math.round(noise(rank, 5) * 2)) * Math.min(1.2, power);
      const impact = 0.86;
      const tracks: TimelineTrack[] = [track((t) => {
        const u = range(t, start, start + span);
        if (t < start) { visual.set({ x: origin.x - w / 2, y: origin.y - h / 2, opacity: 0 }); shadow(origin.x, origin.y, 0, 0); return; }
        const flight = range(u, 0, impact), travel = easeOutCubic(flight);
        const p = cubic(origin, c1, c2, target, travel);
        const air = Math.sin(Math.PI * flight) * (1 - flight * 0.35);
        const z = air * h * 2.4 * power;
        const landing = range(u, impact, 1);
        const squash = settle(landing) * 0.12 * power;
        settleObject(visual, card, t >= 1 ? 1 : u, {
          x: p.x, y: p.y - settle(landing, 1.6, 6) * h * 0.04, z,
          rx: air * 32 * power, rz: spin * (1 - easeOutQuint(flight)),
          ry: card.identity ? mix(180, 0, smoother(range(flight, 0.35, 0.92))) : 0,
          scale: mix(0.55, 1, smooth(range(flight, 0, 0.35))) * (1 + air * 0.18),
          scaleX: 1 + squash, scaleY: 1 - squash, opacity: Math.min(1, flight * 12),
        });
        shadow(p.x, p.y, z, u >= 1 ? 0 : Math.min(1, flight * 6));
      })];
      const at = point(target.x, target.y + h * 0.42);
      tracks.push(shockwave(context, at, w * 1.9, rgba(colors.spec, 0.8), start + span * impact, 0.16, 0.65 * power));
      return tracks;
    });
  },
};

// ─────────────────────────────────────────────────────────────── the flop

export const grandFlop: AnimationPreset = {
  id: 'flop.grand', name: 'Grand Flop', category: 'flop', supportedEvents: ['flop'], duration: 2500, reducedMotion: 'immediate',
  description: 'The flop rises as one stack, fans open in mid-air, then each card turns and slams down in a burst of gold.',
  parameters: showpieceParameters(2500),
  build(context) {
    const cards = context.event.cards.slice(0, 3), colors = palette(context), power = context.intensity;
    const w = cards[0]?.target.width ?? 70, h = cards[0]?.target.height ?? 90;
    const board = context.center, origin = point(context.event.origin.x, context.event.origin.y);
    const hover = point(board.x, board.y - h * 0.8 * power);
    const lift = h * 1.8 * power;
    const glow = halo(context, w * 5.2, colors);
    const tracks: TimelineTrack[] = [track((t) => {
      const visible = smooth(range(t, 0.06, 0.24)) * (1 - smooth(range(t, 0.5, 0.7)));
      const pulse = 1 + Math.sin(t * Math.PI * 7) * 0.05;
      glow.set({ x: hover.x - w * 2.6, y: hover.y - w * 2.6, scale: (0.6 + visible * 0.5) * pulse, opacity: visible * 0.9 * power });
    })];
    cards.forEach((card, index) => {
      const visual = context.card(card), shadow = contactShadow(context, card), target = rectCenter(card.target);
      const offset = index - (cards.length - 1) / 2;
      const fan = point(hover.x + offset * w * 1.18, hover.y + Math.abs(offset) * h * 0.12);
      const rise = [0, 0.26] as const, open = [0.26, 0.44] as const;
      const leave = 0.43 + index * 0.085, land = leave + 0.22;
      tracks.push(track((t) => {
        let x: number, y: number, z: number, rx = 0, ry = 180, rz = 0, scale = 1;
        if (t < open[0]) {
          const u = easeOutCubic(range(t, rise[0], rise[1]));
          x = mix(origin.x, hover.x, u) + offset * 2; y = mix(origin.y, hover.y, u) - Math.sin(Math.PI * u) * h * 0.5 - index * 2;
          z = mix(0, lift, u) + index * 3; rz = (1 - u) * -25 + offset * 2; rx = Math.sin(Math.PI * u) * 22; scale = mix(0.6, 1.08, u);
        } else if (t < leave) {
          const u = easeOutQuint(range(t, open[0], open[1])), bob = Math.sin((t - open[0]) * Math.PI * 6 + index) * h * 0.03;
          x = mix(hover.x, fan.x, u); y = mix(hover.y, fan.y, u) + bob; z = lift + index * 3 * (1 - u);
          rz = offset * 14 * u; rx = 8 * u; scale = 1.08;
        } else {
          const u = range(t, leave, land), fly = smoother(range(u, 0, 0.82)), drop = easeInCubic(range(u, 0.5, 1));
          x = mix(fan.x, target.x, fly); y = mix(fan.y, target.y, fly) - Math.sin(Math.PI * fly) * h * 0.25;
          z = mix(lift, 0, Math.max(drop, fly * 0.45)); rz = offset * 14 * (1 - fly);
          // Turns over on the way down, overshooting a touch before it lands flat.
          ry = 180 - 196 * easeOutCubic(range(u, 0.1, 0.72)) + 16 * smooth(range(u, 0.72, 1));
          rx = 8 * (1 - fly); scale = mix(1.08, 1, fly);
        }
        const after = range(t, land, Math.min(1, land + 0.13)), squash = settle(after) * 0.14 * power;
        if (t >= land) { x = target.x; y = target.y - settle(after, 1.5, 6) * h * 0.05; z = 0; ry = 0; rx = 0; rz = 0; scale = 1; }
        settleObject(visual, card, t, { x, y, z, rx, ry: card.identity ? ry : 0, rz, scale, scaleX: 1 + squash, scaleY: 1 - squash, opacity: Math.min(1, t * 20) });
        shadow(x, y, z, t >= 1 ? 0 : Math.min(1, t * 8));
      }));
      const at = point(target.x, target.y + h * 0.2);
      tracks.push(shockwave(context, at, w * 2.6, rgba(colors.spec, 0.85), land, 0.17, power));
      tracks.push(flare(context, target, w * 2.2, colors.glow, land, 0.16, 0.7 * power));
      tracks.push(...sparks(context, point(target.x, target.y + h * 0.3), Math.round(10 * power), w * 1.4, colors, land, 0.17, 11 + index * 17));
      tracks.push(glint(context, card, land + 0.04, 0.12));
    });
    return tracks;
  },
};

// ─────────────────────────────────────────────────────────────── the turn

function spiralReveal(context: AnimationContext, card: VisualCard, timing: { enter: number; hover: number; flip: number; slam: number }, big: boolean): TimelineTrack[] {
  const colors = palette(context), power = context.intensity;
  const visual = context.card(card), shadow = contactShadow(context, card), target = rectCenter(card.target);
  const w = card.target.width, h = card.target.height;
  const height = h * (big ? 2.6 : 2.2) * power, radius = w * (big ? 1.5 : 1.15) * power;
  const tracks: TimelineTrack[] = [];
  const glow = halo(context, w * (big ? 5 : 4), colors);
  tracks.push(track((t) => {
    const v = smooth(range(t, 0.05, timing.hover)) * (1 - smooth(range(t, timing.slam - 0.05, timing.slam)));
    const tremble = big ? 1 + Math.sin(t * 90) * 0.04 * range(t, timing.hover, timing.flip) : 1;
    glow.set({ x: target.x - w * (big ? 2.5 : 2), y: target.y - height * 0.45 - w * (big ? 2.5 : 2), scale: (0.7 + v * 0.45) * tremble, opacity: v * 0.85 * power });
  }));
  tracks.push(track((t) => {
    let x: number, y: number, z: number, rx = 0, ry = 180, rz = 0;
    if (t < timing.hover) {
      // A descending spiral: one and a quarter turns around the slot, narrowing.
      const u = range(t, 0, timing.hover), v = easeOutCubic(u), angle = -Math.PI * 0.5 + v * Math.PI * 2.5;
      const r = radius * (1 - v * 0.82);
      x = target.x + Math.cos(angle) * r; y = target.y - height * mix(1.15, 0.45, v) + Math.sin(angle) * r * 0.35;
      z = mix(height * 1.35, height * 0.75, v); rz = (1 - v) * -200; rx = Math.sin(angle) * 18 * (1 - v);
    } else if (t < timing.flip) {
      // The tease: the card hangs face down, trembling, and lifts one edge.
      const u = range(t, timing.hover, timing.flip), shake = big ? Math.sin(t * 120) * w * 0.012 * u : 0;
      x = target.x + shake; y = target.y - height * 0.45 + Math.sin(u * Math.PI * 2) * h * 0.03; z = height * 0.75;
      ry = 180 - (big ? 58 : 30) * Math.sin(Math.PI * smooth(range(u, 0.35, 1))) ; rz = Math.sin(u * Math.PI * 3) * (big ? 4 : 2);
    } else {
      const u = range(t, timing.flip, timing.slam);
      x = target.x; y = mix(target.y - height * 0.45, target.y, easeInQuad(u)); z = mix(height * 0.75, 0, easeInCubic(u));
      // The reveal: a hard spin over — two turns on the river — easing onto the felt.
      const turns = big ? 720 : 360;
      ry = mix(180 + turns, 0, easeOutQuint(range(u, 0, 0.85))); rx = (1 - u) * 10;
    }
    const after = range(t, timing.slam, Math.min(1, timing.slam + (big ? 0.12 : 0.15))), squash = settle(after) * (big ? 0.2 : 0.15) * power;
    if (t >= timing.slam) { x = target.x; y = target.y - settle(after, 1.4, 6) * h * 0.06; z = 0; ry = 0; rx = 0; rz = 0; }
    settleObject(visual, card, t, { x, y, z, rx, ry: card.identity ? ry : 0, rz, scale: 1 + (t < timing.slam ? 0.06 : 0),
      scaleX: 1 + squash, scaleY: 1 - squash, opacity: Math.min(1, t * 14) });
    shadow(x, y, z, t >= 1 ? 0 : Math.min(1, t * 8));
  }));
  const at = point(target.x, target.y + h * 0.25);
  tracks.push(shockwave(context, at, w * (big ? 3.4 : 2.8), rgba(colors.spec, 0.9), timing.slam, 0.22, power));
  if (big) tracks.push(shockwave(context, at, w * 5, rgba(colors.glow, 0.55), timing.slam + 0.03, 0.22, power));
  tracks.push(flare(context, target, w * (big ? 4.4 : 3), colors.glow, timing.slam, big ? 0.22 : 0.18, power));
  tracks.push(...sparks(context, point(target.x, target.y + h * 0.3), Math.round((big ? 34 : 20) * power), w * (big ? 2.3 : 1.8), colors, timing.slam, big ? 0.24 : 0.26, big ? 71 : 37));
  tracks.push(glint(context, card, Math.min(0.97, timing.slam + 0.07), big ? 0.14 : 0.16));
  return tracks;
}

export const spotlightTurn: AnimationPreset = {
  id: 'reveal.spotlight', name: 'Spotlight', category: 'reveal', supportedEvents: ['turn', 'river'], duration: 2000, reducedMotion: 'immediate',
  description: 'The room dims to one pool of light; the card spirals down, whips over at the last instant and hits the felt.',
  parameters: showpieceParameters(2000),
  build(context) {
    return context.event.cards.slice(0, 1).flatMap((card) => {
      const target = rectCenter(card.target);
      return [spotlight(context, target, card.target.height * 2.2, 0.5 * Math.min(1.2, context.intensity), [0, 0.2], [0.78, 1]),
        ...spiralReveal(context, card, { enter: 0, hover: 0.42, flip: 0.55, slam: 0.74 }, false)];
    });
  },
};

export const riverShowdown: AnimationPreset = {
  id: 'reveal.showdown', name: 'Showdown', category: 'reveal', supportedEvents: ['turn', 'river'], duration: 2900, reducedMotion: 'immediate',
  description: 'The last card hangs in the dark and trembles, teases a corner, then spins over twice and slams down in a storm of gold.',
  parameters: showpieceParameters(2900),
  build(context) {
    return context.event.cards.slice(0, 1).flatMap((card) => {
      const target = rectCenter(card.target);
      return [spotlight(context, target, card.target.height * 1.9, 0.62 * Math.min(1.2, context.intensity), [0, 0.16], [0.82, 1]),
        ...spiralReveal(context, card, { enter: 0, hover: 0.34, flip: 0.6, slam: 0.73 }, true)];
    });
  },
};

export const showpiecePresets: AnimationPreset[] = [dealersStorm, grandFlop, spotlightTurn, riverShowdown];

/** The quieter house presets these replace as defaults, by street. */
export const SHOWPIECE_UPGRADES: Record<string, string> = {
  'deal.pitch': 'deal.storm', 'flop.cascade': 'flop.grand', 'reveal.turnover': 'reveal.spotlight', 'reveal.squeeze': 'reveal.showdown',
};
