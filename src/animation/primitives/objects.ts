import type { Theme, VisualCard } from '../../types';
import { cardDataUrl, createCardElement } from '../../rendering/cards';
import type { Pose, VisualObject } from '../core/types';

export function applyPose(element: HTMLElement, pose: Pose): void {
  const scale = pose.scale ?? 1;
  element.style.transform = `translate3d(${pose.x.toFixed(3)}px,${pose.y.toFixed(3)}px,${(pose.z ?? 0).toFixed(3)}px) rotateX(${(pose.rx ?? 0).toFixed(3)}deg) rotateY(${(pose.ry ?? 0).toFixed(3)}deg) rotateZ(${(pose.rz ?? 0).toFixed(3)}deg) scale(${(scale * (pose.scaleX ?? 1)).toFixed(5)},${(scale * (pose.scaleY ?? 1)).toFixed(5)})`;
  element.style.opacity = String(pose.opacity ?? 1);
  // Separate layers actually pass in front of and behind each other as depth changes.
  element.style.zIndex = String(Math.round(1000 + (pose.z ?? 0)));
}

export function object(element: HTMLElement): VisualObject {
  return { element, set: pose => applyPose(element, pose), remove: () => element.remove() };
}

export function baseElement(card: VisualCard, parent: HTMLElement): HTMLDivElement {
  const element = document.createElement('div');
  Object.assign(element.style, {
    position: 'absolute', left: '0', top: '0', width: `${card.target.width}px`, height: `${card.target.height}px`,
    pointerEvents: 'none', transformStyle: 'preserve-3d', transformOrigin: '50% 50%', willChange: 'transform, opacity',
  });
  parent.append(element);
  return element;
}

/** Front and back share measured dimensions; unknown descriptors always use back artwork. */
export function cardObject(card: VisualCard, theme: Theme, parent: HTMLElement): VisualObject {
  const element = baseElement(card, parent);
  element.dataset.pncCard = card.id;
  for (const [isBack, artwork] of [[false, createCardElement(card, theme)], [true, createCardElement({ ...card, identity: undefined, source: undefined }, theme)]] as const) {
    Object.assign(artwork.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%', margin: '0',
      backfaceVisibility: 'hidden', transform: isBack ? 'rotateY(180deg)' : 'rotateY(0deg)',
    });
    element.append(artwork);
  }
  return object(element);
}

export function artworkImage(card: VisualCard, theme: Theme): HTMLImageElement {
  const image = document.createElement('img');
  image.src = cardDataUrl(card.identity, theme.card);
  image.alt = '';
  image.draggable = false;
  Object.assign(image.style, { display: 'block', position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  return image;
}

export function pulse(parent: HTMLElement, x: number, y: number, width: number, height: number, color: string): VisualObject {
  const element = document.createElement('div');
  Object.assign(element.style, {
    position: 'absolute', left: '0', top: '0', width: `${width}px`, height: `${height}px`,
    border: `1px solid ${color}`, borderRadius: '50%', boxSizing: 'border-box', pointerEvents: 'none',
    boxShadow: `0 0 22px ${color}`, opacity: '0',
  });
  parent.append(element);
  const result = object(element);
  result.set({ x: x - width / 2, y: y - height / 2, opacity: 0 });
  return result;
}
