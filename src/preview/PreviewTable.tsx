import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { AnimationCoordinator } from '../animation/core/coordinator';
import { getPreset } from '../animation/registry';
import { cardDataUrl } from '../rendering/cards';
import type { CardIdentity, Rect, Settings, Street, Theme, VisualCard, VisualEvent } from '../types';

const BOARD: CardIdentity[] = [
  { rank: 'A', suit: 'spades' }, { rank: 'K', suit: 'hearts' },
  { rank: '7', suit: 'clubs' }, { rank: 'Q', suit: 'diamonds' }, { rank: '8', suit: 'hearts' },
];
const HERO: CardIdentity[] = [{ rank: 'A', suit: 'hearts' }, { rank: 'J', suit: 'hearts' }];
const NAMES = ['You', 'Alex', 'Maya', 'Jamie', 'Sam', 'Riley', 'Jordan', 'Casey', 'Avery', 'Morgan'];
const EVENT_TYPES = {
  deal: 'HOLE_CARDS_APPEARED', flop: 'FLOP_REVEALED', turn: 'TURN_REVEALED', river: 'RIVER_REVEALED',
} as const;
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export interface PreviewHandle {
  play: (street: Street, presetId?: string) => Promise<void>;
  replay: () => Promise<void>;
  reset: () => void;
  pause: () => void;
  resume: () => void;
}

interface Props {
  theme: Theme;
  settings: Settings;
  street: Street;
  players: number;
  slow: boolean;
  onPlaying: (playing: boolean) => void;
  onProgress: (progress: number) => void;
  onError: (message: string) => void;
}

function rectangle(element: HTMLElement): Rect {
  const box = element.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

export const PreviewTable = forwardRef<PreviewHandle, Props>(function PreviewTable(props, ref) {
  const { theme, settings, street, players, slow, onPlaying, onProgress } = props;
  const [boardCount, setBoardCount] = useState(3);
  const [dealt, setDealt] = useState(true);
  const scene = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const coordinator = useRef<AnimationCoordinator | null>(null);
  const active = useRef<ReturnType<AnimationCoordinator['play']> | null>(null);
  const paused = useRef(false);
  const generation = useRef(0);
  const lastStreet = useRef<Street>('flop');
  const lastPreset = useRef<string | undefined>(undefined);
  const current = useRef(props);
  current.current = props;

  useEffect(() => {
    if (!overlay.current) return;
    coordinator.current = new AnimationCoordinator(overlay.current);
    return () => {
      generation.current += 1;
      coordinator.current?.dispose();
      coordinator.current = null;
    };
  }, []);

  useEffect(() => {
    const cancel = () => {
      generation.current += 1;
      coordinator.current?.cancelAll();
      active.current = null;
      paused.current = false;
      current.current.onPlaying(false);
    };
    window.addEventListener('resize', cancel);
    window.addEventListener('scroll', cancel, true);
    document.addEventListener('visibilitychange', cancel);
    return () => {
      window.removeEventListener('resize', cancel);
      window.removeEventListener('scroll', cancel, true);
      document.removeEventListener('visibilitychange', cancel);
    };
  }, []);

  useEffect(() => {
    generation.current += 1;
    coordinator.current?.cancelAll();
    active.current = null;
    paused.current = false;
    onPlaying(false);
    // The engine owns per-frame work; appearance changes only invalidate a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, players, settings.reducedMotion, settings.enabled, settings.speed, slow]);

  async function play(nextStreet: Street, override?: string) {
    const version = ++generation.current;
    paused.current = false;
    coordinator.current?.cancelAll();
    const nextCount = nextStreet === 'deal' ? 0 : nextStreet === 'flop' ? 3 : nextStreet === 'turn' ? 4 : 5;
    setDealt(true);
    setBoardCount(nextCount);
    lastStreet.current = nextStreet;
    lastPreset.current = override;
    onProgress(0);
    onPlaying(true);
    await frame();
    await frame();
    if (version !== generation.current || !scene.current || !coordinator.current) return;
    const options = current.current;
    if (!options.settings.enabled) {
      options.onPlaying(false);
      options.onProgress(1);
      return;
    }
    const cards: VisualCard[] = [];
    if (nextStreet === 'deal') {
      for (let round = 0; round < 2; round += 1) {
        for (let seat = 0; seat < options.players; seat += 1) {
          const source = scene.current.querySelector<HTMLElement>(`[data-hole="${seat}-${round}"]`);
          if (source) cards.push({
            id: `preview-hole-${seat}-${round}`, target: rectangle(source), source,
            seatId: `seat-${seat}`, round, ...(seat === 0 ? { identity: HERO[round] } : {}),
          });
        }
      }
    } else {
      const indices = nextStreet === 'flop' ? [0, 1, 2] : nextStreet === 'turn' ? [3] : [4];
      for (const index of indices) {
        const source = scene.current.querySelector<HTMLElement>(`[data-board="${index}"]`);
        if (source) cards.push({ id: `preview-board-${index}`, identity: BOARD[index], target: rectangle(source), source });
      }
    }
    const table = scene.current.querySelector<HTMLElement>('.table-felt');
    const box = table?.getBoundingClientRect() ?? scene.current.getBoundingClientRect();
    const seats = Array.from(scene.current.querySelectorAll<HTMLElement>('.player-seat')).map(rectangle);
    const deck = scene.current.querySelector<HTMLElement>('.deck-marker')?.getBoundingClientRect();
    const event: VisualEvent = {
      id: `preview-${nextStreet}-${version}-${Date.now()}`, type: EVENT_TYPES[nextStreet], cards,
      origin: deck?.width ? { x: deck.x + deck.width / 2, y: deck.y + deck.height / 2, z: 0 }
        : { x: box.x + box.width * 0.43, y: box.y + box.height * 0.27, z: 0 },
      timestamp: Date.now(), seats,
    };
    try {
      const assignment = options.theme.animations[nextStreet];
      const selected = override ? getPreset(override) : undefined;
      const parameters = selected && override !== assignment.preset
        ? Object.fromEntries(selected.parameters.map((parameter) => [parameter.key, parameter.default]))
        : assignment.parameters;
      const handle = coordinator.current.play(event, options.theme, {
        presetId: override ?? assignment.preset, parameters,
        speed: options.settings.speed * (options.slow ? 0.4 : 1),
        reducedMotion: options.settings.reducedMotion,
        onProgress: (progress: number) => { if (version === generation.current) options.onProgress(progress); },
      });
      active.current = handle;
      if (paused.current) handle.pause();
      await handle.finished;
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'The preview could not finish. Cards have been restored.');
    } finally {
      if (version === generation.current) {
        active.current = null;
        options.onPlaying(false);
        options.onProgress(1);
      }
    }
  }

  useImperativeHandle(ref, () => ({
    play,
    replay: () => play(lastStreet.current, lastPreset.current),
    reset: () => {
      generation.current += 1;
      coordinator.current?.cancelAll();
      active.current = null;
      paused.current = false;
      setBoardCount(0);
      setDealt(false);
      current.current.onPlaying(false);
      current.current.onProgress(0);
    },
    pause: () => { paused.current = true; active.current?.pause(); },
    resume: () => { paused.current = false; active.current?.resume(); },
  }));

  const cardStyle: CSSProperties = {
    boxShadow: theme.card.shadow === 0 ? 'none' : `0 3px 10px rgba(0,0,0,${Math.min(0.65, theme.card.shadow)})`,
    borderRadius: `${theme.card.borderRadius}%`,
  };

  return <div className="preview-scene" ref={scene} data-testid="preview-table"
    style={{ backgroundColor: theme.table.backgroundColor,
      ...(theme.table.backgroundImage ? { backgroundImage: `url("${theme.table.backgroundImage}")` } : {}) }}>
    <div className="scene-vignette" />
    <div className="table-felt" style={{ '--felt': theme.table.feltColor, '--rail': theme.table.railColor } as CSSProperties}>
      <div className="felt-inner-line" />
      <div className="table-wordmark"><span>POKERNOW</span><small>CUSTOMIZER</small></div>
      <div className="deck-marker" aria-hidden="true"><i /><i /><i /></div>
      <div className="preview-board" style={{ gap: `${theme.board.spacing}px`, background: theme.board.color,
        boxShadow: theme.board.highlight ? `0 0 35px ${theme.board.highlight}18` : undefined }}>
        {BOARD.map((identity, index) => <div key={index} className={`board-slot ${index < boardCount ? 'occupied' : ''}`}
          style={index < boardCount ? { boxShadow: `0 ${theme.board.shadow * 6}px ${theme.board.shadow * 18}px #0007` } : undefined}>
          <span className="slot-number">{index + 1}</span>
          {index < boardCount && <div className="canonical-card" style={cardStyle} data-board={index}>
            <img src={cardDataUrl(identity, theme.card)} alt={`${identity.rank} of ${identity.suit}`} draggable={false} />
          </div>}
        </div>)}
      </div>
      <div className="pot-preview"><div className="pot-chips"><i /><i /><i /></div><span>THE POT</span><strong>$240</strong></div>
    </div>
    {Array.from({ length: players }, (_, index) => {
      const angle = Math.PI / 2 + (index / players) * Math.PI * 2;
      const left = 50 + Math.cos(angle) * 43;
      const top = 50 + Math.sin(angle) * 40;
      return <div className={`player-seat ${index === 0 ? 'hero-seat' : ''}`} key={index} style={{ left: `${left}%`, top: `${top}%` }}>
        <div className="seat-cards">{[0, 1].map((round) => <div className="hole-slot" key={round}>
          {dealt && <div className="canonical-card" style={cardStyle} data-hole={`${index}-${round}`}>
            <img src={cardDataUrl(index === 0 ? HERO[round] : undefined, theme.card)}
              alt={index === 0 ? `${HERO[round].rank} of hearts` : 'Face-down opponent card'} draggable={false} />
          </div>}
        </div>)}</div>
        <div className="seat-name"><span className="seat-avatar">{NAMES[index].slice(0, 1)}</span><span>{NAMES[index]}<small>${(1250 + index * 185).toLocaleString()}</small></span>
          {index === 0 && <i className="hero-indicator" />}</div>
      </div>;
    })}
    <div className="scene-label"><span /><span>LOCAL PREVIEW</span></div>
    <div className="scene-event-label">{street === 'deal' ? "THE DEAL" : `THE ${street.toUpperCase()}`}<small>Sample cards · shared animation engine</small></div>
    <div ref={overlay} className="preview-overlay" aria-hidden="true" />
  </div>;
});
