import type { BlockerState } from './types';
import { STATE_KEY } from './constants';
import { getStored, setStored } from './ext';
import { defaultState, normalizeState } from './storage';

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
