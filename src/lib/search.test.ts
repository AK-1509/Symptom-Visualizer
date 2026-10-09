import { describe, expect, it } from 'vitest';
import { buildIndex, search } from './search.ts';
import type { Drug } from './types.ts';

/** Names only: search never reads effects. */
const drug = (id: string, name: string, brands: string[], aliases?: string[]): Drug => ({
  id,
  name,
  brands,
  aliases,
  label: { source: '', sourceUrl: '', labelDate: '', setId: '', labelTitle: '' },
  effects: [],
});

const index = buildIndex([
  drug('semaglutide', 'Semaglutide', ['Ozempic', 'Wegovy', 'Rybelsus']),
  drug('atorvastatin', 'Atorvastatin', ['Lipitor']),
  drug('lisinopril', 'Lisinopril', ['Zestril', 'Prinivil']),
  drug('acetaminophen', 'Acetaminophen', ['Tylenol'], ['Paracetamol']),
  drug('metformin', 'Metformin', ['Glucophage']),
]);
const ids = (q: string) => search(index, q).map((r) => r.drug.id);

describe('drug search', () => {
  it('finds generic names by prefix', () => {
    expect(ids('sema')[0]).toBe('semaglutide');
    expect(ids('MET')[0]).toBe('metformin');
  });

  it('finds brand names and reports the matched brand', () => {
    const [top] = search(index, 'ozem');
    expect(top.drug.id).toBe('semaglutide');
    expect(top.matched).toBe('Ozempic');
    expect(ids('lip')[0]).toBe('atorvastatin');
  });

  it('finds aliases', () => {
    expect(ids('paracet')[0]).toBe('acetaminophen');
  });

  it('tolerates small typos', () => {
    expect(ids('atorvastaton')[0]).toBe('atorvastatin');
    expect(ids('lisinoprl')[0]).toBe('lisinopril');
  });

  it('returns one result per drug and nothing for unknown names', () => {
    expect(ids('s').filter((id) => id === 'semaglutide')).toHaveLength(1);
    expect(ids('zzzzqq')).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });
});
