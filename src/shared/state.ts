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
  try {
    return (await readState()) ?? defaultState();
  } catch {
    // The storage API can be unavailable during startup; content scripts
    // re-read on navigation/visibility, so a transient failure must not abort.
    return defaultState();
  }
}

// The service worker is the single writer; UI surfaces route mutations through
// MUTATE_REQUEST (see requestMutation) so read-modify-write is serialized.
export async function saveState(state: BlockerState): Promise<void> {
  await setStored({ [STATE_KEY]: state });
}

// Writes defaults only when the key is confirmed absent. If storage cannot be
// read, seeding is skipped rather than clobbering the user's real rules with a
// transiently empty read.
export async function seedState(): Promise<void> {
  let stored: unknown;
  try {
    stored = await getStored<unknown>(STATE_KEY);
  } catch {
    return;
  }
  if (stored === undefined) {
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
