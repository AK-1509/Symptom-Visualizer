/**
 * npm run data:build [-- --refresh] [-- --only=semaglutide,metformin]
 *
 * Fetches drug labels from openFDA (https://open.fda.gov/apis/drug/label/), extracts the
 * sections the app needs, maps their terminology onto the app's anatomy vocabulary and writes
 * the compact dataset the browser loads: public/data/drugs.json.
 *
 * Raw API responses are cached in data/raw/ so re-runs are offline and reproducible.
 * Set OPENFDA_API_KEY to raise the openFDA rate limit.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDrug, normalizeGeneric, pickLabel, type DrugConfig, type OpenFdaLabel } from '../src/lib/extract.ts';
import type { Dataset, StoredDrug } from '../src/lib/types.ts';
import { DRUGS } from './drug-list.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'data', 'raw');
const outFile = join(root, 'public', 'data', 'drugs.json');
const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const apiKey = process.env.OPENFDA_API_KEY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchLabels(search: string, attempt = 1): Promise<OpenFdaLabel[]> {
  // openFDA reads "+" as a separator, so keep it literal after encoding.
  const query = encodeURIComponent(search).replace(/%2B/g, '+');
  const url = `https://api.fda.gov/drug/label.json?search=${query}&limit=100${apiKey ? `&api_key=${apiKey}` : ''}`;
  const res = await fetch(url);
  if (res.status === 404) return []; // openFDA answers "no matches" with 404
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await sleep(1000 * 2 ** attempt);
    return fetchLabels(search, attempt + 1);
  }
  if (!res.ok) throw new Error(`openFDA ${res.status} for ${search}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { results?: OpenFdaLabel[] };
  return body.results ?? [];
}

function genericQuery(config: DrugConfig): string {
  const tokens = normalizeGeneric(config.generic ?? config.name)
    .split(' ')
    .filter((t) => t !== 'and');
  return `openfda.generic_name:(${tokens.join('+AND+')})`;
}

async function fetchClassPool(config: DrugConfig): Promise<OpenFdaLabel[]> {
  const labels = await fetchLabels(`${genericQuery(config)}+AND+_exists_:openfda.pharm_class_epc`);
  await sleep(250);
  // Only the class annotation is needed from these.
  return labels.map((l) => ({ set_id: l.set_id, effective_time: l.effective_time, openfda: l.openfda }));
}

async function fetchByBrand(brand: string): Promise<OpenFdaLabel[]> {
  const labels = await fetchLabels(`openfda.brand_name:"${brand}"`);
  await sleep(250);
  return labels;
}

/** Fetch (or read cached) labels for one drug: the label pool and a broader brand-name pool. */
interface Raw {
  labels: OpenFdaLabel[];
  brandPool: OpenFdaLabel[];
  /** Labels found by brand name (the configured brand and OTC brands), keyed by brand. */
  byBrand?: Record<string, OpenFdaLabel[]>;
  /** Labels of the same ingredient that carry an established pharmacologic class. */
  classPool?: OpenFdaLabel[];
}

async function labelsFor(config: DrugConfig): Promise<Raw> {
  const cache = join(rawDir, `${config.id}.json`);
  const brands = [config.brand, ...(config.otcBrands ?? [])].filter((b): b is string => !!b);
  if (!refresh && existsSync(cache)) {
    const data = JSON.parse(await readFile(cache, 'utf8')) as Raw;
    const missing = brands.filter((b) => !data.byBrand?.[b]);
    if (!missing.length && data.classPool) return data;
    data.byBrand ??= {};
    for (const b of missing) data.byBrand[b] = await fetchByBrand(b);
    data.classPool ??= await fetchClassPool(config);
    await writeFile(cache, JSON.stringify(data));
    return data;
  }
  const generic = genericQuery(config);
  const productType = config.otc ? 'HUMAN OTC DRUG' : 'HUMAN PRESCRIPTION DRUG';
  const labels = await fetchLabels(`${generic}+AND+openfda.product_type:"${productType}"`);
  await sleep(250);
  const brandPool = await fetchLabels(generic);
  await sleep(250);
  const byBrand: Record<string, OpenFdaLabel[]> = {};
  for (const b of brands) byBrand[b] = await fetchByBrand(b);
  const data: Raw = { labels, brandPool, byBrand, classPool: await fetchClassPool(config) };
  await writeFile(cache, JSON.stringify(data));
  return data;
}

async function main() {
  await mkdir(rawDir, { recursive: true });
  await mkdir(dirname(outFile), { recursive: true });
  const configs = only ? DRUGS.filter((d) => only.includes(d.id)) : DRUGS;
  const previous: StoredDrug[] = only && existsSync(outFile) ? (JSON.parse(await readFile(outFile, 'utf8')) as Dataset).drugs : [];
  const built = new Map(previous.map((d) => [d.id, d]));
  const problems: string[] = [];

  for (const config of configs) {
    try {
      const { labels, brandPool, byBrand = {}, classPool = [] } = await labelsFor(config);
      const branded = Object.values(byBrand).flat();
      const pool = [...branded, ...labels, ...brandPool];
      const label = pickLabel(pool, config);
      pool.push(...classPool);
      if (!label) {
        problems.push(`${config.id}: no matching label (${labels.length} candidates)`);
        continue;
      }
      const drug = buildDrug(config, label, pool);
      if (!drug.effects.length) problems.push(`${config.id}: label found but no effects mapped`);
      built.set(drug.id, drug);
      const regions = new Set(drug.effects.map((e) => e.region));
      console.log(
        `${config.id.padEnd(30)} ${drug.label.labelTitle.padEnd(28)} ${drug.label.labelDate}  ${String(drug.effects.length).padStart(3)} effects  ${regions.size} regions`,
      );
    } catch (err) {
      problems.push(`${config.id}: ${(err as Error).message}`);
    }
  }

  const order = new Map(DRUGS.map((d, i) => [d.id, i]));
  const dataset: Dataset = {
    kind: 'openfda',
    generatedAt: new Date().toISOString(),
    notice:
      'Generated by scripts/build-data.ts from openFDA drug labeling (api.fda.gov/drug/label). Excerpts are verbatim label text; region mapping is deterministic keyword matching (src/lib/anatomy.ts).',
    drugs: [...built.values()].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)),
  };
  const json = JSON.stringify(dataset);
  await writeFile(outFile, `${json}\n`);
  console.log(`\nWrote ${dataset.drugs.length} drugs to public/data/drugs.json (${(json.length / 1024).toFixed(0)} KB)`);
  if (problems.length) {
    console.warn(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    if (!dataset.drugs.length) process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
