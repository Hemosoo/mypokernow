import type { VisualCard } from '../../types';
import type { AnimationContext, ParameterSchema, Pose, TimelineTrack, VisualObject } from '../core/types';
import { clamp, rectCenter } from '../primitives/motion';

export function parameter(key: string, label: string, min: number, max: number, step: number, value: number, unit?: string): ParameterSchema {
  return { key, label, min, max, step, default: value, ...(unit ? { unit } : {}) };
}
export function commonParameters(duration: number): ParameterSchema[] {
  return [parameter('duration', 'Duration', Math.max(400, Math.round(duration * 0.5 / 50) * 50), Math.min(3800, Math.round(duration * 1.8 / 50) * 50), 50, duration, 'ms'),
    parameter('speed', 'Preset speed', 0.4, 2, 0.1, 1, '×'), parameter('intensity', 'Intensity', 0.3, 1.7, 0.05, 1, '×')];
}
export function track(update: (progress: number) => void, start = 0, end = 1): TimelineTrack { return { start, end, update }; }
export function atCenter(card: VisualCard, pose: Pose): Pose {
  return { ...pose, x: pose.x - card.target.width / 2, y: pose.y - card.target.height / 2 };
}
export function finalPose(card: VisualCard): Pose { return { x: card.target.x, y: card.target.y }; }
export function settleObject(visual: VisualObject, card: VisualCard, progress: number, pose: Pose): void {
  visual.set(progress >= 1 ? finalPose(card) : atCenter(card, pose));
}
export function dealOrder(context: AnimationContext): Map<string, number> {
  const firstSeat = new Map<string, number>();
  const roundCounts = new Map<string, number>();
  const decorated = context.event.cards.map((card, index) => {
    const seat = card.seatId ?? `${Math.floor(index / 2)}`;
    const occurrence = roundCounts.get(seat) ?? 0;
    roundCounts.set(seat, occurrence + 1);
    if (!firstSeat.has(seat)) {
      const center = rectCenter(card.target);
      firstSeat.set(seat, Math.atan2(center.y - context.center.y, center.x - context.center.x));
    }
    return { card, round: card.round ?? occurrence, angle: firstSeat.get(seat) ?? 0, index };
  });
  decorated.sort((a, b) => a.round - b.round || a.angle - b.angle || a.index - b.index);
  return new Map(decorated.map((item, index) => [item.card.id, index]));
}
export function intensity(context: AnimationContext): number { return clamp(context.intensity, 0.2, 2); }
