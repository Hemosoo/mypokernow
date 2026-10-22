import type { TimelineTrack } from './types';
import { clamp, range } from '../primitives/motion';

export interface TimelineOptions {
  duration: number;
  onProgress?: (progress: number) => void;
  onEnd: () => void;
  onError: (error: unknown) => void;
  beforeFrame?: () => boolean;
}

/** A single rAF clock synchronizes all properties without component rerenders. */
export class Timeline {
  private frame = 0;
  private started = 0;
  private elapsed = 0;
  private running = false;
  private done = false;
  private value = 0;
  constructor(private tracks: TimelineTrack[], private options: TimelineOptions) {}

  get progress(): number { return this.value; }

  start(): void {
    if (this.running || this.done) return;
    this.running = true;
    this.started = performance.now() - this.elapsed;
    this.tick(this.started + this.elapsed);
  }

  pause(): void {
    if (!this.running || this.done) return;
    this.elapsed = performance.now() - this.started;
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  finish(): void {
    if (this.done) return;
    try { this.sample(1); } catch (error) { this.options.onError(error); return; }
    this.stop();
    this.options.onEnd();
  }

  stop(): void {
    if (this.done) return;
    this.done = true;
    this.running = false;
    cancelAnimationFrame(this.frame);
    // Each cleanup is isolated: a broken contributor track cannot strand others.
    for (const track of this.tracks) {
      try { track.cleanup?.(); } catch { /* Source restoration is coordinator-owned. */ }
    }
    this.tracks = [];
  }

  private sample(progress: number): void {
    this.value = clamp(progress);
    for (const track of this.tracks) track.update(range(this.value, track.start, track.end));
    this.options.onProgress?.(this.value);
  }

  private tick = (now: number): void => {
    if (!this.running || this.done) return;
    try {
      if (this.options.beforeFrame && !this.options.beforeFrame()) { this.stop(); this.options.onEnd(); return; }
      this.elapsed = now - this.started;
      this.sample(this.elapsed / this.options.duration);
      if (this.value >= 1) { this.stop(); this.options.onEnd(); return; }
      this.frame = requestAnimationFrame(this.tick);
    } catch (error) { this.stop(); this.options.onError(error); }
  };
}
