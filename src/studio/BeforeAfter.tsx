import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

/**
 * The same scripted hand recorded twice on the replica table, frame for frame:
 * once with no theme and once with the Puppy theme. Both clips loop, muted, in
 * step; a divider shows one on each side.
 */
const FPS = 30;
export const COMPARE_CHAPTERS = [
  { label: 'Deal', frame: 32, text: 'The puppy trots to the deck and paws each card out to its player.' },
  { label: 'Flop', frame: 289, text: 'It noses the flop onto the felt, paws the cards apart and watches them turn.' },
  { label: 'Turn', frame: 552, text: 'It fetches the turn card in its mouth and drops it into place.' },
  { label: 'River', frame: 718, text: 'It slides the river along the felt with a paw and flicks it over.' },
  { label: 'Win', frame: 923, text: 'The pot slides to the winner as chips, and the puppy celebrates.' },
] as const;

/** React sets `muted` as a property only; Chrome needs the attribute to autoplay before a click. */
function muted(video: HTMLVideoElement | null): void {
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
}

export function BeforeAfter({ active, onChapter, seek }: { active: boolean; onChapter?: (index: number) => void; seek?: { frame: number; at: number } }) {
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
      const index = COMPARE_CHAPTERS.reduce((found, item, at) => (a.currentTime * FPS >= item.frame - 2 ? at : found), -1);
      if (index !== chapter.current) { chapter.current = index; report.current?.(index); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, playing]);

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
    <video ref={(element) => { before.current = element; muted(element); }} className="ba-before" src="./media/compare-plain.webm" poster="./media/compare-plain.webp"
      muted loop playsInline autoPlay={!reduce} preload="auto" aria-label="A hand on a plain table" />
    <video ref={(element) => { after.current = element; muted(element); }} className="ba-after" src="./media/compare-puppy.webm" poster="./media/compare-puppy.webp"
      muted loop playsInline autoPlay={!reduce} preload="auto" aria-label="The same hand with the Puppy theme" />
    <span className="ba-tag ba-tag-before">Plain table</span>
    <span className="ba-tag ba-tag-after">Puppy theme</span>
    <span className="ba-handle" role="slider" tabIndex={0} aria-label="Comparison divider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)}
      aria-valuetext={`${Math.round(split)}% plain table`} onKeyDown={key}>
      <span className="ba-knob"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6-6 6 6 6M15 6l6 6-6 6" /></svg></span>
    </span>
    {!playing && <button type="button" className="ba-play" onPointerDown={(event) => event.stopPropagation()} onClick={() => setPlaying(true)}>Play the comparison</button>}
  </div>;
}
