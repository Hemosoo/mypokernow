import type { AnimationPreset } from '../../core/types';
import { constructionTracks } from '../../fragments/construction';
import { commonParameters, parameter } from '../shared';

export const crystalSpread: AnimationPreset = {
  id: 'flop.crystal-spread', name: 'Crystal Spread', category: 'flop', supportedEvents: ['flop'], duration: 2300, reducedMotion: 'immediate',
  description: 'A shared geometric field builds three incomplete faces as they drift apart into the board.',
  parameters: [...commonParameters(2300), parameter('fragments', 'Fragments per card', 20, 40, 1, 30),
    parameter('spread', 'Construction field', 0.4, 1.6, 0.05, 1), parameter('depth', 'Fragment depth', 0.2, 1.4, 0.05, 0.9),
    parameter('acceleration', 'Assembly acceleration', 1.2, 3.5, 0.1, 2.5), parameter('drift', 'Outward card drift', 0.6, 1.5, 0.05, 1),
    parameter('rotation', 'Fragment rotation', 0.1, 1.2, 0.05, 0.7), parameter('pulse', 'Completion pulse', 0, 1, 0.05, 0.4)],
  build: context => constructionTracks(context, true),
};
