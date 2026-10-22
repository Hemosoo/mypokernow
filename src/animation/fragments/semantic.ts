import { cardSemanticRegions, cardSvg } from '../../rendering/cards';
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
  const parsed = new DOMParser().parseFromString(cardSvg(card.identity, theme.card), 'image/svg+xml');
  const source = parsed.documentElement;
  const ink = Array.from(source.children).find(child => child.tagName.toLowerCase() === 'g');
  const components = ink ? Array.from(ink.children) : [];
  const descriptors = cardSemanticRegions(card.identity);
  const result: SemanticArtwork[] = [];
  const create = (id: string, kind: SemanticArtwork['kind'], svg: Element, center: { x: number; y: number }): void => {
    const element = baseElement(card, parent);
    element.dataset.pncSemantic = id;
    element.style.transformOrigin = `${center.x * 100}% ${center.y * 100}%`;
    const artwork = document.createElement('img');
    artwork.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
    artwork.alt = '';
    Object.assign(artwork.style, { width: '100%', height: '100%', display: 'block', pointerEvents: 'none' });
    element.append(artwork);
    parent.append(element);
    result.push({ id, kind, center, visual: object(element) });
  };

  if (!card.identity || !ink || components.length < 3) {
    create('card-body', 'body', source, { x: 0.5, y: 0.5 });
    return result;
  }
  const makeLayer = (component: Element): Element => {
    const svg = source.cloneNode(false) as Element;
    const group = ink.cloneNode(false) as Element;
    group.append(component.cloneNode(true));
    svg.append(group);
    return svg;
  };
  const addComponent = (id: string, kind: SemanticArtwork['kind'], component: Element, regionIndex: number): void => {
    const region = descriptors[regionIndex];
    const center = region ? { x: (region.x + region.width / 2) / 100, y: (region.y + region.height / 2) / 140 } : { x: 0.5, y: 0.5 };
    create(id, kind, makeLayer(component), center);
  };
  addComponent('rank-top', 'rank', components[0]!, 0);
  addComponent('suit-top', 'suit', components[1]!, 1);
  const rotated = components[2]!;
  for (let index = 0; index < 2; index++) {
    const child = rotated.children[index];
    if (!child) continue;
    const group = rotated.cloneNode(false) as Element;
    group.append(child.cloneNode(true));
    addComponent(index === 0 ? 'rank-bottom' : 'suit-bottom', index === 0 ? 'rank' : 'suit', group, index === 0 ? 2 : 3);
  }
  const face = ['J', 'Q', 'K'].includes(card.identity.rank);
  components.slice(3).forEach((component, index) => addComponent(face ? 'court' : `pip-${index}`, face ? 'art' : 'suit', component, index + 4));
  const body = source.cloneNode(true) as Element;
  Array.from(body.children).find(child => child.tagName.toLowerCase() === 'g')?.remove();
  create('card-body', 'body', body, { x: 0.5, y: 0.5 });
  return result;
}
