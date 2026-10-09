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

/** Compact effect record as stored in the JSON dataset. */
export interface StoredEffect {
  region: Region;
  type: EffectType;
  /** Label terms that matched (e.g. "Nausea", "Hepatotoxicity"). May be empty for generic anatomical words. */
  terms: string[];
  /** Verbatim label sentences (possibly truncated with an ellipsis). May be empty when matches came only from tables. */
  excerpts: string[];
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

/** Runtime effect record: a stored effect plus its full provenance. */
export interface Effect extends StoredEffect, LabelSource {}

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
  effects: StoredEffect[];
  ageNotes?: Partial<Record<'pediatric' | 'geriatric', AgeNote>>;
}

export interface Drug extends Omit<StoredDrug, 'effects'> {
  effects: Effect[];
}

export interface Dataset {
  /** "openfda" for generated data, "fixture" for test data. */
  kind: string;
  generatedAt: string;
  notice: string;
  drugs: StoredDrug[];
}
