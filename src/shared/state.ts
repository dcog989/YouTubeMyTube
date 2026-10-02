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

// The service worker is the single writer; UI surfaces route mutations through
// MUTATE_REQUEST (see requestMutation) so read-modify-write is serialized.
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

export function onLocalStorageChanged(listener: (newValue: unknown) => void): void {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    const change = changes[STATE_KEY];
    if (!change) return;
    listener(change.newValue);
  });
}
