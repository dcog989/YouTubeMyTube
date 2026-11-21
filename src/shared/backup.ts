import { BACKUP_KEY } from './constants';
import { normalizeState, ruleCount } from './normalize';
import { getStored, setStored } from './storage-ext';
import type { BlockerState } from './types';

export interface Backup {
  state: BlockerState;
  savedAt: number;
}

// Snapshot only states that still carry rules, and never replace a larger
// backup with a smaller one: a wipe applied as a series of removals must not
// walk the backup down to nothing.
export function shouldSnapshot(current: BlockerState, existing: Backup | undefined): boolean {
  const count = ruleCount(current);
  if (count === 0) return false;
  if (!existing) return true;
  if (count < ruleCount(existing.state)) return false;
  return JSON.stringify(existing.state) !== JSON.stringify(current);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// shortcut: the backup lives in the same storage.local area, so a browser
// storage clear or an uninstall takes it; move to storage.sync/files when
// surviving that matters.
export async function readBackup(): Promise<Backup | undefined> {
  const stored = await getStored<unknown>(BACKUP_KEY);
  if (!isRecord(stored)) return undefined;
  const savedAt = typeof stored.savedAt === 'number' ? stored.savedAt : 0;
  return { state: normalizeState(stored.state), savedAt };
}

export async function writeBackup(state: BlockerState, now = Date.now()): Promise<void> {
  await setStored({ [BACKUP_KEY]: { state, savedAt: now } });
}
