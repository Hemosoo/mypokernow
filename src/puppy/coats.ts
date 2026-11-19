import type { CatCoat, CatEyes, PuppyCoat, PuppyCollar } from '../types';

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

/**
 * The cat's coats: main fur, the lighter chest and paws, and markings. Tabby and
 * blue-grey have stripes; calico has orange and black patches; tuxedo is black with
 * a white bib and socks.
 */
export const CAT_COATS: Record<CatCoat, { name: string; fur: string; sheen: string; cream: string; stripe?: string; patchA?: string; patchB?: string }> = {
  tabby: { name: 'Orange tabby', fur: '#e9a45c', sheen: '#ffe0b5', cream: '#fff1de', stripe: '#b5652b' },
  tuxedo: { name: 'Tuxedo', fur: '#232126', sheen: '#6d6870', cream: '#f5f2ec' },
  calico: { name: 'Calico', fur: '#f6efe4', sheen: '#ffffff', cream: '#fffaf3', patchA: '#e3924a', patchB: '#2b2624' },
  black: { name: 'Black', fur: '#1c1b1f', sheen: '#5d5864', cream: '#2f2d33' },
  bluegrey: { name: 'Blue-grey', fur: '#8d98a6', sheen: '#dfe6ef', cream: '#d3d9e0', stripe: '#6b7685' },
};
export const CAT_EYES: Record<CatEyes, { name: string; iris: string }> = {
  green: { name: 'Green', iris: '#86c440' }, amber: { name: 'Amber', iris: '#e8a72a' }, blue: { name: 'Blue', iris: '#5aa9e6' },
};
