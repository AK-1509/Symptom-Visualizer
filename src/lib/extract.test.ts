import { describe, expect, it } from 'vitest';
import { FIXTURE_LABEL } from './__fixtures__/label.ts';
import {
  buildDrug,
  collectBrands,
  detectAges,
  extractEffects,
  normalizeGeneric,
  pickLabel,
  segmentSection,
  splitHeading,
  type OpenFdaLabel,
} from './extract.ts';

const effects = extractEffects(FIXTURE_LABEL);
const find = (region: string, type: string, section?: string) =>
  effects.filter((e) => e.region === region && e.type === type && (!section || e.section === section));

describe('label extraction', () => {
  it('extracts adverse reactions for the stomach with verbatim text and its subsection', () => {
    const [stomach] = find('stomach', 'adverse');
    expect(stomach.terms).toEqual(expect.arrayContaining(['Nausea', 'Vomiting', 'Abdominal pain']));
    expect(stomach.excerpts[0]).toBe(
      'The most common adverse reactions, reported in ≥5% of patients, are nausea, vomiting, diarrhea, abdominal pain and constipation.',
    );
    expect(stomach.section).toBe('Adverse Reactions');
    expect(stomach.sectionNumber).toBe('6.1');
  });

  it('keeps terms found only in tables but never quotes table text', () => {
    const [brain] = find('brain', 'adverse');
    expect(brain.terms).toEqual(['Headache']);
    expect(brain.excerpts).toEqual([]);
  });

  it('marks boxed warnings and keeps their title', () => {
    const [thyroid] = find('thyroid', 'warning', 'Boxed Warning');
    expect(thyroid.boxed).toBe(true);
    expect(thyroid.sectionTitle).toBe('WARNING: RISK OF THYROID C-CELL TUMORS');
    expect(thyroid.excerpts[0]).toMatch(/^In rodents, fixturemab causes thyroid C-cell tumors\.$/);
  });

  it('detects warnings subsection numbers and headings', () => {
    const [pancreas] = find('pancreas', 'warning');
    expect(pancreas.sectionNumber).toBe('5.2');
    expect(pancreas.sectionTitle).toBe('Pancreatitis');
    expect(pancreas.excerpts[0]).toBe('Acute pancreatitis, including fatal cases, has been observed in patients treated with fixturemab.');
  });

  it('takes therapeutic effects from indications but skips limitations of use', () => {
    const therapeutic = find('pancreas', 'therapeutic');
    expect(therapeutic).toHaveLength(1);
    expect(therapeutic[0].terms).toEqual(expect.arrayContaining(['Glycemic control', 'Type 2 diabetes mellitus']));
    expect(therapeutic[0].excerpts.join(' ')).not.toMatch(/type 1|pancreatitis/i);
    expect(therapeutic[0].ages).toEqual(['adult']);
  });

  it('tags age-specific sentences and leaves the rest for all ages', () => {
    const blood = find('blood', 'warning');
    expect(blood.map((e) => e.ages)).toEqual(expect.arrayContaining([undefined, ['pediatric']]));
  });

  it('builds a drug with provenance, class, brands and age notes', () => {
    const drug = buildDrug({ id: 'fixturemab', name: 'Fixturemab' }, FIXTURE_LABEL, [FIXTURE_LABEL, { ...FIXTURE_LABEL, set_id: 'other' }]);
    expect(drug.label).toEqual({
      source: 'FDA Prescribing Information',
      sourceUrl: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=00000000-0000-0000-0000-000000000000',
      labelDate: '2024-01-15',
      setId: '00000000-0000-0000-0000-000000000000',
      labelTitle: 'Zovarex',
    });
    expect(drug.drugClass).toBe('Fixture Receptor Agonist');
    // A class asserted by a single label is not trusted; without one, the label's own "is a ... indicated" wording is used.
    expect(buildDrug({ id: 'f', name: 'Fixturemab' }, FIXTURE_LABEL, []).drugClass).toBeUndefined();
    expect(drug.brands).toEqual(['Zovarex']);
    expect(drug.ageNotes?.pediatric?.text).toBe('Safety and effectiveness of ZOVAREX have not been established in pediatric patients.');
    expect(drug.ageNotes?.pediatric?.sectionNumber).toBe('8.4');
  });
});

describe('age carry-over', () => {
  it('applies a lead-in age group to the bullets that follow it', () => {
    const effects = extractEffects({
      set_id: 'x',
      effective_time: '20240101',
      indications_and_usage: ['1 INDICATIONS AND USAGE ZOVAREX is indicated in adults for: • Hypertension • Heart failure ZOVAREX is indicated for asthma.'],
    });
    expect(effects.find((e) => e.region === 'heart')?.ages).toEqual(['adult']);
    expect(effects.find((e) => e.region === 'lungs')?.ages).toBeUndefined();
  });
});

describe('extraction helpers', () => {
  it('splits flattened subsection headings from their first sentence', () => {
    expect(splitHeading('Clinical Trials Experience Because clinical trials are conducted')).toEqual({
      title: 'Clinical Trials Experience',
      body: 'Because clinical trials are conducted',
    });
    expect(splitHeading('Patients receiving insulin may')).toEqual({ body: 'Patients receiving insulin may' });
  });

  it('ignores decimals that are not subsection headings', () => {
    const segs = segmentSection('5 WARNINGS AND PRECAUTIONS 5.1 Risk A dose of 0.5 mg and 5.5 mg was given.', '5');
    expect(segs.map((s) => s.number)).toEqual(['5.1']);
  });

  it('detects age groups', () => {
    expect(detectAges('in pediatric patients 10 years and older')).toEqual(['pediatric']);
    expect(detectAges('in adults and pediatric patients')).toEqual(['adult', 'pediatric']);
    expect(detectAges('patients 65 years of age and older')).toEqual(['geriatric']);
    expect(detectAges('in patients with renal impairment')).toBeUndefined();
  });

  it('normalizes generic names by stripping salts', () => {
    expect(normalizeGeneric('ATORVASTATIN CALCIUM')).toBe('atorvastatin');
    expect(normalizeGeneric('Metformin Hydrochloride')).toBe('metformin');
    expect(normalizeGeneric('AMOXICILLIN AND CLAVULANATE POTASSIUM')).toBe('amoxicillin and clavulanate');
  });

  it('prefers the configured brand label and ignores combination products for labels and brands', () => {
    const base = { set_id: 'x', effective_time: '20200101', adverse_reactions: ['6 ADVERSE REACTIONS'] };
    const labels: OpenFdaLabel[] = [
      { ...base, set_id: 'generic', effective_time: '20250101', openfda: { generic_name: ['ATORVASTATIN CALCIUM'], brand_name: ['Atorvastatin Calcium'] } },
      { ...base, set_id: 'brand', openfda: { generic_name: ['ATORVASTATIN CALCIUM'], brand_name: ['LIPITOR'] } },
      { ...base, set_id: 'combo', openfda: { generic_name: ['AMLODIPINE AND ATORVASTATIN'], brand_name: ['CADUET'] } },
    ];
    expect(pickLabel(labels, { id: 'atorvastatin', name: 'Atorvastatin', brand: 'Lipitor' })?.set_id).toBe('brand');
    expect(pickLabel(labels, { id: 'atorvastatin', name: 'Atorvastatin' })?.set_id).toBe('generic');
    expect(collectBrands(labels, { id: 'atorvastatin', name: 'Atorvastatin' })).toEqual(['Lipitor']);
  });
});
