import type { Point3, Rect } from '../../types';

export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const range = (t: number, start: number, end: number): number => clamp((t - start) / Math.max(0.00001, end - start));
export const smooth = (t: number): number => { const u = clamp(t); return u * u * (3 - 2 * u); };
export const smoother = (t: number): number => { const u = clamp(t); return u * u * u * (u * (u * 6 - 15) + 10); };
export const easeOut = (t: number): number => 1 - (1 - clamp(t)) ** 3;
export const easeIn = (t: number): number => clamp(t) ** 3;
export const envelope = (t: number): number => Math.sin(Math.PI * clamp(t));
export const damped = (t: number, strength = 1): number => Math.sin(clamp(t) * Math.PI * 3) * Math.exp(-8 * clamp(t)) * (1 - clamp(t)) * strength;

export function point(x: number, y: number, z = 0): Point3 { return { x, y, z }; }
export function lerpPoint(a: Point3, b: Point3, t: number): Point3 {
  return point(mix(a.x, b.x, t), mix(a.y, b.y, t), mix(a.z ?? 0, b.z ?? 0, t));
}
export function rectCenter(rect: Rect): Point3 { return point(rect.x + rect.width / 2, rect.y + rect.height / 2); }
export function cardCenter(cards: { target: Rect }[]): Point3 {
  if (!cards.length) return point(0, 0);
  return point(cards.reduce((sum, card) => sum + card.target.x + card.target.width / 2, 0) / cards.length,
    cards.reduce((sum, card) => sum + card.target.y + card.target.height / 2, 0) / cards.length);
}

export function cubic(a: Point3, b: Point3, c: Point3, d: Point3, t: number): Point3 {
  const u = clamp(t), v = 1 - u;
  return point(v ** 3 * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u ** 3 * d.x,
    v ** 3 * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u ** 3 * d.y,
    v ** 3 * (a.z ?? 0) + 3 * v * v * u * (b.z ?? 0) + 3 * v * u * u * (c.z ?? 0) + u ** 3 * (d.z ?? 0));
}

export function cubicTangent(a: Point3, b: Point3, c: Point3, d: Point3, t: number): Point3 {
  const u = clamp(t), v = 1 - u;
  return point(3 * v * v * (b.x - a.x) + 6 * v * u * (c.x - b.x) + 3 * u * u * (d.x - c.x),
    3 * v * v * (b.y - a.y) + 6 * v * u * (c.y - b.y) + 3 * u * u * (d.y - c.y),
    3 * v * v * ((b.z ?? 0) - (a.z ?? 0)) + 6 * v * u * ((c.z ?? 0) - (b.z ?? 0)) + 3 * u * u * ((d.z ?? 0) - (c.z ?? 0)));
}

/** Deterministic replay; never used for game state or card identities. */
export const noise = (index: number, seed = 1): number => {
  const n = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123;
  return n - Math.floor(n);
};

export interface Formation {
  center: Point3;
  radiusX: number;
  radiusY: number;
  depth: number;
  phase: number;
  arc: number;
}

/** Members share this moving center/phase; offset represents their formation slot. */
export function formationAt(formation: Formation, time: number, offset: number): Point3 {
  const angle = formation.phase + formation.arc * time + offset;
  return point(formation.center.x + Math.cos(angle) * formation.radiusX,
    formation.center.y + Math.sin(angle) * formation.radiusY - Math.sin(Math.PI * time) * formation.radiusY * 0.15,
    (formation.center.z ?? 0) + Math.sin(angle) * formation.depth);
}

/** Finite derivative gives a tangent matched departure from any shared trajectory. */
export function peelFrom(path: (time: number) => Point3, departure: number, end: number, target: Point3, time: number): Point3 {
  if (time <= departure) return path(time);
  if (time >= end) return target;
  const start = path(departure), epsilon = 0.001;
  const before = path(departure - epsilon), after = path(departure + epsilon);
  const dt = end - departure;
  const control = point(start.x + (after.x - before.x) / (2 * epsilon) * dt / 3,
    start.y + (after.y - before.y) / (2 * epsilon) * dt / 3,
    (start.z ?? 0) + ((after.z ?? 0) - (before.z ?? 0)) / (2 * epsilon) * dt / 3);
  // Final repeated control gives zero terminal velocity without stopping at departure.
  return cubic(start, control, target, target, (time - departure) / dt);
}
