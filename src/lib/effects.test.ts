import { describe, expect, it } from 'vitest';
import { FIXTURE_LABEL } from './__fixtures__/label.ts';
import {
  addActive,
  ageGroup,
  appliesAtAge,
  appliesToSex,
  hydrate,
  regionDetails,
  regionOverlap,
  regionStates,
  removeActive,
  sexNotesFor,
  specificCounts,
} from './effects.ts';
import { buildDrug } from './extract.ts';
import type { Dataset, Sex } from './types.ts';

const dataset: Dataset = {
  kind: 'fixture',
  generatedAt: '',
  notice: '',
  drugs: [buildDrug({ id: 'fixturemab', name: 'Fixturemab' }, FIXTURE_LABEL, [FIXTURE_LABEL])],
};
const [drug] = hydrate(dataset);
const v = (age: number, sex: Sex = 'amab') => ({ age, sex });

describe('effect lookup', () => {
  it('attaches source, sourceUrl, section and labelDate to every effect', () => {
    expect(drug.effects.length).toBeGreaterThan(5);
    for (const e of drug.effects) {
      expect(e.source).toBeTruthy();
      expect(e.sourceUrl).toMatch(/^https:\/\/dailymed\.nlm\.nih\.gov\//);
      expect(e.section).toBeTruthy();
      expect(e.labelDate).toBe('2024-01-15');
    }
  });

  it('computes region states with distinct effect types', () => {
    const states = regionStates(drug, v(40));
    expect(states.get('stomach')).toEqual({ therapeutic: false, adverse: true, warning: false });
    expect(states.get('thyroid')).toEqual({ therapeutic: false, adverse: false, warning: true });
    expect(states.get('pancreas')).toMatchObject({ therapeutic: true, warning: true });
    expect(states.has('eyes')).toBe(false);
  });

  it('splits one region into therapeutic, adverse, warning and contraindication sections', () => {
    const d = regionDetails(drug, 'thyroid', v(40));
    expect(d.warning.length).toBeGreaterThan(0);
    expect(d.contraindication.length).toBeGreaterThan(0);
    expect(d.adverse).toEqual([]);
  });

  it('counts overlapping drugs per region', () => {
    const overlap = regionOverlap([drug, { ...drug, id: 'copy' }], v(40));
    expect(overlap.get('stomach')?.map((d) => d.id)).toEqual(['fixturemab', 'copy']);
  });
});

describe('age filtering', () => {
  it('groups ages', () => {
    expect([0, 17, 18, 64, 65, 100].map(ageGroup)).toEqual(['pediatric', 'pediatric', 'adult', 'adult', 'geriatric', 'geriatric']);
  });

  it('applies untagged effects at every age and tagged effects only to their group', () => {
    expect(appliesAtAge({}, 5)).toBe(true);
    expect(appliesAtAge({ ages: ['pediatric'] }, 5)).toBe(true);
    expect(appliesAtAge({ ages: ['pediatric'] }, 40)).toBe(false);
    expect(appliesAtAge({ ages: ['adult'] }, 80)).toBe(true);
    expect(appliesAtAge({ ages: ['geriatric'] }, 40)).toBe(false);
  });

  it('removes adult-only indications from the map for a child and moves them to other ages', () => {
    expect(regionStates(drug, v(40)).get('pancreas')?.therapeutic).toBe(true);
    expect(regionStates(drug, v(8)).get('pancreas')?.therapeutic).toBe(false);
    const d = regionDetails(drug, 'pancreas', v(8));
    expect(d.therapeutic).toEqual([]);
    expect(d.other.some((e) => e.type === 'therapeutic')).toBe(true);
  });

  it('puts the matching age-specific statement first', () => {
    const d = regionDetails(drug, 'blood', v(8));
    expect(d.warning[0].ages).toEqual(['pediatric']);
  });
});

describe('sex filtering', () => {
  it('applies untagged effects to both and tagged effects only to that sex', () => {
    expect(appliesToSex({}, 'afab')).toBe(true);
    expect(appliesToSex({ sexes: ['afab'] }, 'afab')).toBe(true);
    expect(appliesToSex({ sexes: ['afab'] }, 'amab')).toBe(false);
  });

  it('maps a pregnancy-specific contraindication only for AFAB and lists it as other for AMAB', () => {
    expect(regionStates(drug, v(30, 'afab')).get('reproductive')?.warning).toBe(true);
    expect(regionStates(drug, v(30, 'amab')).has('reproductive')).toBe(false);
    const d = regionDetails(drug, 'reproductive', v(30, 'amab'));
    expect(d.contraindication).toEqual([]);
    expect(d.other.map((e) => e.sexes)).toEqual([['afab']]);
    expect(specificCounts(drug, v(30, 'afab')).sex).toBe(1);
  });

  it('selects sex notes for the viewer', () => {
    expect(sexNotesFor(drug, 'afab').map((n) => n.topic)).toEqual(['Pregnancy', 'Lactation', 'Male and female differences']);
    expect(sexNotesFor(drug, 'amab').map((n) => n.topic)).toEqual(['Male and female differences']);
  });
});

describe('active drugs', () => {
  it('prevents duplicates', () => {
    const once = addActive([], 'semaglutide');
    expect(addActive(once, 'semaglutide')).toBe(once);
    expect(addActive(once, 'metformin')).toEqual(['semaglutide', 'metformin']);
  });

  it('removes a drug', () => {
    expect(removeActive(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});
