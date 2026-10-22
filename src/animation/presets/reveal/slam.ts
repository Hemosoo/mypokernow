import type { AnimationPreset } from '../../core/types';
import { object, pulse } from '../../primitives/objects';
import { clamp, envelope, mix, range, rectCenter, smooth, smoother } from '../../primitives/motion';
import { commonParameters, parameter, settleObject, track } from '../shared';

export const slam: AnimationPreset = {
  id: 'reveal.slam', name: 'Slam / Impact Reveal', category: 'reveal', supportedEvents: ['turn', 'river'], duration: 1200, reducedMotion: 'immediate',
  description: 'Elevated anticipation and a continuous flip collapse into a quick, forceful board impact.',
  parameters: [...commonParameters(1200), parameter('force', 'Impact force', 0.2, 1.6, 0.05, 1),
    parameter('anticipation', 'Anticipation', 0.14, 0.4, 0.01, 0.26), parameter('shake', 'Local shake', 0, 1.5, 0.05, 0.6),
    parameter('shockwave', 'Shockwave', 0, 1.5, 0.05, 0.75), parameter('travel', 'Travel / elevation', 0.5, 1.6, 0.05, 1),
    parameter('squash', 'Impact compression', 0, 1.3, 0.05, 0.75), parameter('riverBoost', 'River emphasis', 1, 1.2, 0.025, 1.15, '×')],
  build(context) {
    const p = context.parameters, force = clamp(p.force! * context.intensity, 0.1, 2.3), impact = 0.74;
    return context.event.cards.slice(0, 1).flatMap(card => {
      const visual = context.card(card), center = rectCenter(card.target), width = card.target.width, height = card.target.height;
      for (const child of Array.from(visual.element.children)) if (child instanceof HTMLElement) child.style.boxShadow = 'none';
      const focus = document.createElement('div');
      Object.assign(focus.style, { position: 'absolute', left: '0', top: '0', width: `${width * 3.4}px`, height: `${height * 1.5}px`,
        borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(4,7,14,.6),rgba(4,7,14,0) 70%)', pointerEvents: 'none' });
      context.layer.prepend(focus);
      const focusObject = object(focus), ring = pulse(context.layer, center.x, center.y, width * 1.8, height * 0.65, '#aaf4f0');
      const sparks = Array.from({ length: 7 }, () => {
        const spark = document.createElement('div');
        Object.assign(spark.style, { position: 'absolute', width: `${Math.max(2, width * 0.045)}px`, height: `${height * 0.07}px`,
          borderRadius: '2px', background: '#d6fffa', pointerEvents: 'none', opacity: '0', boxShadow: '0 0 6px #9ae5db' });
        context.layer.append(spark);
        return object(spark);
      });
      return [track(t => {
        const drop = range(t, p.anticipation!, impact), descent = drop ** 3;
        const anticipation = smoother(range(t, 0, p.anticipation!));
        const heightEnvelope = t < impact ? (1 - descent) * (0.92 + 0.08 * Math.sin(Math.PI * anticipation)) : 0;
        const response = range(t, impact, 1), vibration = Math.sin(response * Math.PI * 5) * Math.exp(-response * 7) * (1 - response);
        const compression = response === 0 ? 0 : Math.sin(Math.min(1, response * 4) * Math.PI) * Math.exp(-response * 5);
        settleObject(visual, card, t, { x: center.x + vibration * p.shake! * force * width * 0.035,
          y: center.y - heightEnvelope * height * 0.72 * p.travel!,
          z: heightEnvelope * height * 1.55 * p.travel!,
          rx: -16 * heightEnvelope, ry: card.identity ? mix(180, 0, smoother(range(t, 0.08, 0.64))) : 0,
          rz: -7 * heightEnvelope + vibration * p.shake! * 1.5,
          scaleX: 1 + compression * p.squash! * force * 0.06,
          scaleY: 1 - compression * p.squash! * force * 0.08 });
        visual.element.style.filter = `drop-shadow(0 ${mix(4, 22, heightEnvelope)}px ${mix(8, 30, heightEnvelope)}px rgba(0,0,0,${mix(0.28, 0.12, heightEnvelope)}))`;
        focusObject.set({ x: center.x - width * 1.7, y: center.y - height * 0.75,
          opacity: t < impact ? smooth(range(t, 0, 0.17)) * (1 - smooth(range(t, 0.59, impact))) * 0.27 : 0 });
        ring.set({ x: center.x - width * 0.9, y: center.y - height * 0.325,
          scale: mix(0.45, 2.1, Math.sqrt(response)), opacity: t < impact ? 0 : (1 - response) ** 2 * p.shockwave! * force * 0.47 });
        sparks.forEach((spark, index) => {
          const angle = (index / sparks.length) * Math.PI * 2 + 0.21;
          const distance = width * (0.45 + 1.3 * response) * force;
          spark.set({ x: center.x + Math.cos(angle) * distance, y: center.y + Math.sin(angle) * distance * 0.43,
            rz: angle * 180 / Math.PI + 90, scale: 1 - response * 0.8,
            opacity: t < impact ? 0 : envelope(range(response, 0, 0.65)) * 0.65 * p.shockwave! });
        });
      })];
    });
  },
};
