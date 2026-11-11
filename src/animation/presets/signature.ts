import type { AnimationPreset } from '../core/types';
import { commonParameters, dealOrder, settleObject, track } from './shared';
import { envelope, mix, range, rectCenter, smoother } from '../primitives/motion';

/** Quiet, physical house choreography; all tracks converge on measured artwork. */
export const signaturePresets: AnimationPreset[] = [
  { id: 'deal.pitch', name: 'House Pitch', category: 'deal', supportedEvents: ['deal'], duration: 1150, reducedMotion: 'immediate',
    description: 'A low, banked two-round pitch with a soft felt landing.', parameters: commonParameters(1150),
    build(context) {
      const order = dealOrder(context), count = context.event.cards.length;
      return context.event.cards.map(card => {
        const visual = context.card(card), target = rectCenter(card.target);
        const start = (order.get(card.id) ?? 0) / Math.max(1, count - 1) * .5;
        return track(t => {
          const u = range(t, start, start + .5), v = smoother(u), arc = envelope(u);
          settleObject(visual, card, u, { x: mix(context.event.origin.x, target.x, v), y: mix(context.event.origin.y, target.y, v) - arc * card.target.height * .12,
            z: arc * 14, rz: arc * (target.x < context.center.x ? -9 : 9), scale: mix(.88, 1, v), opacity: t < start ? 0 : 1 });
        });
      });
    } },
  { id: 'flop.cascade', name: 'Silk Cascade', category: 'flop', supportedEvents: ['flop'], duration: 1050, reducedMotion: 'immediate',
    description: 'Three public cards roll into place with a measured, overlapping cadence.', parameters: commonParameters(1050),
    build(context) { return context.event.cards.map((card, index) => { const visual = context.card(card), c = rectCenter(card.target);
      return track(t => { const u = range(t, index * .13, .72 + index * .13), v = smoother(u);
        settleObject(visual, card, u, { x: c.x, y: c.y - (1-v) * card.target.height * .24, z: envelope(u) * 18, rx: (1-v) * -64,
          rz: (1-v) * -3, scale: mix(.96, 1, v), opacity: t < index * .13 ? 0 : 1 }); }); }); } },
  ...(['turnover', 'squeeze'] as const).map((name): AnimationPreset => ({
    id: `reveal.${name}`, name: name === 'turnover' ? 'Velvet Turnover' : 'River Squeeze', category: 'reveal', supportedEvents: ['turn','river'],
    duration: name === 'squeeze' ? 1450 : 950, reducedMotion: 'immediate',
    description: name === 'squeeze' ? 'A patient edge lift resolves into a clean river reveal.' : 'A restrained lift and turnover that lands without a shockwave.',
    parameters: commonParameters(name === 'squeeze' ? 1450 : 950),
    build(context) { return context.event.cards.slice(0,1).map(card => { const visual = context.card(card), c = rectCenter(card.target);
      return track(t => { const v = smoother(name === 'squeeze' ? range(t, .18, .96) : t), arc = Math.sin(Math.PI * v);
        settleObject(visual, card, t, { x: c.x + arc * card.target.width * .06, y: c.y - arc * card.target.height * .09,
          z: arc * 24, ry: mix(178,0,v), rz: arc * -2, opacity: 1 }); }); }); }
  }))
];
