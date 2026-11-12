import type { Rect, Street, VisualCard, VisualEvent } from '../types';

/**
 * The puppy's choreography for one card event, as pure screen-space geometry.
 *
 * The same plan drives two things: the card animation preset (2D overlay) and
 * the 3D puppy. Both sample it at the animation's own progress, so a card leaves
 * at exactly the moment the paw, nose or mouth touches it — through speed
 * changes, pauses and cancellation alike. Nothing here reads or changes the
 * game; positions come from the measured page.
 */
export interface Pt { x: number; y: number }

export interface CardCue {
  /** Card centre in screen pixels. */
  x: number; y: number;
  /** Height above the felt in pixels (overlay depth), and rotations in degrees. */
  z: number; rx: number; ry: number; rz: number;
  scale: number; opacity: number;
}

/** What the puppy is doing at a moment of the plan. */
export type PuppyAction = 'run' | 'paw-strike' | 'nose-push' | 'mouth-grab' | 'mouth-carry' | 'drop' | 'paw-slide' | 'paw-flick' | 'proud' | 'hop' | 'spin';
/** The part of the puppy that must coincide with `point`. */
export type PuppyPart = 'paw' | 'nose' | 'mouth' | 'body';

export interface PuppyCue {
  phase: 'approach' | 'act' | 'after';
  /** Progress through the approach phase, 0–1 (the puppy runs from wherever it is). */
  approach: number;
  part: PuppyPart;
  point: Pt;
  /** The direction the puppy faces, as a point to face toward. */
  face: Pt;
  look: Pt;
  action: PuppyAction;
  /** Progress within the current action, 0–1, for paw and head poses. */
  actionT: number;
  /** 0 calm … 1 delighted: tail speed, ears, little bounces. */
  excite: number;
  /** 0 closed … 1 open. */
  mouth: number;
}

export interface Choreography {
  street: Street;
  cards: Map<string, (p: number) => CardCue>;
  puppy: (p: number) => PuppyCue;
}

const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
const range = (t: number, a: number, b: number): number => clamp((t - a) / Math.max(1e-6, b - a));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const smooth = (t: number): number => { const u = clamp(t); return u * u * (3 - 2 * u); };
const easeOut = (t: number): number => 1 - (1 - clamp(t)) ** 3;
const easeIn = (t: number): number => clamp(t) ** 2;
const easeInOut = (t: number): number => { const u = clamp(t); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; };
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const unit = (a: Pt, b: Pt): Pt => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
const centre = (r: Rect): Pt => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
/** Under-damped landing wobble: 0 at contact, settling to 0. */
const wobble = (t: number): number => Math.sin(clamp(t) * Math.PI * 2) * Math.exp(-4 * clamp(t)) * (1 - clamp(t));

const resting = (card: VisualCard): CardCue => ({ ...centre(card.target), z: 0, rx: 0, ry: 0, rz: 0, scale: 1, opacity: 1 });

/** Table centre used by every plan: the middle of the event's cards, as presets compute it. */
export function eventCentre(event: VisualEvent): Pt {
  const cards = event.cards;
  if (!cards.length) return { x: event.origin.x, y: event.origin.y };
  return { x: cards.reduce((s, c) => s + c.target.x + c.target.width / 2, 0) / cards.length, y: cards.reduce((s, c) => s + c.target.y + c.target.height / 2, 0) / cards.length };
}

/** Deal order: two rounds, clockwise from the dealer, as the presets order them. */
function dealSequence(event: VisualEvent, middle: Pt): VisualCard[] {
  const firstSeat = new Map<string, number>(), counts = new Map<string, number>();
  return event.cards.map((card, index) => {
    const seat = card.seatId ?? `${Math.floor(index / 2)}`, occurrence = counts.get(seat) ?? 0;
    counts.set(seat, occurrence + 1);
    if (!firstSeat.has(seat)) { const c = centre(card.target); firstSeat.set(seat, Math.atan2(c.y - middle.y, c.x - middle.x)); }
    return { card, round: card.round ?? occurrence, angle: firstSeat.get(seat) ?? 0, index };
  }).sort((a, b) => a.round - b.round || a.angle - b.angle || a.index - b.index).map((item) => item.card);
}

interface Layout { deck: Pt; inward: Pt; cardW: number; cardH: number; middle: Pt }
function layout(event: VisualEvent, tableMiddle?: Pt): Layout {
  const middle = tableMiddle ?? eventCentre(event), origin = { x: event.origin.x, y: event.origin.y };
  const first = event.cards[0]?.target, cardW = first?.width ?? 60, cardH = first?.height ?? 80;
  const inward = unit(origin, middle);
  // The deck sits on the felt just inside the dealer button.
  return { deck: add(origin, inward, cardH * 0.75), inward, cardW, cardH, middle };
}

function approachCue(p: number, until: number, stand: Pt, face: Pt, part: PuppyPart = 'body'): PuppyCue {
  return { phase: 'approach', approach: smooth(range(p, 0, until)), part, point: stand, face, look: face, action: 'run', actionT: range(p, 0, until), excite: 0.35, mouth: 0 };
}

// ─────────────────────────────────────────────────────────────── deal: paw tosses

function dealPlan(event: VisualEvent): Choreography {
  const L = layout(event), order = dealSequence(event, L.middle), n = order.length;
  const approach = 0.18, last = 0.86, flight = Math.min(0.2, 0.5 / Math.max(1, Math.sqrt(n)) + 0.08);
  const span = Math.max(0.0001, last - flight - (approach + 0.04));
  const contact = (i: number): number => approach + 0.04 + (n > 1 ? (i / (n - 1)) * span : 0);
  const cards = new Map<string, (p: number) => CardCue>();
  order.forEach((card, i) => {
    const target = centre(card.target), c = contact(i), stack = add(L.deck, { x: 0, y: -1 }, i * 0.6);
    const dist = Math.hypot(target.x - stack.x, target.y - stack.y), spin = (i % 2 ? 1 : -1) * (dist > L.cardW * 6 ? 540 : 360);
    cards.set(card.id, (p) => {
      if (p >= c + flight || p >= 1) return resting(card);
      if (p < c) return { ...stack, z: 2 + i * 0.4, rx: 0, ry: card.identity ? 180 : 0, rz: (i % 3 - 1) * 2, scale: 0.92, opacity: smooth(range(p, 0, 0.06)) };
      const u = range(p, c, c + flight), travel = easeOut(u), pos = lerp(stack, target, travel), air = Math.sin(Math.PI * u);
      return { x: pos.x, y: pos.y - air * L.cardH * 0.35, z: air * L.cardH * 0.8, rx: air * 18, ry: card.identity ? mix(180, 0, smooth(range(u, 0.45, 0.95))) : 0,
        rz: spin * (1 - travel), scale: mix(0.92, 1, travel) * (1 + air * 0.12), opacity: 1 };
    });
  });
  const hero = order.find((card) => card.identity) ?? order[0];
  return {
    street: 'deal', cards,
    puppy: (p) => {
      const firstGoal = order[0] ? centre(order[0].target) : L.middle;
      if (p < approach) return approachCue(p, approach, add(L.deck, unit(firstGoal, L.deck), L.cardW * 0.55), firstGoal, 'paw');
      if (p >= last) return { phase: 'after', approach: 1, part: 'paw', point: add(L.deck, L.inward, -L.cardW * 0.4), face: L.middle, look: hero ? centre(hero.target) : L.middle, action: 'proud', actionT: range(p, last, 1), excite: 0.8, mouth: 0.6 };
      // Which toss is underway: the paw winds up before each contact and follows through after.
      let i = 0;
      while (i < n - 1 && p > contact(i) + (contact(i + 1) - contact(i)) * 0.5) i++;
      const card = order[i]!, c = contact(i), gap = n > 1 ? span / (n - 1) : 0.1;
      const actionT = range(p, c - gap * 0.5, c + gap * 0.5), goal = centre(card.target);
      // The paw meets the back edge of the deck, so the card is struck toward its player.
      const edge = add(L.deck, unit(goal, L.deck), L.cardW * 0.55);
      return { phase: 'act', approach: 1, part: 'paw', point: edge, face: goal, look: goal, action: 'paw-strike', actionT, excite: 0.55, mouth: 0.2 };
    },
  };
}

// ─────────────────────────────────────────────────────────────── flop: nose push and paw spread

function flopPlan(event: VisualEvent): Choreography {
  const L = layout(event), slots = event.cards.slice(0, 3);
  const first = centre(slots[0]!.target), toward = unit(L.deck, first);
  // The stack is nosed to a point just beside the first slot, on the deck's side.
  const meet = add(first, toward, -L.cardW * 1.25);
  const approach = 0.16, push: [number, number] = [0.18, 0.46], contacts = [0.52, 0.59, 0.66], slide = 0.11, flips = [0.76, 0.81, 0.86], flipLen = 0.09;
  const stackAt = (p: number): Pt => lerp(L.deck, meet, easeInOut(range(p, push[0], push[1])));
  const cards = new Map<string, (p: number) => CardCue>();
  slots.forEach((card, k) => {
    const target = centre(card.target);
    cards.set(card.id, (p) => {
      if (p >= 1) return resting(card);
      const flipU = range(p, flips[k]!, flips[k]! + flipLen), lift = Math.sin(Math.PI * flipU);
      if (p >= contacts[k]!) {
        const u = range(p, contacts[k]!, contacts[k]! + slide), pos = lerp(meet, target, easeOut(u));
        return { x: pos.x, y: pos.y - lift * L.cardH * 0.18, z: lift * L.cardH * 0.6 + 2, rx: lift * 10, ry: card.identity ? mix(180, 0, easeInOut(flipU)) : 0,
          rz: (1 - easeOut(u)) * (k - 1) * 6, scale: 1 + lift * 0.08 + wobble(range(p, flips[k]! + flipLen, flips[k]! + flipLen + 0.08)) * 0.03, opacity: 1 };
      }
      const s = stackAt(p);
      return { x: s.x, y: s.y - k * 0.8, z: 2 + k * 0.5, rx: 0, ry: card.identity ? 180 : 0, rz: (k - 1) * 1.5, scale: 1, opacity: smooth(range(p, 0, 0.05)) };
    });
  });
  return {
    street: 'flop', cards,
    puppy: (p) => {
      const behind = (at: Pt): Pt => add(at, toward, -L.cardW * 0.55);
      if (p < push[0]) return approachCue(p, approach, behind(L.deck), meet, 'nose');
      if (p < contacts[0]! - 0.03) return { phase: 'act', approach: 1, part: 'nose', point: behind(stackAt(p)), face: meet, look: stackAt(p), action: 'nose-push', actionT: range(p, push[0], push[1]), excite: 0.5, mouth: 0 };
      if (p < flips[0]!) {
        let k = 0;
        while (k < 2 && p > contacts[k]! + 0.035) k++;
        const target = centre(slots[k]!.target);
        return { phase: 'act', approach: 1, part: 'paw', point: add(meet, unit(target, meet), L.cardW * 0.55), face: target, look: target, action: 'paw-strike', actionT: range(p, contacts[k]! - 0.035, contacts[k]! + 0.035), excite: 0.6, mouth: 0.2 };
      }
      const middle = centre(slots[1]!.target);
      return { phase: 'after', approach: 1, part: 'paw', point: add(meet, toward, -L.cardW * 0.6), face: middle, look: centre(slots[Math.min(2, Math.max(0, Math.floor(range(p, flips[0]!, flips[2]! + flipLen) * 3)))]!.target),
        action: p > 0.9 ? 'hop' : 'proud', actionT: range(p, 0.9, 1), excite: mix(0.6, 1, range(p, flips[0]!, 1)), mouth: 0.7 };
    },
  };
}

// ─────────────────────────────────────────────────────────────── turn: carried in the mouth

function turnPlan(event: VisualEvent): Choreography {
  const L = layout(event), card = event.cards[0]!, target = centre(card.target);
  const approach = 0.2, grab = 0.27, carry: [number, number] = [0.3, 0.7], drop: [number, number] = [0.72, 0.8], flip: [number, number] = [0.73, 0.86];
  const hang = L.cardH * 0.36;
  // Carried a little above the slot, then let go.
  const above = add(target, { x: 0, y: -1 }, L.cardH * 0.28);
  const carried = (p: number): Pt => {
    const u = easeInOut(range(p, carry[0], carry[1])), pos = lerp(L.deck, above, u);
    return { x: pos.x, y: pos.y - Math.sin(Math.PI * u) * L.cardH * 0.25 };
  };
  const cards = new Map<string, (p: number) => CardCue>();
  cards.set(card.id, (p) => {
    if (p >= 1) return resting(card);
    if (p < grab) return { ...L.deck, z: 2, rx: 0, ry: card.identity ? 180 : 0, rz: 0, scale: 1, opacity: smooth(range(p, 0, 0.06)) };
    if (p < drop[0]) {
      const lifted = smooth(range(p, grab, carry[0])), at = carried(p), sway = Math.sin(p * 40) * (1 - range(p, carry[1], drop[0])) * 5;
      return { x: at.x, y: at.y, z: lifted * L.cardH * 0.9, rx: -lifted * 14, ry: card.identity ? 180 : 0, rz: sway * lifted, scale: 1 - lifted * 0.06, opacity: 1 };
    }
    const u = range(p, drop[0], drop[1]), f = range(p, flip[0], flip[1]), pos = lerp(above, target, easeIn(u)), land = wobble(range(p, drop[1], drop[1] + 0.1));
    return { x: pos.x, y: pos.y - Math.sin(Math.PI * f) * L.cardH * 0.12, z: mix(L.cardH * 0.9, 0, easeIn(u)) + Math.sin(Math.PI * f) * L.cardH * 0.3,
      rx: mix(-14, 0, u), ry: card.identity ? mix(180, 0, easeInOut(f)) : 0, rz: 0, scale: mix(0.94, 1, u) * (1 + land * 0.04), opacity: 1 };
  });
  return {
    street: 'turn', cards,
    puppy: (p) => {
      if (p < approach) return approachCue(p, approach, L.deck, target, 'mouth');
      if (p < carry[0]) return { phase: 'act', approach: 1, part: 'mouth', point: L.deck, face: target, look: L.deck, action: 'mouth-grab', actionT: range(p, approach, carry[0]), excite: 0.45, mouth: p < grab ? mix(0.2, 1, range(p, approach, grab)) : 0.15 };
      if (p < drop[0]) { const at = carried(p); return { phase: 'act', approach: 1, part: 'mouth', point: { x: at.x, y: at.y - hang }, face: above, look: above, action: 'mouth-carry', actionT: range(p, carry[0], carry[1]), excite: 0.55, mouth: 0.15 }; }
      return { phase: 'after', approach: 1, part: 'mouth', point: { x: above.x, y: above.y - hang }, face: target, look: target, action: p > 0.86 ? 'proud' : 'drop', actionT: range(p, drop[0], 1), excite: mix(0.6, 0.95, range(p, flip[0], 1)), mouth: p < drop[0] + 0.04 ? 1 : 0.6 };
    },
  };
}

// ─────────────────────────────────────────────────────────────── river: slid with a paw, then a celebration

function riverPlan(event: VisualEvent): Choreography {
  const L = layout(event), card = event.cards[0]!, target = centre(card.target);
  const approach = 0.18, contact = 0.23, slide: [number, number] = [0.25, 0.64], flick = 0.68, flip: [number, number] = [0.69, 0.81];
  const dir = unit(L.deck, target);
  const sliding = (p: number): Pt => lerp(L.deck, target, easeInOut(range(p, slide[0], slide[1])));
  const cards = new Map<string, (p: number) => CardCue>();
  cards.set(card.id, (p) => {
    if (p >= 1) return resting(card);
    if (p < flip[0]) { const at = sliding(p); return { ...at, z: 2, rx: 0, ry: card.identity ? 180 : 0, rz: (1 - range(p, slide[0], slide[1])) * 8 * (dir.x >= 0 ? -1 : 1), scale: 1, opacity: smooth(range(p, 0, 0.06)) }; }
    const f = range(p, flip[0], flip[1]), lift = Math.sin(Math.PI * f), land = wobble(range(p, flip[1], flip[1] + 0.1));
    return { x: target.x, y: target.y - lift * L.cardH * 0.4, z: lift * L.cardH * 1.1, rx: lift * 16, ry: card.identity ? mix(180, 0, easeInOut(f)) : 0, rz: lift * 4, scale: (1 + lift * 0.1) * (1 + land * 0.04), opacity: 1 };
  });
  return {
    street: 'river', cards,
    puppy: (p) => {
      const behind = (at: Pt): Pt => add(at, dir, -L.cardW * 0.42);
      if (p < contact) return approachCue(p, approach, behind(L.deck), target, 'paw');
      if (p < flick) return { phase: 'act', approach: 1, part: 'paw', point: behind(sliding(p)), face: target, look: sliding(p), action: 'paw-slide', actionT: range(p, slide[0], slide[1]), excite: 0.55, mouth: 0.2 };
      if (p < flip[1]) return { phase: 'act', approach: 1, part: 'paw', point: behind(target), face: target, look: target, action: 'paw-flick', actionT: range(p, flick - 0.02, flip[0] + 0.04), excite: 0.8, mouth: 0.5 };
      return { phase: 'after', approach: 1, part: 'paw', point: behind(target), face: target, look: target, action: 'spin', actionT: range(p, flip[1], 1), excite: 1, mouth: 0.8 };
    },
  };
}

/** Four kinds of puppy choreography; the preset chooses which one runs. */
export type PlanKind = 'deal' | 'flop' | 'mouth' | 'paw';

export function choreograph(event: VisualEvent, kind: PlanKind): Choreography | undefined {
  if (!event.cards.length) return undefined;
  if (kind === 'deal') return dealPlan(event);
  if (kind === 'flop') return event.cards.length === 3 ? flopPlan(event) : undefined;
  return kind === 'mouth' ? turnPlan(event) : riverPlan(event);
}

/**
 * Plans are deterministic, and the card preset builds the one for its event. The
 * puppy then finds that same plan by event id, so both sample one script.
 */
const plans = new Map<string, Choreography>();
export function planFor(event: VisualEvent, kind: PlanKind): Choreography | undefined {
  let plan = plans.get(event.id);
  if (!plan) {
    plan = choreograph(event, kind);
    if (!plan) return undefined;
    plans.set(event.id, plan);
    if (plans.size > 12) plans.delete(plans.keys().next().value!);
  }
  return plan;
}
export const planForEvent = (eventId: string): Choreography | undefined => plans.get(eventId);
