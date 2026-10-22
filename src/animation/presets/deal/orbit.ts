import type { AnimationPreset } from '../../core/types';
import { envelope, formationAt, lerpPoint, mix, peelFrom, point, range, rectCenter, smoother, type Formation } from '../../primitives/motion';
import { commonParameters, dealOrder, parameter, settleObject, track } from '../shared';

export const orbitDeal: AnimationPreset = {
  id: 'deal.orbit', name: 'Orbit Deal', category: 'deal', supportedEvents: ['deal'], duration: 2150, reducedMotion: 'immediate',
  description: 'One sweeping 3D formation launches from the deck, then peels into two dealing waves.',
  parameters: [...commonParameters(2150), parameter('radius', 'Orbit radius', 0.6, 2.2, 0.05, 1.35),
    parameter('formation', 'Formation duration', 0.25, 0.55, 0.025, 0.4), parameter('spacing', 'Card spacing', 0.4, 1.4, 0.05, 0.85),
    parameter('stagger', 'Wave stagger', 0.08, 0.22, 0.01, 0.14), parameter('depth', 'Depth variation', 0.2, 1.5, 0.05, 0.8),
    parameter('rotation', 'Rotation intensity', 0, 1.3, 0.05, 0.65)],
  build(context) {
    const p = context.parameters, cards = context.event.cards, order = dealOrder(context);
    const width = cards.reduce((sum, card) => sum + card.target.width, 0) / Math.max(1, cards.length);
    const positions = cards.map(card => rectCenter(card.target));
    const spreadX = positions.length ? Math.max(...positions.map(pos => Math.abs(pos.x - context.center.x))) : width * 3;
    const radius = Math.min(width * p.radius! * 1.8, Math.max(width, spreadX * 0.68));
    const formation: Formation = { center: point(context.center.x, context.center.y, 30), radiusX: radius,
      radiusY: radius * 0.37, depth: width * p.depth! * context.intensity, phase: -Math.PI * 0.8, arc: Math.PI * 1.42 };
    const rounds = Math.max(1, new Set(cards.map(card => card.seatId ?? card.id)).size);
    return cards.map(card => {
      const visual = context.card(card), rank = order.get(card.id) ?? 0, wave = Math.floor(rank / rounds);
      const withinWave = rank % rounds, offset = (rank / Math.max(1, cards.length - 1) - 0.5) * Math.PI * 1.5 * p.spacing!;
      const target = rectCenter(card.target), launch = point(context.event.origin.x, context.event.origin.y, 5);
      const path = (time: number) => {
        const formationPoint = formationAt(formation, time, offset);
        // C2-continuous blend from common deck into a continuously moving formation.
        return lerpPoint(launch, formationPoint, smoother(range(time, 0, 0.24)));
      };
      const departure = p.formation! + wave * p.stagger! + withinWave / Math.max(1, rounds - 1) * 0.065;
      const arrival = Math.min(0.99, departure + 0.31);
      return track(t => {
        const position = peelFrom(path, departure, arrival, target, t), finish = smoother(range(t, departure, arrival));
        const angle = formation.phase + formation.arc * t + offset;
        const bank = Math.cos(angle) * 18 * p.rotation! * envelope(t) * (1 - finish);
        settleObject(visual, card, t >= arrival ? 1 : t, { x: position.x, y: position.y, z: position.z,
          rx: Math.sin(angle) * 18 * p.rotation! * (1 - finish),
          ry: card.identity ? 180 * (1 - smoother(range(t, departure + 0.06, arrival - 0.02))) : 0,
          rz: bank, scale: mix(0.88, 1, smoother(range(t, 0, arrival))) });
      });
    });
  },
};
