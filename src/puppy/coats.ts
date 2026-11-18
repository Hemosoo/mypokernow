import type { PuppyCoat, PuppyCollar } from '../types';

/**
 * Fur colourings: main coat, the cream of the chest and paws, and the darker ears.
 * Kept apart from the Three.js model so the studio can show swatches without loading the renderer.
 */
export const COATS: Record<PuppyCoat, { fur: string; sheen: string; cream: string; ear: string; earSheen: string }> = {
  golden: { fur: '#e2a15c', sheen: '#ffe2b8', cream: '#fff2dc', ear: '#9c5a33', earSheen: '#e0a77a' },
  chocolate: { fur: '#7b4a2c', sheen: '#c99572', cream: '#efd6ba', ear: '#47281a', earSheen: '#8a5a3e' },
  cream: { fur: '#f0dcba', sheen: '#fff6e6', cream: '#fffaf1', ear: '#cf9f6d', earSheen: '#f2cfa4' },
  midnight: { fur: '#33302f', sheen: '#77706c', cream: '#ddd5ca', ear: '#1d1a1a', earSheen: '#55504e' },
  silver: { fur: '#b8bcc3', sheen: '#eef1f5', cream: '#f6f6f3', ear: '#777b84', earSheen: '#b3b7bf' },
};
export const COLLARS: Record<PuppyCollar, string> = { ruby: '#d8475f', sapphire: '#3f6fd8', emerald: '#2f9d6a', violet: '#8b5cf6' };
