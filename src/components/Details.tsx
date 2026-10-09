import { REGION_INFO } from '../lib/anatomy.ts';
import { AGE_LABEL, ageGroup, isAgeSpecificMatch, regionDetails, regionStates, visualType } from '../lib/effects.ts';
import type { Drug, Effect, EffectType, Region } from '../lib/types.ts';

interface DetailsProps {
  drug: Drug | null;
  region: Region | null;
  age: number;
  /** Other active drugs with an applicable effect in the selected region. */
  others: Drug[];
  onSelectRegion: (r: Region) => void;
  onSelectDrug: (id: string) => void;
  onClose: () => void;
}

const HEADINGS: Record<EffectType, string> = {
  therapeutic: 'Therapeutic use',
  adverse: 'Adverse reactions',
  warning: 'Warnings',
  contraindication: 'Contraindications',
};

function sourceLine(e: Pick<Effect, 'section' | 'sectionNumber' | 'sectionTitle'>): string {
  const sub = [e.sectionNumber && `Section ${e.sectionNumber}`, e.sectionTitle].filter(Boolean).join(' ');
  return sub ? `${e.section} · ${sub}` : e.section;
}

function Glyph({ type }: { type: EffectType }) {
  return <span className={`glyph glyph-${visualType(type)}`} aria-hidden="true" />;
}

function EffectItem({ effect, age, muted }: { effect: Effect; age: number; muted?: boolean }) {
  const emphasized = !muted && isAgeSpecificMatch(effect, age);
  return (
    <li className={`effect${muted ? ' is-muted' : ''}${emphasized ? ' is-age' : ''}`}>
      {(effect.boxed || effect.ages) && (
        <div className="tags">
          {effect.boxed && <span className="tag tag-boxed">Boxed warning</span>}
          {effect.ages?.map((a) => (
            <span key={a} className="tag">
              {AGE_LABEL[a]}
            </span>
          ))}
        </div>
      )}
      {effect.terms.length > 0 && (
        <ul className="terms">
          {effect.terms.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {effect.excerpts.map((x, i) => (
        <blockquote key={i}>{x}</blockquote>
      ))}
      <p className="cite">
        {effect.excerpts.length ? '' : 'Listed in '}
        {sourceLine(effect)}
      </p>
    </li>
  );
}

function SourceFooter({ drug }: { drug: Drug }) {
  const { label } = drug;
  return (
    <footer className="source">
      <span className="eyebrow">Source</span>
      {label.sourceUrl ? (
        <a href={label.sourceUrl} target="_blank" rel="noreferrer">
          {label.source}
        </a>
      ) : (
        <span>{label.source || 'No source information available'}</span>
      )}
      <span className="source-meta">
        {label.labelTitle} label{label.labelDate ? ` · ${label.labelDate}` : ''}
      </span>
      <span className="source-meta">Regions are mapped from label wording by keyword.</span>
    </footer>
  );
}

function RegionChips({ drug, age, onSelectRegion }: { drug: Drug; age: number; onSelectRegion: (r: Region) => void }) {
  const states = regionStates(drug, age);
  if (!states.size) return <p className="empty">No body regions are mapped from this label at this age.</p>;
  return (
    <ul className="chips">
      {[...states.entries()].map(([region, s]) => (
        <li key={region}>
          <button className="chip" onClick={() => onSelectRegion(region)}>
            {s.therapeutic && <Glyph type="therapeutic" />}
            {s.adverse && <Glyph type="adverse" />}
            {s.warning && <Glyph type="warning" />}
            {REGION_INFO[region].label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Details({ drug, region, age, others, onSelectRegion, onSelectDrug, onClose }: DetailsProps) {
  if (!drug && !region) return null;
  const group = ageGroup(age);
  const ageNote = drug && group !== 'adult' ? drug.ageNotes?.[group] : undefined;

  return (
    <aside className="details" aria-label="Details" aria-live="polite">
      <header className="details-head">
        <div>
          {drug && <p className="eyebrow details-drug">{drug.name}</p>}
          <h2>{region ? REGION_INFO[region].label : drug?.drugClass ?? 'Overview'}</h2>
        </div>
        <button className="icon-btn" aria-label="Close details" onClick={onClose}>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3 L9 9 M9 3 L3 9" />
          </svg>
        </button>
      </header>

      {ageNote && (
        <div className="age-note">
          <span className="eyebrow">
            {ageNote.section}
            {ageNote.sectionNumber ? ` · ${ageNote.sectionNumber}` : ''}
          </span>
          <p>{ageNote.text}</p>
        </div>
      )}

      {drug && region && <DrugRegion drug={drug} region={region} age={age} onSelectRegion={onSelectRegion} />}

      {drug && !region && (
        <>
          {drug.brands.length > 0 && <p className="brands">{drug.brands.join(' · ')}</p>}
          <h3 className="eyebrow">Mapped regions</h3>
          <RegionChips drug={drug} age={age} onSelectRegion={onSelectRegion} />
        </>
      )}

      {!drug && region && (
        <p className="empty">{others.length ? 'Select a drug to read its label information here.' : 'Add a drug to see label information for this region.'}</p>
      )}

      {region && others.length > 0 && (
        <div className="others">
          <h3 className="eyebrow">{drug ? 'Also mapped here' : 'Mapped here'}</h3>
          <ul className="chips">
            {others.map((o) => (
              <li key={o.id}>
                <button className="chip" onClick={() => onSelectDrug(o.id)}>
                  {o.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {drug && <SourceFooter drug={drug} />}
    </aside>
  );
}

function DrugRegion({ drug, region, age, onSelectRegion }: { drug: Drug; region: Region; age: number; onSelectRegion: (r: Region) => void }) {
  const details = regionDetails(drug, region, age);
  const order: EffectType[] = ['therapeutic', 'adverse', 'warning', 'contraindication'];
  const present = order.filter((t) => details[t].length);

  if (!present.length) {
    return (
      <div className="no-effect">
        <p className="empty">
          No effect is mapped to the {REGION_INFO[region].label.toLowerCase()} in the {drug.label.labelTitle || drug.name} label
          {details.otherAges.length ? ` for ${AGE_LABEL[ageGroup(age)].toLowerCase()} patients` : ''}.
        </p>
        {details.otherAges.length > 0 && <OtherAges effects={details.otherAges} age={age} />}
        <h3 className="eyebrow">Mapped regions</h3>
        <RegionChips drug={drug} age={age} onSelectRegion={onSelectRegion} />
      </div>
    );
  }

  return (
    <div className="sections">
      {present.map((type) => (
        <section key={type} className={`effect-group group-${visualType(type)}`}>
          <h3 className="eyebrow">
            <Glyph type={type} />
            {HEADINGS[type]}
          </h3>
          <ul>
            {details[type].map((e, i) => (
              <EffectItem key={i} effect={e} age={age} />
            ))}
          </ul>
        </section>
      ))}
      {details.otherAges.length > 0 && <OtherAges effects={details.otherAges} age={age} />}
    </div>
  );
}

function OtherAges({ effects, age }: { effects: Effect[]; age: number }) {
  return (
    <details className="other-ages">
      <summary>
        {effects.length} statement{effects.length > 1 ? 's' : ''} for other age groups
      </summary>
      <ul>
        {effects.map((e, i) => (
          <EffectItem key={i} effect={e} age={age} muted />
        ))}
      </ul>
    </details>
  );
}
