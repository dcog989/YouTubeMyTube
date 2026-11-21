import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backfillMissing } from '../src/options/backfill';
import { getDraft, setDraft } from '../src/options/state';
import { defaultState } from '../src/shared/defaults';

const mocks = vi.hoisted(() => ({
  resolveChannelMeta: vi.fn(),
  resolveVideoTitle: vi.fn(),
  requestMutation: vi.fn(),
  dirty: { value: false },
}));

vi.mock('../src/shared/resolve', () => ({
  resolveChannelMeta: mocks.resolveChannelMeta,
  resolveVideoTitle: mocks.resolveVideoTitle,
}));

vi.mock('../src/shared/runtime', () => ({ requestMutation: mocks.requestMutation }));

vi.mock('../src/options/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/options/state')>();
  return { ...actual, isDirty: () => mocks.dirty.value };
});

describe('backfillMissing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dirty.value = false;
    setDraft(defaultState());
  });

  it('keeps an entry retryable and writes nothing when a lookup fails', async () => {
    const state = defaultState();
    state.rules.channels.push({ id: 'UCtrailing', name: '', handle: '' });
    setDraft(state);
    mocks.resolveChannelMeta.mockRejectedValue(new Error('503'));

    await backfillMissing();

    expect(mocks.requestMutation).not.toHaveBeenCalled();
    expect(getDraft().rules.channels).toEqual([{ id: 'UCtrailing', name: '', handle: '' }]);
  });

  it('does not look up a deliberate name-only rule', async () => {
    const state = defaultState();
    state.rules.channels.push({ id: '', name: 'Music', handle: '' });
    setDraft(state);

    await backfillMissing();

    expect(mocks.resolveChannelMeta).not.toHaveBeenCalled();
  });

  it('persists a whole batch of fixes once', async () => {
    const state = defaultState();
    const ids = Array.from({ length: 26 }, (_, index) => String(index).padStart(11, '0'));
    for (const id of ids) state.rules.videos.push({ id, title: '' });
    setDraft(state);
    mocks.resolveVideoTitle.mockResolvedValue('A Title');
    mocks.requestMutation.mockResolvedValue(null);

    await backfillMissing();

    expect(mocks.requestMutation).toHaveBeenCalledTimes(1);
    const mutation = mocks.requestMutation.mock.calls[0]?.[0];
    expect(mutation.fixes).toHaveLength(26);
  });

  it('applies fixes to the draft when it has unsaved edits', async () => {
    const state = defaultState();
    state.rules.videos.push({ id: 'aaaaaaaaaaa', title: '' });
    setDraft(state);
    mocks.dirty.value = true;
    mocks.resolveVideoTitle.mockResolvedValue('Found Title');

    await backfillMissing();

    expect(getDraft().rules.videos[0]?.title).toBe('Found Title');
    expect(mocks.requestMutation).not.toHaveBeenCalled();
  });

  it('drops a fix when the row is edited while the lookup runs', async () => {
    const state = defaultState();
    state.rules.videos.push({ id: 'aaaaaaaaaaa', title: '' });
    setDraft(state);
    mocks.resolveVideoTitle.mockImplementation(async () => {
      const edited = defaultState();
      edited.rules.videos.push({ id: 'aaaaaaaaaaa', title: 'Mine' });
      setDraft(edited);
      return 'Lookup Title';
    });

    await backfillMissing();

    expect(getDraft().rules.videos[0]?.title).toBe('Mine');
    expect(mocks.requestMutation).not.toHaveBeenCalled();
  });

  it('stops after repeated lookup failures and leaves the rows retryable', async () => {
    const state = defaultState();
    for (const id of ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']) {
      state.rules.videos.push({ id, title: '' });
    }
    setDraft(state);
    mocks.resolveVideoTitle.mockRejectedValue(new Error('429'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await backfillMissing();

    expect(mocks.requestMutation).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(getDraft().rules.videos.every((video) => !video.lookupFailed)).toBe(true);
    warn.mockRestore();
  });
});
