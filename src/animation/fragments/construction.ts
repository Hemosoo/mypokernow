import { cardSemanticRegions } from '../../rendering/cards';
import type { VisualCard } from '../../types';
import type { AnimationContext, TimelineTrack } from '../core/types';
import { baseElement, cardObject, object, pulse } from '../primitives/objects';
import { clamp, envelope, mix, noise, range, rectCenter, smooth, smoother } from '../primitives/motion';
import { track } from '../presets/shared';
import { partitionArtwork, type ArtworkFragment, type Vertex } from './geometry';
import { clippedArtwork } from './objects';

function inside(p: Vertex, polygon: Vertex[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

/** Defer fragments that carry identity; edge/background shards seed first. */
export function constructionOrder(fragments: ArtworkFragment[], card: VisualCard): ArtworkFragment[] {
  const regions = card.identity ? cardSemanticRegions(card.identity) : [];
  const score = (fragment: ArtworkFragment): number => {
    let samples = 0, marked = 0;
    for (let row = 0; row < 16; row++) for (let column = 0; column < 12; column++) {
      const p = { x: (column + 0.5) / 12, y: (row + 0.5) / 16 };
      if (!inside(p, fragment.polygon)) continue;
      samples++;
      if (regions.some(region => p.x * 100 >= region.x && p.x * 100 <= region.x + region.width && p.y * 140 >= region.y && p.y * 140 <= region.y + region.height)) marked++;
    }
    return (samples ? marked / samples : 0) * 1.8 + (fragment.edge ? 0 : 0.4) + noise(Number(fragment.id.split('-')[1]), 12) * 0.08;
  };
  return [...fragments].sort((a, b) => score(a) - score(b));
}

/** Reusable physical construction; shared mode supplies ONE field and card drift
 * envelope for a board, rather than launching independent single-card reveals.
 */
export function constructionTracks(context: AnimationContext, shared: boolean): TimelineTrack[] {
  const p = context.parameters, cards = context.event.cards.slice(0, shared ? 3 : 1);
  const tracks: TimelineTrack[] = [], requested = Math.round(p.fragments ?? 30);
  const fragmentsPerCard = Math.min(requested, Math.floor(120 / Math.max(1, cards.length)));
  const width = cards[0]?.target.width ?? 65, height = cards[0]?.target.height ?? 91;
  const spread = (p.spread ?? 1) * context.intensity;
  const phase = -Math.PI * 0.65;
  const groupPosition = (card: VisualCard, t: number) => {
    const center = rectCenter(card.target);
    const drift = shared ? mix(clamp(0.24 / (p.drift ?? 1), 0.12, 0.45), 1, smoother(range(t, 0.08, 0.97))) : 1;
    return { x: context.center.x + (center.x - context.center.x) * drift,
      y: center.y - (shared ? height * 0.12 * envelope(t) : 0), z: shared ? height * 0.10 * envelope(t) : 0 };
  };
  cards.forEach((card, cardIndex) => {
    const group = object(baseElement(card, context.layer));
    group.element.dataset.pncConstruction = shared ? 'shared' : 'single';
    const pieces = constructionOrder(partitionArtwork(fragmentsPerCard), card);
    const assembled = cardObject(card, context.theme, group.element);
    tracks.push(track(t => {
      const position = groupPosition(card, t);
      group.set({ x: position.x - card.target.width / 2, y: position.y - card.target.height / 2, z: position.z });
      assembled.set({ x: 0, y: 0, opacity: t >= 0.988 ? 1 : 0 });
    }));
    let areaBefore = 0;
    pieces.forEach((fragment, index) => {
      const visual = clippedArtwork(card, context.theme, [fragment.polygon], group.element, fragment.center);
      visual.element.dataset.pncFragment = fragment.id;
      // Area-weighted scheduling makes the fraction locked represent visible artwork area.
      const fraction = (areaBefore + fragment.area / 2) / pieces.reduce((sum, piece) => sum + piece.area, 0);
      areaBefore += fragment.area;
      const acceleration = p.acceleration ?? 2.3;
      const arrival = 0.13 + Math.pow(fraction, 1 / acceleration) * 0.84;
      const start = Math.max(0, arrival - mix(0.32, 0.15, fraction));
      const angle = phase + index * 2.399963 + cardIndex * 0.22;
      const radius = width * (shared ? 2.8 : 2.2) * spread * mix(0.7, 1.4, noise(index, 7));
      const depth = (0.3 + noise(index, 11) * 0.9) * height * (p.depth ?? 0.9) * context.intensity;
      const rotation = (noise(index, 16) - 0.5) * 58 * (p.rotation ?? 0.8) * context.intensity;
      tracks.push(track(t => {
        const u = range(t, start, arrival), approach = smoother(u), local = groupPosition(card, t);
        // All fragments derive from a moving common field; no stationary detour precedes locking.
        const theta = angle + (shared ? 0.55 : 0.24) * Math.PI * t;
        const fieldX = context.center.x + Math.cos(theta) * radius;
        const fieldY = context.center.y + Math.sin(theta) * radius * 0.52;
        const sourceOffsetX = fieldX - local.x - (fragment.center.x - 0.5) * card.target.width;
        const sourceOffsetY = fieldY - local.y - (fragment.center.y - 0.5) * card.target.height;
        visual.set({ x: sourceOffsetX * (1 - approach), y: sourceOffsetY * (1 - approach),
          z: depth * (1 - approach), rx: rotation * 0.6 * (1 - approach), ry: rotation * (1 - approach),
          rz: rotation * (1 - approach), opacity: t >= 0.988 ? 0 : smooth(range(t, start, start + 0.045)) });
      }));
    });
  });
  const boardWidth = cards.length > 1 ? Math.max(...cards.map(card => card.target.x + card.target.width)) - Math.min(...cards.map(card => card.target.x)) : width;
  const ring = pulse(context.layer, context.center.x, context.center.y, boardWidth * 1.16, height * 1.16, '#a8efff');
  tracks.push(track(t => {
    const u = range(t, 0.94, 1), amplitude = (p.pulse ?? 0.45) * context.intensity;
    ring.set({ x: context.center.x - boardWidth * 1.16 / 2, y: context.center.y - height * 1.16 / 2,
      scale: mix(0.9, 1.17, u), opacity: Math.sin(u * Math.PI) * amplitude * 0.28 });
  }));
  return tracks;
}
