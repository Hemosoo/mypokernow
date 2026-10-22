import type { AnimationPreset } from '../../core/types';
import { semanticArtwork } from '../../fragments/semantic';
import { baseElement, cardObject, object, pulse } from '../../primitives/objects';
import { clamp, envelope, mix, noise, range, rectCenter, smooth, smoother } from '../../primitives/motion';
import { commonParameters, parameter, track } from '../shared';

export const fragmentAssembly: AnimationPreset = {
  id: 'reveal.fragment-assembly', name: 'Fragment Assembly', category: 'reveal', supportedEvents: ['turn', 'river'], duration: 1750, reducedMotion: 'immediate',
  description: 'Ranks, suit symbols and coherent court artwork trace a shared field before identity and body lock together.',
  parameters: [...commonParameters(1750), parameter('spread', 'Symbol spread', 0.5, 1.8, 0.05, 1),
    parameter('arc', 'Component orbit', 0.15, 1, 0.05, 0.55, 'π'), parameter('stagger', 'Component stagger', 0, 0.12, 0.01, 0.055),
    parameter('bodyDelay', 'Body arrival', 0.5, 0.8, 0.025, 0.68), parameter('depth', 'Semantic depth', 0, 1.4, 0.05, 0.65),
    parameter('accent', 'Finishing accent', 0, 1, 0.05, 0.4), parameter('riverBoost', 'River emphasis', 1, 1.2, 0.025, 1.15, '×')],
  build(context) {
    const p = context.parameters;
    return context.event.cards.slice(0, 1).flatMap(card => {
      const center = rectCenter(card.target), parent = object(baseElement(card, context.layer));
      parent.set({ x: card.target.x, y: card.target.y });
      const components = semanticArtwork(card, context.theme, parent.element), complete = cardObject(card, context.theme, parent.element);
      const tracks = [track(t => complete.set({ x: 0, y: 0, opacity: t >= 0.985 ? 1 : 0 }))];
      components.forEach((component, index) => {
        const isBody = component.kind === 'body', isRank = component.kind === 'rank', isCourt = component.kind === 'art';
        const angle = -Math.PI * 0.8 + index * Math.PI * 2 / Math.max(1, components.length - 1);
        const radius = card.target.width * p.spread! * context.intensity * (isRank ? 0.95 : isCourt ? 0.7 : 1.2);
        const start = isBody ? p.bodyDelay! : isRank ? 0.02 : 0.06 + index * p.stagger! * 0.25;
        const arrival = isBody ? 0.96 : clamp((isRank ? 0.79 : isCourt ? 0.87 : 0.86) + noise(index, 2) * p.stagger!, 0.78, 0.96);
        tracks.push(track(t => {
          if (isBody) {
            const u = smoother(range(t, start, 0.96));
            component.visual.set({ x: 0, y: card.target.height * 0.08 * (1 - u), z: -12 * (1 - u), scale: mix(0.96, 1, u),
              opacity: t >= 0.985 ? 0 : u });
            component.visual.element.style.zIndex = '1';
            return;
          }
          const u = range(t, start, arrival), convergence = smoother(range(t, 0.39 + index * 0.006, arrival));
          const phase = angle + p.arc! * Math.PI * t;
          const localX = (component.center.x - 0.5) * card.target.width;
          const localY = (component.center.y - 0.5) * card.target.height;
          // Actual symbols float around one center, then aim at their exact source-art locations.
          const x = (Math.cos(phase) * radius - localX) * (1 - convergence);
          const y = (Math.sin(phase) * radius * 0.52 - localY) * (1 - convergence);
          component.visual.set({ x, y, z: (18 + Math.sin(phase) * card.target.width * p.depth!) * (1 - convergence),
            rz: Math.sin(phase) * 12 * (1 - convergence), rx: Math.cos(phase) * 12 * (1 - convergence),
            scale: mix(1.13, 1, convergence), opacity: t >= 0.985 ? 0 : smooth(range(u, 0, 0.16)) });
          // Body lives behind every meaningful component even when perspective crosses zero.
          component.visual.element.style.zIndex = String(20 + index);
        }));
      });
      const ring = pulse(context.layer, center.x, center.y, card.target.width * 1.3, card.target.height * 1.15, '#d8c5ff');
      tracks.push(track(t => {
        const u = range(t, 0.91, 1);
        ring.set({ x: center.x - card.target.width * 1.3 / 2, y: center.y - card.target.height * 1.15 / 2,
          scale: mix(0.92, 1.14, u), opacity: envelope(u) * p.accent! * 0.28 * context.intensity });
      }));
      return tracks;
    });
  },
};
