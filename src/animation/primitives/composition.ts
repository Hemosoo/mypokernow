import type { TimelineTrack } from '../core/types';

/** Place normalized reusable segments onto a parent clock, including overlaps. */
export function segment(tracks: TimelineTrack[], start: number, end: number): TimelineTrack[] {
  return tracks.map(track => ({ ...track, start: start + track.start * (end - start), end: start + track.end * (end - start) }));
}
export function parallel(...groups: TimelineTrack[][]): TimelineTrack[] { return groups.flat(); }
export function sequence(...groups: { tracks: TimelineTrack[]; weight?: number; overlap?: number }[]): TimelineTrack[] {
  const weights = groups.map(group => Math.max(0.001, group.weight ?? 1));
  // overlap belongs to the incoming segment, so it overlaps its predecessor.
  const overlaps = groups.map((group, index) => index === 0 ? 0 : Math.max(0, Math.min(group.overlap ?? 0, Math.min(weights[index - 1]!, weights[index]!) * 0.95)));
  const total = weights.reduce((sum, weight, index) => sum + weight - overlaps[index]!, 0) || 1;
  let cursor = 0;
  return groups.flatMap((group, index) => {
    cursor -= overlaps[index]! / total;
    const width = weights[index]! / total;
    const result = segment(group.tracks, cursor, cursor + width);
    cursor += width;
    return result;
  });
}
export function stagger(count: number, delay: number, factory: (index: number) => TimelineTrack[]): TimelineTrack[] {
  const span = 1 + Math.max(0, count - 1) * delay;
  return Array.from({ length: count }, (_, index) => segment(factory(index), index * delay / span, (index * delay + 1) / span)).flat();
}
