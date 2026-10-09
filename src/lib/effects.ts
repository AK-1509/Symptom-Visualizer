import type { AgeGroup, Dataset, Drug, Effect, EffectType, Region } from './types.ts';

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

/** Effects without an age tag apply to all ages. Geriatric patients are adults, so adult-tagged text applies to them too. */
export function appliesAtAge(effect: Pick<Effect, 'ages'>, age: number): boolean {
  if (!effect.ages?.length) return true;
  const group = ageGroup(age);
  return effect.ages.includes(group) || (group === 'geriatric' && effect.ages.includes('adult'));
}

/** True when the effect is tagged with an age group and that group matches: these get emphasis. */
export function isAgeSpecificMatch(effect: Pick<Effect, 'ages'>, age: number): boolean {
  return !!effect.ages?.length && appliesAtAge(effect, age);
}

export function effectsForRegion(drug: Drug, region: Region): Effect[] {
  return drug.effects.filter((e) => e.region === region);
}

/** Visual state type: contraindications share the warning state. */
export type VisualType = 'therapeutic' | 'adverse' | 'warning';
export const visualType = (t: EffectType): VisualType => (t === 'contraindication' ? 'warning' : t);

export type RegionState = Record<VisualType, boolean>;

/** Which visual states each region has for a drug at a given age. Regions with no applicable effects are absent. */
export function regionStates(drug: Drug | undefined, age: number): Map<Region, RegionState> {
  const states = new Map<Region, RegionState>();
  if (!drug) return states;
  for (const e of drug.effects) {
    if (!appliesAtAge(e, age)) continue;
    const s = states.get(e.region) ?? { therapeutic: false, adverse: false, warning: false };
    s[visualType(e.type)] = true;
    states.set(e.region, s);
  }
  return states;
}

/** For every region, the active drugs that have an applicable effect there. */
export function regionOverlap(drugs: Drug[], age: number): Map<Region, Drug[]> {
  const out = new Map<Region, Drug[]>();
  for (const d of drugs) {
    for (const region of regionStates(d, age).keys()) {
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
  /** Age-tagged effects for other age groups, kept visible but de-emphasized. */
  otherAges: Effect[];
}

/** Effects for one drug and region, split by section type; age-matched, age-specific statements first. */
export function regionDetails(drug: Drug, region: Region, age: number): RegionDetails {
  const out: RegionDetails = { therapeutic: [], adverse: [], warning: [], contraindication: [], otherAges: [] };
  const effects = effectsForRegion(drug, region);
  const rank = (e: Effect) => (isAgeSpecificMatch(e, age) ? 0 : 1) + (e.boxed ? -1 : 0);
  for (const e of [...effects].sort((a, b) => rank(a) - rank(b))) {
    if (appliesAtAge(e, age)) out[e.type].push(e);
    else out.otherAges.push(e);
  }
  return out;
}

/** Attach each label's provenance to every effect so no claim travels without its source. */
export function hydrate(dataset: Dataset): Drug[] {
  return dataset.drugs.map((d) => ({
    ...d,
    effects: d.effects.map((e) => ({ ...d.label, ...e })),
  }));
}

/** Add a drug id to the active list unless it is already there. */
export function addActive(active: string[], id: string): string[] {
  return active.includes(id) ? active : [...active, id];
}

export function removeActive(active: string[], id: string): string[] {
  return active.filter((x) => x !== id);
}
