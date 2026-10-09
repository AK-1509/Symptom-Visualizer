import { useId, useMemo, useRef, useState } from 'react';
import { REGION_INFO } from '../lib/anatomy.ts';
import { search, searchText, type SearchIndex } from '../lib/search.ts';
import type { EffectType, Region } from '../lib/types.ts';

interface SearchProps {
  index: SearchIndex | null;
  activeIds: string[];
  /** Add a drug; a label-text result also opens the region it was found in. */
  onAdd: (id: string, region?: Region) => void;
}

const TYPE_LABEL: Record<EffectType, string> = {
  therapeutic: 'Therapeutic use',
  adverse: 'Adverse reactions',
  warning: 'Warnings',
  contraindication: 'Contraindications',
};

type Option = { kind: 'drug'; id: string; key: string } | { kind: 'mention'; id: string; region: Region; key: string };

export function Search({ index, activeIds, onAdd }: SearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const drugs = useMemo(() => (index ? search(index, query, 5) : []), [index, query]);
  const text = useMemo(
    () => (index ? searchText(index, query, 6, new Set(drugs.map((r) => r.drug.id))) : { mentions: [], total: 0 }),
    [index, query, drugs],
  );
  const options: Option[] = [
    ...drugs.map((r) => ({ kind: 'drug' as const, id: r.drug.id, key: `d-${r.drug.id}` })),
    ...text.mentions.map((m) => ({ kind: 'mention' as const, id: m.drug.id, region: m.region, key: `m-${m.drug.id}` })),
  ];
  const showList = open && query.trim().length > 0;
  const optionId = (o: Option) => `${listId}-${o.key}`;

  const choose = (o: Option) => {
    onAdd(o.id, o.kind === 'mention' ? o.region : undefined);
    setQuery('');
    setCursor(0);
    input.current?.focus();
  };

  const optionProps = (o: Option, i: number) => ({
    id: optionId(o),
    role: 'option',
    'aria-selected': i === cursor,
    onPointerDown: (e: React.PointerEvent) => e.preventDefault(),
    onClick: () => choose(o),
    onPointerEnter: () => setCursor(i),
  });

  return (
    <div className="search">
      <label className="eyebrow" htmlFor={`${listId}-input`}>
        Search drugs and label text
      </label>
      <div className="search-field">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 L14 14" />
        </svg>
        <input
          id={`${listId}-input`}
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[cursor] ? optionId(options[cursor]) : undefined}
          placeholder={index ? 'Drug, brand, class or effect' : 'Loading drugs…'}
          disabled={!index}
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter' && options[cursor]) {
              e.preventDefault();
              choose(options[cursor]);
            } else if (e.key === 'Escape') {
              setQuery('');
            }
          }}
        />
      </div>
      {showList && (
        <ul className="results" id={listId} role="listbox" aria-label="Search results">
          {options.length === 0 && <li className="results-empty">No drug or label text found for “{query.trim()}”</li>}
          {drugs.map((r, i) => {
            const showMatch = r.matched !== r.drug.name;
            return (
              <li key={r.drug.id} className={`result${i === cursor ? ' is-cursor' : ''}`} {...optionProps(options[i], i)}>
                <span className="result-name">
                  {r.drug.name}
                  {showMatch && <span className="result-match"> · {r.matched}</span>}
                </span>
                <span className="result-meta">{activeIds.includes(r.drug.id) ? 'Active' : (r.drug.drugClass ?? '')}</span>
              </li>
            );
          })}
          {text.mentions.length > 0 && (
            <li className="results-group" role="presentation">
              In label text{text.total > text.mentions.length ? ` · ${text.total} drugs` : ''}
            </li>
          )}
          {text.mentions.map((m, j) => {
            const i = drugs.length + j;
            return (
              <li key={m.drug.id} className={`result result-mention${i === cursor ? ' is-cursor' : ''}`} {...optionProps(options[i], i)}>
                <span className="result-name">
                  {m.drug.name}
                  <span className="result-match">
                    {' '}
                    · {REGION_INFO[m.region].label} · {TYPE_LABEL[m.effect.type]}
                  </span>
                </span>
                <span className="result-snippet">
                  {m.snippet.map((part, k) => (part.mark ? <mark key={k}>{part.text}</mark> : <span key={k}>{part.text}</span>))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
