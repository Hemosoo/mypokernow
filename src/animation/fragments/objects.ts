import type { Theme, VisualCard } from '../../types';
import { artworkImage, baseElement, object } from '../primitives/objects';
import type { VisualObject } from '../core/types';
import { polygonClip, type Vertex } from './geometry';

/** Each child samples the same complete source at the exact same source coordinates.
 * Only the chosen region exists; there is no underlying complete-card decoration.
 */
export function clippedArtwork(card: VisualCard, theme: Theme, polygons: Vertex[][], parent: HTMLElement, origin?: Vertex): VisualObject {
  const element = baseElement(card, parent);
  if (origin) element.style.transformOrigin = `${origin.x * 100}% ${origin.y * 100}%`;
  for (const polygon of polygons) {
    const image = artworkImage(card, theme);
    image.style.clipPath = polygonClip(polygon);
    element.append(image);
  }
  return object(element);
}
