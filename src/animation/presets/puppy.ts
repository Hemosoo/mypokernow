import type { AnimationPreset } from '../core/types';
import { planFor, type PlanKind } from '../../puppy/plan';
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

function puppyPreset(id: string, name: string, kind: PlanKind, events: AnimationPreset['supportedEvents'], duration: number, description: string): AnimationPreset {
  return {
    id, name, category: events[0] === 'deal' ? 'deal' : events[0] === 'flop' ? 'flop' : 'reveal', supportedEvents: events, duration, reducedMotion: 'immediate', companion: true,
    description: `${description} In other rooms the puppy drops in just for this, then trots off.`, parameters: puppyParameters(duration),
    build(context) {
      const plan = planFor(context.event, kind);
      if (!plan) return [];
      return context.event.cards.flatMap((card) => {
        const cue = plan.cards.get(card.id);
        if (!cue) return [];
        const visual = context.card(card);
        return [track((t) => {
          const c = cue(t);
          settleObject(visual, card, t, { x: c.x, y: c.y, z: c.z, rx: c.rx, ry: c.ry, rz: c.rz, scale: c.scale, opacity: c.opacity });
        })];
      });
    },
  };
}

/** Whether a preset id is one the puppy performs. */
export const isCompanionPreset = (id: string | undefined): boolean => Boolean(id && /^(deal|flop|turn|river)\.puppy$/.test(id));

export const puppyPresets: AnimationPreset[] = [
  puppyPreset('deal.puppy', 'Puppy Deal', 'deal', ['deal'], 2800, 'The puppy trots to the deck and paws each card out to its player.'),
  puppyPreset('flop.puppy', 'Puppy Flop', 'flop', ['flop'], 3000, 'The puppy noses the flop onto the felt, paws the cards apart and watches them turn.'),
  puppyPreset('turn.puppy', 'Puppy Fetch', 'mouth', ['turn', 'river'], 2600, 'The puppy carries the card over in its mouth and drops it into place.'),
  puppyPreset('river.puppy', 'Puppy Paw', 'paw', ['turn', 'river'], 2600, 'The puppy slides the card along the felt with a paw, flicks it over and celebrates.'),
];
