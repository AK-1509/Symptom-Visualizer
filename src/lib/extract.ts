/**
 * Deterministic extraction of body-region effects from an openFDA drug label.
 * Used by the data build script (scripts/build-data.ts) and unit tests; never by the browser.
 */
import { matchTerms, type TermMatch } from './anatomy.ts';
import type { AgeGroup, AgeNote, EffectType, ExtractedEffect, LabelSource, Region, Sex, SexNote, StoredDrug } from './types.ts';

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
  pregnancy?: string[];
  use_in_specific_populations?: string[];
  pharmacokinetics?: string[];
  clinical_pharmacology?: string[];
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

/** Title given to statements from the label's Highlights summary. */
export const HIGHLIGHTS = 'Highlights';

const MAX_EXCERPT = 280;
const MIN_EXCERPT = 24;
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

const IMPERATIVES =
  /^(Discontinue|Advise|Monitor|Consider|Avoid|Instruct|Inform|Verify|Counsel|Assess|Evaluate|Obtain|Do|Reduce|Start|Stop|Administer|Measure|Check|Perform|Initiate|Withhold|Educate|Tell)$/;
const CONNECTORS = new Set(['of', 'and', 'or', 'in', 'with', 'the', 'to', 'for', 'a', 'an', 'on', 'at', 'by', 'from', 'vs', 'during', '&']);
const isCapitalized = (w: string) => /^[A-Z(]/.test(w);
const isTitleCase = (text: string) => text.split(' ').every((w) => isCapitalized(w) || CONNECTORS.has(w));

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
  // "... Reactions | Use of OZEMPIC has": a connector before the start means the sentence began one word earlier.
  if (start > 1 && CONNECTORS.has(words[start - 1]) && isCapitalized(words[start - 2])) start -= 2;
  // An imperative verb starts the sentence, not the heading ("Reproductive Potential | Discontinue OZEMPIC in women").
  while (start > 0 && IMPERATIVES.test(words[start - 1])) start--;
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

const subsectionPattern = (major: string) => new RegExp(`(?:^|\\s)(${major}\\.\\d{1,2})\\s+(?=[A-Z])`, 'g');

/**
 * Break raw section text at PLR subsection headings ("5.1 ", "6.2 ") that belong to the section's major number.
 * The text before the first subsection is the section intro, which in openFDA text also carries the
 * Highlights bullets ("• Acute Pancreatitis: Has been observed... ( 5.2 )"). Each intro bullet becomes its own
 * segment numbered by its trailing reference; bullets that only point elsewhere ("[see Warnings and
 * Precautions (5.1)]") are dropped.
 */
export function segmentSection(raw: string, major?: string): Segment[] {
  const text = raw.replace(/\s+/g, ' ').trim().replace(SECTION_TITLES, '');
  const cuts: { index: number; number: string; length: number }[] = [];
  if (major) for (const m of text.matchAll(subsectionPattern(major))) cuts.push({ index: m.index!, number: m[1], length: m[0].length });
  const out: Segment[] = [];
  const intro = cuts.length ? text.slice(0, cuts[0].index) : text;
  for (const item of intro.split(/\s*•\s*/)) {
    // Each Highlights statement ends in a reference "( 5.2 )"; a bare cross-reference "[see ... ( 5.1 )]" ends a
    // pointer to another section, which carries no claim of its own.
    let last = 0;
    const pieces: { text: string; ref?: string; xref?: boolean }[] = [];
    for (const m of item.matchAll(/\[\s*see[^\]]*\]|\(\s*(\d{1,2}(?:\.\d{1,2})?)\s*\)/gi)) {
      // Only a reference that closes a statement ends a piece; one inside a sentence stays put.
      const close = item.slice(m.index! + m[0].length).match(/^\s*[.;]?\s*(?=[A-Z•]|$)/);
      if (!close) continue;
      const end = m.index! + m[0].length + close[0].length;
      pieces.push({ text: item.slice(last, end), ref: m[1], xref: m[0].startsWith('[') });
      last = end;
    }
    pieces.push({ text: item.slice(last) });
    for (const piece of pieces) {
      const number = piece.ref && major && piece.ref.startsWith(`${major}.`) ? piece.ref : undefined;
      const cleaned = cleanText(piece.text);
      if (piece.xref && isTitleCase(cleaned)) continue;
      if (cleaned) out.push(number ? { number, title: HIGHLIGHTS, text: cleaned } : { text: cleaned });
    }
  }
  cuts.forEach((c, i) => {
    const chunk = cleanText(text.slice(c.index + c.length, i + 1 < cuts.length ? cuts[i + 1].index : undefined));
    const { title, body } = splitHeading(chunk);
    out.push({ number: c.number, title, text: body });
  });
  return out.filter((s) => s.text);
}

/** "Gastrointestinal: acute pancreatitis ..." style run-in headings used in postmarketing lists and Highlights. */
const RUN_IN = /(?:^|\s)((?:[A-Z][A-Za-z-]*)(?:\s(?:and|of|or|in|with|to|&|[A-Z][A-Za-z-]*)){0,6}):\s/g;

/** Words that commonly start the first sentence after an inline sub-heading ("Cholelithiasis | In placebo-controlled trials"). */
const STARTERS =
  /^(In|The|A|An|Across|During|Because|There|Among|Most|Other|Patients|Overall|This|These|Adverse|When|Following|At|For|Over|Postmarketing|Treatment|Of|Compared|Data|Events|Two|One|Three|Clinical|Cases|Serious|Severe|Mean|Approximately|Discontinuation|Use|Monitor|If)$/;

/** Sentence split on terminal punctuation followed by an uppercase start, bullets, and run-in headings. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/(?<=[.!?])\s+(?=[A-Z(•“"])|\s*•\s*/)) {
    const starts = [...part.matchAll(RUN_IN)].map((m) => m.index! + (m[0].startsWith(' ') ? 1 : 0));
    const bounds = [0, ...starts.filter((i) => i > 0), part.length];
    for (let i = 0; i < bounds.length - 1; i++) {
      let sentence = part.slice(bounds[i], bounds[i + 1]).trim();
      // Drop an inline sub-heading glued to the sentence ("Injection Site Reactions In placebo-controlled trials ...").
      const { title, body } = splitHeading(sentence);
      if (title && STARTERS.test(body.split(' ')[0])) sentence = body;
      if (sentence.length > 3) out.push(sentence);
    }
  }
  return out;
}

/** A "Title: text" run-in heading at the start of a sentence. */
export function runInTitle(sentence: string): string | undefined {
  RUN_IN.lastIndex = 0;
  const m = RUN_IN.exec(sentence);
  RUN_IN.lastIndex = 0;
  return m && m.index === 0 ? m[1] : undefined;
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

/** Trial-population descriptions in Adverse Reactions are not reactions ("At baseline, 8.9% ... reported retinopathy"). */
const POPULATION = /\b(at baseline|mean age|baseline characteristics|were (male|female|white)|identified as|demographics?)\b/i;

const FEMALE =
  /\b(women|woman|females?|girls?|pregnan\w*|lactat\w*|breastfe\w*|breast-fe\w*|nursing mothers?|menstrua\w*|menopaus\w*|postmenopausal|premenopausal|uter\w*|ovar\w*|vagin\w*|vulv\w*|endometri\w*|amenorrh\w*|dysmenorrh\w*|fetus|fetal)\b/i;
const MALE = /\b(men|man|males?|boys?|prostat\w*|testic\w*|testes|erectile|erections?|priapism|ejaculat\w*|gynecomastia|scrot\w*|penile)\b/i;

/**
 * The sex a sentence is specific to, from the people it names ("in women", "males") or anatomy only one sex has
 * (pregnancy, prostate). A sentence naming both, or neither, applies to both. Fetal harm is tied to pregnancy.
 */
export function detectSexes(sentence: string): Sex[] | undefined {
  const female = FEMALE.test(sentence);
  const male = MALE.test(sentence);
  if (female === male) return undefined;
  return female ? ['afab'] : ['amab'];
}

const EXCLUDED_THERAPEUTIC = /\b(not indicated|not recommended|has not been (studied|established)|have not been (studied|established)|not for use|limitations? of use|should not be used)\b/i;

function truncate(sentence: string): string {
  if (sentence.length <= MAX_EXCERPT) return sentence;
  const cut = sentence.slice(0, MAX_EXCERPT);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

function excerptScore(h: Hit): number {
  let score = 0;
  if (h.type === 'adverse' && /most common|most frequent|commonly/i.test(h.sentence)) score += 50;
  if (h.terms.length) score += 5;
  if (h.direct) score += 8;
  // The full section is the authoritative text; Highlights only summarize it.
  if (h.title === HIGHLIGHTS) score -= 6;
  if (h.sentence.length > MAX_EXCERPT) score -= 4;
  if (h.sentence.length < 40) score -= 10;
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
  /** The sentence names the region itself rather than inheriting it from its subsection title. */
  direct: boolean;
  ages?: AgeGroup[];
  sexes?: Sex[];
  order: number;
}

/** Regions a sentence maps to, with the specific terms behind each. */
function regionTerms(matches: TermMatch[]): Map<Region, string[]> {
  const byRegion = new Map<Region, string[]>();
  for (const m of matches)
    for (const r of m.regions) {
      const list = byRegion.get(r) ?? [];
      if (!m.generic && !list.includes(m.term)) list.push(m.term);
      byRegion.set(r, list);
    }
  return byRegion;
}

/** Extract the per-region effect records for a label. */
export function extractEffects(label: OpenFdaLabel): ExtractedEffect[] {
  const hits: Hit[] = [];
  let order = 0;
  for (const spec of SECTIONS) {
    const values = label[spec.field];
    if (!Array.isArray(values)) continue;
    if (spec.field === 'warnings' && label.warnings_and_cautions?.length) continue;
    const therapeutic = spec.type === 'therapeutic';
    // openFDA repeats subsections as separate array entries after the full section text.
    const seen = new Set<string>();
    for (const raw of values) {
      let segments = segmentSection(raw, spec.major);
      let boxedTitle: string | undefined;
      if (spec.boxed) [segments, boxedTitle] = stripBoxedTitle(segments);
      // "indicated in adults for:" applies its age group to the bullets that follow it, which arrive as separate segments.
      let leadAges: AgeGroup[] | undefined;
      for (const seg of segments) {
        let limited = false;
        if (seg.number) leadAges = undefined;
        for (const sentence of splitSentences(seg.text)) {
          order++;
          // A bullet run together with the next statement ("Heart failure ZOVAREX is indicated for ...") starts afresh.
          const sentenceAges = detectAges(sentence) ?? (/\bindicated\b/i.test(sentence) ? undefined : leadAges);
          if (/:$/.test(sentence)) leadAges = detectAges(sentence);
          else if (/[.!?]$/.test(sentence)) leadAges = undefined;
          if (seen.has(sentence)) continue;
          seen.add(sentence);
          if (therapeutic) {
            if (/limitations? of use/i.test(sentence)) limited = true;
            if (limited || EXCLUDED_THERAPEUTIC.test(sentence)) continue;
          }
          if (spec.type === 'adverse' && POPULATION.test(sentence)) continue;
          const own = regionTerms(matchTerms(sentence, { therapeutic, adverse: spec.type === 'adverse' }));
          let byRegion = own;
          // A warning sentence is about its subsection's topic: "symptoms of thyroid tumors (... dyspnea)"
          // under "Risk of Thyroid C-Cell Tumors" belongs to the thyroid, not the lungs.
          const title = spec.type === 'warning' || spec.type === 'contraindication' ? (runInTitle(sentence) ?? seg.title ?? boxedTitle) : undefined;
          const scope = title ? regionTerms(matchTerms(title, { therapeutic })) : undefined;
          if (scope?.size) {
            const scoped = new Map<Region, string[]>();
            for (const [region, titleTerms] of scope) scoped.set(region, [...new Set([...(byRegion.get(region) ?? []), ...titleTerms])]);
            byRegion = scoped;
          }
          if (!byRegion.size) continue;
          const ages = sentenceAges;
          const sexes = detectSexes(sentence);
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
              direct: own.has(region),
              ages,
              sexes,
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

function groupHits(hits: Hit[]): ExtractedEffect[] {
  const groups = new Map<string, Hit[]>();
  for (const h of hits) {
    const key = [h.region, h.type, h.section, h.ages?.join(',') ?? '', h.sexes?.join(',') ?? ''].join('|');
    const list = groups.get(key) ?? [];
    list.push(h);
    groups.set(key, list);
  }
  const effects: ExtractedEffect[] = [];
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
      .sort((a, b) => excerptScore(b) - excerptScore(a) || a.order - b.order);
    const chosen: Hit[] = [];
    for (const h of clean) {
      if (chosen.length >= MAX_EXCERPTS) break;
      if (!chosen.some((c) => c.sentence === h.sentence)) chosen.push(h);
    }
    if (!terms.length && !chosen.length) continue;
    const lead = chosen[0] ?? list[0];
    const effect: ExtractedEffect = {
      region: lead.region,
      type: lead.type,
      terms,
      excerpts: chosen.map((h) => truncate(h.sentence)),
      section: lead.section,
    };
    if (lead.number) effect.sectionNumber = lead.number;
    if (lead.title) effect.sectionTitle = lead.title;
    if (lead.ages) effect.ages = lead.ages;
    if (lead.sexes) effect.sexes = lead.sexes;
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

/** The first one or two prose sentences of a passage, as a note. */
const BOILERPLATE = /\bregistry\b|\b1-8\d\d\b|www\.|https?:|encourage|background risk|general population/i;

const NOTE_HEADINGS = /^(?:Risk Summary|Clinical Considerations|Human Data|Animal Data|Data|Contraception|Infertility|Pregnancy Testing)\s+(?=[A-Z])/;

function noteText(text: string): string | undefined {
  const sentences = splitSentences(text)
    .map((s) => s.replace(NOTE_HEADINGS, ''))
    .filter((s) => !isTableLike(s) && s.length >= MIN_EXCERPT && !BOILERPLATE.test(s));
  if (!sentences.length) return undefined;
  let out = sentences[0];
  if (sentences[1] && out.length + sentences[1].length < MAX_EXCERPT) out += ` ${sentences[1]}`;
  return truncate(out);
}

/**
 * Sex-specific context from the label: Pregnancy (8.1) and Lactation (8.2) for AFAB, Females and Males of
 * Reproductive Potential (8.3) split by its "Females" / "Males" run-in headings, and any male/female
 * difference stated in Pharmacokinetics (12.3), which is relevant to both.
 */
export function extractSexNotes(label: OpenFdaLabel): SexNote[] | undefined {
  const notes: SexNote[] = [];
  const populations = [...(label.pregnancy ?? []), ...(label.use_in_specific_populations ?? [])].join(' ');
  const seen = new Set<string>();
  for (const seg of segmentSection(populations, '8')) {
    if (!seg.number || seen.has(seg.number) || seg.title === HIGHLIGHTS) continue;
    const title = seg.title ?? '';
    if (/^Pregnancy/i.test(title) || /^Lactation|^Nursing Mothers/i.test(title)) {
      seen.add(seg.number);
      const text = noteText(seg.text);
      const topic = /^Pregnancy/i.test(title) ? 'Pregnancy' : 'Lactation';
      if (text) notes.push({ topic, sexes: ['afab'], text, section: topic, sectionNumber: seg.number });
    } else if (/Reproductive Potential/i.test(title)) {
      seen.add(seg.number);
      // Run-in "Females" / "Males" headings ("Contraception Females Advise females of reproductive potential ...").
      const parts = seg.text.split(/\s(?=(?:Females|Males)\s+(?:[A-Z]|of|who|should|must|with|taking|treated))/);
      for (const raw of parts) {
        // A part that opens with the "Females" / "Males" heading belongs to that sex even when it mentions partners.
        const heading = raw.match(/^(Females|Males)\s+/);
        const part = heading ? raw.slice(heading[0].length) : raw;
        const sexes: Sex[] | undefined = heading ? [heading[1] === 'Males' ? 'amab' : 'afab'] : detectSexes(part);
        const text = noteText(part);
        if (!text) continue;
        const topic = sexes?.[0] === 'amab' ? 'Males of reproductive potential' : sexes?.[0] === 'afab' ? 'Females of reproductive potential' : 'Reproductive potential';
        if (!notes.some((n) => n.topic === topic))
          notes.push({ topic, ...(sexes && { sexes }), text, section: 'Females and Males of Reproductive Potential', sectionNumber: seg.number });
      }
    }
  }
  const pk = cleanText([...(label.pharmacokinetics ?? []), ...(label.clinical_pharmacology ?? [])].join(' '));
  // The first sentence after a "Gender" / "Sex" / "Male and Female Patients" heading.
  const m = pk.match(/(?:^|\s)(?:Gender|Sex|Male and Female (?:Patients|Subjects))\s*[:\-]?\s+([A-Z][\s\S]{20,400}?\.)(?=\s|$)/);
  if (m && (FEMALE.test(m[1]) || MALE.test(m[1]) || /gender|\bsex\b/i.test(m[1])))
    notes.push({ topic: 'Male and female differences', text: truncate(m[1]), section: 'Pharmacokinetics', sectionNumber: '12.3' });
  return notes.length ? notes : undefined;
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

const genericMatches = (l: OpenFdaLabel, target: string) => (l.openfda?.generic_name ?? []).some((g) => normalizeGeneric(g) === target);
const isOtc = (l: OpenFdaLabel) => !!l.openfda?.product_type?.some((p) => /OTC/i.test(p));
const brandMatches = (brand: string, wanted: string) => {
  const b = brand.toLowerCase().trim();
  const w = wanted.toLowerCase();
  return b === w || b.startsWith(`${w} `);
};

const NOT_A_BRAND = /\d|n\/a|diluent|relief|reducer|allergy|\bcold\b|\bflu\b|\bkit\b/i;

/** Misspelled generic names sometimes appear as brand names ("Losortan Potassium"). */
function nearGeneric(brand: string, generic: string): boolean {
  const a = brand.split(' ')[0];
  const b = generic.split(' ')[0];
  if (Math.abs(a.length - b.length) > 3) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= 3;
}

/**
 * Brand names for search, taken only from labels of the same single-ingredient product.
 * Prescription brands are ranked by how many labels carry them; OTC store-brand names ("Acid Reducer")
 * are skipped unless the config names the brand and openFDA confirms it. Variants of a listed brand
 * ("Lantus Solostar" after "Lantus") are dropped.
 */
export function collectBrands(labels: OpenFdaLabel[], config: DrugConfig, limit = 5): string[] {
  const target = normalizeGeneric(config.generic ?? config.name);
  const same = labels.filter((l) => genericMatches(l, target));
  const named = [config.brand, ...(config.otcBrands ?? [])].filter((b): b is string => !!b);
  const out: string[] = named.filter((b) => same.some((l) => l.openfda?.brand_name?.some((n) => brandMatches(n, b))));
  const counts = new Map<string, number>();
  for (const l of same) {
    if (isOtc(l)) continue;
    for (const b of l.openfda?.brand_name ?? []) {
      const n = normalizeGeneric(b);
      if (!n || n.includes(target) || target.includes(n) || NOT_A_BRAND.test(b) || nearGeneric(n, target)) continue;
      const name = titleCase(b.trim());
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [name] of ranked) {
    const first = name.split(' ')[0].toLowerCase();
    if (out.some((b) => b.split(' ')[0].toLowerCase() === first)) continue;
    out.push(name);
  }
  return out.slice(0, limit);
}

const epcName = (epc: string) => epc.replace(/\s*\[EPC\]\s*$/, '');

/**
 * Established pharmacologic class. openFDA's EPC annotation is missing on many single-ingredient labels and
 * occasionally wrong, so a class counts only when at least two labels of the ingredient agree. Otherwise the
 * label's own wording is used: "OZEMPIC is a glucagon-like peptide 1 (GLP-1) receptor agonist indicated ...".
 */
export function drugClass(label: OpenFdaLabel, sameIngredient: OpenFdaLabel[] = [label]): string | undefined {
  const votes = new Map<string, number>();
  for (const l of sameIngredient) for (const epc of l.openfda?.pharm_class_epc ?? []) votes.set(epcName(epc), (votes.get(epcName(epc)) ?? 0) + 1);
  const own = (label.openfda?.pharm_class_epc ?? []).map(epcName);
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1] || Number(own.includes(b[0])) - Number(own.includes(a[0])));
  if (ranked[0] && ranked[0][1] >= 2) {
    // Dual-action drugs carry two equally attested classes (carvedilol: alpha- and beta-adrenergic blocker).
    return ranked[1]?.[1] === ranked[0][1] ? `${ranked[0][0]} · ${ranked[1][0]}` : ranked[0][0];
  }
  const text = cleanText((label.indications_and_usage ?? []).join(' '));
  const m = text.match(/\b(?:is|are) an? ((?:[\w()/,'-]+ ){0,8}?[\w()/'-]+)\s+(?:that is |which is )?indicated\b/i);
  if (!m || m[1].length > 60 || /\b(combination|member|product|specific)\b/i.test(m[1])) return undefined;
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
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
  /** Well-known OTC brand names to make searchable; kept only if openFDA has a label with that brand. */
  otcBrands?: string[];
  aliases?: string[];
}

/** Score candidate labels so the most complete, preferred, newest label wins. */
export function pickLabel(labels: OpenFdaLabel[], config: DrugConfig): OpenFdaLabel | undefined {
  const target = normalizeGeneric(config.generic ?? config.name);
  const candidates = labels.filter((l) => genericMatches(l, target) && isOtc(l) === !!config.otc);
  const score = (l: OpenFdaLabel) =>
    (config.brand && l.openfda?.brand_name?.some((b) => b.toLowerCase().trim() === config.brand!.toLowerCase()) ? 500 : 0) +
    (config.brand && l.openfda?.brand_name?.some((b) => brandMatches(b, config.brand!)) ? 1000 : 0) +
    (l.adverse_reactions?.length ? 100 : 0) +
    (l.warnings_and_cautions?.length ? 50 : 0) +
    (l.indications_and_usage?.length ? 50 : 0) +
    (l.boxed_warning?.length ? 5 : 0);
  return candidates.sort((a, b) => score(b) - score(a) || (b.effective_time ?? '').localeCompare(a.effective_time ?? ''))[0];
}

export function buildDrug(config: DrugConfig, label: OpenFdaLabel, brandSource: OpenFdaLabel[]): StoredDrug {
  const brands = collectBrands(brandSource, config);
  const quotes: string[] = [];
  const quoteIndex = new Map<string, number>();
  const effects = extractEffects(label).map((e) => ({
    ...e,
    excerpts: e.excerpts.map((x) => {
      if (!quoteIndex.has(x)) quoteIndex.set(x, quotes.push(x) - 1);
      return quoteIndex.get(x)!;
    }),
  }));
  const drug: StoredDrug = { id: config.id, name: config.name, brands, label: labelSource(label), quotes, effects };
  if (config.aliases?.length) drug.aliases = config.aliases;
  // Innovator labels often lack openFDA's class annotation; other labels of the same ingredient carry it.
  const target = normalizeGeneric(config.generic ?? config.name);
  const cls = drugClass(label, [label, ...brandSource.filter((l) => l !== label && genericMatches(l, target))]);
  if (cls) drug.drugClass = cls;
  const notes = extractAgeNotes(label);
  if (notes) drug.ageNotes = notes;
  const sexNotes = extractSexNotes(label);
  if (sexNotes) drug.sexNotes = sexNotes;
  return drug;
}
