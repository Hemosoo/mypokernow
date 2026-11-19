import type { AnimationContext, AnimationPreset, TimelineTrack } from '../core/types';
import type { CompanionKind } from '../../types';
import { planFor, type Choreography, type PlanKind } from '../../puppy/plan';
import { YARN } from '../../rendering/cat-art';
import { svgDataUrl } from '../../rendering/color';
import { parameter, settleObject, track } from './shared';

/**
 * Puppy choreography. The cards follow the shared plan; the 3D puppy samples the
 * same plan at the same progress, so it is the puppy's paw, nose or mouth that sets
 * each card moving. On the Puppy table it lives there; in any other room it visits
 * for these animations only. Without a puppy (animations off, no WebGL) a showpiece
 * plays instead, so cards never move on their own.
 */
const puppyParameters = (duration: number) => [
  parameter('duration', 'Duration', 900, 4800, 50, duration, 'ms'),
  parameter('speed', 'Preset speed', 0.4, 2, 0.1, 1, '×'),
  parameter('intensity', 'Intensity', 0.3, 1.7, 0.05, 1, '×'),
];

/**
 * The cat's ball of yarn and the strand it trails, drawn above the cards so the
 * ball visibly rolls across them. Follows the plan's prop cue.
 */
/** The animation layer's perspective distance (see the coordinator). */
const PERSPECTIVE = 1100;

function yarnBall(context: AnimationContext, plan: Choreography): TimelineTrack[] {
  if (!plan.prop) return [];
  const color = '#e2556f', shade = '#a5304a';
  const ball = document.createElement('div');
  ball.style.cssText = `position:absolute;left:0;top:0;z-index:2400;pointer-events:none;opacity:0;background:center/contain no-repeat url("${svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-.5 -.5 1 1" width="64" height="64"><defs><radialGradient id="y" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#ff9db0"/><stop offset="1" stop-color="${shade}"/></radialGradient></defs><g fill="url(#y)" stroke="#ffd6df" stroke-width=".05">${YARN.replace(/<path d="M\.3 \.3[^>]*>/, '')}</g></svg>`)}");filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))`;
  const strand = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  strand.setAttribute('width', '100%'); strand.setAttribute('height', '100%');
  strand.style.cssText = 'position:absolute;inset:0;z-index:2399;overflow:visible;pointer-events:none';
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-linecap', 'round');
  strand.append(path);
  context.layer.append(strand, ball);
  return [track((t) => {
    const cue = plan.prop!(t);
    if (!cue || t >= 1) { ball.style.opacity = '0'; path.setAttribute('d', ''); return; }
    const size = cue.radius * 2;
    ball.style.width = ball.style.height = `${size.toFixed(1)}px`;
    // The layer has depth: lift the ball toward the viewer so it rolls over the flipping cards,
    // and undo the perspective so it still lands exactly at (x, y) at its own size.
    const lift = cue.radius * 7, k = (PERSPECTIVE - lift) / PERSPECTIVE, o = context.center;
    const x = o.x + (cue.x - o.x) * k, y = o.y + (cue.y - o.y) * k;
    ball.style.transform = `translate3d(${(x - cue.radius).toFixed(1)}px,${(y - cue.radius).toFixed(1)}px,${lift.toFixed(1)}px) scale(${k.toFixed(4)}) rotate(${cue.spin.toFixed(1)}deg)`;
    ball.style.opacity = String(cue.opacity);
    if (cue.thread) {
      // A lazy strand: a slight sag between where the ball started and where it is.
      const from = cue.thread.from, mx = (from.x + cue.x) / 2, my = (from.y + cue.y) / 2 + cue.radius * 0.8;
      path.setAttribute('d', `M${from.x.toFixed(1)} ${from.y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${cue.x.toFixed(1)} ${(cue.y + cue.radius * 0.6).toFixed(1)}`);
      path.setAttribute('stroke-opacity', String(cue.thread.opacity));
    }
  })];
}

function puppyPreset(id: string, name: string, kind: PlanKind, events: AnimationPreset['supportedEvents'], duration: number, description: string, species: CompanionKind = 'puppy'): AnimationPreset {
  return {
    id, name, category: events[0] === 'deal' ? 'deal' : events[0] === 'flop' ? 'flop' : 'reveal', supportedEvents: events, duration, reducedMotion: 'immediate', companion: true,
    description: `${description} In other rooms the ${species} drops in just for this, then ${species === 'cat' ? 'slinks' : 'trots'} off.`, parameters: puppyParameters(duration),
    build(context) {
      const plan = planFor(context.event, kind);
      if (!plan) return [];
      return [...yarnBall(context, plan), ...context.event.cards.flatMap((card) => {
        const cue = plan.cards.get(card.id);
        if (!cue) return [];
        const visual = context.card(card);
        return [track((t) => {
          const c = cue(t);
          settleObject(visual, card, t, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, rz: c.rz, scale: c.scale, opacity: c.opacity });
        })];
      })];
    },
  };
}

/** Whether a preset id is one a companion performs (the puppy or the cat). */
export const isCompanionPreset = (id: string | undefined): boolean => Boolean(id && /^(deal|flop|turn|river)\.(puppy|cat)$/.test(id));
/** Which character performs a companion preset. */
export const presetSpecies = (id: string | undefined): CompanionKind | undefined => !id || !isCompanionPreset(id) ? undefined : id.endsWith('.cat') ? 'cat' : 'puppy';
/** The same street's move for the other character, so a room can switch companion. */
export const counterpart = (id: string, kind: CompanionKind): string => isCompanionPreset(id) ? id.replace(/\.(puppy|cat)$/, `.${kind}`) : id;

export const puppyPresets: AnimationPreset[] = [
  puppyPreset('deal.puppy', 'Puppy Deal', 'deal', ['deal'], 2800, 'The puppy trots to the deck and paws each card out to its player.'),
  puppyPreset('flop.puppy', 'Puppy Flop', 'flop', ['flop'], 3000, 'The puppy noses the flop onto the felt, paws the cards apart and watches them turn.'),
  puppyPreset('turn.puppy', 'Puppy Fetch', 'mouth', ['turn', 'river'], 2600, 'The puppy carries the card over in its mouth and drops it into place.'),
  puppyPreset('river.puppy', 'Puppy Paw', 'paw', ['turn', 'river'], 2600, 'The puppy slides the card along the felt with a paw, flicks it over and celebrates.'),
  puppyPreset('deal.cat', 'Cat Deal', 'cat-deal', ['deal'], 2800, 'The cat sits up by the deck and flicks each card out to its player with a paw.', 'cat'),
  puppyPreset('flop.cat', 'Yarn Ball Flop', 'cat-flop', ['flop'], 3300, 'The cat paws the flop out face down, then bats a ball of yarn along the row: each card flips as the ball rolls over it.', 'cat'),
  puppyPreset('turn.cat', 'Cat Push', 'cat-push', ['turn', 'river'], 2800, 'The cat slowly pushes the card into place with one paw, staring at you, then flicks it over.', 'cat'),
  puppyPreset('river.cat', 'Pounce', 'cat-pounce', ['turn', 'river'], 2900, 'The cat slides the card in, crouches, wiggles and pounces; the card flips under its paws.', 'cat'),
];
