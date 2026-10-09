/**
 * Deterministic extraction of body-region effects from an openFDA drug label.
 * Used by the data build script (scripts/build-data.ts) and unit tests; never by the browser.
 */
import { matchTerms } from './anatomy.ts';
import type { AgeGroup, AgeNote, EffectType, LabelSource, Region, StoredDrug, StoredEffect } from './types.ts';

/** The subset of an openFDA /drug/label.json result this pipeline reads. */
export interface OpenFdaLabel {
  set_id: string;
  effective_time: string;
  indications_and_usage?: string[];
  adverse_reactions?: string[];
  warnings_and_cautions?: string[];
  warnings?: string[];
  boxed_warning?: string[];
  contraindications?: string[];
  do_not_use?: string[];
  stop_use?: string[];
  pediatric_use?: string[];
  geriatric_use?: string[];
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    pharm_class_epc?: string[];
    product_type?: string[];
  };
}

interface SectionSpec {
  field: keyof OpenFdaLabel;
  section: string;
  type: EffectType;
  /** PLR section number; subsection numbers must start with it. */
  major?: string;
  boxed?: boolean;
}

export const SECTIONS: SectionSpec[] = [
  { field: 'boxed_warning', section: 'Boxed Warning', type: 'warning', boxed: true },
  { field: 'indications_and_usage', section: 'Indications and Usage', type: 'therapeutic', major: '1' },
  { field: 'contraindications', section: 'Contraindications', type: 'contraindication', major: '4' },
  { field: 'warnings_and_cautions', section: 'Warnings and Precautions', type: 'warning', major: '5' },
  { field: 'warnings', section: 'Warnings', type: 'warning' },
  { field: 'do_not_use', section: 'Do Not Use', type: 'contraindication' },
  { field: 'stop_use', section: 'Stop Use', type: 'warning' },
  { field: 'adverse_reactions', section: 'Adverse Reactions', type: 'adverse', major: '6' },
];

const SECTION_TITLES =
  /^\s*(?:\d{1,2}\s+)?(?:INDICATIONS\s*(?:AND|&)\s*USAGE|ADVERSE REACTIONS|WARNINGS\s*(?:AND|&)\s*PRECAUTIONS|CONTRAINDICATIONS|WARNINGS|PRECAUTIONS|DO NOT USE|STOP USE(?: AND ASK A DOCTOR IF)?)\b[:.]?\s*/i;

const MAX_EXCERPT = 280;
const MIN_EXCERPT = 35;
const MAX_EXCERPTS = 2;
const MAX_TERMS = 8;

/** Remove cross-references and normalize whitespace without changing the wording of a claim. */
export function cleanText(text: string): string {
  return text
    .replace(/\s*\[\s*see[^\]]*\]/gi, '')
    .replace(/\s*\(\s*\d{1,2}(?:\.\d{1,2})?(?:\s*,\s*\d{1,2}(?:\.\d{1,2})?)*\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

const CONNECTORS = new Set(['of', 'and', 'or', 'in', 'with', 'the', 'to', 'for', 'a', 'an', 'on', 'at', 'by', 'from', 'vs', 'during', '&']);
const isCapitalized = (w: string) => /^[A-Z0-9(]/.test(w);

/**
 * Split a flattened "5.2 Pancreatitis Acute pancreatitis, including..." run into a heading
 * ("Pancreatitis") and its body ("Acute pancreatitis, including..."). The heading is the run of
 * capitalized words that ends right before the capitalized word that starts the first sentence.
 */
export function splitHeading(text: string): { title?: string; body: string } {
  const words = text.split(' ');
  let firstLower = -1;
  for (let i = 0; i < words.length && i < 14; i++) {
    const w = words[i];
    if (!isCapitalized(w) && !CONNECTORS.has(w)) {
      firstLower = i;
      break;
    }
  }
  // The sentence starts at the last capitalized non-connector word before the first lowercase word
  // ("Pediatric Use | Safety and effectiveness ...").
  let start = firstLower - 1;
  while (start > 0 && CONNECTORS.has(words[start])) start--;
  if (start < 1) return { body: text };
  const title = words.slice(0, start).join(' ');
  if (/[.:;]$/.test(title) || title.length > 90) return { body: text };
  return { title, body: words.slice(start).join(' ') };
}

interface Segment {
  number?: string;
  title?: string;
  text: string;
}

/** Break section text at PLR subsection headings ("5.1 ", "6.2 ") that belong to the section's major number. */
export function segmentSection(raw: string, major?: string): Segment[] {
  let text = cleanText(raw).replace(SECTION_TITLES, '');
  if (!major) return [{ text }];
  const heading = new RegExp(`(?:^|\\s)(${major}\\.\\d{1,2})\\s+(?=[A-Z])`, 'g');
  const cuts: { index: number; number: string; length: number }[] = [];
  for (const m of text.matchAll(heading)) cuts.push({ index: m.index!, number: m[1], length: m[0].length });
  if (!cuts.length) return [{ text }];
  const out: Segment[] = [];
  if (cuts[0].index > 0) out.push({ text: text.slice(0, cuts[0].index).trim() });
  cuts.forEach((c, i) => {
    const chunk = text.slice(c.index + c.length, i + 1 < cuts.length ? cuts[i + 1].index : undefined).trim();
    const { title, body } = splitHeading(chunk);
    out.push({ number: c.number, title, text: body });
  });
  return out.filter((s) => s.text);
}

/** Sentence split on terminal punctuation followed by an uppercase start, plus bullets. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(•“"])|\s*•\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

/** Flattened tables read as runs of numbers and percentages. */
export function isTableLike(sentence: string): boolean {
  const digits = (sentence.match(/\d/g) ?? []).length;
  const percents = (sentence.match(/%/g) ?? []).length;
  return /\bTable \d/i.test(sentence) || percents > 3 || digits / sentence.length > 0.12 || sentence.length > 600;
}

export function detectAges(sentence: string): AgeGroup[] | undefined {
  const s = sentence.toLowerCase();
  const ages = new Set<AgeGroup>();
  if (/\b(pediatric|paediatric|children|child|adolescents?|infants?|neonates?|newborns?)\b/.test(s)) ages.add('pediatric');
  if (/\b(geriatric|elderly|older adults|older patients|65 years (of age )?(and|or) older|aged 65)\b/.test(s)) ages.add('geriatric');
  if (/\badults?\b/.test(s)) ages.add('adult');
  return ages.size ? [...ages].sort() : undefined;
}

const EXCLUDED_THERAPEUTIC = /\b(not indicated|not recommended|has not been (studied|established)|have not been (studied|established)|not for use|limitations? of use|should not be used)\b/i;

function truncate(sentence: string): string {
  if (sentence.length <= MAX_EXCERPT) return sentence;
  const cut = sentence.slice(0, MAX_EXCERPT);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

function excerptScore(sentence: string, type: EffectType): number {
  let score = 0;
  if (type === 'adverse' && /most common|most frequent|commonly/i.test(sentence)) score += 50;
  if (/\b(fatal|serious|severe)\b/i.test(sentence)) score += 10;
  if (sentence.length > MAX_EXCERPT) score -= 20;
  if (sentence.length < 40) score -= 15;
  return score;
}

interface Hit {
  region: Region;
  type: EffectType;
  section: string;
  boxed: boolean;
  number?: string;
  title?: string;
  terms: string[];
  sentence: string;
  clean: boolean;
  ages?: AgeGroup[];
  order: number;
}

/** Extract the per-region effect records for a label. */
export function extractEffects(label: OpenFdaLabel): StoredEffect[] {
  const hits: Hit[] = [];
  let order = 0;
  for (const spec of SECTIONS) {
    const values = label[spec.field];
    if (!Array.isArray(values)) continue;
    if (spec.field === 'warnings' && label.warnings_and_cautions?.length) continue;
    for (const raw of values) {
      let segments = segmentSection(raw, spec.major);
      let boxedTitle: string | undefined;
      if (spec.boxed) [segments, boxedTitle] = stripBoxedTitle(segments);
      for (const seg of segments) {
        let limited = false;
        for (const sentence of splitSentences(seg.text)) {
          order++;
          if (spec.type === 'therapeutic') {
            if (/limitations? of use/i.test(sentence)) limited = true;
            if (limited || EXCLUDED_THERAPEUTIC.test(sentence)) continue;
          }
          const matches = matchTerms(sentence);
          if (!matches.length) continue;
          const ages = detectAges(sentence);
          const byRegion = new Map<Region, string[]>();
          for (const m of matches) {
            for (const r of m.regions) {
              const list = byRegion.get(r) ?? [];
              if (!m.generic) list.push(m.term);
              byRegion.set(r, list);
            }
          }
          for (const [region, terms] of byRegion) {
            hits.push({
              region,
              type: spec.type,
              section: spec.section,
              boxed: !!spec.boxed,
              number: seg.number,
              title: seg.title ?? boxedTitle,
              terms,
              sentence,
              clean: !isTableLike(sentence),
              ages,
              order,
            });
          }
        }
      }
    }
  }
  return groupHits(hits);
}

function stripBoxedTitle(segments: Segment[]): [Segment[], string | undefined] {
  if (!segments.length) return [segments, undefined];
  const [first, ...rest] = segments;
  const m = first.text.match(/^((?:BOXED )?WARNING:?\s+(?:[A-Z0-9,;:&()/'’-]+\s+)+)/);
  if (!m) return [segments, undefined];
  const words = m[1].trim().split(' ');
  // The last all-caps word may be the brand name that starts the first sentence ("... TUMORS OZEMPIC causes").
  const next = first.text.slice(m[1].length).split(' ')[0] ?? '';
  const keepLast = /^[a-z]/.test(next) && words.length > 1;
  const titleWords = keepLast ? words.slice(0, -1) : words;
  const body = (keepLast ? `${words.at(-1)} ` : '') + first.text.slice(m[1].length);
  const title = titleWords.join(' ').replace(/^(BOXED )?WARNING:?\s*/, '').trim();
  return [[{ ...first, text: body.trim() }, ...rest], title ? `WARNING: ${title}` : undefined];
}

function groupHits(hits: Hit[]): StoredEffect[] {
  const groups = new Map<string, Hit[]>();
  for (const h of hits) {
    const key = [h.region, h.type, h.section, h.ages?.join(',') ?? ''].join('|');
    const list = groups.get(key) ?? [];
    list.push(h);
    groups.set(key, list);
  }
  const effects: StoredEffect[] = [];
  for (const list of groups.values()) {
    const termCounts = new Map<string, { count: number; first: number }>();
    for (const h of list)
      for (const t of h.terms) {
        const c = termCounts.get(t) ?? { count: 0, first: h.order };
        c.count++;
        termCounts.set(t, c);
      }
    const terms = [...termCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[1].first - b[1].first)
      .slice(0, MAX_TERMS)
      .map(([t]) => t);
    const clean = list
      .filter((h) => h.clean && h.sentence.length >= MIN_EXCERPT)
      .sort((a, b) => excerptScore(b.sentence, b.type) - excerptScore(a.sentence, a.type) || a.order - b.order);
    const chosen: Hit[] = [];
    for (const h of clean) {
      if (chosen.length >= MAX_EXCERPTS) break;
      if (!chosen.some((c) => c.sentence === h.sentence)) chosen.push(h);
    }
    if (!terms.length && !chosen.length) continue;
    const lead = chosen[0] ?? list[0];
    const effect: StoredEffect = {
      region: lead.region,
      type: lead.type,
      terms,
      excerpts: chosen.map((h) => truncate(h.sentence)),
      section: lead.section,
    };
    if (lead.number) effect.sectionNumber = lead.number;
    if (lead.title) effect.sectionTitle = lead.title;
    if (lead.ages) effect.ages = lead.ages;
    if (lead.boxed) effect.boxed = true;
    effects.push(effect);
  }
  return effects.sort((a, b) => a.region.localeCompare(b.region) || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
}

const TYPE_ORDER: Record<EffectType, number> = { therapeutic: 0, warning: 1, contraindication: 2, adverse: 3 };

function ageNote(values: string[] | undefined, section: string, major: string): AgeNote | undefined {
  if (!values?.length) return undefined;
  const segments = segmentSection(values[0], major);
  const seg = segments.find((s) => s.text) ?? segments[0];
  if (!seg) return undefined;
  const sentences = splitSentences(seg.text).filter((s) => !isTableLike(s));
  if (!sentences.length) return undefined;
  let text = sentences[0];
  if (sentences[1] && text.length + sentences[1].length < MAX_EXCERPT) text += ` ${sentences[1]}`;
  const note: AgeNote = { text: truncate(text), section };
  if (seg.number) note.sectionNumber = seg.number;
  return note;
}

export function extractAgeNotes(label: OpenFdaLabel): StoredDrug['ageNotes'] {
  const pediatric = ageNote(label.pediatric_use, 'Pediatric Use', '8');
  const geriatric = ageNote(label.geriatric_use, 'Geriatric Use', '8');
  if (!pediatric && !geriatric) return undefined;
  return { ...(pediatric && { pediatric }), ...(geriatric && { geriatric }) };
}

export function labelSource(label: OpenFdaLabel): LabelSource {
  const t = label.effective_time ?? '';
  const otc = label.openfda?.product_type?.some((p) => /OTC/i.test(p));
  return {
    source: otc ? 'FDA OTC Drug Facts label' : 'FDA Prescribing Information',
    sourceUrl: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${label.set_id}`,
    labelDate: t.length === 8 ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : t,
    setId: label.set_id,
    labelTitle: titleCase(label.openfda?.brand_name?.[0] ?? label.openfda?.generic_name?.[0] ?? ''),
  };
}

const SALTS =
  /\b(hydrochloride|hcl|hydrobromide|calcium|sodium|potassium|magnesium|maleate|besylate|mesylate|succinate|tartrate|citrate|sulfate|fumarate|phosphate|acetate|dihydrate|monohydrate|trihydrate|anhydrous|propionate|furoate|bromide|xinafoate|disoproxil|dipropionate|mononitrate|monosodium|hyclate|olamine|salts?)\b/g;

/** Lowercase generic name with salt forms removed: "ATORVASTATIN CALCIUM" → "atorvastatin". */
export function normalizeGeneric(name: string): string {
  return name.toLowerCase().replace(SALTS, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s/-])([a-z])/g, (_, p, c) => p + c.toUpperCase())
    .trim();
}

/** Brand names that are not just the generic name, most frequent first. */
export function collectBrands(labels: OpenFdaLabel[], generic: string, preferred: string[] = [], limit = 5): string[] {
  const counts = new Map<string, number>();
  const g = normalizeGeneric(generic);
  for (const l of labels) {
    for (const b of l.openfda?.brand_name ?? []) {
      const n = normalizeGeneric(b);
      if (!n || n.includes(g) || g.includes(n)) continue;
      const name = titleCase(b.trim());
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const pref = preferred.map((p) => p.toLowerCase());
  return [...counts.entries()]
    .sort((a, b) => {
      const pa = pref.indexOf(a[0].toLowerCase());
      const pb = pref.indexOf(b[0].toLowerCase());
      if (pa !== pb) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
      return b[1] - a[1] || a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([b]) => b);
}

export function drugClass(label: OpenFdaLabel): string | undefined {
  const epc = label.openfda?.pharm_class_epc?.[0];
  return epc ? epc.replace(/\s*\[EPC\]\s*$/, '') : undefined;
}

export interface DrugConfig {
  id: string;
  name: string;
  /** openFDA generic_name search value. Defaults to `name`. */
  generic?: string;
  /** Brand whose label is preferred as the source (usually the innovator). */
  brand?: string;
  /** Use OTC labels instead of prescription labels. */
  otc?: boolean;
  aliases?: string[];
}

/** Score candidate labels so the most complete, preferred, newest label wins. */
export function pickLabel(labels: OpenFdaLabel[], config: DrugConfig): OpenFdaLabel | undefined {
  const target = normalizeGeneric(config.generic ?? config.name);
  const candidates = labels.filter((l) => (l.openfda?.generic_name ?? []).some((g) => normalizeGeneric(g) === target));
  const score = (l: OpenFdaLabel) =>
    (config.brand && l.openfda?.brand_name?.some((b) => b.toLowerCase() === config.brand!.toLowerCase()) ? 1000 : 0) +
    (l.adverse_reactions?.length ? 100 : 0) +
    (l.warnings_and_cautions?.length ? 50 : 0) +
    (l.indications_and_usage?.length ? 50 : 0) +
    (l.boxed_warning?.length ? 5 : 0);
  return candidates.sort((a, b) => score(b) - score(a) || (b.effective_time ?? '').localeCompare(a.effective_time ?? ''))[0];
}

export function buildDrug(config: DrugConfig, label: OpenFdaLabel, brandSource: OpenFdaLabel[]): StoredDrug {
  const brands = collectBrands(brandSource, config.generic ?? config.name, config.brand ? [config.brand] : []);
  const drug: StoredDrug = {
    id: config.id,
    name: config.name,
    brands,
    label: labelSource(label),
    effects: extractEffects(label),
  };
  if (config.aliases?.length) drug.aliases = config.aliases;
  const cls = drugClass(label);
  if (cls) drug.drugClass = cls;
  const notes = extractAgeNotes(label);
  if (notes) drug.ageNotes = notes;
  return drug;
}
