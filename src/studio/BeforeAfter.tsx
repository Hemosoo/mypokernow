import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * The same hand recorded twice, frame for frame, one clip on each side of a
 * divider. Both loop, muted, in step.
 *
 * Out of the box this is an illustration: the scripted hand on the replica
 * table, once with no theme and once with the Puppy theme, and it is labelled as
 * such. Running scripts/capture-pokernow.mjs on a real PokerNow table writes
 * media/compare.json with two recordings of one real hand (one browser without
 * the extension, one with it), and those are shown instead.
 */
const FPS = 30;
export interface CompareChapter { label: string; frame: number; text: string }
export interface CompareSource {
  /** 'pokernow' for a real recording; 'replica' for the illustration. */
  source: 'pokernow' | 'replica';
  plain: string; themed: string; plainPoster: string; themedPoster: string;
  themeName: string;
  chapters: readonly CompareChapter[];
}
export const COMPARE_CHAPTERS: readonly CompareChapter[] = [
  { label: 'Deal', frame: 32, text: 'The puppy trots to the deck and paws each card out to its player.' },
  { label: 'Flop', frame: 289, text: 'It noses the flop onto the felt, paws the cards apart and watches them turn.' },
  { label: 'Turn', frame: 552, text: 'It fetches the turn card in its mouth and drops it into place.' },
  { label: 'River', frame: 718, text: 'It slides the river along the felt with a paw and flicks it over.' },
  { label: 'Win', frame: 923, text: 'The pot slides to the winner as chips, and the puppy celebrates.' },
];
const ILLUSTRATION: CompareSource = { source: 'replica', plain: './media/compare-plain.webm', themed: './media/compare-puppy.webm', plainPoster: './media/compare-plain.webp',
  themedPoster: './media/compare-puppy.webp', themeName: 'Puppy', chapters: COMPARE_CHAPTERS };

/** The real recording when one has been made; the replica illustration otherwise. */
export function useCompareSource(): CompareSource {
  const [source, setSource] = useState<CompareSource>(ILLUSTRATION);
  useEffect(() => {
    let live = true;
    void fetch('./media/compare.json').then((response) => (response.ok ? response.json() : undefined)).then((manifest: unknown) => {
      const m = manifest as { source?: string; theme?: string; chapters?: CompareChapter[] } | undefined;
      if (!live || m?.source !== 'pokernow') return;
      setSource({ source: 'pokernow', plain: './media/compare-real-plain.webm', themed: './media/compare-real-theme.webm', plainPoster: './media/compare-real-plain.webp',
        themedPoster: './media/compare-real-theme.webp', themeName: typeof m.theme === 'string' ? m.theme.slice(0, 40) : 'Your theme',
        chapters: Array.isArray(m.chapters) ? m.chapters.filter((item) => typeof item?.label === 'string' && Number.isFinite(item.frame)).slice(0, 8) : [] });
    }).catch(() => { /* No recording: the illustration stays. */ });
    return () => { live = false; };
  }, []);
  return source;
}

/** React sets `muted` as a property only; Chrome needs the attribute to autoplay before a click. */
function muted(video: HTMLVideoElement | null): void {
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
}

export function BeforeAfter({ active, onChapter, seek, source = ILLUSTRATION }: { active: boolean; onChapter?: (index: number) => void; seek?: { frame: number; at: number }; source?: CompareSource }) {
  const box = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLVideoElement>(null);
  const after = useRef<HTMLVideoElement>(null);
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const chapter = useRef(-1);
  const report = useRef(onChapter);
  report.current = onChapter;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!reduce);

  // Play while shown; keep the plain clip on the Puppy clip's frame.
  useEffect(() => {
    const a = after.current, b = before.current;
    if (!a || !b) return;
    if (!active || !playing) { a.pause?.(); b.pause?.(); return; }
    muted(a); muted(b);
    b.currentTime = a.currentTime;
    void a.play?.()?.catch(() => setPlaying(false));
    void b.play?.()?.catch(() => {});
    let frame = 0;
    const tick = (): void => {
      if (Math.abs(b.currentTime - a.currentTime) > 0.08) b.currentTime = a.currentTime;
      const index = source.chapters.reduce((found, item, at) => (a.currentTime * FPS >= item.frame - 2 ? at : found), -1);
      if (index !== chapter.current) { chapter.current = index; report.current?.(index); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, playing, source]);

  // Jump both clips to a chapter when asked.
  useEffect(() => {
    if (!seek || !after.current || !before.current) return;
    after.current.currentTime = before.current.currentTime = seek.frame / FPS;
    setPlaying(true);
  }, [seek]);

  const at = (event: PointerEvent): void => {
    const rect = box.current!.getBoundingClientRect();
    setSplit(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)));
  };
  const key = (event: KeyboardEvent): void => {
    const step = event.shiftKey ? 10 : 3;
    if (event.key === 'ArrowLeft') { event.preventDefault(); setSplit((value) => Math.max(0, value - step)); }
    if (event.key === 'ArrowRight') { event.preventDefault(); setSplit((value) => Math.min(100, value + step)); }
  };
  return <div ref={box} className={`before-after ${dragging ? 'dragging' : ''}`} style={{ '--split': `${split}%` } as CSSProperties}
    onPointerDown={(event) => { box.current?.setPointerCapture(event.pointerId); setDragging(true); at(event); }}
    onPointerMove={(event) => { if (dragging) at(event); }} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
    <video ref={(element) => { before.current = element; muted(element); }} className="ba-before" src={source.plain} poster={source.plainPoster}
      muted loop playsInline autoPlay={!reduce} preload="auto" aria-label={source.source === 'pokernow' ? 'A hand on PokerNow without the extension' : 'An illustration of a hand on a plain table'} />
    <video ref={(element) => { after.current = element; muted(element); }} className="ba-after" src={source.themed} poster={source.themedPoster}
      muted loop playsInline autoPlay={!reduce} preload="auto" aria-label={`The same hand with the ${source.themeName} theme`} />
    {source.source === 'pokernow' ? <span className="ba-tag ba-tag-before">PokerNow</span>
      : <span className="ba-tag ba-tag-before" title="A stand-in drawn by the extension, not PokerNow’s own artwork">Plain table · illustration</span>}
    <span className="ba-tag ba-tag-after">{source.themeName} theme</span>
    <span className="ba-handle" role="slider" tabIndex={0} aria-label="Comparison divider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)}
      aria-valuetext={`${Math.round(split)}% plain table`} onKeyDown={key}>
      <span className="ba-knob"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6-6 6 6 6M15 6l6 6-6 6" /></svg></span>
    </span>
    {!playing && <button type="button" className="ba-play" onPointerDown={(event) => event.stopPropagation()} onClick={() => setPlaying(true)}>Play the comparison</button>}
  </div>;
}
