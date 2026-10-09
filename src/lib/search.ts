import type { Drug, Effect, Region } from './types.ts';

export interface SearchResult {
  drug: Drug;
  /** The name that matched: the generic name, a brand, an alias or the drug class. */
  matched: string;
  score: number;
}

interface Entry {
  drug: Drug;
  name: string;
  key: string;
  words: string[];
  kind: 'generic' | 'name' | 'class';
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

export interface SearchIndex {
  drugs: Drug[];
  entries: Entry[];
  /** Built on first full-text query (or ahead of time with warmTextIndex). */
  text?: TextIndex;
}

export function buildIndex(drugs: Drug[]): SearchIndex {
  const entries: Entry[] = [];
  for (const drug of drugs) {
    const names = [drug.name, ...drug.brands, ...(drug.aliases ?? [])];
    names.forEach((name, i) => {
      const key = norm(name);
      if (key) entries.push({ drug, name, key, words: key.split(' '), kind: i === 0 ? 'generic' : 'name' });
    });
    const cls = drug.drugClass && norm(drug.drugClass);
    if (cls) entries.push({ drug, name: drug.drugClass!, key: cls, words: cls.split(' '), kind: 'class' });
  }
  return { drugs, entries };
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
  // Classes match by whole words or prefixes only, and rank below names: "ssri", "proton pump".
  if (e.kind === 'class') return e.words.some((w) => w.startsWith(q)) || (q.includes(' ') && e.key.includes(q)) ? 50 : 0;
  if (e.key === q) return 100;
  if (e.key.startsWith(q)) return 90 - Math.min(e.key.length - q.length, 20) * 0.1;
  if (e.words.some((w) => w.startsWith(q))) return 75;
  if (q.length >= 3 && e.key.includes(q)) return 60;
  if (q.length >= 5) {
    // Typo tolerance on the prefix of the same length: "atorvastaton" → atorvastatin, "ozempc" → ozempic.
    const max = q.length >= 7 ? 2 : 1;
    const d = Math.min(...e.words.map((w) => distance(q, w.slice(0, q.length), max)), distance(q, e.key.slice(0, q.length), max));
    if (d <= max) return 40 - d * 10;
  }
  return 0;
}

/** Prefix and fuzzy search over generic names, brands, aliases and drug classes. One result per drug. */
export function search(index: SearchIndex, query: string, limit = 8): SearchResult[] {
  const q = norm(query);
  if (!q) return [];
  const best = new Map<string, SearchResult>();
  for (const e of index.entries) {
    const score = scoreEntry(e, q) + (e.kind === 'generic' ? 1 : 0);
    if (score <= 1) continue;
    const prev = best.get(e.drug.id);
    if (!prev || score > prev.score) best.set(e.drug.id, { drug: e.drug, matched: e.name, score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.drug.name.localeCompare(b.drug.name)).slice(0, limit);
}

/* ---------- Full-text search over label content ---------- */

const STOPWORDS = new Set(
  'a an and are as at be been by for from has have in is it its may of on or that the this to was were which with not no can'.split(' '),
);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tokenize = (text: string) => norm(text).split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t));

interface TextIndex {
  refs: { drug: Drug; effect: Effect }[];
  /** Lowercased terms and excerpts per ref, for phrase checks on candidates. */
  terms: string[];
  excerpts: string[];
  /** Sorted vocabulary, so a prefix maps to a contiguous range. */
  vocab: string[];
  postings: Map<string, number[]>;
}

function buildTextIndex(drugs: Drug[]): TextIndex {
  const refs: TextIndex['refs'] = [];
  const terms: string[] = [];
  const excerpts: string[] = [];
  const postings = new Map<string, number[]>();
  for (const drug of drugs)
    for (const effect of drug.effects) {
      const id = refs.length;
      refs.push({ drug, effect });
      terms.push(norm(effect.terms.join(' | ')));
      excerpts.push(norm(effect.excerpts.join(' ')));
      for (const token of new Set([...tokenize(effect.terms.join(' ')), ...tokenize(effect.excerpts.join(' '))])) {
        const list = postings.get(token);
        if (list) list.push(id);
        else postings.set(token, [id]);
      }
    }
  return { refs, terms, excerpts, vocab: [...postings.keys()].sort(), postings };
}

/** Build the full-text index now (e.g. when the browser is idle) instead of on the first query. */
export function warmTextIndex(index: SearchIndex): void {
  index.text ??= buildTextIndex(index.drugs);
}

/** Ref ids whose text has a token starting with `prefix`. */
function lookup(text: TextIndex, prefix: string): Set<number> {
  const out = new Set<number>();
  let lo = 0;
  let hi = text.vocab.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (text.vocab[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < text.vocab.length && text.vocab[i].startsWith(prefix); i++) for (const id of text.postings.get(text.vocab[i])!) out.add(id);
  return out;
}

export interface Snippet {
  text: string;
  mark: boolean;
}

export interface Mention {
  drug: Drug;
  region: Region;
  effect: Effect;
  /** What matched: a mapped term, or a stretch of label text with the query words marked. */
  term?: string;
  snippet: Snippet[];
  score: number;
}

export interface MentionResults {
  mentions: Mention[];
  /** Number of drugs whose label text matched, before the limit. */
  total: number;
}

/** Split text into marked and unmarked runs for every word starting with a query token. */
export function highlight(text: string, tokens: string[]): Snippet[] {
  if (!tokens.length) return [{ text, mark: false }];
  const re = new RegExp(`\\b(?:${tokens.map((t) => escape(t)).join('|')})[\\w-]*`, 'gi');
  const out: Snippet[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), mark: false });
    out.push({ text: m[0], mark: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mark: false });
  return out;
}

/** A window of about `width` characters around the first match. */
function window(text: string, tokens: string[], width = 120): string {
  const lower = text.toLowerCase();
  const hits = tokens.map((t) => lower.search(new RegExp(`\\b${escape(t)}`))).filter((i) => i >= 0);
  const at = hits.length ? Math.min(...hits) : 0;
  const start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  const from = start > 0 ? text.indexOf(' ', start) + 1 || start : 0;
  return `${from > 0 ? '…' : ''}${text.slice(from, end).trim()}${end < text.length ? '…' : ''}`;
}

const TYPE_WEIGHT = { warning: 4, contraindication: 3, adverse: 2, therapeutic: 1 } as const;

/**
 * Full-text search over mapped terms and quoted label sentences. Every query word must appear (as a word prefix)
 * in the same statement. Returns the best statement per drug: an exact term match first, then a phrase in the
 * text, then all words anywhere in the statement. Drugs in `exclude` (already matched by name) are skipped, since their
 * own labels repeat their names throughout.
 */
export function searchText(index: SearchIndex, query: string, limit = 6, exclude: ReadonlySet<string> = new Set()): MentionResults {
  const tokens = tokenize(query);
  const phrase = norm(query);
  if (!tokens.length || phrase.length < 3) return { mentions: [], total: 0 };
  warmTextIndex(index);
  const text = index.text!;
  // Intersect from the rarest word up.
  const [first, ...rest] = tokens.map((t) => lookup(text, t)).sort((a, b) => a.size - b.size);
  const candidates = [...first].filter((id) => rest.every((ids) => ids.has(id)));
  const best = new Map<string, Mention>();
  for (const id of candidates) {
    const { drug, effect } = text.refs[id];
    if (exclude.has(drug.id)) continue;
    const termHit = effect.terms.find((t) => norm(t) === phrase) ?? effect.terms.find((t) => norm(t).includes(phrase));
    const score =
      (termHit ? (norm(termHit) === phrase ? 100 : 80) : text.excerpts[id].includes(phrase) ? 50 : 20) +
      TYPE_WEIGHT[effect.type] +
      (effect.boxed ? 2 : 0) +
      (effect.excerpts.length ? 1 : 0);
    const prev = best.get(drug.id);
    if (prev && prev.score >= score) continue;
    const source = effect.excerpts.find((x) => tokens.every((t) => new RegExp(`\\b${escape(t)}`, 'i').test(x)));
    const snippetText = source ? window(source, tokens) : effect.terms.join(' · ');
    best.set(drug.id, { drug, region: effect.region, effect, term: termHit, snippet: highlight(snippetText, tokens), score });
  }
  const mentions = [...best.values()].sort((a, b) => b.score - a.score || a.drug.name.localeCompare(b.drug.name));
  return { mentions: mentions.slice(0, limit), total: mentions.length };
}
