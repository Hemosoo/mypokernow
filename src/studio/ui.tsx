import { useId, type CSSProperties, type ReactNode } from 'react';

export type IconName = 'spark' | 'cards' | 'felt' | 'board' | 'paw' | 'library' | 'settings' | 'play' | 'pause' | 'replay' | 'reset'
  | 'check' | 'plus' | 'upload' | 'download' | 'copy' | 'trash' | 'chevron' | 'down' | 'search' | 'heart' | 'heart-fill' | 'shuffle'
  | 'eye' | 'close' | 'slow' | 'keyboard' | 'hand' | 'external' | 'power';

const PATHS: Record<IconName, ReactNode> = {
  spark: <><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" /></>,
  cards: <><rect x="7" y="4" width="12" height="16" rx="2" /><path d="m6 7-2 .5a2 2 0 0 0-1.4 2.4l2.6 9.6a2 2 0 0 0 2.4 1.4L11 20" /></>,
  felt: <><ellipse cx="12" cy="12" rx="10" ry="7" /><ellipse cx="12" cy="12" rx="6.5" ry="4" /></>,
  board: <><rect x="2" y="7" width="5" height="10" rx="1.4" /><rect x="9.5" y="7" width="5" height="10" rx="1.4" /><rect x="17" y="7" width="5" height="10" rx="1.4" /></>,
  paw: <><ellipse cx="12" cy="16" rx="4.6" ry="3.8" /><circle cx="6" cy="10.5" r="1.9" /><circle cx="18" cy="10.5" r="1.9" /><circle cx="9.2" cy="6.3" r="1.9" /><circle cx="14.8" cy="6.3" r="1.9" /></>,
  library: <><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="4" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  settings: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2.2" /><circle cx="10" cy="17" r="2.2" /></>,
  play: <path d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.4-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>,
  replay: <><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" /></>,
  reset: <><path d="M4 8a8 8 0 1 1-1 8M4 3v5h5" /><path d="M10 9.5v5l4-2.5-4-2.5Z" /></>,
  check: <path d="m5 12.5 4.2 4L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  upload: <><path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4" /></>,
  download: <><path d="M12 4v12m-5-5 5 5 5-5M4 17v3h16v-3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  trash: <><path d="M4 6h16M9 6V4h6v2M6.5 6l1 14h9l1-14M10 10v6M14 10v6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  heart: <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />,
  'heart-fill': <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" fill="currentColor" />,
  shuffle: <><path d="M3 7h3.5c2 0 3 1 4.3 3l2.4 4c1.3 2 2.3 3 4.3 3H21M3 17h3.5c1.4 0 2.3-.5 3.1-1.4M14.4 8.4C15.2 7.5 16.1 7 17.5 7H21" /><path d="m18 4 3 3-3 3M18 14l3 3-3 3" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  slow: <><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 2.5M9.5 3h5" /></>,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10" /></>,
  hand: <><rect x="3" y="6" width="8" height="12" rx="1.5" transform="rotate(-8 7 12)" /><rect x="12" y="6" width="8" height="12" rx="1.5" transform="rotate(8 16 12)" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9M10 5H5v14h14v-5" /></>,
  power: <><path d="M12 3v8" /><path d="M7 6.3a7.5 7.5 0 1 0 10 0" /></>,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{PATHS[name]}</svg>;
}

export function Kbd({ children }: { children: ReactNode }) { return <kbd className="kbd">{children}</kbd>; }

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" className={`switch ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}

export function Range({ label, value, min, max, step = 1, unit = '', onChange, hint }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void; hint?: string;
}) {
  const id = useId();
  const shown = Number(value.toFixed(2));
  return <div className="range">
    <div className="range-head"><label htmlFor={id}>{label}</label><output htmlFor={id}>{shown}{unit}</output></div>
    <input id={id} type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))}
      style={{ '--fill': `${((value - min) / (max - min)) * 100}%` } as CSSProperties} />
    {hint && <p className="hint">{hint}</p>}
  </div>;
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : '#142b29';
  return <div className="color-field"><label htmlFor={id}>{label}</label>
    <span className="color-value"><input id={id} type="color" value={hex} onChange={(event) => onChange(event.target.value)} /><code>{hex.toUpperCase()}</code></span></div>;
}

/** A row of mutually exclusive choices. */
export function Segmented<T extends string>({ label, value, options, onChange, size }: {
  label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void; size?: 'small';
}) {
  return <div className={`segmented ${size === 'small' ? 'small' : ''}`} role="radiogroup" aria-label={label}>
    {options.map(([key, text]) => <button type="button" key={key} role="radio" aria-checked={value === key} className={value === key ? 'on' : ''} onClick={() => onChange(key)}>{text}</button>)}
  </div>;
}

export function Setting({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return <div className="setting"><div className="setting-text"><h4>{title}</h4>{description && <p>{description}</p>}</div>{children}</div>;
}

/** A section of a step, with an optional quiet action on the right. */
export function Group({ title, note, action, children, id }: { title: string; note?: ReactNode; action?: ReactNode; children: ReactNode; id?: string }) {
  return <section className="group" aria-labelledby={id}>
    <header className="group-head"><div><h3 id={id}>{title}</h3>{note && <p>{note}</p>}</div>{action}</header>
    {children}
  </section>;
}

export function Disclosure({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return <details className="disclosure" open={open}><summary><span>{title}</span><Icon name="down" size={16} /></summary><div className="disclosure-body">{children}</div></details>;
}
