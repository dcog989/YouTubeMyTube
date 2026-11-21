import { describe, expect, it } from 'vitest';
import { type Backup, shouldSnapshot } from '../src/shared/backup';
import { defaultState } from '../src/shared/defaults';
import type { BlockerState } from '../src/shared/types';

function stateWithVideos(ids: string[]): BlockerState {
  const state = defaultState();
  state.rules.videos = ids.map((id) => ({ id, title: '' }));
  return state;
}

function backupOf(state: BlockerState): Backup {
  return { state, savedAt: 1 };
}

describe('shouldSnapshot', () => {
  it('skips a state with no rules', () => {
    expect(shouldSnapshot(defaultState(), undefined)).toBe(false);
    expect(shouldSnapshot(defaultState(), backupOf(stateWithVideos(['a'])))).toBe(false);
  });

  it('takes the first state that has rules', () => {
    expect(shouldSnapshot(stateWithVideos(['a']), undefined)).toBe(true);
  });

  it('skips a state identical to the existing backup', () => {
    const state = stateWithVideos(['a']);
    expect(shouldSnapshot(stateWithVideos(['a']), backupOf(state))).toBe(false);
  });

  it('never lets a shrinking state replace a larger backup', () => {
    const backup = backupOf(stateWithVideos(['a', 'b', 'c']));
    // A wipe applied as a series of removals ends at one rule and then at none.
    expect(shouldSnapshot(stateWithVideos(['a', 'b']), backup)).toBe(false);
    expect(shouldSnapshot(stateWithVideos(['a']), backup)).toBe(false);
    expect(shouldSnapshot(defaultState(), backup)).toBe(false);
  });

  it('refreshes the backup when the rule count grows', () => {
    expect(shouldSnapshot(stateWithVideos(['a', 'b']), backupOf(stateWithVideos(['a'])))).toBe(
      true,
    );
  });

  it('refreshes the backup when the rule count is unchanged but content differs', () => {
    expect(shouldSnapshot(stateWithVideos(['b']), backupOf(stateWithVideos(['a'])))).toBe(true);
  });
});
