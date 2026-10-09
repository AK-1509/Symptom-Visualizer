import type { AgeGroup, Dataset, Drug, Effect, EffectType, Region, Sex, SexNote } from './types.ts';

export function ageGroup(age: number): AgeGroup {
  if (age < 18) return 'pediatric';
  if (age >= 65) return 'geriatric';
  return 'adult';
}

export const AGE_LABEL: Record<AgeGroup, string> = {
  pediatric: 'Pediatric',
  adult: 'Adult',
  geriatric: 'Geriatric',
};

export const SEX_LABEL: Record<Sex, string> = { amab: 'AMAB', afab: 'AFAB' };

/** Who the body map is showing. */
export interface Viewer {
  age: number;
  sex: Sex;
}

/** Effects without an age tag apply to all ages. Geriatric patients are adults, so adult-tagged text applies to them too. */
export function appliesAtAge(effect: Pick<Effect, 'ages'>, age: number): boolean {
  if (!effect.ages?.length) return true;
  const group = ageGroup(age);
  return effect.ages.includes(group) || (group === 'geriatric' && effect.ages.includes('adult'));
}

/** Effects without a sex tag apply to both. */
export function appliesToSex(effect: Pick<Effect, 'sexes'>, sex: Sex): boolean {
  return !effect.sexes?.length || effect.sexes.includes(sex);
}

export function appliesTo(effect: Pick<Effect, 'ages' | 'sexes'>, viewer: Viewer): boolean {
  return appliesAtAge(effect, viewer.age) && appliesToSex(effect, viewer.sex);
}

/** True when the effect is tagged with an age group and that group matches: these get emphasis. */
export function isAgeSpecificMatch(effect: Pick<Effect, 'ages'>, age: number): boolean {
  return !!effect.ages?.length && appliesAtAge(effect, age);
}

/** True when the effect names the viewer's sex specifically. */
export function isSexSpecificMatch(effect: Pick<Effect, 'sexes'>, sex: Sex): boolean {
  return !!effect.sexes?.length && appliesToSex(effect, sex);
}

/** Applicable statements that are specific to the viewer's age group or sex. */
export function specificCounts(drug: Drug | null, viewer: Viewer): { age: number; sex: number } {
  const out = { age: 0, sex: 0 };
  for (const e of drug?.effects ?? []) {
    if (!appliesTo(e, viewer)) continue;
    if (isAgeSpecificMatch(e, viewer.age)) out.age++;
    if (isSexSpecificMatch(e, viewer.sex)) out.sex++;
  }
  return out;
}

/** Sex-related label notes relevant to the viewer. */
export function sexNotesFor(drug: Drug, sex: Sex): SexNote[] {
  return (drug.sexNotes ?? []).filter((n) => !n.sexes || n.sexes.includes(sex));
}

export function effectsForRegion(drug: Drug, region: Region): Effect[] {
  return drug.effects.filter((e) => e.region === region);
}

/** Visual state type: contraindications share the warning state. */
export type VisualType = 'therapeutic' | 'adverse' | 'warning';
export const visualType = (t: EffectType): VisualType => (t === 'contraindication' ? 'warning' : t);

export type RegionState = Record<VisualType, boolean>;

/** Which visual states each region has for a drug and viewer. Regions with no applicable effects are absent. */
export function regionStates(drug: Drug | undefined, viewer: Viewer): Map<Region, RegionState> {
  const states = new Map<Region, RegionState>();
  if (!drug) return states;
  for (const e of drug.effects) {
    if (!appliesTo(e, viewer)) continue;
    const s = states.get(e.region) ?? { therapeutic: false, adverse: false, warning: false };
    s[visualType(e.type)] = true;
    states.set(e.region, s);
  }
  return states;
}

/** For every region, the active drugs that have an applicable effect there. */
export function regionOverlap(drugs: Drug[], viewer: Viewer): Map<Region, Drug[]> {
  const out = new Map<Region, Drug[]>();
  for (const d of drugs) {
    for (const region of regionStates(d, viewer).keys()) {
      const list = out.get(region) ?? [];
      list.push(d);
      out.set(region, list);
    }
  }
  return out;
}

export interface RegionDetails {
  therapeutic: Effect[];
  adverse: Effect[];
  warning: Effect[];
  contraindication: Effect[];
  /** Effects tagged for another age group or the other sex, kept visible but de-emphasized. */
  other: Effect[];
}

/** Effects for one drug and region, split by section type; statements specific to the viewer first. */
export function regionDetails(drug: Drug, region: Region, viewer: Viewer): RegionDetails {
  const out: RegionDetails = { therapeutic: [], adverse: [], warning: [], contraindication: [], other: [] };
  const effects = effectsForRegion(drug, region);
  const rank = (e: Effect) =>
    (isAgeSpecificMatch(e, viewer.age) || isSexSpecificMatch(e, viewer.sex) ? 0 : 1) + (e.boxed ? -1 : 0);
  for (const e of [...effects].sort((a, b) => rank(a) - rank(b))) {
    if (appliesTo(e, viewer)) out[e.type].push(e);
    else out.other.push(e);
  }
  return out;
}

/** Resolve excerpt references and attach each label's provenance to every effect, so no claim travels without its source. */
export function hydrate(dataset: Dataset): Drug[] {
  return dataset.drugs.map(({ quotes, effects, ...drug }) => ({
    ...drug,
    effects: effects.map((e) => ({
      ...drug.label,
      ...e,
      excerpts: e.excerpts.map((i) => quotes[i]).filter((q) => q !== undefined),
    })),
  }));
}

/** Add a drug id to the active list unless it is already there. */
export function addActive(active: string[], id: string): string[] {
  return active.includes(id) ? active : [...active, id];
}

export function removeActive(active: string[], id: string): string[] {
  return active.filter((x) => x !== id);
}
