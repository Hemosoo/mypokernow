import { useEffect, useId, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';

export type IconName = 'spark' | 'cards' | 'felt' | 'board' | 'paw' | 'library' | 'settings' | 'play' | 'pause' | 'replay' | 'reset'
  | 'check' | 'plus' | 'upload' | 'download' | 'copy' | 'trash' | 'chevron' | 'down' | 'search' | 'heart' | 'heart-fill' | 'shuffle'
  | 'eye' | 'close' | 'slow' | 'keyboard' | 'hand' | 'external' | 'power' | 'home' | 'compass' | 'brush' | 'undo' | 'redo'
  | 'expand' | 'panel' | 'more' | 'pencil' | 'dice' | 'room' | 'clock' | 'bolt' | 'sliders' | 'back';

const PATHS: Record<IconName, ReactNode> = {
  spark: <><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" /></>,
  cards: <><rect x="7" y="4" width="12" height="16" rx="2" /><path d="m6 7-2 .5a2 2 0 0 0-1.4 2.4l2.6 9.6a2 2 0 0 0 2.4 1.4L11 20" /></>,
  felt: <><ellipse cx="12" cy="12" rx="10" ry="7" /><ellipse cx="12" cy="12" rx="6.5" ry="4" /></>,
  board: <><rect x="2" y="7" width="5" height="10" rx="1.4" /><rect x="9.5" y="7" width="5" height="10" rx="1.4" /><rect x="17" y="7" width="5" height="10" rx="1.4" /></>,
  paw: <><ellipse cx="12" cy="16" rx="4.6" ry="3.8" /><circle cx="6" cy="10.5" r="1.9" /><circle cx="18" cy="10.5" r="1.9" /><circle cx="9.2" cy="6.3" r="1.9" /><circle cx="14.8" cy="6.3" r="1.9" /></>,
  library: <><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></>,
  play: <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>,
  replay: <><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" /></>,
  reset: <><path d="M4 8a8 8 0 1 1-1 8M4 3v5h5" /></>,
  check: <path d="m5 12.5 4.2 4L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4" /></>,
  download: <><path d="M12 4v12m-5-5 5 5 5-5M4 17v3h16v-3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  trash: <><path d="M4 6h16M9 6V4h6v2M6.5 6l1 14h9l1-14M10 10v6M14 10v6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  back: <path d="m15 5-7 7 7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  heart: <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />,
  'heart-fill': <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" fill="currentColor" />,
  shuffle: <><path d="M3 7h3.5c2 0 3 1 4.3 3l2.4 4c1.3 2 2.3 3 4.3 3H21M3 17h3.5c1.4 0 2.3-.5 3.1-1.4M14.4 8.4C15.2 7.5 16.1 7 17.5 7H21" /><path d="m18 4 3 3-3 3M18 14l3 3-3 3" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  slow: <><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 2.5M9.5 3h5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10" /></>,
  hand: <><rect x="3" y="6" width="8" height="12" rx="1.5" transform="rotate(-8 7 12)" /><rect x="12" y="6" width="8" height="12" rx="1.5" transform="rotate(8 16 12)" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9M10 5H5v14h14v-5" /></>,
  power: <><path d="M12 3v8" /><path d="M7 6.3a7.5 7.5 0 1 0 10 0" /></>,
  home: <><path d="M4 11 12 4l8 7" /><path d="M6 9.5V20h12V9.5M10 20v-5h4v5" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  brush: <><path d="M14.5 4.5 19.5 9.5 11 18l-5-5 8.5-8.5Z" /><path d="M6 13c-2 0-3 1.6-3 3.5V20h3.5C8.4 20 10 19 10 17" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  redo: <><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>,
  expand: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  more: <><circle cx="5.5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" /></>,
  pencil: <><path d="M15.5 4.5 19.5 8.5 8.5 19.5H4.5v-4l11-11Z" /></>,
  dice: <><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1.2" fill="currentColor" /><circle cx="15" cy="15" r="1.2" fill="currentColor" /><circle cx="15" cy="9" r="1.2" fill="currentColor" /><circle cx="9" cy="15" r="1.2" fill="currentColor" /></>,
  room: <><path d="M3 20V8l9-5 9 5v12" /><path d="M3 20h18M8 20v-6h8v6" /></>,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{PATHS[name]}</svg>;
}

export function Kbd({ children }: { children: ReactNode }) { return <kbd className="kbd">{children}</kbd>; }

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" className={`switch ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}

export function Range({ label, value, min, max, step = 1, unit = '', onChange, hint, format }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void; hint?: string; format?: (value: number) => string;
}) {
  const id = useId();
  const shown = format ? format(value) : `${Number(value.toFixed(2))}${unit}`;
  return <div className="range">
    <div className="range-head"><label htmlFor={id}>{label}</label><output htmlFor={id}>{shown}</output></div>
    <input id={id} type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))}
      style={{ '--fill': `${((value - min) / (max - min)) * 100}%` } as CSSProperties} />
    {hint && <p className="hint">{hint}</p>}
  </div>;
}

/** A labelled colour well. `onReset` shows a reset button when the value differs from where it started. */
export function ColorField({ label, value, onChange, onReset, onFocusPart }: {
  label: string; value: string; onChange: (value: string) => void; onReset?: () => void; onFocusPart?: (on: boolean) => void;
}) {
  const id = useId();
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#142b29';
  return <div className="color-field" onMouseEnter={() => onFocusPart?.(true)} onMouseLeave={() => onFocusPart?.(false)} onFocus={() => onFocusPart?.(true)} onBlur={() => onFocusPart?.(false)}>
    <label htmlFor={id}>{label}</label>
    <span className="color-value">
      {onReset && <button type="button" className="icon-button tiny" aria-label={`Reset ${label.toLowerCase()}`} title="Reset" onClick={onReset}><Icon name="reset" size={14} /></button>}
      <code>{hex.toUpperCase()}</code><input id={id} type="color" value={hex} onChange={(event) => onChange(event.target.value)} /></span>
  </div>;
}

/** A row of mutually exclusive choices. */
export function Segmented<T extends string>({ label, value, options, onChange, size }: {
  label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void; size?: 'small';
}) {
  return <div className={`segmented ${size === 'small' ? 'small' : ''}`} role="radiogroup" aria-label={label}>
    {options.map(([key, text]) => <button type="button" key={key} role="radio" aria-checked={value === key} className={value === key ? 'on' : ''} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}

export function Setting({ title, description, children, tag }: { title: string; description?: ReactNode; children: ReactNode; tag?: string }) {
  return <div className="setting"><div className="setting-text"><h4>{title}{tag && <span className="tag">{tag}</span>}</h4>{description && <p>{description}</p>}</div>{children}</div>;
}

/** A section of a page, with an optional quiet action on the right. */
export function Section({ title, note, action, children, id, tag }: { title: string; note?: ReactNode; action?: ReactNode; children: ReactNode; id?: string; tag?: string }) {
  const fallback = useId();
  const heading = id ?? fallback;
  return <section className="section" aria-labelledby={heading}>
    <header className="section-head"><div><h3 id={heading}>{title}{tag && <span className="tag">{tag}</span>}</h3>{note && <p>{note}</p>}</div>{action}</header>
    {children}
  </section>;
}

export function Disclosure({ title, children, open, tag }: { title: string; children: ReactNode; open?: boolean; tag?: string }) {
  return <details className="disclosure" open={open}><summary><span>{title}{tag && <span className="tag">{tag}</span>}</span><Icon name="down" size={16} /></summary><div className="disclosure-body">{children}</div></details>;
}

/** Close a popover on Escape or a click outside it. */
export function useDismiss(open: boolean, close: () => void, refs: RefObject<HTMLElement | null>[]): void {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return;
    const down = (event: PointerEvent): void => { if (!refs.some((ref) => ref.current?.contains(event.target as Node))) latest.current(); };
    const key = (event: KeyboardEvent): void => { if (event.key === 'Escape') { event.stopPropagation(); latest.current(); } };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key, true); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** Arrow-key movement between the items of a menu or list. */
export function moveFocus(event: React.KeyboardEvent, container: HTMLElement | null, selector: string): void {
  if (!container || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = [...container.querySelectorAll<HTMLElement>(selector)].filter((item) => !item.hasAttribute('disabled'));
  if (!items.length) return;
  event.preventDefault();
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
    : event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
  items[next]?.focus();
}
