import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Icon, Kbd, type IconName } from './ui';

export interface Command {
  id: string;
  group: 'Effects' | 'Themes' | 'Go to' | 'Settings' | 'Actions';
  title: string;
  detail?: string;
  icon?: IconName;
  /** A colour swatch instead of an icon (themes). */
  swatch?: string;
  keys?: string;
  keywords?: string;
  run: () => void;
}

const ORDER: Command['group'][] = ['Actions', 'Effects', 'Themes', 'Go to', 'Settings'];

/** Word-start matches rank above anywhere-matches; every typed word must appear. */
function score(command: Command, query: string): number {
  const haystack = `${command.title} ${command.detail ?? ''} ${command.group} ${command.keywords ?? ''}`.toLowerCase();
  let total = 0;
  for (const word of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const at = haystack.indexOf(word);
    if (at < 0) return -1;
    total += at === 0 || haystack[at - 1] === ' ' ? 3 : 1;
    if (command.title.toLowerCase().startsWith(word)) total += 2;
  }
  return total;
}

export function CommandMenu({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const restore = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
  const results = useMemo(() => {
    const trimmed = query.trim();
    const ranked = commands.map((command, index) => ({ command, index, score: trimmed ? score(command, trimmed) : 0 })).filter((item) => item.score >= 0);
    if (trimmed) ranked.sort((a, b) => b.score - a.score || a.index - b.index);
    else ranked.sort((a, b) => ORDER.indexOf(a.command.group) - ORDER.indexOf(b.command.group) || a.index - b.index);
    return ranked.slice(0, trimmed ? 40 : 60).map((item) => item.command);
  }, [commands, query]);
  useEffect(() => { input.current?.focus(); return () => { (restore.current as HTMLElement | null)?.focus?.(); }; }, []);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }); }, [active]);
  const run = (command: Command | undefined): void => { if (!command) return; onClose(); command.run(); };
  let group = '';
  return <div className="menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="menu" role="dialog" aria-modal="true" aria-label="Search the studio">
      <div className="menu-input"><Icon name="search" size={18} />
        <input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search effects, themes and settings…" aria-label="Search the studio"
          role="combobox" aria-expanded="true" aria-controls="menu-results" aria-activedescendant={results[active] ? `menu-${results[active]!.id}` : undefined}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
            else if (event.key === 'Enter') { event.preventDefault(); run(results[active]); }
            else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
          }} />
        <Kbd>Esc</Kbd></div>
      <ul ref={list} id="menu-results" role="listbox" aria-label="Results">
        {!results.length && <li className="menu-empty">Nothing matches “{query}”. Try “puppy”, “rouge” or “motion”.</li>}
        {results.map((command, index) => {
          const heading = command.group !== group ? (group = command.group) : '';
          return [heading && <li key={`h-${heading}`} className="menu-group" role="presentation">{heading}</li>,
            <li key={command.id} id={`menu-${command.id}`} role="option" aria-selected={index === active} className="menu-item"
              onMouseMove={() => { if (index !== active) setActive(index); }} onClick={() => run(command)}>
              {command.swatch ? <span className="menu-swatch" style={{ '--swatch': command.swatch } as CSSProperties} /> : <span className="menu-icon"><Icon name={command.icon ?? 'chevron'} size={16} /></span>}
              <span className="menu-title">{command.title}{command.detail && <small>{command.detail}</small>}</span>
              {command.keys && <Kbd>{command.keys}</Kbd>}
            </li>];
        })}
      </ul>
      <footer className="menu-foot"><span><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span><span><Kbd>↵</Kbd> run</span><span><Kbd>Esc</Kbd> close</span></footer>
    </div>
  </div>;
}

export const SHORTCUTS: [string, string][] = [
  ['⌘K or /', 'Search the studio'], ['⌘Z', 'Undo'], ['⇧⌘Z', 'Redo'], ['Space', 'Play or pause'], ['1 – 4', 'Play the deal, flop, turn or river'],
  ['[ and ]', 'Try the previous or next effect'], ['H', 'Play a whole hand'], ['F', 'Heart the effect on the table'],
  ['R', 'Replay'], ['Hold C', 'See the table without your theme'], ['Esc', 'Stop previewing a theme'], ['?', 'Show these shortcuts'],
]

export function ShortcutSheet({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus(); }, []);
  return <div className="menu-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <header><h2 id="shortcuts-title">Keyboard shortcuts</h2><button ref={close} type="button" className="icon-button" aria-label="Close shortcuts" onClick={onClose}><Icon name="close" size={18} /></button></header>
      <dl>{SHORTCUTS.map(([keys, action]) => <div key={keys}><dt>{keys.split(' or ').map((key, index) => <span key={key}>{index > 0 && ' or '}<Kbd>{key}</Kbd></span>)}</dt><dd>{action}</dd></div>)}</dl>
    </div>
  </div>;
}
