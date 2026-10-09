export const REGIONS = [
  'brain',
  'eyes',
  'mouth_throat',
  'heart',
  'lungs',
  'thyroid',
  'stomach',
  'intestines',
  'liver',
  'pancreas',
  'kidneys',
  'bladder',
  'reproductive',
  'blood',
  'immune',
  'skin',
  'musculoskeletal',
  'nervous_system',
  'endocrine',
  'whole_body',
] as const;

export type Region = (typeof REGIONS)[number];

/** What the label section says about the region. Contraindications render with the warning visual state. */
export type EffectType = 'therapeutic' | 'adverse' | 'warning' | 'contraindication';

export type AgeGroup = 'pediatric' | 'adult' | 'geriatric';

export type Sex = 'amab' | 'afab';

/** Where a label came from. Shared by every effect extracted from it. */
export interface LabelSource {
  /** Human-readable source name, e.g. "FDA prescribing information". */
  source: string;
  /** DailyMed page for the SPL set id. */
  sourceUrl: string;
  /** Label effective date, ISO yyyy-mm-dd. */
  labelDate: string;
  setId: string;
  /** Brand or title of the specific label the text was extracted from. */
  labelTitle: string;
}

/** One region-level statement extracted from a label section. */
interface EffectFields {
  region: Region;
  type: EffectType;
  /** Label terms that matched (e.g. "Nausea", "Hepatotoxicity"). May be empty for generic anatomical words. */
  terms: string[];
  /** Label section name, e.g. "Adverse Reactions". */
  section: string;
  /** Subsection number when detectable, e.g. "6.1". */
  sectionNumber?: string;
  /** Subsection heading when detectable, e.g. "Pancreatitis". */
  sectionTitle?: string;
  /** Present only when the source sentences name an age group. Absent = applies to all ages. */
  ages?: AgeGroup[];
  boxed?: boolean;
}

/** Effect as produced by extraction: excerpts are verbatim label sentences (possibly truncated with an ellipsis). */
export interface ExtractedEffect extends EffectFields {
  /** May be empty when the terms came only from tables. */
  excerpts: string[];
}

/** Effect as stored in the JSON dataset: excerpts index into the drug's `quotes`, since one sentence often maps to several regions. */
export interface StoredEffect extends EffectFields {
  excerpts: number[];
}

/** Runtime effect record: an effect with its excerpt text and its full provenance. */
export interface Effect extends ExtractedEffect, LabelSource {}

export interface AgeNote {
  text: string;
  section: string;
  sectionNumber?: string;
}

export interface StoredDrug {
  id: string;
  name: string;
  brands: string[];
  /** Other searchable names (e.g. international nonproprietary names). */
  aliases?: string[];
  /** Established pharmacologic class from openFDA (EPC), when present. */
  drugClass?: string;
  label: LabelSource;
  /** Verbatim label sentences referenced by effects. */
  quotes: string[];
  effects: StoredEffect[];
  ageNotes?: Partial<Record<'pediatric' | 'geriatric', AgeNote>>;
}

export interface Drug extends Omit<StoredDrug, 'effects' | 'quotes'> {
  effects: Effect[];
}

export interface Dataset {
  /** "openfda" for generated data, "fixture" for test data. */
  kind: string;
  generatedAt: string;
  notice: string;
  drugs: StoredDrug[];
}
