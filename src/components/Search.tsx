import { useId, useMemo, useRef, useState } from 'react';
import { search, type SearchIndex } from '../lib/search.ts';

interface SearchProps {
  index: SearchIndex | null;
  activeIds: string[];
  onAdd: (id: string) => void;
}

export function Search({ index, activeIds, onAdd }: SearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => (index ? search(index, query) : []), [index, query]);
  const showList = open && query.trim().length > 0;

  const choose = (id: string) => {
    onAdd(id);
    setQuery('');
    setCursor(0);
    input.current?.focus();
  };

  return (
    <div className="search">
      <label className="eyebrow" htmlFor={`${listId}-input`}>
        Search drugs
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
          aria-activedescendant={showList && results[cursor] ? `${listId}-${results[cursor].drug.id}` : undefined}
          placeholder={index ? 'Generic or brand name' : 'Loading drugs…'}
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
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter' && results[cursor]) {
              e.preventDefault();
              choose(results[cursor].drug.id);
            } else if (e.key === 'Escape') {
              setQuery('');
            }
          }}
        />
      </div>
      {showList && (
        <ul className="results" id={listId} role="listbox" aria-label="Matching drugs">
          {results.length === 0 && <li className="results-empty">No drug found for “{query.trim()}”</li>}
          {results.map((r, i) => {
            const active = activeIds.includes(r.drug.id);
            const showMatch = r.matched !== r.drug.name;
            return (
              <li
                key={r.drug.id}
                id={`${listId}-${r.drug.id}`}
                role="option"
                aria-selected={i === cursor}
                className={`result${i === cursor ? ' is-cursor' : ''}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(r.drug.id)}
                onPointerEnter={() => setCursor(i)}
              >
                <span className="result-name">
                  {r.drug.name}
                  {showMatch && <span className="result-match"> · {r.matched}</span>}
                </span>
                <span className="result-meta">{active ? 'Active' : r.drug.drugClass ?? ''}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
