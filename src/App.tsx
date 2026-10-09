import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ActiveDrugs } from './components/ActiveDrugs.tsx';
import { Body } from './components/Body.tsx';
import { Details } from './components/Details.tsx';
import { Search } from './components/Search.tsx';
import { AGE_LABEL, addActive, ageGroup, isAgeSpecificMatch, regionOverlap, regionStates, removeActive } from './lib/effects.ts';
import { buildIndex } from './lib/search.ts';
import type { Region, Sex } from './lib/types.ts';
import { loadDrugs, type LoadState } from './data.ts';

const PALETTE = ['#7aa2ff', '#ffd166', '#c792ea', '#5ad1e6', '#ff8fab', '#a3e635', '#f4a261', '#94a3b8'];

interface Drag {
  id: string;
  startX: number;
  startY: number;
  moved: boolean;
}

export function App() {
  const [data, setData] = useState<LoadState>({ status: 'loading' });
  const [sex, setSex] = useState<Sex>('amab');
  const [age, setAge] = useState(34);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [colors, setColors] = useState<Map<string, string>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [dropTarget, setDropTarget] = useState<Region | null>(null);
  const ghost = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setData({ status: 'loading' });
    loadDrugs().then(setData);
  }, []);
  useEffect(load, [load]);

  const drugs = data.status === 'ready' ? data.drugs : null;
  const byId = useMemo(() => new Map((drugs ?? []).map((d) => [d.id, d])), [drugs]);
  const index = useMemo(() => (drugs ? buildIndex(drugs) : null), [drugs]);
  const active = useMemo(() => activeIds.map((id) => byId.get(id)).filter((d) => !!d), [activeIds, byId]);
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;

  const states = useMemo(() => regionStates(selected ?? undefined, age), [selected, age]);
  const overlapDrugs = useMemo(() => regionOverlap(active, age), [active, age]);
  const overlap = useMemo(() => new Map([...overlapDrugs].map(([r, list]) => [r, list.length])), [overlapDrugs]);
  const others = region ? (overlapDrugs.get(region) ?? []).filter((d) => d.id !== selectedId) : [];
  const group = ageGroup(age);
  const ageSpecific = selected ? selected.effects.filter((e) => isAgeSpecificMatch(e, age)).length : 0;

  const add = useCallback((id: string) => {
    setActiveIds((ids) => addActive(ids, id));
    setColors((c) => {
      if (c.has(id)) return c;
      const used = new Set(c.values());
      const next = new Map(c);
      next.set(id, PALETTE.find((p) => !used.has(p)) ?? PALETTE[c.size % PALETTE.length]);
      return next;
    });
    setSelectedId(id);
  }, []);

  const remove = useCallback(
    (id: string) => {
      const rest = removeActive(activeIds, id);
      setActiveIds(rest);
      setColors((c) => {
        const next = new Map(c);
        next.delete(id);
        return next;
      });
      if (selectedId === id) setSelectedId(rest.at(-1) ?? null);
    },
    [activeIds, selectedId],
  );

  const selectRegion = useCallback((r: Region) => setRegion((cur) => (cur === r ? null : r)), []);

  /** Pointer-driven drag: works for mouse, pen and touch. A press without movement selects the drug. */
  const startDrag = useCallback((id: string, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const drag: Drag = { id, startX: e.clientX, startY: e.clientY, moved: false };
    let target: Region | null = null;
    const el = ghost.current;
    if (el) el.style.setProperty('--drug', colors.get(id) ?? PALETTE[0]);

    const move = (ev: PointerEvent) => {
      if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        setSelectedId(id);
        document.body.classList.add('is-dragging');
      }
      if (el) {
        el.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
        el.hidden = false;
      }
      const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<SVGElement>('[data-region]');
      const next = (hit?.dataset.region as Region | undefined) ?? null;
      if (next !== target) {
        target = next;
        setDropTarget(next);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('is-dragging');
      if (el) el.hidden = true;
      setDropTarget(null);
      setSelectedId(id);
      if (drag.moved && target) setRegion(target);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, [colors]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) setRegion(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <header className="top">
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Drug Body Map
        </h1>
        <div className="controls">
          <div className="sex" role="radiogroup" aria-label="Body">
            {(['amab', 'afab'] as const).map((s) => (
              <button key={s} role="radio" aria-checked={sex === s} className={sex === s ? 'is-on' : ''} onClick={() => setSex(s)}>
                {s.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="age">
            <span className="age-value">
              Age <strong>{age}</strong>
            </span>
            <input type="range" min={0} max={100} value={age} onChange={(e) => setAge(Number(e.target.value))} aria-valuetext={`Age ${age}, ${AGE_LABEL[group]}`} />
            <span className="age-group">
              {AGE_LABEL[group]}
              {ageSpecific > 0 && <em> · {ageSpecific} age-specific</em>}
            </span>
          </label>
        </div>
        <div className="top-spacer" />
      </header>

      <div className="left">
        <Search index={index} activeIds={activeIds} onAdd={add} />
        {data.status === 'error' && (
          <div className="banner" role="alert">
            <strong>Data unavailable.</strong> {data.message}
            <button onClick={load}>Retry</button>
          </div>
        )}
        <ActiveDrugs drugs={active} selectedId={selectedId} colors={colors} onSelect={setSelectedId} onRemove={remove} onDragStart={startDrag} />
        {selected && states.size === 0 && <p className="hint">No body regions are mapped for {selected.name} at age {age}.</p>}
      </div>

      <main className="stage">
        <Body sex={sex} states={states} overlap={overlap} drugSelected={!!selected} selectedRegion={region} dropTarget={dropTarget} onSelect={selectRegion} />
        <Legend />
      </main>

      <div className="right">
        <Details
          drug={selected}
          region={region}
          age={age}
          others={others}
          onSelectRegion={setRegion}
          onSelectDrug={setSelectedId}
          onClose={() => setRegion(null)}
        />
      </div>

      <footer className="foot">
        <p>For informational purposes only. This visualization is not medical advice and does not diagnose, treat, or recommend medication use.</p>
        {data.status === 'ready' && (
          <p className="data-note">
            {data.drugs.length} drugs · {data.kind === 'openfda' ? 'openFDA drug labeling' : 'development dataset'} · not full FDA coverage
          </p>
        )}
      </footer>

      <div ref={ghost} className="ghost" hidden aria-hidden="true" />
    </div>
  );
}

function Legend() {
  return (
    <ul className="legend" aria-label="Legend">
      <li>
        <svg viewBox="0 0 20 12" aria-hidden="true">
          <rect className="lg-therapeutic" x="1" y="1" width="18" height="10" rx="5" />
        </svg>
        Therapeutic
      </li>
      <li>
        <svg viewBox="0 0 20 12" aria-hidden="true">
          <rect className="lg-adverse" x="1" y="1" width="18" height="10" rx="5" />
        </svg>
        Adverse
      </li>
      <li>
        <svg viewBox="0 0 20 12" aria-hidden="true">
          <rect className="lg-warning" x="1" y="1" width="18" height="10" rx="5" />
        </svg>
        Warning
      </li>
      <li>
        <svg viewBox="0 0 20 12" aria-hidden="true">
          <circle className="lg-badge" cx="10" cy="6" r="5" />
        </svg>
        Drugs overlapping
      </li>
    </ul>
  );
}
