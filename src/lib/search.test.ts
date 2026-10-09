import { describe, expect, it } from 'vitest';
import { FIXTURE_LABEL } from './__fixtures__/label.ts';
import { hydrate } from './effects.ts';
import { buildDrug } from './extract.ts';
import { buildIndex, highlight, search, searchText } from './search.ts';
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

describe('full-text search', () => {
  const [fixture] = hydrate({
    kind: 'fixture',
    generatedAt: '',
    notice: '',
    drugs: [buildDrug({ id: 'fixturemab', name: 'Fixturemab' }, FIXTURE_LABEL, [FIXTURE_LABEL, { ...FIXTURE_LABEL, set_id: 'other' }])],
  });
  const full = buildIndex([fixture, drug('metformin', 'Metformin', ['Glucophage'])]);

  it('finds a mapped term and points at its region', () => {
    const { mentions, total } = searchText(full, 'pancreatitis');
    expect(total).toBe(1);
    expect(mentions[0]).toMatchObject({ region: 'pancreas', term: 'Pancreatitis' });
    expect(mentions[0].effect.type).toBe('warning');
  });

  it('matches word prefixes and requires every word in the same statement', () => {
    expect(searchText(full, 'pancrea').total).toBe(1);
    expect(searchText(full, 'acute pancreatitis').mentions[0].region).toBe('pancreas');
    expect(searchText(full, 'pancreatitis zebra').total).toBe(0);
  });

  it('marks the matched words in the snippet', () => {
    const [m] = searchText(full, 'hypoglycemia pediatric').mentions;
    expect(m.snippet.filter((s) => s.mark).map((s) => s.text.toLowerCase())).toEqual(['hypoglycemia', 'pediatric']);
  });

  it('ignores stopwords and very short queries', () => {
    expect(searchText(full, 'of').total).toBe(0);
    expect(searchText(full, 'the and').total).toBe(0);
  });

  it('searches drug classes alongside names', () => {
    const [top] = search(full, 'receptor agonist');
    expect(top.drug.id).toBe('fixturemab');
    expect(top.matched).toBe('Fixture Receptor Agonist');
  });

  it('highlights word prefixes only', () => {
    expect(highlight('Nausea and nauseated', ['nause'])).toEqual([
      { text: 'Nausea', mark: true },
      { text: ' and ', mark: false },
      { text: 'nauseated', mark: true },
    ]);
  });
});
