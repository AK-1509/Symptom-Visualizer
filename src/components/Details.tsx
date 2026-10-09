import { useState } from 'react';
import { REGION_INFO } from '../lib/anatomy.ts';
import {
  AGE_LABEL,
  SEX_LABEL,
  ageGroup,
  isAgeSpecificMatch,
  isSexSpecificMatch,
  regionDetails,
  regionStates,
  sexNotesFor,
  visualType,
  type Viewer,
} from '../lib/effects.ts';
import type { Drug, Effect, EffectType, Region, SexNote } from '../lib/types.ts';

interface DetailsProps {
  drug: Drug | null;
  region: Region | null;
  viewer: Viewer;
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
  if (e.sectionTitle === 'Highlights') return `${e.section} · Highlights${e.sectionNumber ? `, see Section ${e.sectionNumber}` : ''}`;
  const sub = [e.sectionNumber && `Section ${e.sectionNumber}`, e.sectionTitle].filter(Boolean).join(' ');
  return sub ? `${e.section} · ${sub}` : e.section;
}

function Glyph({ type }: { type: EffectType }) {
  return <span className={`glyph glyph-${visualType(type)}`} aria-hidden="true" />;
}

function EffectItem({ effect, viewer, muted }: { effect: Effect; viewer: Viewer; muted?: boolean }) {
  const emphasized = !muted && (isAgeSpecificMatch(effect, viewer.age) || isSexSpecificMatch(effect, viewer.sex));
  return (
    <li className={`effect${muted ? ' is-muted' : ''}${emphasized ? ' is-age' : ''}`}>
      {(effect.boxed || effect.ages || effect.sexes) && (
        <div className="tags">
          {effect.boxed && <span className="tag tag-boxed">Boxed warning</span>}
          {effect.ages?.map((a) => (
            <span key={a} className="tag">
              {AGE_LABEL[a]}
            </span>
          ))}
          {effect.sexes?.map((x) => (
            <span key={x} className="tag">
              {SEX_LABEL[x]}
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

function RegionChips({ drug, viewer, onSelectRegion }: { drug: Drug; viewer: Viewer; onSelectRegion: (r: Region) => void }) {
  const states = regionStates(drug, viewer);
  if (!states.size) return <p className="empty">No body regions are mapped from this label for this age and sex.</p>;
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

function Note({ title, note }: { title: string; note: { text: string; section: string; sectionNumber?: string } }) {
  return (
    <div className="age-note">
      <span className="eyebrow">
        {title}
        {note.sectionNumber ? ` · ${note.sectionNumber}` : ''}
      </span>
      <p>{note.text}</p>
    </div>
  );
}

/** Pregnancy, lactation, reproductive-potential and male/female pharmacokinetic text for the selected body. */
function SexNotes({ notes, sex, open }: { notes: SexNote[]; sex: Viewer['sex']; open: boolean }) {
  if (!notes.length) return null;
  const list = notes.map((n) => <Note key={n.topic} title={n.section === n.topic ? n.topic : `${n.topic} · ${n.section}`} note={n} />);
  if (open)
    return (
      <div className="sex-notes">
        <h3 className="eyebrow">{SEX_LABEL[sex]} label notes</h3>
        {list}
      </div>
    );
  return (
    <details className="other-ages sex-notes">
      <summary>
        {notes.length} {SEX_LABEL[sex]} label note{notes.length > 1 ? 's' : ''}
      </summary>
      {list}
    </details>
  );
}

export function Details({ drug, region, viewer, others, onSelectRegion, onSelectDrug, onClose }: DetailsProps) {
  if (!drug && !region) return null;
  const group = ageGroup(viewer.age);
  const sexNotes = drug ? sexNotesFor(drug, viewer.sex) : [];
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

      {ageNote && <Note title={ageNote.section} note={ageNote} />}

      {drug && region && <DrugRegion drug={drug} region={region} viewer={viewer} onSelectRegion={onSelectRegion} />}

      {drug && !region && (
        <>
          {drug.brands.length > 0 && <p className="brands">{drug.brands.join(' · ')}</p>}
          <h3 className="eyebrow">Mapped regions</h3>
          <RegionChips drug={drug} viewer={viewer} onSelectRegion={onSelectRegion} />
        </>
      )}

      {drug && <SexNotes notes={sexNotes} sex={viewer.sex} open={!region || region === 'reproductive'} />}

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

function DrugRegion({ drug, region, viewer, onSelectRegion }: { drug: Drug; region: Region; viewer: Viewer; onSelectRegion: (r: Region) => void }) {
  const details = regionDetails(drug, region, viewer);
  const order: EffectType[] = ['therapeutic', 'adverse', 'warning', 'contraindication'];
  const present = order.filter((t) => details[t].length);

  if (!present.length) {
    return (
      <div className="no-effect">
        <p className="empty">
          No effect is mapped to the {REGION_INFO[region].label.toLowerCase()} in the {drug.label.labelTitle || drug.name} label
          {details.other.length ? ` for ${SEX_LABEL[viewer.sex]}, ${AGE_LABEL[ageGroup(viewer.age)].toLowerCase()} patients` : ''}.
        </p>
        {details.other.length > 0 && <Other effects={details.other} viewer={viewer} />}
        <h3 className="eyebrow">Mapped regions</h3>
        <RegionChips drug={drug} viewer={viewer} onSelectRegion={onSelectRegion} />
      </div>
    );
  }

  return (
    <div className="sections">
      {present.map((type) => (
        <EffectGroup key={`${drug.id}-${region}-${type}`} type={type} effects={details[type]} viewer={viewer} />
      ))}
      {details.other.length > 0 && <Other effects={details.other} viewer={viewer} />}
    </div>
  );
}

const VISIBLE = 2;

function EffectGroup({ type, effects, viewer }: { type: EffectType; effects: Effect[]; viewer: Viewer }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? effects : effects.slice(0, VISIBLE);
  const hidden = effects.length - shown.length;
  return (
    <section className={`effect-group group-${visualType(type)}`}>
      <h3 className="eyebrow">
        <Glyph type={type} />
        {HEADINGS[type]}
      </h3>
      <ul>
        {shown.map((e, i) => (
          <EffectItem key={i} effect={e} viewer={viewer} />
        ))}
      </ul>
      {hidden > 0 && (
        <button className="more" onClick={() => setExpanded(true)}>
          Show {hidden} more
        </button>
      )}
    </section>
  );
}

function Other({ effects, viewer }: { effects: Effect[]; viewer: Viewer }) {
  return (
    <details className="other-ages">
      <summary>
        {effects.length} statement{effects.length > 1 ? 's' : ''} for another age group or sex
      </summary>
      <ul>
        {effects.map((e, i) => (
          <EffectItem key={i} effect={e} viewer={viewer} muted />
        ))}
      </ul>
    </details>
  );
}
