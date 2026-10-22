import type { AnimationPreset } from '../../core/types';
import { cubic, envelope, lerpPoint, mix, point, range, rectCenter, smooth, smoother } from '../../primitives/motion';
import { commonParameters, parameter, settleObject, track } from '../shared';

export const tripleSpread: AnimationPreset = {
  id: 'flop.triple-spread', name: 'Triple Spread', category: 'flop', supportedEvents: ['flop'], duration: 1250, reducedMotion: 'immediate',
  description: 'A single traveling stack opens into a precise three-card fan while the faces ripple into view.',
  parameters: [...commonParameters(1250), parameter('spread', 'Spread width', 0.5, 1.5, 0.05, 1),
    parameter('ripple', 'Flip ripple', 0, 0.12, 0.01, 0.045), parameter('lift', 'Stack lift', 0.2, 1.4, 0.05, 0.75),
    parameter('rotation', 'Fan / bank', 0, 1.4, 0.05, 0.7), parameter('settle', 'Settle', 0, 1, 0.05, 0.4)],
  build(context) {
    const p = context.parameters, center = context.center, height = context.event.cards[0]?.target.height ?? 90;
    const origin = point(context.event.origin.x, context.event.origin.y, 15);
    return context.event.cards.map((card, index) => {
      const visual = context.card(card), target = rectCenter(card.target), offset = index - (context.event.cards.length - 1) / 2;
      return track(t => {
        const group = cubic(origin, point(origin.x + (center.x - origin.x) * 0.3, origin.y - height * 0.4 * context.intensity, height * p.lift! * context.intensity),
          point(center.x, center.y - height * 0.16, height * p.lift! * 0.35 * context.intensity), center, smooth(t));
        const spread = smoother(range(t, 0.15, 0.91));
        // Spread and group travel continue together, with exact measured spacing at the end.
        const fan = Math.sin(spread * Math.PI) * 0.12 * p.spread! * context.intensity;
        const position = lerpPoint(group, point(target.x, target.y), spread);
        const settle = range(t, 0.8, 1), spring = Math.sin(settle * Math.PI * 2) * (1 - settle) ** 2 * p.settle!;
        settleObject(visual, card, t, { x: position.x + offset * card.target.width * (1 - spread) * 0.07 + (target.x - center.x) * fan,
          y: position.y + Math.abs(offset) * card.target.height * fan * 0.15 + spring * 2,
          z: (group.z ?? 0) * (1 - spread) + Math.abs(offset) * 8 * envelope(t),
          ry: card.identity ? mix(180, 0, smooth(range(t, 0.22 + index * p.ripple!, 0.76 + index * p.ripple!))) : 0,
          rx: -12 * envelope(t) * p.rotation! * context.intensity, rz: offset * 13 * envelope(t) * p.rotation! * context.intensity,
          scale: mix(0.9, 1, spread) });
      });
    });
  },
};
