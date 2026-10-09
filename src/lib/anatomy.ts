import type { Region } from './types.ts';

export interface RegionInfo {
  label: string;
  /** Systemic regions have no single organ shape; the body renders them as a network or outline. */
  systemic: boolean;
}

export const REGION_INFO: Record<Region, RegionInfo> = {
  brain: { label: 'Brain', systemic: false },
  eyes: { label: 'Eyes', systemic: false },
  mouth_throat: { label: 'Mouth & throat', systemic: false },
  heart: { label: 'Heart', systemic: false },
  lungs: { label: 'Lungs', systemic: false },
  thyroid: { label: 'Thyroid', systemic: false },
  stomach: { label: 'Stomach', systemic: false },
  intestines: { label: 'Intestines', systemic: false },
  liver: { label: 'Liver', systemic: false },
  pancreas: { label: 'Pancreas', systemic: false },
  kidneys: { label: 'Kidneys', systemic: false },
  bladder: { label: 'Bladder', systemic: false },
  reproductive: { label: 'Reproductive', systemic: false },
  blood: { label: 'Blood & vessels', systemic: true },
  immune: { label: 'Immune & lymph', systemic: true },
  skin: { label: 'Skin', systemic: true },
  musculoskeletal: { label: 'Muscles & bones', systemic: true },
  nervous_system: { label: 'Nervous system', systemic: true },
  endocrine: { label: 'Endocrine glands', systemic: true },
  whole_body: { label: 'Whole body', systemic: true },
};

/**
 * One entry of the controlled mapping from label terminology to anatomy.
 * `term` is the display label. Entries with `generic: true` (e.g. "hepatic") only
 * locate a sentence in the body; they are not shown as a named reaction.
 */
export interface TermEntry {
  term: string;
  regions: Region[];
  pattern: RegExp;
  generic?: boolean;
}

type Row = [term: string, regions: Region | Region[], patterns: string, generic?: 'g'];

/**
 * Deterministic keyword/synonym table. Patterns are case-insensitive, word-bounded
 * alternations; `*` is a word-character wildcard. Order matters only for display:
 * more specific terms are listed before the generic anatomical words they contain.
 */
const ROWS: Row[] = [
  // Brain & mind
  ['Seizures', 'brain', 'seizures?|convulsions?|epilep*'],
  ['Stroke', 'brain', 'strokes?|cerebrovascular accidents?|cerebrovascular events?'],
  ['Migraine', 'brain', 'migraines?'],
  ['Headache', 'brain', 'headaches?'],
  ['Dizziness', 'brain', 'dizziness|vertigo|lightheadedness'],
  ['Somnolence', 'brain', 'somnolence|drowsiness|sedation|sleepiness'],
  ['Insomnia', 'brain', 'insomnia|sleep disorders?|abnormal dreams'],
  ['Suicidal thoughts and behaviors', 'brain', 'suicid*'],
  ['Depression', 'brain', 'depression|depressed mood'],
  ['Anxiety', 'brain', 'anxiety|nervousness|agitation|restlessness'],
  ['Confusion', 'brain', 'confusion|confusional state|delirium|disorientation'],
  ['Hallucinations', 'brain', 'hallucinations?'],
  ['Mania', 'brain', 'mania|manic|hypomania'],
  ['Psychiatric reactions', 'brain', 'psychiatric|neuropsychiatric|psychosis|psychotic'],
  ['Cognitive impairment', 'brain', 'cognitive|memory impairment|amnesia|dementia'],
  ['Serotonin syndrome', ['brain', 'whole_body'], 'serotonin syndrome'],
  ['Neuroleptic malignant syndrome', ['brain', 'whole_body'], 'neuroleptic malignant syndrome'],
  ['Tardive dyskinesia', 'brain', 'tardive dyskinesia|extrapyramidal|akathisia|dystonia'],
  ['CNS depression', 'brain', 'cns depression|central nervous system depression|respiratory and cns depression'],
  ['Schizophrenia', 'brain', 'schizophrenia'],
  ['Bipolar disorder', 'brain', 'bipolar'],
  ['Major depressive disorder', 'brain', 'major depressive disorder|mdd'],
  ['Anxiety disorders', 'brain', 'generalized anxiety disorder|panic disorder|social anxiety disorder|obsessive.compulsive disorder|post.?traumatic stress disorder'],
  ['ADHD', 'brain', 'attention deficit hyperactivity disorder|adhd'],
  ['Alzheimer’s disease', 'brain', 'alzheimer*'],
  ['Abuse, dependence and withdrawal', 'brain', 'addiction|abuse|misuse|dependence|withdrawal|discontinuation syndrome'],
  ['Pain', 'nervous_system', 'pain severe enough|management of pain|relief of pain|acute pain|chronic pain|mild to moderate pain'],
  ['Brain', 'brain', 'brain|cerebral|intracranial|central nervous system|cns', 'g'],

  // Peripheral nervous system
  ['Peripheral neuropathy', 'nervous_system', 'peripheral neuropathy|neuropathy|polyneuropathy'],
  ['Paresthesia', 'nervous_system', 'paresthesias?|paraesthesias?|numbness|tingling|hypoesthesia'],
  ['Tremor', 'nervous_system', 'tremors?'],
  ['Neuropathic pain', 'nervous_system', 'neuropathic pain|postherpetic neuralgia|neuralgia'],
  ['Nervous system', 'nervous_system', 'nervous system|neurologic*|neurotoxicity|nerves?', 'g'],

  // Eyes
  ['Blurred vision', 'eyes', 'blurred vision|vision blurred|visual disturbances?|visual impairment|vision changes|visual changes'],
  ['Diabetic retinopathy', 'eyes', 'diabetic retinopathy|retinopathy'],
  ['Glaucoma', 'eyes', 'glaucoma|intraocular pressure'],
  ['Cataracts', 'eyes', 'cataracts?'],
  ['Conjunctivitis', 'eyes', 'conjunctivitis'],
  ['Eyes', 'eyes', 'eyes?|ocular|ophthalmic|visual|vision|retina*|optic', 'g'],

  // Mouth, nose & throat
  ['Dry mouth', 'mouth_throat', 'dry mouth|xerostomia'],
  ['Taste changes', 'mouth_throat', 'dysgeusia|taste disturbance|altered taste|taste perversion'],
  ['Nasopharyngitis', 'mouth_throat', 'nasopharyngitis|common cold'],
  ['Pharyngitis', 'mouth_throat', 'pharyngitis|sore throat|throat irritation|pharyngolaryngeal pain|oropharyngeal pain'],
  ['Rhinitis & sinusitis', 'mouth_throat', 'sinusitis|rhinitis|nasal congestion|rhinorrhea|epistaxis'],
  ['Stomatitis', 'mouth_throat', 'stomatitis|mouth ulcers?|mucositis|oral candidiasis|thrush'],
  ['Angioedema', ['mouth_throat', 'skin'], 'angioedema'],
  ['Tonsillitis', 'mouth_throat', 'tonsillitis'],
  ['Mouth & throat', 'mouth_throat', 'mouth|oral cavity|throat|tongue|lips|larynx|laryngeal|nasal|nose', 'g'],

  // Heart & circulation
  ['Hypertension', 'heart', 'hypertension|high blood pressure|elevated blood pressure'],
  ['Hypotension', 'heart', 'hypotension|orthostatic|syncope'],
  ['Heart failure', 'heart', 'heart failure|cardiac failure|ventricular dysfunction'],
  ['Myocardial infarction', 'heart', 'myocardial infarction|heart attack'],
  ['Arrhythmias', 'heart', 'arrhythmias?|atrial fibrillation|qt prolongation|qt interval|torsade* de pointes|tachycardia|bradycardia|palpitations|heart block|atrioventricular block'],
  ['Angina', 'heart', 'angina'],
  ['Cardiovascular events', 'heart', 'cardiovascular events?|cardiovascular death|cardiovascular thrombotic events|major adverse cardiovascular|cardiovascular risk|cardiovascular mortality'],
  ['Chest pain', 'heart', 'chest pain'],
  ['Heart', 'heart', 'heart|cardiac|cardio*|myocard*|coronary', 'g'],

  // Lungs
  ['Asthma', 'lungs', 'asthma|bronchospasm|wheezing'],
  ['COPD', 'lungs', 'chronic obstructive pulmonary disease|copd|emphysema|chronic bronchitis'],
  ['Respiratory depression', 'lungs', 'respiratory depression'],
  ['Cough', 'lungs', 'cough'],
  ['Dyspnea', 'lungs', 'dyspnea|shortness of breath|breathing difficulties|difficulty breathing'],
  ['Respiratory tract infection', 'lungs', 'upper respiratory tract infections?|respiratory tract infections?|lower respiratory tract infections?|bronchitis'],
  ['Pneumonia', 'lungs', 'pneumonia'],
  ['Interstitial lung disease', 'lungs', 'interstitial lung disease|pneumonitis|pulmonary fibrosis|pulmonary toxicity'],
  ['Pulmonary embolism', ['lungs', 'blood'], 'pulmonary embol*'],
  ['Lungs', 'lungs', 'lungs?|pulmonary|respiratory|bronch*', 'g'],

  // Thyroid
  ['Thyroid C-cell tumors', 'thyroid', 'thyroid c.cell tumors?|medullary thyroid carcinoma|mtc'],
  ['Hypothyroidism', 'thyroid', 'hypothyroidism'],
  ['Hyperthyroidism', 'thyroid', 'hyperthyroidism|thyrotoxicosis'],
  ['Thyroid', 'thyroid', 'thyroid*|tsh', 'g'],

  // Stomach & upper GI
  ['Nausea', 'stomach', 'nausea'],
  ['Vomiting', 'stomach', 'vomiting|emesis'],
  ['Dyspepsia', 'stomach', 'dyspepsia|indigestion|heartburn'],
  ['Gastroesophageal reflux', 'stomach', 'gastroesophageal reflux*|gerd|reflux|erosive esophagitis|esophagitis'],
  ['Ulcers', 'stomach', 'peptic ulcers?|gastric ulcers?|duodenal ulcers?|gastrointestinal ulcers?|ulcer disease'],
  ['Gastrointestinal bleeding', ['stomach', 'intestines'], 'gastrointestinal bleeding|gi bleeding|gastrointestinal hemorrhage|bleeding, ulceration, and perforation'],
  ['Delayed gastric emptying', 'stomach', 'gastric emptying|gastroparesis'],
  ['Decreased appetite', 'stomach', 'decreased appetite|anorexia|loss of appetite'],
  ['Abdominal pain', ['stomach', 'intestines'], 'abdominal pain|abdominal discomfort|stomach pain|upper abdominal pain|abdominal distension'],
  ['Gastrointestinal reactions', ['stomach', 'intestines'], 'gastrointestinal|gi ', 'g'],
  ['Stomach', 'stomach', 'stomach|gastric|esophag*', 'g'],

  // Intestines
  ['Diarrhea', 'intestines', 'diarrhea|diarrhoea|loose stools?'],
  ['Constipation', 'intestines', 'constipation'],
  ['Flatulence', 'intestines', 'flatulence|eructation|bloating'],
  ['C. difficile–associated diarrhea', 'intestines', 'clostridioides difficile|clostridium difficile|c\\. difficile|cdad|pseudomembranous colitis'],
  ['Colitis', 'intestines', 'colitis|crohn*|inflammatory bowel'],
  ['Intestinal obstruction', 'intestines', 'ileus|intestinal obstruction|bowel obstruction'],
  ['Intestines', 'intestines', 'intestin*|bowel|colon|duoden*|rectal', 'g'],

  // Liver
  ['Hepatotoxicity', 'liver', 'hepatotoxicity|liver injury|liver damage|hepatic injury|drug.induced liver'],
  ['Liver failure', 'liver', 'hepatic failure|liver failure|acute liver failure'],
  ['Hepatitis', 'liver', 'hepatitis'],
  ['Elevated liver enzymes', 'liver', 'transaminase*|alt |ast |aminotransferase*|liver enzymes?|liver function tests?|hepatic enzymes?|bilirubin'],
  ['Jaundice', 'liver', 'jaundice|cholestasis|cholestatic'],
  ['Cirrhosis', 'liver', 'cirrhosis'],
  ['Gallbladder disease', 'liver', 'cholelithiasis|cholecystitis|gallbladder|gallstones?|biliary'],
  ['Liver', 'liver', 'liver|hepatic|hepato*', 'g'],

  // Pancreas & glucose control
  ['Pancreatitis', 'pancreas', 'pancreatitis'],
  ['Type 2 diabetes mellitus', 'pancreas', 'type 2 diabetes mellitus|type 2 diabetes'],
  ['Diabetes mellitus', 'pancreas', 'diabetes mellitus|diabetic patients'],
  ['Glycemic control', 'pancreas', 'glycemic control|blood glucose control'],
  ['Pancreas', 'pancreas', 'pancrea*', 'g'],

  // Kidneys
  ['Acute kidney injury', 'kidneys', 'acute kidney injury|acute renal failure|renal failure|kidney failure'],
  ['Renal impairment', 'kidneys', 'renal impairment|renal dysfunction|impaired renal function|kidney disease|chronic kidney disease|nephropathy|renal insufficiency'],
  ['Nephrotoxicity', 'kidneys', 'nephrotoxicity|interstitial nephritis|nephritis'],
  ['Kidney stones', 'kidneys', 'nephrolithiasis|kidney stones?|renal calculi'],
  ['Kidneys', 'kidneys', 'kidneys?|renal|nephr*|glomerular', 'g'],

  // Bladder & urinary tract
  ['Urinary tract infection', 'bladder', 'urinary tract infections?|uti|cystitis'],
  ['Urinary retention', 'bladder', 'urinary retention|difficulty urinating|urinary hesitation'],
  ['Overactive bladder', 'bladder', 'overactive bladder|urinary incontinence|urge urinary incontinence|urgency|pollakiuria|urinary frequency|nocturia'],
  ['Benign prostatic hyperplasia', ['bladder', 'reproductive'], 'benign prostatic hyperplasia|bph'],
  ['Bladder', 'bladder', 'bladder|urinary|urination|urethr*', 'g'],

  // Reproductive
  ['Erectile dysfunction', 'reproductive', 'erectile dysfunction|impotence|erection*|priapism'],
  ['Sexual dysfunction', 'reproductive', 'sexual dysfunction|decreased libido|libido decreased|libido|ejaculat*|anorgasmia|orgasm*'],
  ['Embryo-fetal toxicity', 'reproductive', 'embryo.fetal toxicity|fetal toxicity|fetal harm|teratogen*|birth defects'],
  ['Menstrual disorders', 'reproductive', 'menstrual|dysmenorrhea|amenorrhea|vaginal bleeding|uterine bleeding|menorrhagia'],
  ['Vaginal infection', 'reproductive', 'vulvovaginal|vaginal candidiasis|vaginitis|genital mycotic infections?|mycotic infections?'],
  ['Breast changes', 'reproductive', 'gynecomastia|breast pain|breast tenderness|breast enlargement'],
  ['Reproductive', 'reproductive', 'reproductive|prostat*|testic*|testes|ovar*|uter*|vagin*|genital|fertility|pregnan*', 'g'],

  // Blood & vessels
  ['Bleeding', 'blood', 'bleeding|hemorrhage|haemorrhage|bruising|ecchymosis|hematoma'],
  ['Thromboembolism', 'blood', 'thromboembol*|thrombosis|deep vein thrombosis|blood clots?|venous thromboembolism|dvt|thrombotic|systemic embolism|embolism'],
  ['Anemia', 'blood', 'anemia|anaemia|hemolytic|hemolysis'],
  ['Low blood counts', ['blood', 'immune'], 'neutropenia|agranulocytosis|leukopenia|thrombocytopenia|pancytopenia|bone marrow suppression|myelosuppression|aplastic anemia'],
  ['Hypoglycemia', 'blood', 'hypoglycemia|hypoglycaemia|low blood sugar'],
  ['Hyperglycemia', 'blood', 'hyperglycemia|hyperglycaemia|increased blood glucose|elevated glucose'],
  ['Lactic acidosis', 'blood', 'lactic acidosis|lactate'],
  ['Ketoacidosis', 'blood', 'ketoacidosis'],
  ['Electrolyte changes', 'blood', 'hypokalemia|hyperkalemia|hyponatremia|hypomagnesemia|hypocalcemia|hypercalcemia|electrolyte*|potassium|sodium levels|serum potassium'],
  ['Cholesterol and lipids', 'blood', 'hyperlipidemia|hypercholesterolemia|dyslipidemia|ldl.c|cholesterol|triglycerides|lipid*'],
  ['Vasculitis', 'blood', 'vasculitis'],
  ['Hyperuricemia', 'blood', 'hyperuricemia|uric acid'],
  ['Anticoagulation', 'blood', 'anticoagula*|inr|prothrombin'],
  ['Blood & vessels', 'blood', 'blood|vascular|vessels?|arter*|venous|veins?|hemato*|plasma', 'g'],

  // Immune & infection
  ['Hypersensitivity reactions', ['immune', 'whole_body'], 'hypersensitivity|allergic reactions?|allergy|allergies'],
  ['Anaphylaxis', ['immune', 'whole_body'], 'anaphyla*'],
  ['Serious infections', 'immune', 'serious infections?|opportunistic infections?|sepsis|tuberculosis|fungal infections?'],
  ['Bacterial infections', 'immune', 'infections caused by|bacterial infections?|susceptible (strains|isolates|bacteria)|community.acquired|otitis media|streptococcus|staphylococcus|h\\. pylori|helicobacter pylori'],
  ['Viral infections', 'immune', 'herpes zoster|herpes labialis|genital herpes|influenza|covid|hepatitis b|herpes'],
  ['Immunosuppression', 'immune', 'immunosuppress*|immune suppression|lymphoma|malignancies'],
  ['Lupus-like reactions', 'immune', 'lupus|autoimmune'],
  ['Rheumatoid arthritis', ['immune', 'musculoskeletal'], 'rheumatoid arthritis|psoriatic arthritis|ankylosing spondylitis|juvenile idiopathic arthritis'],
  ['Immune & lymph', 'immune', 'immune|lymph*|spleen|splen*', 'g'],

  // Skin
  ['Rash', 'skin', 'rash|rashes|exanthema|urticaria|hives'],
  ['Pruritus', 'skin', 'pruritus|itching|itch'],
  ['Severe skin reactions', 'skin', 'stevens.johnson|toxic epidermal necrolysis|dress|drug reaction with eosinophilia|serious skin reactions|severe cutaneous adverse reactions|exfoliative'],
  ['Photosensitivity', 'skin', 'photosensitivity|phototoxicity|sunburn'],
  ['Injection site reactions', 'skin', 'injection site|infusion site'],
  ['Lipodystrophy', 'skin', 'lipodystrophy|lipohypertrophy|localized cutaneous amyloidosis'],
  ['Hair loss', 'skin', 'alopecia|hair loss'],
  ['Sweating', 'skin', 'hyperhidrosis|sweating|night sweats'],
  ['Acne', 'skin', 'acne'],
  ['Psoriasis', 'skin', 'psoriasis'],
  ['Skin and soft tissue infections', 'skin', 'skin and skin structure infections?|skin and soft tissue|cellulitis'],
  ['Skin', 'skin', 'skin|dermat*|cutaneous|subcutaneous', 'g'],

  // Muscles, bones & joints
  ['Myopathy', 'musculoskeletal', 'myopathy|rhabdomyolysis|myositis|muscle injury|necrotizing'],
  ['Muscle pain', 'musculoskeletal', 'myalgia|muscle pain|muscle spasms?|muscle cramps?|muscle weakness'],
  ['Joint pain', 'musculoskeletal', 'arthralgia|joint pain|arthritis|joint swelling'],
  ['Back pain', 'musculoskeletal', 'back pain'],
  ['Tendon rupture', 'musculoskeletal', 'tendinitis|tendon rupture|tendon'],
  ['Fractures', 'musculoskeletal', 'fractures?|osteoporosis|bone mineral density|bone loss|osteonecrosis'],
  ['Pain in extremity', 'musculoskeletal', 'pain in extremity|limb pain'],
  ['Osteoarthritis', 'musculoskeletal', 'osteoarthritis'],
  ['Gout', 'musculoskeletal', 'gout|gouty'],
  ['Muscles & bones', 'musculoskeletal', 'musculoskeletal|muscles?|skeletal|bones?|joints?', 'g'],

  // Endocrine glands
  ['Adrenal insufficiency', 'endocrine', 'adrenal insufficiency|adrenal suppression|hpa axis|hypothalamic.pituitary.adrenal|cushing*'],
  ['Hyperprolactinemia', 'endocrine', 'hyperprolactinemia|prolactin'],
  ['Hormone changes', 'endocrine', 'testosterone|estrogen|hormon*|menopaus*|hypogonadism'],
  ['Endocrine glands', 'endocrine', 'endocrine|adrenal|pituitary|corticosteroid insufficiency', 'g'],

  // Whole body
  ['Fatigue', 'whole_body', 'fatigue|asthenia|tiredness|malaise|lethargy'],
  ['Weight changes', 'whole_body', 'weight gain|weight loss|weight increased|weight decreased|weight reduction|body weight|obesity|overweight|chronic weight management'],
  ['Edema', 'whole_body', 'edema|oedema|swelling|fluid retention'],
  ['Fever', 'whole_body', 'fever|pyrexia|chills'],
  ['Overdose', 'whole_body', 'overdose|overdosage'],
  ['Death', 'whole_body', 'deaths?|mortality'],
];

function compile(source: string): RegExp {
  const body = source
    .split('|')
    .map((alt) => alt.trim().replace(/\*/g, '\\w*'))
    .join('|');
  return new RegExp(`\\b(?:${body})(?![\\w-])`, 'i');
}

export const TERMS: TermEntry[] = ROWS.map(([term, regions, patterns, generic]) => ({
  term,
  regions: Array.isArray(regions) ? regions : [regions],
  pattern: compile(patterns),
  generic: generic === 'g',
}));

export interface TermMatch {
  term: string;
  regions: Region[];
  generic: boolean;
}

/**
 * Find every mapped term in a piece of label text.
 * A generic anatomical word only counts for a region no specific term already covers,
 * so "hepatic failure" yields "Liver failure" and not also a bare "Liver" hit.
 */
export function matchTerms(text: string): TermMatch[] {
  const out: TermMatch[] = [];
  const covered = new Set<Region>();
  const spans: [number, number][] = [];
  for (const entry of TERMS) {
    const m = entry.pattern.exec(text);
    if (!m) continue;
    const span: [number, number] = [m.index, m.index + m[0].length];
    // "diabetes mellitus" inside an already-matched "type 2 diabetes mellitus" is the same mention.
    if (spans.some(([a, b]) => span[0] >= a && span[1] <= b)) continue;
    if (entry.generic) {
      const regions = entry.regions.filter((r) => !covered.has(r));
      if (regions.length) out.push({ term: entry.term, regions, generic: true });
    } else {
      entry.regions.forEach((r) => covered.add(r));
      spans.push(span);
      out.push({ term: entry.term, regions: entry.regions, generic: false });
    }
  }
  return out;
}

/** Regions mentioned by a piece of text. */
export function mapToRegions(text: string): Region[] {
  const set = new Set<Region>();
  for (const m of matchTerms(text)) m.regions.forEach((r) => set.add(r));
  return [...set];
}
