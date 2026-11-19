import type { VisualCard } from '../../types';
import type { AnimationContext, AnimationPreset, VisualObject } from '../core/types';
import { object } from '../primitives/objects';
import { clamp, easeOut, mix, noise, range, rectCenter, smooth } from '../primitives/motion';
import { commonParameters, dealOrder, parameter, settleObject, track } from './shared';

/**
 * The card effects of the Arcade, Rain District and Breach rooms.
 *
 * Arcade moves like a sprite game: time advances in frames (12 a second) and
 * positions snap to a pixel grid, so cards blink in, hop and flip in a few
 * hard frames. Rain District projects its cards: a beam draws the outline, the
 * card flickers twice and turns solid. Breach sends data packets along right-angle
 * traces and deals cards "encrypted", their faces scrolling code until they decrypt.
 */

const FPS = 12;
/** Time held to whole frames, so motion reads as stepped sprite animation. */
const frames = (t: number, duration: number): number => {
  const count = Math.max(4, Math.round(duration / 1000 * FPS));
  return Math.min(1, Math.floor(clamp(t) * count) / count);
};
const snap = (value: number, grid: number): number => Math.round(value / grid) * grid;
/** A sprite flip: four hard frames from back to face (180, 120, 60, 0 degrees). */
const flipFrames = (u: number): number => (u <= 0 ? 180 : u < 0.34 ? 120 : u < 0.67 ? 60 : 0);

function element(context: AnimationContext, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const node = document.createElement('div');
  Object.assign(node.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', opacity: '0' }, style);
  context.layer.append(node);
  return node;
}

/** Four square sparks thrown out where a card lands. */
function sparks(context: AnimationContext, color: string, size: number): VisualObject[] {
  return [0, 1, 2, 3].map(() => object(element(context, { width: `${size}px`, height: `${size}px`, background: color, boxShadow: `0 0 ${size}px ${color}` })));
}
function burst(list: VisualObject[], at: { x: number; y: number }, u: number, reach: number, size: number): void {
  list.forEach((spark, index) => {
    const angle = index * Math.PI / 2 + Math.PI / 4, k = Math.floor(u * 4) / 4;
    spark.set({ x: at.x + Math.cos(angle) * reach * k - size / 2, y: at.y + Math.sin(angle) * reach * k - size / 2, opacity: u > 0 && u < 1 ? 1 : 0 });
  });
}

// ─────────────────────────────────────────────────────────────── Arcade

export const pixelDeal: AnimationPreset = {
  id: 'deal.pixel', name: 'Pixel Deal', category: 'deal', supportedEvents: ['deal'], duration: 1500, reducedMotion: 'immediate',
  description: 'Cards blink in at the deck, hop across the felt in stepped frames and flip in three.',
  parameters: [...commonParameters(1500), parameter('stagger', 'Round stagger', 0.2, 0.6, 0.025, 0.45), parameter('hop', 'Hop height', 0, 1.5, 0.05, 1)],
  build(context) {
    const p = context.parameters, order = dealOrder(context), count = context.event.cards.length, duration = p.duration ?? 1500;
    return context.event.cards.map((card) => {
      const visual = context.card(card), target = rectCenter(card.target), grid = Math.max(2, card.target.width / 8);
      const origin = { x: context.event.origin.x, y: context.event.origin.y };
      const start = count > 1 ? (order.get(card.id) ?? 0) / (count - 1) * p.stagger! : 0, flight = 1 - p.stagger!;
      return track((group) => {
        const t = frames(range(group, start, start + flight), duration * flight);
        if (group < start) { visual.set({ x: origin.x, y: origin.y, opacity: 0 }); return; }
        // Blink in: on, off, on over the first frames.
        const blink = t < 0.08 ? 1 : t < 0.14 ? 0 : 1;
        const travel = range(t, 0.12, 0.72), hop = Math.sin(Math.PI * travel) * card.target.height * 0.45 * p.hop! * context.intensity;
        const x = snap(mix(origin.x, target.x, travel), grid), y = snap(mix(origin.y, target.y, travel) - hop, grid);
        settleObject(visual, card, t, { x: t >= 0.72 ? target.x : x, y: t >= 0.72 ? target.y : y, z: hop * 0.4,
          ry: card.identity ? flipFrames(range(t, 0.74, 0.98)) : 0, scale: t < 0.12 ? 0.9 : 1, opacity: blink });
      });
    });
  },
};

export const pixelFlop: AnimationPreset = {
  id: 'flop.pixel', name: 'Pixel Flop', category: 'flop', supportedEvents: ['flop'], duration: 1800, reducedMotion: 'immediate',
  description: 'Three cards drop in from above in hard frames, land with a squash and a spark, then flip one after another.',
  parameters: [...commonParameters(1800), parameter('stagger', 'Card stagger', 0, 0.2, 0.01, 0.12)],
  build(context) {
    const p = context.parameters, duration = p.duration ?? 1800, accent = context.theme.table.trimColor;
    return context.event.cards.slice(0, 3).flatMap((card, index) => {
      const visual = context.card(card), target = rectCenter(card.target), grid = Math.max(2, card.target.width / 8);
      const size = Math.max(3, Math.round(grid * 0.8)), list = sparks(context, accent, size);
      const delay = index * p.stagger!;
      return [track((t0) => {
        const t = frames(t0, duration), u = range(t, delay, delay + 0.4);
        const fall = 1 - (1 - u) ** 2, y = snap(mix(target.y - card.target.height * 2.2, target.y, fall), grid);
        const landed = u >= 1, squash = landed && range(t, delay + 0.4, delay + 0.5) < 1 ? 0.82 : 1;
        settleObject(visual, card, t, { x: target.x, y: landed ? target.y + (squash < 1 ? card.target.height * 0.05 : 0) : y,
          ry: card.identity ? flipFrames(range(t, 0.62 + index * 0.1, 0.78 + index * 0.1)) : 0,
          scaleX: squash < 1 ? 1.1 : 1, scaleY: squash, opacity: t >= delay ? 1 : 0 });
        burst(list, { x: target.x, y: target.y + card.target.height / 2 }, range(t, delay + 0.4, delay + 0.56), card.target.width * 0.8, size);
      })];
    });
  },
};

export const pixelDrop: AnimationPreset = {
  id: 'reveal.pixel', name: 'Pixel Drop', category: 'reveal', supportedEvents: ['turn', 'river'], duration: 1400, reducedMotion: 'immediate',
  description: 'The card falls into its slot in stepped frames, bounces twice and flips over in three.',
  parameters: [...commonParameters(1400), parameter('bounce', 'Bounce', 0, 1.5, 0.05, 1)],
  build(context) {
    const p = context.parameters, duration = p.duration ?? 1400, accent = context.theme.table.trimColor;
    return context.event.cards.slice(0, 1).flatMap((card) => {
      const visual = context.card(card), target = rectCenter(card.target), grid = Math.max(2, card.target.width / 8), h = card.target.height;
      const size = Math.max(3, Math.round(grid * 0.8)), list = sparks(context, accent, size);
      return [track((t0) => {
        const t = frames(t0, duration);
        const fall = range(t, 0, 0.4), bounce = range(t, 0.4, 0.7);
        let y = mix(target.y - h * 2.4, target.y, fall ** 2);
        if (fall >= 1) y = target.y - Math.abs(Math.sin(bounce * Math.PI * 2)) * h * 0.3 * (1 - bounce) * p.bounce!;
        settleObject(visual, card, t, { x: target.x, y: snap(y, grid), ry: card.identity ? flipFrames(range(t, 0.72, 0.94)) : 0, opacity: 1 });
        burst(list, { x: target.x, y: target.y + h / 2 }, range(t, 0.4, 0.56), card.target.width * 0.9, size);
      })];
    });
  },
};

// ─────────────────────────────────────────────────────────────── Rain District

/** A card projected into place: beam, outline, two flickers, solid. */
function hologram(context: AnimationContext, card: VisualCard, start: number, span: number): ReturnType<typeof track>[] {
  const visual = context.card(card), w = card.target.width, h = card.target.height, target = rectCenter(card.target);
  const beamColor = context.theme.card.blackColor, glow = context.theme.table.trimColor;
  // The projector's beam: a soft wedge rising from below the card.
  const beam = element(context, { width: `${w * 1.5}px`, height: `${h * 1.25}px`, transformOrigin: '50% 100%',
    background: `linear-gradient(0deg, ${beamColor}55, ${beamColor}00 92%)`, clipPath: 'polygon(46% 100%, 54% 100%, 100% 0, 0 0)', mixBlendMode: 'screen' });
  // The outline the beam draws before the card fills in.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(w)); svg.setAttribute('height', String(h)); svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', overflow: 'visible', pointerEvents: 'none', filter: `drop-shadow(0 0 4px ${glow})` });
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const perimeter = 2 * (w + h);
  for (const [key, value] of Object.entries({ x: '1', y: '1', width: String(w - 2), height: String(h - 2), rx: '4', fill: 'none', stroke: beamColor, 'stroke-width': '1.6', 'stroke-dasharray': String(perimeter), 'stroke-dashoffset': String(perimeter) })) rect.setAttribute(key, value);
  svg.append(rect);
  context.layer.append(svg);
  const outline = { set: (u: number, opacity: number): void => { rect.setAttribute('stroke-dashoffset', String(perimeter * (1 - u))); svg.style.opacity = String(opacity); svg.style.transform = `translate3d(${target.x - w / 2}px,${target.y - h / 2}px,0)`; } };
  const beamObject = object(beam);
  return [track((t0) => {
    const t = range(t0, start, start + span);
    const draw = smooth(range(t, 0.05, 0.42));
    // Two flickers, then solid: the opacity a failing projector settles into.
    const fill = t < 0.42 ? 0 : t < 0.48 ? 0.75 : t < 0.53 ? 0.1 : t < 0.6 ? 0.9 : t < 0.64 ? 0.3 : smooth(range(t, 0.64, 0.8));
    const jitter = t > 0.42 && t < 0.66 ? (noise(Math.floor(t * 40), 7) - 0.5) * w * 0.05 : 0;
    settleObject(visual, card, t0, { x: target.x + jitter, y: target.y, z: 0, scale: mix(1.03, 1, smooth(range(t, 0.42, 0.85))), opacity: t0 < start ? 0 : fill });
    outline.set(draw, t0 < start ? 0 : t < 0.86 ? 1 : 1 - range(t, 0.86, 1));
    beamObject.set({ x: target.x - w * 0.75, y: target.y - h * 0.25, scaleY: smooth(range(t, 0, 0.2)), opacity: t0 < start ? 0 : Math.min(smooth(range(t, 0, 0.15)), 1 - smooth(range(t, 0.7, 0.95))) * 0.9 });
  })];
}

export const hologramFlop: AnimationPreset = {
  id: 'flop.hologram', name: 'Hologram Flop', category: 'flop', supportedEvents: ['flop'], duration: 2100, reducedMotion: 'immediate',
  description: 'A projector beam draws each card’s outline; the cards flicker twice and turn solid, left to right.',
  parameters: [...commonParameters(2100), parameter('stagger', 'Card stagger', 0, 0.25, 0.01, 0.16)],
  build(context) {
    const stagger = context.parameters.stagger!;
    return context.event.cards.slice(0, 3).flatMap((card, index) => hologram(context, card, index * stagger, 1 - 2 * stagger));
  },
};

export const hologramReveal: AnimationPreset = {
  id: 'reveal.hologram', name: 'Hologram Boot', category: 'reveal', supportedEvents: ['turn', 'river'], duration: 1600, reducedMotion: 'immediate',
  description: 'The card is projected into its slot: the beam draws its outline, it flickers twice and turns solid.',
  parameters: commonParameters(1600),
  build(context) { return context.event.cards.slice(0, 1).flatMap((card) => hologram(context, card, 0, 1)); },
};

// ─────────────────────────────────────────────────────────────── Breach

const CODE = '0123456789ABCDEF#%$&@<>/\\';

/**
 * The "encrypted" face: a panel over the card's face showing scrolling code. The
 * real face is beneath it, and only shows as the code resolves.
 */
function cipherPanel(visual: VisualObject, context: AnimationContext, card: VisualCard): (u: number) => void {
  const panel = document.createElement('div');
  const ink = context.theme.card.blackColor, red = context.theme.card.redColor, paper = context.theme.card.faceColor;
  const size = Math.max(7, card.target.height * 0.12);
  Object.assign(panel.style, { position: 'absolute', inset: '0', borderRadius: `${context.theme.card.borderRadius * 0.9}%`, background: paper, color: ink,
    font: `700 ${size.toFixed(1)}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`, lineHeight: '1.05', letterSpacing: '.04em',
    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', whiteSpace: 'pre', textShadow: `0 0 ${(size * 0.4).toFixed(1)}px ${ink}`,
    backfaceVisibility: 'hidden', transform: 'translateZ(.5px)', boxShadow: `inset 0 0 0 1px ${ink}55` });
  visual.element.append(panel);
  const seed = Number.parseInt(card.id.replace(/\D/g, '').slice(-4) || '7', 10);
  let shown = '';
  return (u: number) => {
    // Rows of code; each character settles to a blank, left to right, as u runs 0 → 1.
    const tick = Math.floor(u * 30);
    let text = '';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        const settled = u > (col + row * 0.6) / 7;
        text += settled ? ' ' : CODE[Math.floor(noise(tick * 13 + row * 7 + col, seed) * CODE.length)];
      }
      if (row < 4) text += '\n';
    }
    if (text !== shown) { shown = text; panel.textContent = text; }
    panel.style.color = u > 0.55 && u < 0.62 ? red : ink;
    panel.style.opacity = String(1 - smooth(range(u, 0.7, 1)));
  };
}

function decrypt(context: AnimationContext, card: VisualCard, start: number, span: number): ReturnType<typeof track>[] {
  const visual = context.card(card), target = rectCenter(card.target), h = card.target.height;
  const panel = card.identity ? cipherPanel(visual, context, card) : undefined;
  return [track((t0) => {
    const t = range(t0, start, start + span);
    // In fast with a glitch, face up under the code; the code then decrypts.
    const arrive = easeOut(range(t, 0, 0.22));
    const glitch = t > 0.18 && t < 0.3 && noise(Math.floor(t * 50), 3) > 0.55 ? (noise(Math.floor(t * 50), 5) - 0.5) * card.target.width * 0.18 : 0;
    settleObject(visual, card, t0, { x: target.x + glitch, y: mix(target.y - h * 0.5, target.y, arrive), z: 0, ry: 0, scale: mix(1.12, 1, arrive), opacity: t0 < start ? 0 : clamp(arrive * 3) });
    panel?.(range(t, 0.2, 0.95));
  })];
}

export const decryptFlop: AnimationPreset = {
  id: 'flop.decrypt', name: 'Decrypt Flop', category: 'flop', supportedEvents: ['flop'], duration: 2000, reducedMotion: 'immediate',
  description: 'Three cards glitch onto the board encrypted; scrolling code unscrambles into each rank and suit.',
  parameters: [...commonParameters(2000), parameter('stagger', 'Card stagger', 0, 0.25, 0.01, 0.12)],
  build(context) {
    const stagger = context.parameters.stagger!;
    return context.event.cards.slice(0, 3).flatMap((card, index) => decrypt(context, card, index * stagger, 1 - 2 * stagger));
  },
};

export const decryptReveal: AnimationPreset = {
  id: 'reveal.decrypt', name: 'Decrypt', category: 'reveal', supportedEvents: ['turn', 'river'], duration: 1500, reducedMotion: 'immediate',
  description: 'The card lands encrypted, its face a block of scrolling code that unscrambles one character at a time.',
  parameters: commonParameters(1500),
  build(context) { return context.event.cards.slice(0, 1).flatMap((card) => decrypt(context, card, 0, 1)); },
};

export const packetDeal: AnimationPreset = {
  id: 'deal.packet', name: 'Packet Deal', category: 'deal', supportedEvents: ['deal'], duration: 1700, reducedMotion: 'immediate',
  description: 'A data packet runs along a right-angle trace to each seat; the card materialises where it lands.',
  parameters: [...commonParameters(1700), parameter('stagger', 'Round stagger', 0.2, 0.6, 0.025, 0.42)],
  build(context) {
    const p = context.parameters, order = dealOrder(context), count = context.event.cards.length;
    const ink = context.theme.table.trimColor;
    return context.event.cards.flatMap((card) => {
      const visual = context.card(card), target = rectCenter(card.target), origin = { x: context.event.origin.x, y: context.event.origin.y };
      const size = Math.max(4, card.target.width * 0.14);
      const packet = object(element(context, { width: `${size}px`, height: `${size}px`, background: ink, boxShadow: `0 0 ${size * 1.6}px ${ink}, 0 0 ${size * 0.5}px #fff` }));
      const start = count > 1 ? (order.get(card.id) ?? 0) / (count - 1) * p.stagger! : 0, flight = 1 - p.stagger!;
      // Along x first, then y: the way a trace is routed.
      const corner = { x: target.x, y: origin.y };
      const legA = Math.abs(corner.x - origin.x), legB = Math.abs(target.y - corner.y), total = legA + legB || 1;
      return [track((group) => {
        const t = range(group, start, start + flight), run = smooth(range(t, 0, 0.55)) * total;
        const at = run <= legA ? { x: mix(origin.x, corner.x, legA ? run / legA : 1), y: origin.y } : { x: target.x, y: mix(corner.y, target.y, legB ? (run - legA) / legB : 1) };
        packet.set({ x: at.x - size / 2, y: at.y - size / 2, opacity: group < start || t > 0.62 ? 0 : 1 });
        // The card resolves out of noise: stepped opacity and a horizontal tear.
        const form = range(t, 0.55, 0.85), tear = form > 0 && form < 0.7 && noise(Math.floor(form * 20), 9) > 0.5 ? (noise(Math.floor(form * 20), 4) - 0.5) * card.target.width * 0.3 : 0;
        settleObject(visual, card, t, { x: target.x + tear, y: target.y, ry: card.identity ? mix(180, 0, smooth(range(t, 0.78, 0.98))) : 0,
          scaleY: form < 1 ? mix(0.1, 1, easeOut(form)) : 1, opacity: Math.floor(form * 6) / 6 });
      })];
    });
  },
};

export const roomPresets: AnimationPreset[] = [pixelDeal, pixelFlop, pixelDrop, hologramFlop, hologramReveal, packetDeal, decryptFlop, decryptReveal];
