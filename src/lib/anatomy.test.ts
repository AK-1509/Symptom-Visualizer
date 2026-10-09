import { describe, expect, it } from 'vitest';
import { mapToRegions, matchTerms } from './anatomy.ts';

describe('anatomy mapping', () => {
  it.each([
    ['Hepatic adverse reactions have been reported.', 'liver'],
    ['Cases of hepatotoxicity were observed.', 'liver'],
    ['Use with caution in renal impairment.', 'kidneys'],
    ['Nephrotoxicity has occurred.', 'kidneys'],
    ['Cardiac arrhythmias were reported.', 'heart'],
    ['Cardiovascular events', 'heart'],
    ['Gastric ulceration', 'stomach'],
    ['Pulmonary toxicity', 'lungs'],
    ['Neurologic reactions', 'nervous_system'],
    ['Dermatologic reactions', 'skin'],
  ])('maps "%s" to %s', (text, region) => {
    expect(mapToRegions(text)).toContain(region);
  });

  it('maps gastrointestinal wording to both stomach and intestines', () => {
    expect(mapToRegions('Severe gastrointestinal adverse reactions')).toEqual(expect.arrayContaining(['stomach', 'intestines']));
  });

  it('reports specific terms and suppresses the generic word they contain', () => {
    const matches = matchTerms('Hepatic failure has been reported.');
    expect(matches.map((m) => m.term)).toEqual(['Liver failure']);
  });

  it('keeps generic anatomical words out of the named terms', () => {
    const matches = matchTerms('Monitor renal function.');
    expect(matches).toEqual([{ term: 'Kidneys', regions: ['kidneys'], generic: true }]);
  });

  it('does not match inside other words', () => {
    expect(mapToRegions('The address was overstated.')).toEqual([]);
  });
});
