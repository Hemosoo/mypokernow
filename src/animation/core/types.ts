import type { Point3, Street, Theme, VisualCard, VisualEvent } from '../../types';

export interface ParameterSchema {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

/** Track offsets use normalized group time; properties on a track share one clock. */
export interface TimelineTrack {
  start: number;
  end: number;
  update: (progress: number) => void;
  cleanup?: () => void;
}

export interface Pose {
  x: number;
  y: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
}

export interface VisualObject {
  element: HTMLElement;
  set: (pose: Pose) => void;
  remove: () => void;
}

export interface AnimationContext {
  event: VisualEvent;
  theme: Theme;
  parameters: Record<string, number>;
  layer: HTMLElement;
  intensity: number;
  /** All geometry is in viewport pixels; artwork alone may use normalized coordinates. */
  center: Point3;
  card: (card: VisualCard) => VisualObject;
}

export interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  category: 'deal' | 'flop' | 'reveal';
  supportedEvents: Street[];
  duration: number;
  parameters: ParameterSchema[];
  reducedMotion: 'immediate';
  build: (context: AnimationContext) => TimelineTrack[];
}

export interface AnimationHandle {
  readonly finished: Promise<void>;
  readonly progress: number;
  pause(): void;
  resume(): void;
  cancel(): void;
  finish(): void;
}

export interface PlayOptions {
  speed?: number;
  reducedMotion?: boolean;
  presetId?: string;
  parameters?: Record<string, number>;
  onProgress?: (progress: number) => void;
}
