import type { Street } from '../../types';
import type { AnimationPreset } from '../core/types';
import { dealerFlick } from '../presets/deal/dealer-flick';
import { orbitDeal } from '../presets/deal/orbit';
import { tripleSpread } from '../presets/flop/triple-spread';
import { tripleOrbit } from '../presets/flop/triple-orbit';
import { crystalSpread } from '../presets/flop/crystal-spread';
import { slam } from '../presets/reveal/slam';
import { fragmentAssembly } from '../presets/reveal/fragment-assembly';
import { crystallization } from '../presets/reveal/crystallization';

export const presets: AnimationPreset[] = [dealerFlick, orbitDeal, tripleSpread, tripleOrbit, crystalSpread, slam, fragmentAssembly, crystallization];
const byId = new Map(presets.map(preset => [preset.id, preset]));
export const getPreset = (id: string): AnimationPreset | undefined => byId.get(id);
export const presetsForStreet = (street: Street): AnimationPreset[] => presets.filter(preset => preset.supportedEvents.includes(street));

/** Contributions only register compiled implementations; imported themes never become code. */
export function registerPreset(preset: AnimationPreset): void {
  if (byId.has(preset.id)) throw new Error(`Duplicate animation ID: ${preset.id}`);
  if (!preset.id || !preset.supportedEvents.length || !Number.isFinite(preset.duration) || preset.duration <= 0) throw new Error('Invalid animation preset');
  byId.set(preset.id, preset);
  presets.push(preset);
}

export type { AnimationPreset, ParameterSchema } from '../core/types';
