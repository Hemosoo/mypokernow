import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { AnimationHandle } from '../animation/core/coordinator';
import { getPreset } from '../animation/registry';
import type { Settings, Street, Theme } from '../types';
import type { PreviewHandle } from './PreviewTable';

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
  stop(): void;
  rest(street?: Street): void;
  onAnimation(listener: ((handle: AnimationHandle) => void) | undefined): void;
}

export interface LiveTableHandle extends PreviewHandle {
  playHand: () => void;
}

interface Props {
  theme: Theme;
  settings: Settings;
  players: number;
  slow: boolean;
  onPlaying: (playing: boolean) => void;
  onProgress: (progress: number) => void;
  onError: (message: string) => void;
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
    const { settings, slow } = current.current;
    return { ...settings, ...override, speed: Math.max(0.25, settings.speed * (slow ? 0.4 : 1)) };
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
    [ready, props.theme, props.settings, props.slow]);
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
      active.current?.cancel();
      active.current = null;
      control.current?.rest('deal');
      current.current.onPlaying(false);
      current.current.onProgress(0);
    },
    pause: () => active.current?.pause(),
    resume: () => active.current?.resume(),
    playHand: () => {
      generation.current += 1;
      active.current?.cancel();
      active.current = null;
      current.current.onPlaying(false);
      void control.current?.loop();
    },
  }));

  return <div className={`live-table ${ready ? 'is-ready' : ''}`} data-testid="live-table">
    <iframe ref={frame} className="live-table-frame" src="./preview.html?embed=1" title="Live table preview" tabIndex={-1} />
    {!ready && <div className="live-table-loading">Setting the table…</div>}
  </div>;
});
