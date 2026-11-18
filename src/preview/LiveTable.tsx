import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { AnimationHandle } from '../animation/core/coordinator';
import { getPreset } from '../animation/registry';
import { streetForEvent, type CompanionAction, type Settings, type Street, type Theme, type VisualEvent } from '../types';
import type { PreviewHandle } from './PreviewTable';
import './preview.css';

/**
 * The studio's live preview: the replica table inside a same-origin frame,
 * dressed and animated by the exact Runtime the content script runs on
 * PokerNow. Skin, chips, stage moments and card presets all appear as they
 * will at the table. The frame keeps PokerNow's class names and rem scaling
 * away from the studio's own document.
 */
interface ReplicaControl {
  configure(theme: Theme, settings: Settings): void;
  setPlayers(count: number): void;
  play(street: Street): Promise<void>;
  loop(): Promise<void>;
  hand(): Promise<boolean>;
  stop(): void;
  rest(street?: Street): void;
  onAnimation(listener: ((handle: AnimationHandle, event?: VisualEvent) => void) | undefined): void;
  companion(action: CompanionAction): boolean;
  companionAt(): { x: number; y: number } | undefined;
}

export interface LiveTableHandle extends PreviewHandle {
  /** One complete scripted hand; resolves when the winner has been shown. */
  playHand: () => Promise<void>;
  /** Ask the table companion to act something out. False when it cannot right now. */
  companion: (action: CompanionAction) => boolean;
  /** Where the companion stands, as fractions (0–1) of the table frame; undefined when absent. */
  companionAt: () => { x: number; y: number } | undefined;
}

interface Props {
  theme: Theme;
  settings: Settings;
  players: number;
  /** Preview playback rate (1 = as on PokerNow). Multiplies the gameplay speed setting; never saved. */
  rate: number;
  /** Show the table exactly as PokerNow draws it, without the theme (hold-to-compare). */
  original?: boolean;
  /** During a full hand: the street whose animation is playing now. */
  onMoment?: (street: Street | undefined) => void;
  onPlaying: (playing: boolean) => void;
  onProgress: (progress: number) => void;
  onError: (message: string) => void;
  /** The frame has loaded and the table can play. */
  onReady?: () => void;
}

/** jsdom and some embedded browsers cannot load frames; the studio falls back to the effect lab there. */
export const liveTableSupported = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.navigator) && !/jsdom/i.test(window.navigator.userAgent);

export const LiveTable = forwardRef<LiveTableHandle, Props>(function LiveTable(props, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const control = useRef<ReplicaControl | null>(null);
  const active = useRef<AnimationHandle | null>(null);
  const generation = useRef(0);
  const last = useRef<{ street: Street; presetId?: string }>({ street: 'flop' });
  const current = useRef(props);
  current.current = props;
  const [ready, setReady] = useState(false);

  const settingsFor = (override?: Partial<Settings>): Settings => {
    const { settings, rate, original } = current.current;
    return { ...settings, ...(original ? { enabled: false } : {}), ...override, speed: Math.max(0.25, settings.speed * rate) };
  };

  // Attach to the frame once its page has published its control surface.
  useEffect(() => {
    let disposed = false, timer = 0;
    const attach = (): void => {
      if (disposed) return;
      const replica = (frame.current?.contentWindow as (Window & { __pncReplica?: ReplicaControl }) | null | undefined)?.__pncReplica;
      if (!replica) { timer = window.setTimeout(attach, 60); return; }
      control.current = replica;
      replica.configure(structuredClone(current.current.theme), settingsFor());
      replica.setPlayers(current.current.players);
      setReady(true);
      current.current.onReady?.();
    };
    attach();
    return () => {
      disposed = true;
      clearTimeout(timer);
      generation.current += 1;
      control.current?.onAnimation(undefined);
      control.current?.stop();
      control.current = null;
    };
  }, []);

  useEffect(() => { if (ready) control.current?.configure(structuredClone(props.theme), settingsFor()); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, props.theme, props.settings, props.rate, props.original]);
  useEffect(() => { if (ready) control.current?.setPlayers(props.players); }, [ready, props.players]);

  function finish(version: number): void {
    if (version !== generation.current) return;
    active.current = null;
    current.current.onPlaying(false);
    current.current.onProgress(1);
  }

  async function play(street: Street, presetId?: string): Promise<void> {
    const replica = control.current;
    const version = ++generation.current;
    last.current = { street, presetId };
    active.current?.cancel();
    active.current = null;
    if (!replica) return;
    const { theme, settings } = current.current;
    current.current.onProgress(0);
    current.current.onPlaying(true);
    if (!settings.enabled) { finish(version); return; }
    // Preview a preset other than the saved assignment at its default tuning.
    let previewTheme = theme;
    if (presetId && presetId !== theme.animations[street].preset) {
      const preset = getPreset(presetId);
      if (preset) previewTheme = { ...theme, animations: { ...theme.animations, [street]: { preset: presetId,
        parameters: Object.fromEntries(preset.parameters.map((parameter) => [parameter.key, parameter.default])) } } };
    }
    replica.configure(structuredClone(previewTheme), settingsFor());
    const started = new Promise<AnimationHandle | undefined>((resolve) => {
      const timeout = window.setTimeout(() => resolve(undefined), 2400);
      replica.onAnimation((handle) => { clearTimeout(timeout); resolve(handle); });
    });
    try {
      await replica.play(street);
      const handle = await started;
      replica.onAnimation(undefined);
      if (version !== generation.current) return;
      if (!handle) { finish(version); return; }
      active.current = handle;
      const tick = (): void => {
        if (version !== generation.current || active.current !== handle) return;
        current.current.onProgress(handle.progress);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      await handle.finished;
    } catch (error) {
      current.current.onError(error instanceof Error ? error.message : 'The preview could not finish.');
    } finally {
      if (previewTheme !== theme && version === generation.current) replica.configure(structuredClone(current.current.theme), settingsFor());
      finish(version);
    }
  }

  useImperativeHandle(ref, () => ({
    play,
    replay: () => play(last.current.street, last.current.presetId),
    reset: () => {
      generation.current += 1;
      control.current?.onAnimation(undefined);
      current.current.onMoment?.(undefined);
      active.current?.cancel();
      active.current = null;
      control.current?.rest('deal');
      current.current.onPlaying(false);
      current.current.onProgress(0);
    },
    companion: (action) => control.current?.companion(action) ?? false,
    companionAt: () => {
      const at = control.current?.companionAt(), box = frame.current;
      if (!at || !box || !box.clientWidth || !box.clientHeight) return undefined;
      return { x: at.x / box.clientWidth, y: at.y / box.clientHeight };
    },
    pause: () => active.current?.pause(),
    resume: () => active.current?.resume(),
    playHand: async () => {
      const replica = control.current;
      const version = ++generation.current;
      active.current?.cancel();
      active.current = null;
      if (!replica) return;
      current.current.onProgress(0);
      current.current.onPlaying(true);
      replica.configure(structuredClone(current.current.theme), settingsFor());
      replica.onAnimation((handle, event) => {
        if (version !== generation.current) return;
        active.current = handle;
        current.current.onMoment?.(event ? streetForEvent(event.type) : undefined);
        const tick = (): void => {
          if (version !== generation.current || active.current !== handle) return;
          current.current.onProgress(handle.progress);
          if (handle.progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      try { await replica.hand(); } finally {
        if (version === generation.current) {
          replica.onAnimation(undefined);
          active.current = null;
          current.current.onMoment?.(undefined);
          current.current.onPlaying(false);
          current.current.onProgress(1);
        }
      }
    },
  }));

  return <div className={`live-table ${ready ? 'is-ready' : ''}`} data-testid="live-table">
    <iframe ref={frame} className="live-table-frame" src="./preview.html?embed=1" title="Live table preview" tabIndex={-1} />
    {!ready && <div className="live-table-loading">Setting the table…</div>}
  </div>;
});
