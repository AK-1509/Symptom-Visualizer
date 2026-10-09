import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Drug } from '../lib/types.ts';

interface ActiveDrugsProps {
  drugs: Drug[];
  selectedId: string | null;
  colors: Map<string, string>;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string, e: ReactPointerEvent) => void;
}

export function ActiveDrugs({ drugs, selectedId, colors, onSelect, onRemove, onDragStart }: ActiveDrugsProps) {
  return (
    <section className="active" aria-label="Active drugs">
      <h2 className="eyebrow">
        Active drugs <span className="count">{drugs.length || ''}</span>
      </h2>
      {drugs.length === 0 ? (
        <p className="hint">Search above to add a drug. Then drag its pill onto the body, or click a highlighted region.</p>
      ) : (
        <ul className="cards">
          {drugs.map((d) => {
            const selected = d.id === selectedId;
            return (
              <li key={d.id} className={`card${selected ? ' is-selected' : ''}`} style={{ '--drug': colors.get(d.id) } as React.CSSProperties}>
                <span
                  className="pill"
                  role="img"
                  aria-label={`Drag ${d.name} onto the body`}
                  title="Drag onto a body region"
                  data-drug={d.id}
                  onPointerDown={(e) => onDragStart(d.id, e)}
                />
                <button className="card-main" aria-pressed={selected} onClick={() => onSelect(d.id)}>
                  <span className="card-name">{d.name}</span>
                  <span className="card-class">{d.drugClass ?? d.brands[0] ?? ''}</span>
                </button>
                <button className="card-remove" aria-label={`Remove ${d.name}`} title="Remove" onClick={() => onRemove(d.id)}>
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M3 3 L9 9 M9 3 L3 9" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
