import { STATE_KEY } from './constants';
import { defaultState, normalizeState } from './storage';
import { getStored, setStored } from './storage-ext';
import type { BlockerState } from './types';

export async function loadState(): Promise<BlockerState> {
  const stored = await getStored<unknown>(STATE_KEY);
  return normalizeState(stored);
}

export async function saveState(state: BlockerState): Promise<void> {
  await setStored({ [STATE_KEY]: state });
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
