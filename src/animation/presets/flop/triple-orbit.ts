import type { AnimationPreset } from '../../core/types';
import { envelope, formationAt, lerpPoint, mix, peelFrom, point, range, rectCenter, smoother, type Formation } from '../../primitives/motion';
import { commonParameters, parameter, settleObject, track } from '../shared';

export const tripleOrbit: AnimationPreset = {
  id: 'flop.triple-orbit', name: 'Triple Orbit', category: 'flop', supportedEvents: ['flop'], duration: 1650, reducedMotion: 'immediate',
  description: 'Three faces cross in depth through a shared elliptical flourish before a tangent-matched release.',
  parameters: [...commonParameters(1650), parameter('radius', 'Orbit radius', 0.6, 1.7, 0.05, 1),
    parameter('arc', 'Orbit arc', 0.65, 1.6, 0.05, 1.15, 'π'), parameter('tilt', 'Orbit tilt', 0.15, 0.65, 0.025, 0.38),
    parameter('depth', 'Depth crossing', 0.2, 1.5, 0.05, 0.9), parameter('flip', 'Flip timing', 0.15, 0.38, 0.01, 0.24),
    parameter('departure', 'Departure overlap', 0.46, 0.65, 0.01, 0.55)],
  build(context) {
    const p = context.parameters, cards = context.event.cards, width = cards[0]?.target.width ?? 65;
    const formation: Formation = { center: context.center, radiusX: width * p.radius! * 1.25,
      radiusY: width * p.radius! * p.tilt!, depth: width * p.depth! * context.intensity,
      phase: -Math.PI * 0.65, arc: Math.PI * p.arc! };
    return cards.map((card, index) => {
      const visual = context.card(card), offset = index * Math.PI * 2 / Math.max(1, cards.length), target = rectCenter(card.target);
      const start = point(context.center.x + (index - 1) * width * 0.17, context.center.y - width * 0.9, 40 - index * 20);
      const path = (time: number) => lerpPoint(start, formationAt(formation, time, offset), smoother(range(time, 0, 0.23)));
      const departure = p.departure! + index * 0.013;
      return track(t => {
        const position = peelFrom(path, departure, 0.97, target, t), exit = smoother(range(t, departure, 0.97));
        const phase = formation.phase + t * formation.arc + offset;
        settleObject(visual, card, t, { x: position.x, y: position.y, z: position.z,
          rx: Math.sin(phase) * 17 * (1 - exit) * envelope(t), rz: Math.cos(phase) * 14 * (1 - exit) * envelope(t),
          ry: card.identity ? mix(180, 0, smoother(range(t, p.flip! + index * 0.015, 0.73))) : 0,
          scale: mix(0.9, 1, smoother(t)) });
      });
    });
  },
};
