import type { AnimationPreset } from '../../core/types';
import { cubic, cubicTangent, envelope, mix, point, range, rectCenter, smooth } from '../../primitives/motion';
import { commonParameters, dealOrder, parameter, settleObject, track } from '../shared';

export const dealerFlick: AnimationPreset = {
  id: 'deal.dealer-flick', name: 'Dealer Flick', category: 'deal', supportedEvents: ['deal'], duration: 1200, reducedMotion: 'immediate',
  description: 'A crisp two-round deal, flicked from one deck along tactile, banked trajectories.',
  parameters: [...commonParameters(1200), parameter('stagger', 'Round stagger', 0.15, 0.55, 0.025, 0.40),
    parameter('curvature', 'Flight curvature', 0.1, 1, 0.05, 0.45), parameter('lift', 'Card lift', 0.2, 1.8, 0.05, 0.8),
    parameter('rotation', 'Bank / rotation', 0, 1.5, 0.05, 0.7), parameter('settle', 'Tactile settle', 0, 1.5, 0.05, 0.5)],
  build(context) {
    const p = context.parameters, order = dealOrder(context), count = context.event.cards.length;
    return context.event.cards.map(card => {
      const visual = context.card(card), target = rectCenter(card.target), origin = point(context.event.origin.x, context.event.origin.y, 12);
      const dx = target.x - origin.x, dy = target.y - origin.y, length = Math.hypot(dx, dy) || 1;
      const arc = card.target.width * p.curvature! * context.intensity;
      const bendX = -dy / length * arc, bendY = dx / length * arc;
      const lift = card.target.height * p.lift! * context.intensity;
      const c1 = point(origin.x + dx * 0.24 + bendX, origin.y + dy * 0.24 + bendY, lift);
      const c2 = point(target.x - dx * 0.19 + bendX * 0.35, target.y - dy * 0.19 + bendY * 0.35, lift * 0.28);
      const start = count > 1 ? (order.get(card.id) ?? 0) / (count - 1) * p.stagger! : 0;
      const flight = 1 - p.stagger!;
      return track(group => {
        const t = range(group, start, start + flight), travel = 1 - (1 - t) ** 2.15;
        const position = cubic(origin, c1, c2, target, travel), tangent = cubicTangent(origin, c1, c2, target, travel);
        const heading = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;
        // Heading informs a restrained bank; no card spins through a full revolution.
        const bank = Math.sin(heading * Math.PI / 180) * 15 * p.rotation! * envelope(t) * context.intensity;
        const settling = range(t, 0.76, 1);
        const bounce = Math.sin(settling * Math.PI * 2) * (1 - settling) ** 2 * p.settle! * 3;
        settleObject(visual, card, t, { x: position.x, y: position.y + bounce, z: position.z,
          rx: -12 * envelope(t) * p.rotation!, ry: card.identity ? mix(180, 0, smooth(range(t, 0.56, 0.91))) : 0,
          rz: bank, scale: mix(0.82, 1, smooth(t)), opacity: group < start ? 0 : 1 });
      });
    });
  },
};
