import type { OpenFdaLabel } from '../extract.ts';

/**
 * Synthetic openFDA-shaped label for a fictional drug, used only to test extraction mechanics.
 * It mimics the flattened PLR text openFDA returns; none of it describes a real product.
 */
export const FIXTURE_LABEL: OpenFdaLabel = {
  set_id: '00000000-0000-0000-0000-000000000000',
  effective_time: '20240115',
  openfda: {
    brand_name: ['ZOVAREX'],
    generic_name: ['FIXTUREMAB HYDROCHLORIDE'],
    pharm_class_epc: ['Fixture Receptor Agonist [EPC]'],
    product_type: ['HUMAN PRESCRIPTION DRUG'],
  },
  boxed_warning: [
    'WARNING: RISK OF THYROID C-CELL TUMORS In rodents, fixturemab causes thyroid C-cell tumors [see Warnings and Precautions (5.1)]. ZOVAREX is contraindicated in patients with a personal history of medullary thyroid carcinoma.',
  ],
  indications_and_usage: [
    '1 INDICATIONS AND USAGE ZOVAREX is indicated as an adjunct to diet and exercise to improve glycemic control in adults with type 2 diabetes mellitus. Limitations of Use: ZOVAREX has not been studied in patients with a history of pancreatitis. ZOVAREX is not a substitute for insulin in type 1 diabetes mellitus.',
  ],
  contraindications: [
    '4 CONTRAINDICATIONS ZOVAREX is contraindicated in patients with a personal or family history of medullary thyroid carcinoma. Serious hypersensitivity reactions to fixturemab. ZOVAREX is contraindicated in pregnancy because it may cause fetal harm.',
  ],
  warnings_and_cautions: [
    '5 WARNINGS AND PRECAUTIONS 5.1 Risk of Thyroid C-Cell Tumors In both sexes of rats, fixturemab caused thyroid C-cell tumors. 5.2 Pancreatitis Acute pancreatitis, including fatal cases, has been observed in patients treated with fixturemab (5.2). 5.3 Hypoglycemia Patients receiving insulin may have an increased risk of hypoglycemia. 5.4 Use in Pediatric Patients Serious hypoglycemia has been reported in pediatric patients.',
  ],
  adverse_reactions: [
    '6 ADVERSE REACTIONS 6.1 Clinical Trials Experience The most common adverse reactions, reported in ≥5% of patients, are nausea, vomiting, diarrhea, abdominal pain and constipation. Table 1: Adverse Reactions Nausea 20 % 15 % 6 % 2 % Headache 5 % 3 % 4 % 1 % 6.2 Postmarketing Experience Gastrointestinal Disorders: ileus.',
  ],
  pregnancy: [
    '8.1 Pregnancy Pregnancy Exposure Registry There is a pregnancy exposure registry that monitors pregnancy outcomes. Risk Summary Based on animal data, ZOVAREX may cause fetal harm when given to a pregnant woman.',
  ],
  use_in_specific_populations: [
    '8.2 Lactation Risk Summary There are no data on the presence of fixturemab in human milk. 8.4 Pediatric Use Safety and effectiveness have not been established.',
  ],
  pharmacokinetics: [
    '12.3 Pharmacokinetics Absorption Fixturemab is absorbed slowly. Specific Populations Male and Female Patients Exposure was 15% higher in women than in men. Renal Impairment No adjustment.',
  ],
  pediatric_use: ['8.4 Pediatric Use Safety and effectiveness of ZOVAREX have not been established in pediatric patients.'],
  geriatric_use: [
    '8.5 Geriatric Use No overall differences in safety or effectiveness were observed between patients 65 years of age and older and younger adult patients.',
  ],
};
