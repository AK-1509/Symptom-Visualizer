import { describe, expect, it } from 'vitest';
import { FIXTURE_LABEL } from './__fixtures__/label.ts';
import { addActive, ageGroup, appliesAtAge, hydrate, regionDetails, regionOverlap, regionStates, removeActive } from './effects.ts';
import { buildDrug } from './extract.ts';
import type { Dataset } from './types.ts';

const dataset: Dataset = {
  kind: 'fixture',
  generatedAt: '',
  notice: '',
  drugs: [buildDrug({ id: 'fixturemab', name: 'Fixturemab' }, FIXTURE_LABEL, [FIXTURE_LABEL])],
};
const [drug] = hydrate(dataset);

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
    const states = regionStates(drug, 40);
    expect(states.get('stomach')).toEqual({ therapeutic: false, adverse: true, warning: false });
    expect(states.get('thyroid')).toEqual({ therapeutic: false, adverse: false, warning: true });
    expect(states.get('pancreas')).toMatchObject({ therapeutic: true, warning: true });
    expect(states.has('eyes')).toBe(false);
  });

  it('splits one region into therapeutic, adverse, warning and contraindication sections', () => {
    const d = regionDetails(drug, 'thyroid', 40);
    expect(d.warning.length).toBeGreaterThan(0);
    expect(d.contraindication.length).toBeGreaterThan(0);
    expect(d.adverse).toEqual([]);
  });

  it('counts overlapping drugs per region', () => {
    const overlap = regionOverlap([drug, { ...drug, id: 'copy' }], 40);
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
    expect(regionStates(drug, 40).get('pancreas')?.therapeutic).toBe(true);
    expect(regionStates(drug, 8).get('pancreas')?.therapeutic).toBe(false);
    const d = regionDetails(drug, 'pancreas', 8);
    expect(d.therapeutic).toEqual([]);
    expect(d.otherAges.some((e) => e.type === 'therapeutic')).toBe(true);
  });

  it('puts the matching age-specific statement first', () => {
    const d = regionDetails(drug, 'blood', 8);
    expect(d.warning[0].ages).toEqual(['pediatric']);
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
