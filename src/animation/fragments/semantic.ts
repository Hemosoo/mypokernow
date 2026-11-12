import { artOptions, cardSvg, createCardElement } from '../../rendering/cards';
import type { Theme, VisualCard } from '../../types';
import type { VisualObject } from '../core/types';
import { baseElement, object } from '../primitives/objects';

export interface SemanticArtwork {
  id: string;
  kind: 'rank' | 'suit' | 'art' | 'body';
  center: { x: number; y: number };
  visual: VisualObject;
}

/** Split the locally rendered SVG's actual symbols, preserving inherited ink and
 * source transforms. Unlike physical fragments, these are transparent rank,
 * suit, pip and court layers, with one separate background/border layer.
 * Only our renderer's SVG is parsed, never a website's hidden card structure.
 */
export function semanticArtwork(card: VisualCard, theme: Theme, parent: HTMLElement): SemanticArtwork[] {
  const parsed = new DOMParser().parseFromString(cardSvg(card.identity, theme.card, artOptions(theme)), 'image/svg+xml');
  const source = parsed.documentElement;
  const result: SemanticArtwork[] = [];
  const create = (id: string, kind: SemanticArtwork['kind'], svg: Element, center: { x: number; y: number }): void => {
    const element = baseElement(card, parent);
    element.dataset.pncSemantic = id;
    if (kind === 'body') {
      const resting = createCardElement(card, theme);
      element.style.boxShadow = resting.style.boxShadow;
      element.style.borderRadius = resting.style.borderRadius;
    }
    element.style.transformOrigin = `${center.x * 100}% ${center.y * 100}%`;
    const artwork = document.createElement('img');
    artwork.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    artwork.alt = '';
    Object.assign(artwork.style, { width: '100%', height: '100%', display: 'block', pointerEvents: 'none' });
    element.append(artwork);
    parent.append(element);
    result.push({ id, kind, center, visual: object(element) });
  };

  // Every layer carries its own paint servers: SVG images cannot resolve
  // gradients from another image. Keep the renderer's exact paths and transforms.
  const parts = Array.from(source.querySelectorAll('[data-part]'));
  const layer = (part?: Element): Element => {
    const svg = source.cloneNode(true) as Element;
    for (const node of Array.from(svg.querySelectorAll('[data-part]'))) {
      if (!part || node.getAttribute('data-id') !== part.getAttribute('data-id')) node.remove();
    }
    if (part) {
      for (const node of Array.from(svg.children)) {
        if (node.tagName.toLowerCase() !== 'defs' && !node.hasAttribute('data-part')) node.remove();
      }
    }
    return svg;
  };
  for (const part of parts) {
    const kind = part.getAttribute('data-part') as SemanticArtwork['kind'];
    const center = { x: Number(part.getAttribute('data-cx')), y: Number(part.getAttribute('data-cy')) };
    create(part.getAttribute('data-id')!, kind, layer(part), center);
  }
  create('card-body', 'body', layer(), { x: 0.5, y: 0.5 });
  return result;
}
