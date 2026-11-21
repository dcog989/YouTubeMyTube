import { BACKUP_KEY } from './constants';
import { normalizeState, ruleCount } from './normalize';
import { getStored, setStored } from './storage-ext';
import type { BlockerState } from './types';

export interface Backup {
  state: BlockerState;
  savedAt: number;
}

// The first save into a store that has rules but no usable backup seeds one
// from what was saved, so a fresh import is protected before the next change.
export function shouldSeedBackup(saved: BlockerState, existing: Backup | undefined): boolean {
  return !backupState(existing) && ruleCount(saved) > 0;
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

// The base for a mutation when the state key is absent. An empty backup is no
// base at all: restoring it would just write defaults over the user's slots.
export function backupState(backup: Backup | undefined): BlockerState | undefined {
  if (!backup || ruleCount(backup.state) === 0) return undefined;
  return backup.state;
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
