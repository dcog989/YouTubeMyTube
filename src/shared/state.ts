import { STATE_KEY } from './constants';
import { defaultState } from './defaults';
import { normalizeState } from './normalize';
import { getStored, setStored } from './storage-ext';
import type { BlockerState } from './types';

export async function loadState(): Promise<BlockerState> {
  const stored = await getStored<unknown>(STATE_KEY);
  return normalizeState(stored);
}

export async function saveState(state: BlockerState): Promise<void> {
  await setStored({ [STATE_KEY]: state });
}

// Reads the latest state, applies the mutator, then persists and returns it.
// Serialized so concurrent writers cannot clobber each other's changes.
let mutationQueue: Promise<unknown> = Promise.resolve();

export function mutateState(
  mutator: (state: BlockerState) => boolean | undefined,
): Promise<BlockerState | null> {
  const run = async (): Promise<BlockerState | null> => {
    const state = await loadState();
    const changed = mutator(state);
    if (changed === false) return null;
    const normalized = normalizeState(state);
    await saveState(normalized);
    return normalized;
  };
  const result = mutationQueue.then(run, run);
  mutationQueue = result.catch(() => undefined);
  return result;
}

export async function ensureState(): Promise<BlockerState> {
  const stored = await getStored<unknown>(STATE_KEY);
  if (stored === undefined) {
    const initial = defaultState();
    await saveState(initial);
    return initial;
  }
  return normalizeState(stored);
}

export function onLocalStorageChanged(listener: (newValue: unknown) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const change = changes[STATE_KEY];
    if (!change) return;
    listener(change.newValue);
  });
}
