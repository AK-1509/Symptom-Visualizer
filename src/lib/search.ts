import type { Drug } from './types.ts';

export interface SearchResult {
  drug: Drug;
  /** The name that matched: the generic name, a brand or an alias. */
  matched: string;
  score: number;
}

interface Entry {
  drug: Drug;
  name: string;
  key: string;
  words: string[];
  generic: boolean;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

export interface SearchIndex {
  entries: Entry[];
}

export function buildIndex(drugs: Drug[]): SearchIndex {
  const entries: Entry[] = [];
  for (const drug of drugs) {
    const names = [drug.name, ...drug.brands, ...(drug.aliases ?? [])];
    names.forEach((name, i) => {
      const key = norm(name);
      if (key) entries.push({ drug, name, key, words: key.split(' '), generic: i === 0 });
    });
  }
  return { entries };
}

/** Levenshtein distance with an early exit once it exceeds `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function scoreEntry(e: Entry, q: string): number {
  if (e.key === q) return 100;
  if (e.key.startsWith(q)) return 90 - Math.min(e.key.length - q.length, 20) * 0.1;
  if (e.words.some((w) => w.startsWith(q))) return 75;
  if (q.length >= 3 && e.key.includes(q)) return 60;
  if (q.length >= 4) {
    // Typo tolerance on the prefix of the same length: "atorvastaton" → atorvastatin, "ozmp" → ozempic.
    const max = q.length >= 7 ? 2 : 1;
    const d = Math.min(...e.words.map((w) => distance(q, w.slice(0, q.length), max)), distance(q, e.key.slice(0, q.length), max));
    if (d <= max) return 40 - d * 10;
  }
  return 0;
}

/** Prefix and fuzzy search over generic names, brands and aliases. One result per drug. */
export function search(index: SearchIndex, query: string, limit = 8): SearchResult[] {
  const q = norm(query);
  if (!q) return [];
  const best = new Map<string, SearchResult>();
  for (const e of index.entries) {
    const score = scoreEntry(e, q) + (e.generic ? 1 : 0);
    if (score <= 1) continue;
    const prev = best.get(e.drug.id);
    if (!prev || score > prev.score) best.set(e.drug.id, { drug: e.drug, matched: e.name, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.drug.name.localeCompare(b.drug.name)).slice(0, limit);
}
