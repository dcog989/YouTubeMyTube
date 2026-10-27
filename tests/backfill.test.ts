import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backfillMissing } from '../src/options/backfill';
import { getDraft, setDraft } from '../src/options/state';
import { defaultState } from '../src/shared/defaults';

const mocks = vi.hoisted(() => ({
  resolveChannelMeta: vi.fn(),
  resolveVideoTitle: vi.fn(),
  requestMutation: vi.fn(),
}));

vi.mock('../src/shared/resolve', () => ({
  resolveChannelMeta: mocks.resolveChannelMeta,
  resolveVideoTitle: mocks.resolveVideoTitle,
}));

vi.mock('../src/shared/runtime', () => ({ requestMutation: mocks.requestMutation }));

describe('backfillMissing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDraft(defaultState());
  });

  it('keeps an entry retryable and writes nothing when a lookup fails', async () => {
    const state = defaultState();
    state.rules.channels.push({ id: '', name: 'Music', handle: '' });
    setDraft(state);
    mocks.resolveChannelMeta.mockRejectedValue(new Error('503'));

    await backfillMissing();

    expect(mocks.requestMutation).not.toHaveBeenCalled();
    expect(getDraft().rules.channels).toEqual([{ id: '', name: 'Music', handle: '' }]);
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
});
