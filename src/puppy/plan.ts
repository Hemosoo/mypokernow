import type { CompanionKind, Rect, Street, VisualCard, VisualEvent } from '../types';

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
export type PuppyAction = 'run' | 'paw-strike' | 'nose-push' | 'mouth-grab' | 'mouth-carry' | 'drop' | 'paw-slide' | 'paw-flick' | 'proud' | 'hop' | 'spin'
  // The cat's own moves: a seated flick, a bat at the yarn, a wiggling crouch, a pounce, a slow push.
  | 'flick' | 'bat' | 'crouch' | 'pounce' | 'push';
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

/** A prop the companion plays with, drawn by the card preset: the cat's ball of yarn. */
export interface PropCue {
  x: number; y: number; radius: number;
  /** Rolling angle in degrees. */
  spin: number;
  opacity: number;
  /** The strand of yarn left behind, from where the ball started to where it is. */
  thread?: { from: Pt; opacity: number };
}

export interface Choreography {
  street: Street;
  /** Which character performs it; the puppy when absent. */
  species?: CompanionKind;
  cards: Map<string, (p: number) => CardCue>;
  puppy: (p: number) => PuppyCue;
  prop?: (p: number) => PropCue | undefined;
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
      if (p < approach) return approachCue(p, approach, add(L.deck, L.inward, -L.cardW * 0.55), L.middle, 'paw');
      if (p >= last) return { phase: 'after', approach: 1, part: 'paw', point: add(L.deck, L.inward, -L.cardW * 0.4), face: L.middle, look: hero ? centre(hero.target) : L.middle, action: 'proud', actionT: range(p, last, 1), excite: 0.8, mouth: 0.6 };
      // Which toss is underway: the paw winds up before each contact and follows through after.
      let i = 0;
      while (i < n - 1 && p > contact(i) + (contact(i + 1) - contact(i)) * 0.5) i++;
      const card = order[i]!, c = contact(i), gap = n > 1 ? span / (n - 1) : 0.1;
      const actionT = range(p, c - gap * 0.5, c + gap * 0.5), goal = centre(card.target);
      // The paw meets the back edge of the deck, so the card is struck toward its player.
      // A dealer faces the table and flicks each card out; only the head follows the card.
      // The body holds one heading, so dealing around the table never spins the puppy.
      const stance = add(L.deck, L.inward, -L.cardW * 0.55);
      return { phase: 'act', approach: 1, part: 'paw', point: stance, face: L.middle, look: goal, action: 'paw-strike', actionT, excite: 0.55, mouth: 0.2 };
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
        // Body faces along the board; the paw sweeps each card from the stack, the head follows it.
        const target = centre(slots[k]!.target), along = centre(slots[1]!.target);
        return { phase: 'act', approach: 1, part: 'paw', point: add(meet, toward, -L.cardW * 0.55), face: along, look: target, action: 'paw-strike', actionT: range(p, contacts[k]! - 0.035, contacts[k]! + 0.035), excite: 0.6, mouth: 0.2 };
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

// ─────────────────────────────────────────────────────────────── the cat

/** The cat deals sitting up by the deck, flicking each card out with a paw. */
function catDealPlan(event: VisualEvent): Choreography {
  const plan = dealPlan(event);
  return { ...plan, species: 'cat', puppy: (p) => { const cue = plan.puppy(p); return cue.action === 'paw-strike' ? { ...cue, action: 'flick' } : cue; } };
}

/**
 * The yarn-ball flop. The cat paws the three cards out to their slots face down,
 * walks to the end of the board, crouches and bats a ball of yarn along the row.
 * Each card flips over as the ball rolls across it, and the strand it trails fades.
 */
function catFlopPlan(event: VisualEvent): Choreography {
  const L = layout(event), slots = event.cards.slice(0, 3);
  const first = centre(slots[0]!.target), last = centre(slots[2]!.target);
  const along = unit(first, last), radius = L.cardW * 0.3;
  // The ball starts beyond whichever end of the row is nearer the deck and rolls to the far end.
  const fromFirst = Math.hypot(L.deck.x - first.x, L.deck.y - first.y) <= Math.hypot(L.deck.x - last.x, L.deck.y - last.y);
  const dir = fromFirst ? along : { x: -along.x, y: -along.y };
  const head = fromFirst ? first : last, tail = fromFirst ? last : first;
  const ballStart = add(head, dir, -L.cardW * 0.95), ballEnd = add(tail, dir, L.cardW * 0.9);
  const approach = 0.13, sweeps = [0.17, 0.235, 0.3], slide = 0.1, walk: [number, number] = [0.42, 0.5], crouch: [number, number] = [0.5, 0.56], hit = 0.57, roll: [number, number] = [0.57, 0.84];
  const rollEase = (u: number): number => 1 - (1 - clamp(u)) ** 2.2;
  const ballAt = (p: number): Pt => lerp(ballStart, ballEnd, rollEase(range(p, roll[0], roll[1])));
  // When the ball's centre passes each card, found by stepping along the roll.
  const total = Math.hypot(ballEnd.x - ballStart.x, ballEnd.y - ballStart.y) || 1;
  const passes = slots.map((card) => {
    const c = centre(card.target), along0 = ((c.x - ballStart.x) * dir.x + (c.y - ballStart.y) * dir.y) / total;
    let p = roll[0];
    for (let i = 0; i <= 400; i++) { const q = roll[0] + (roll[1] - roll[0]) * (i / 400); if (rollEase(range(q, roll[0], roll[1])) >= along0) { p = q; break; } p = q; }
    return p;
  });
  const flipLen = 0.065;
  const order = fromFirst ? [0, 1, 2] : [2, 1, 0];
  const cards = new Map<string, (p: number) => CardCue>();
  slots.forEach((card, k) => {
    const target = centre(card.target), contact = sweeps[order.indexOf(k)]!, flipAt = passes[k]! - 0.01;
    cards.set(card.id, (p) => {
      if (p >= 1) return resting(card);
      if (p < contact) return { ...add(L.deck, { x: 0, y: -1 }, k * 0.7), z: 2 + k * 0.4, rx: 0, ry: card.identity ? 180 : 0, rz: (k - 1) * 2, scale: 1, opacity: smooth(range(p, 0, 0.05)) };
      const u = range(p, contact, contact + slide), pos = lerp(L.deck, target, easeOut(u));
      const f = range(p, flipAt, flipAt + flipLen), lift = Math.sin(Math.PI * f);
      return { x: pos.x, y: pos.y - lift * L.cardH * 0.25, z: lift * L.cardH * 0.7 + 1, rx: lift * 12, ry: card.identity ? mix(180, 0, easeInOut(f)) : 0,
        rz: (1 - easeOut(u)) * (k - 1) * 8 + lift * 6, scale: 1 + lift * 0.08 + wobble(range(p, flipAt + flipLen, flipAt + flipLen + 0.08)) * 0.03, opacity: 1 };
    });
  });
  const batFrom = add(ballStart, dir, -radius * 1.1);
  return {
    street: 'flop', species: 'cat', cards,
    prop: (p) => {
      if (p < hit - 0.08) return undefined;
      const at = ballAt(p), rolled = Math.hypot(at.x - ballStart.x, at.y - ballStart.y);
      const appear = smooth(range(p, hit - 0.08, hit - 0.03)), fade = 1 - smooth(range(p, 0.9, 0.99));
      return { x: at.x, y: at.y, radius, spin: rolled / radius * 57.3, opacity: appear * fade, thread: { from: add(ballStart, dir, -radius * 2.2), opacity: fade * 0.9 } };
    },
    puppy: (p) => {
      if (p < approach) return approachCue(p, approach, add(L.deck, L.inward, -L.cardW * 0.5), L.middle, 'paw');
      if (p < walk[0]) {
        let i = 0;
        while (i < 2 && p > sweeps[i]! + 0.03) i++;
        const target = centre(slots[order[i]!]!.target);
        return { phase: 'act', approach: 1, part: 'paw', point: add(L.deck, L.inward, -L.cardW * 0.5), face: L.middle, look: target, action: 'flick', actionT: range(p, sweeps[i]! - 0.03, sweeps[i]! + 0.03), excite: 0.5, mouth: 0 };
      }
      if (p < crouch[0]) {
        // Trot round to the end of the row, behind the ball.
        const from = add(L.deck, L.inward, -L.cardW * 0.5), u = smooth(range(p, walk[0], walk[1]));
        return { phase: 'act', approach: 1, part: 'paw', point: lerp(from, batFrom, u), face: ballEnd, look: ballStart, action: 'run', actionT: u, excite: 0.6, mouth: 0 };
      }
      if (p < hit + 0.03) return { phase: 'act', approach: 1, part: 'paw', point: batFrom, face: ballEnd, look: ballStart, action: p < crouch[1] ? 'crouch' : 'bat', actionT: p < crouch[1] ? range(p, crouch[0], crouch[1]) : range(p, crouch[1], hit + 0.03), excite: 0.85, mouth: 0 };
      const ball = ballAt(p);
      return { phase: 'after', approach: 1, part: 'paw', point: batFrom, face: ballEnd, look: ball, action: p > 0.86 ? 'proud' : 'run', actionT: range(p, 0.86, 1), excite: 0.9, mouth: p > 0.86 ? 0.3 : 0 };
    },
  };
}

/** The cat walks the card in with one paw, slowly, looking at you the whole way, then flicks it over. */
function catPushPlan(event: VisualEvent): Choreography {
  const plan = riverPlan(event), L = layout(event), card = event.cards[0]!, target = centre(card.target);
  const viewer = { x: target.x, y: target.y + L.cardH * 12 };
  return { ...plan, species: 'cat', puppy: (p) => {
    const cue = plan.puppy(p);
    if (cue.action === 'paw-slide') return { ...cue, action: 'push', look: viewer, excite: 0.3 };
    if (cue.action === 'spin') return { ...cue, action: 'proud', look: viewer, excite: 0.7 };
    return cue;
  } };
}

/** The cat slides the card into its slot, backs off, crouches with a wiggle and pounces; the card flips under its paws. */
function catPouncePlan(event: VisualEvent): Choreography {
  const L = layout(event), card = event.cards[0]!, target = centre(card.target);
  const approach = 0.14, slide: [number, number] = [0.16, 0.36], back: [number, number] = [0.38, 0.47], crouch: [number, number] = [0.47, 0.62], leap: [number, number] = [0.62, 0.72], flip: [number, number] = [0.71, 0.82];
  const dir = unit(L.deck, target), crouchAt = add(target, dir, -L.cardW * 1.7);
  const sliding = (p: number): Pt => lerp(L.deck, target, easeInOut(range(p, slide[0], slide[1])));
  const cards = new Map<string, (p: number) => CardCue>();
  cards.set(card.id, (p) => {
    if (p >= 1) return resting(card);
    if (p < flip[0]) { const at = sliding(p); return { ...at, z: 1, rx: 0, ry: card.identity ? 180 : 0, rz: (1 - range(p, slide[0], slide[1])) * 6 * (dir.x >= 0 ? -1 : 1), scale: 1, opacity: smooth(range(p, 0, 0.06)) }; }
    const f = range(p, flip[0], flip[1]), lift = Math.sin(Math.PI * f), land = wobble(range(p, flip[1], flip[1] + 0.1));
    return { x: target.x, y: target.y - lift * L.cardH * 0.3, z: lift * L.cardH * 0.9, rx: lift * 14, ry: card.identity ? mix(180, 0, easeInOut(f)) : 0, rz: -lift * 5, scale: (1 + lift * 0.08) * (1 + land * 0.05), opacity: 1 };
  });
  const behind = (at: Pt): Pt => add(at, dir, -L.cardW * 0.4);
  return {
    street: event.type === 'TURN_REVEALED' ? 'turn' : 'river', species: 'cat', cards,
    puppy: (p) => {
      if (p < slide[0]) return approachCue(p, approach, behind(L.deck), target, 'paw');
      if (p < back[0]) return { phase: 'act', approach: 1, part: 'paw', point: behind(sliding(p)), face: target, look: sliding(p), action: 'paw-slide', actionT: range(p, slide[0], slide[1]), excite: 0.5, mouth: 0 };
      if (p < crouch[0]) return { phase: 'act', approach: 1, part: 'paw', point: lerp(behind(target), crouchAt, smooth(range(p, back[0], back[1]))), face: target, look: target, action: 'run', actionT: range(p, back[0], back[1]), excite: 0.6, mouth: 0 };
      if (p < leap[0]) return { phase: 'act', approach: 1, part: 'paw', point: crouchAt, face: target, look: target, action: 'crouch', actionT: range(p, crouch[0], crouch[1]), excite: 0.95, mouth: 0 };
      if (p < flip[1]) { const u = range(p, leap[0], leap[1]); return { phase: 'act', approach: 1, part: 'paw', point: lerp(crouchAt, target, easeOut(u)), face: target, look: target, action: 'pounce', actionT: u, excite: 1, mouth: 0.2 }; }
      return { phase: 'after', approach: 1, part: 'paw', point: target, face: target, look: target, action: 'proud', actionT: range(p, flip[1], 1), excite: 0.9, mouth: 0.3 };
    },
  };
}

/** The puppy's four kinds of choreography and the cat's four; the preset chooses which one runs. */
export type PlanKind = 'deal' | 'flop' | 'mouth' | 'paw' | 'cat-deal' | 'cat-flop' | 'cat-push' | 'cat-pounce';

export function choreograph(event: VisualEvent, kind: PlanKind): Choreography | undefined {
  if (!event.cards.length) return undefined;
  if (kind === 'deal') return dealPlan(event);
  if (kind === 'cat-deal') return catDealPlan(event);
  if (kind === 'flop') return event.cards.length === 3 ? flopPlan(event) : undefined;
  if (kind === 'cat-flop') return event.cards.length === 3 ? catFlopPlan(event) : undefined;
  if (kind === 'cat-push') return catPushPlan(event);
  if (kind === 'cat-pounce') return catPouncePlan(event);
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
