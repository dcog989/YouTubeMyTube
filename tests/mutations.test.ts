import { describe, expect, it } from 'vitest';
import { defaultState } from '../src/shared/defaults';
import { applyMutation, isMutation } from '../src/shared/mutations';

describe('isMutation', () => {
  it('accepts known kinds and rejects everything else', () => {
    expect(isMutation({ kind: 'setEnabled', enabled: true })).toBe(true);
    expect(isMutation({ kind: 'applyMetadata', fixes: [] })).toBe(true);
    expect(isMutation({ kind: 'replaceState', state: defaultState() })).toBe(true);
    expect(isMutation({ kind: 'unknown' })).toBe(false);
    expect(isMutation({})).toBe(false);
    expect(isMutation(null)).toBe(false);
    expect(isMutation('setEnabled')).toBe(false);
  });
});

describe('applyMutation', () => {
  it('toggles the enabled setting and reports no-ops', () => {
    const state = defaultState();
    expect(applyMutation(state, { kind: 'setEnabled', enabled: false })).toBe(state);
    expect(state.settings.enabled).toBe(false);
    expect(applyMutation(state, { kind: 'setEnabled', enabled: false })).toBeNull();
  });

  it('blocks and unblocks videos', () => {
    const state = defaultState();
    const entry = { id: 'abc', title: '' };
    expect(applyMutation(state, { kind: 'blockVideo', entry })).toBe(state);
    expect(state.rules.videos).toHaveLength(1);
    expect(applyMutation(state, { kind: 'blockVideo', entry })).toBeNull();
    expect(applyMutation(state, { kind: 'unblockVideo', videoId: 'abc' })).toBe(state);
    expect(state.rules.videos).toHaveLength(0);
    expect(applyMutation(state, { kind: 'unblockVideo', videoId: 'abc' })).toBeNull();
  });

  it('blocks and unblocks channels by lookup', () => {
    const state = defaultState();
    const entry = { id: 'UC1', name: '', handle: '@SomeHandle' };
    expect(applyMutation(state, { kind: 'blockChannel', entry })).toBe(state);
    expect(state.rules.channels).toHaveLength(1);
    expect(applyMutation(state, { kind: 'blockChannel', entry })).toBeNull();
    const lookup = { handle: '@somehandle' };
    expect(applyMutation(state, { kind: 'unblockChannel', lookup })).toBe(state);
    expect(state.rules.channels).toHaveLength(0);
    expect(applyMutation(state, { kind: 'unblockChannel', lookup })).toBeNull();
  });

  it('removes rules by reason ref and ignores reasons without a ref', () => {
    const state = defaultState();
    state.rules.videos = [{ id: 'abc', title: '' }];
    const reason = { kind: 'video', value: 'abc' } as const;
    expect(applyMutation(state, { kind: 'unblockReason', reason })).toBe(state);
    expect(state.rules.videos).toHaveLength(0);
    const noRef = { kind: 'title', value: 'spam' } as const;
    expect(applyMutation(state, { kind: 'unblockReason', reason: noRef })).toBeNull();
  });

  it('replaces the whole state', () => {
    const replacement = defaultState();
    replacement.settings.enabled = false;
    const next = applyMutation(defaultState(), { kind: 'replaceState', state: replacement });
    expect(next).toBe(replacement);
  });
});

describe('applyMetadata', () => {
  it('fills channel and video metadata', () => {
    const state = defaultState();
    state.rules.channels.push({ id: '', name: 'Old Name', handle: '' });
    state.rules.videos.push({ id: 'abc', title: '' });

    const next = applyMutation(state, {
      kind: 'applyMetadata',
      fixes: [
        {
          kind: 'channel',
          lookup: { name: 'Old Name' },
          id: 'UC1',
          name: 'New Name',
          handle: 'newhandle',
          failed: false,
        },
        { kind: 'video', videoId: 'abc', title: 'A Video', failed: false },
      ],
    });

    expect(next).toBe(state);
    expect(state.rules.channels[0]).toEqual({ id: 'UC1', name: 'New Name', handle: 'newhandle' });
    expect(state.rules.videos[0]).toEqual({ id: 'abc', title: 'A Video' });
  });

  it('marks and clears lookup failures', () => {
    const state = defaultState();
    state.rules.channels.push({ id: 'UC1', name: 'Name', handle: '' });
    state.rules.videos.push({ id: 'abc', title: 'Title' });

    applyMutation(state, {
      kind: 'applyMetadata',
      fixes: [
        { kind: 'channel', lookup: { id: 'UC1' }, id: '', name: '', handle: '', failed: true },
        { kind: 'video', videoId: 'abc', title: '', failed: true },
      ],
    });
    expect(state.rules.channels[0]?.lookupFailed).toBe(true);
    expect(state.rules.videos[0]?.lookupFailed).toBe(true);

    applyMutation(state, {
      kind: 'applyMetadata',
      fixes: [
        { kind: 'channel', lookup: { id: 'UC1' }, id: '', name: '', handle: '', failed: false },
        { kind: 'video', videoId: 'abc', title: 'Title', failed: false },
      ],
    });
    expect(state.rules.channels[0]?.lookupFailed).toBeUndefined();
    expect(state.rules.videos[0]?.lookupFailed).toBeUndefined();
  });

  it('ignores entries that are no longer stored', () => {
    const state = defaultState();
    expect(
      applyMutation(state, {
        kind: 'applyMetadata',
        fixes: [{ kind: 'video', videoId: 'gone', title: 'Title', failed: false }],
      }),
    ).toBeNull();
  });
});
