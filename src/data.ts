import { hydrate } from './lib/effects.ts';
import type { Dataset, Drug } from './lib/types.ts';

export type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; drugs: Drug[]; kind: string }
  | { status: 'error'; message: string };

const url = `${import.meta.env.BASE_URL}data/drugs.json`;

// Start the request while the bundle is still evaluating, before React mounts.
let pending: Promise<Dataset> | null = fetchDataset();

function fetchDataset(): Promise<Dataset> {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`The drug dataset could not be loaded (HTTP ${res.status}).`);
    return res.json() as Promise<Dataset>;
  });
}

export async function loadDrugs(): Promise<LoadState> {
  try {
    const dataset = await (pending ?? fetchDataset());
    if (!Array.isArray(dataset?.drugs)) throw new Error('The drug dataset is malformed.');
    return { status: 'ready', drugs: hydrate(dataset), kind: dataset.kind };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'The drug dataset could not be loaded.' };
  } finally {
    pending = null;
  }
}
