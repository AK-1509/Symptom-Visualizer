import type { DrugConfig } from '../src/lib/extract.ts';

/**
 * Drugs ingested by `npm run data:build`. Add a row to expand the dataset.
 * `generic` is matched against openFDA `openfda.generic_name` after salt forms are stripped;
 * `brand` picks which label (usually the innovator's) the text is taken from.
 */
export const DRUGS: DrugConfig[] = [
  // Endocrine & metabolic
  { id: 'semaglutide', name: 'Semaglutide', brand: 'Ozempic' },
  { id: 'tirzepatide', name: 'Tirzepatide', brand: 'Mounjaro' },
  { id: 'liraglutide', name: 'Liraglutide', brand: 'Victoza' },
  { id: 'metformin', name: 'Metformin', brand: 'Glucophage' },
  { id: 'empagliflozin', name: 'Empagliflozin', brand: 'Jardiance' },
  { id: 'dapagliflozin', name: 'Dapagliflozin', brand: 'Farxiga' },
  { id: 'sitagliptin', name: 'Sitagliptin', brand: 'Januvia' },
  { id: 'glipizide', name: 'Glipizide', brand: 'Glucotrol' },
  { id: 'insulin-glargine', name: 'Insulin glargine', brand: 'Lantus' },
  { id: 'insulin-lispro', name: 'Insulin lispro', brand: 'Humalog' },
  { id: 'levothyroxine', name: 'Levothyroxine', brand: 'Synthroid' },
  { id: 'methimazole', name: 'Methimazole', brand: 'Tapazole' },
  { id: 'prednisone', name: 'Prednisone' },
  { id: 'alendronate', name: 'Alendronate', brand: 'Fosamax' },
  { id: 'estradiol', name: 'Estradiol', brand: 'Estrace' },
  { id: 'testosterone', name: 'Testosterone', generic: 'testosterone cypionate', brand: 'Depo-Testosterone' },
  { id: 'allopurinol', name: 'Allopurinol', brand: 'Zyloprim' },

  // Cardiovascular & blood
  { id: 'atorvastatin', name: 'Atorvastatin', brand: 'Lipitor' },
  { id: 'rosuvastatin', name: 'Rosuvastatin', brand: 'Crestor' },
  { id: 'simvastatin', name: 'Simvastatin', brand: 'Zocor' },
  { id: 'lisinopril', name: 'Lisinopril', brand: 'Zestril' },
  { id: 'losartan', name: 'Losartan', brand: 'Cozaar' },
  { id: 'amlodipine', name: 'Amlodipine', brand: 'Norvasc' },
  { id: 'metoprolol', name: 'Metoprolol', generic: 'metoprolol succinate', brand: 'Toprol-XL' },
  { id: 'carvedilol', name: 'Carvedilol', brand: 'Coreg' },
  { id: 'hydrochlorothiazide', name: 'Hydrochlorothiazide' },
  { id: 'furosemide', name: 'Furosemide', brand: 'Lasix' },
  { id: 'spironolactone', name: 'Spironolactone', brand: 'Aldactone' },
  { id: 'warfarin', name: 'Warfarin', brand: 'Coumadin' },
  { id: 'apixaban', name: 'Apixaban', brand: 'Eliquis' },
  { id: 'rivaroxaban', name: 'Rivaroxaban', brand: 'Xarelto' },
  { id: 'clopidogrel', name: 'Clopidogrel', brand: 'Plavix' },
  { id: 'digoxin', name: 'Digoxin', brand: 'Lanoxin' },
  { id: 'aspirin', name: 'Aspirin', otc: true, brand: 'Bayer Aspirin', otcBrands: ['Ecotrin'] },

  // Brain & mental health
  { id: 'sertraline', name: 'Sertraline', brand: 'Zoloft' },
  { id: 'fluoxetine', name: 'Fluoxetine', brand: 'Prozac' },
  { id: 'escitalopram', name: 'Escitalopram', brand: 'Lexapro' },
  { id: 'bupropion', name: 'Bupropion', brand: 'Wellbutrin XL' },
  { id: 'venlafaxine', name: 'Venlafaxine', brand: 'Effexor XR' },
  { id: 'duloxetine', name: 'Duloxetine', brand: 'Cymbalta' },
  { id: 'trazodone', name: 'Trazodone' },
  { id: 'quetiapine', name: 'Quetiapine', brand: 'Seroquel' },
  { id: 'aripiprazole', name: 'Aripiprazole', brand: 'Abilify' },
  { id: 'lithium', name: 'Lithium', generic: 'lithium carbonate' },
  { id: 'alprazolam', name: 'Alprazolam', brand: 'Xanax' },
  { id: 'lorazepam', name: 'Lorazepam', brand: 'Ativan' },
  { id: 'zolpidem', name: 'Zolpidem', brand: 'Ambien' },
  { id: 'methylphenidate', name: 'Methylphenidate', brand: 'Ritalin' },
  { id: 'amphetamine', name: 'Amphetamine mixed salts', generic: 'dextroamphetamine saccharate, amphetamine aspartate, dextroamphetamine sulfate and amphetamine sulfate', brand: 'Adderall' },
  { id: 'donepezil', name: 'Donepezil', brand: 'Aricept' },

  // Nerves, seizures & migraine
  { id: 'gabapentin', name: 'Gabapentin', brand: 'Neurontin' },
  { id: 'pregabalin', name: 'Pregabalin', brand: 'Lyrica' },
  { id: 'levetiracetam', name: 'Levetiracetam', brand: 'Keppra' },
  { id: 'lamotrigine', name: 'Lamotrigine', brand: 'Lamictal' },
  { id: 'topiramate', name: 'Topiramate', brand: 'Topamax' },
  { id: 'sumatriptan', name: 'Sumatriptan', brand: 'Imitrex' },

  // Digestive
  { id: 'omeprazole', name: 'Omeprazole', brand: 'Prilosec', otcBrands: ['Prilosec OTC'] },
  { id: 'pantoprazole', name: 'Pantoprazole', brand: 'Protonix' },
  { id: 'famotidine', name: 'Famotidine', brand: 'Pepcid', otcBrands: ['Pepcid AC'] },
  { id: 'ondansetron', name: 'Ondansetron', brand: 'Zofran' },

  // Respiratory & allergy
  { id: 'albuterol', name: 'Albuterol', brand: 'Ventolin HFA', aliases: ['Salbutamol'] },
  { id: 'fluticasone-salmeterol', name: 'Fluticasone / salmeterol', generic: 'fluticasone and salmeterol', brand: 'Advair Diskus' },
  { id: 'budesonide-formoterol', name: 'Budesonide / formoterol', generic: 'budesonide and formoterol', brand: 'Symbicort' },
  { id: 'tiotropium', name: 'Tiotropium', brand: 'Spiriva' },
  { id: 'montelukast', name: 'Montelukast', brand: 'Singulair' },
  { id: 'cetirizine', name: 'Cetirizine', otc: true, brand: 'Zyrtec' },

  // Infection
  { id: 'amoxicillin', name: 'Amoxicillin' },
  { id: 'amoxicillin-clavulanate', name: 'Amoxicillin / clavulanate', generic: 'amoxicillin and clavulanate', brand: 'Augmentin' },
  { id: 'azithromycin', name: 'Azithromycin', brand: 'Zithromax' },
  { id: 'doxycycline', name: 'Doxycycline' },
  { id: 'ciprofloxacin', name: 'Ciprofloxacin', brand: 'Cipro' },
  { id: 'cephalexin', name: 'Cephalexin', brand: 'Keflex' },
  { id: 'sulfamethoxazole-trimethoprim', name: 'Sulfamethoxazole / trimethoprim', generic: 'sulfamethoxazole and trimethoprim', brand: 'Bactrim' },
  { id: 'nitrofurantoin', name: 'Nitrofurantoin', brand: 'Macrobid' },
  { id: 'valacyclovir', name: 'Valacyclovir', brand: 'Valtrex' },
  { id: 'oseltamivir', name: 'Oseltamivir', brand: 'Tamiflu' },
  { id: 'fluconazole', name: 'Fluconazole', brand: 'Diflucan' },

  // Pain & inflammation
  { id: 'ibuprofen', name: 'Ibuprofen', otcBrands: ['Advil', 'Motrin'] },
  { id: 'naproxen', name: 'Naproxen', brand: 'Naprosyn', otcBrands: ['Aleve'] },
  { id: 'acetaminophen', name: 'Acetaminophen', brand: 'Ofirmev', otcBrands: ['Tylenol'], aliases: ['Paracetamol'] },
  { id: 'celecoxib', name: 'Celecoxib', brand: 'Celebrex' },
  { id: 'meloxicam', name: 'Meloxicam', brand: 'Mobic' },
  { id: 'tramadol', name: 'Tramadol', brand: 'Ultram' },
  { id: 'oxycodone', name: 'Oxycodone', brand: 'OxyContin' },
  { id: 'cyclobenzaprine', name: 'Cyclobenzaprine' },

  // Immune, skin & joints
  { id: 'methotrexate', name: 'Methotrexate' },
  { id: 'hydroxychloroquine', name: 'Hydroxychloroquine', brand: 'Plaquenil' },
  { id: 'adalimumab', name: 'Adalimumab', brand: 'Humira' },
  { id: 'isotretinoin', name: 'Isotretinoin' },

  // Urology & reproductive
  { id: 'sildenafil', name: 'Sildenafil', brand: 'Viagra' },
  { id: 'tadalafil', name: 'Tadalafil', brand: 'Cialis' },
  { id: 'tamsulosin', name: 'Tamsulosin', brand: 'Flomax' },
  { id: 'finasteride', name: 'Finasteride', brand: 'Proscar' },
  { id: 'oxybutynin', name: 'Oxybutynin' },
];
