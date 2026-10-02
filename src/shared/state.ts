import { STATE_KEY } from './constants';
import { defaultState } from './defaults';
import { normalizeState } from './normalize';
import { getStored, setStored } from './storage-ext';
import type { BlockerState } from './types';

export async function readState(): Promise<BlockerState | undefined> {
  const stored = await getStored<unknown>(STATE_KEY);
  if (stored === undefined) return undefined;
  return normalizeState(stored);
}

export async function loadState(): Promise<BlockerState> {
  return (await readState()) ?? defaultState();
}

export async function saveState(state: BlockerState): Promise<void> {
  await setStored({ [STATE_KEY]: state });
}

// Writes defaults only when the key is genuinely absent. Called from
// runtime.onInstalled, where an empty read means a real first install rather
// than a transient startup read, so it is safe to seed here.
export async function seedState(): Promise<void> {
  if ((await getStored<unknown>(STATE_KEY)) === undefined) {
    await saveState(defaultState());
  }
}

// Reads the latest state, applies the mutator, then persists and returns it.
// Serialized so concurrent writers cannot clobber each other's changes.
let mutationQueue: Promise<unknown> = Promise.resolve();

export function mutateState(
  mutator: (state: BlockerState) => boolean | undefined,
): Promise<BlockerState | null> {
  const run = async (): Promise<BlockerState | null> => {
    const current = await readState();
    // Abort on a missing key: a transient empty read must not replace the
    // user's real rules with defaults plus this mutation.
    if (!current) return null;
    const changed = mutator(current);
    if (changed === false) return null;
    const normalized = normalizeState(current);
    await saveState(normalized);
    return normalized;
  };
  const result = mutationQueue.then(run, run);
  mutationQueue = result.catch(() => undefined);
  return result;
}

export function onLocalStorageChanged(listener: (newValue: unknown) => void): void {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const change = changes[STATE_KEY];
    if (!change) return;
    listener(change.newValue);
  });
}
