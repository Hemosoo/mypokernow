import type { AnimationPreset } from '../../core/types';
import { constructionTracks } from '../../fragments/construction';
import { commonParameters, parameter } from '../shared';

export const crystallization: AnimationPreset = {
  id: 'reveal.crystallization', name: 'Crystallization Reveal', category: 'reveal', supportedEvents: ['turn', 'river'], duration: 1850, reducedMotion: 'immediate',
  description: 'Actual pieces of the card artwork seed its silhouette, then accelerate into a complete physical card.',
  parameters: [...commonParameters(1850), parameter('fragments', 'Artwork fragments', 20, 40, 1, 32),
    parameter('spread', 'Fragment spread', 0.4, 1.7, 0.05, 1), parameter('depth', 'Depth variation', 0.2, 1.5, 0.05, 0.9),
    parameter('acceleration', 'Assembly acceleration', 1.2, 3.5, 0.1, 2.3), parameter('rotation', 'Fragment rotation', 0, 1.4, 0.05, 0.85),
    parameter('pulse', 'Crystal pulse', 0, 1, 0.05, 0.4), parameter('riverBoost', 'River emphasis', 1, 1.2, 0.025, 1.15, '×')],
  build: context => constructionTracks(context, false),
};
