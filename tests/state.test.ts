import { afterEach, describe, expect, it, vi } from 'vitest';
import { MUTATE_REQUEST } from '../src/shared/constants';
import { defaultState } from '../src/shared/defaults';
import type { Mutation } from '../src/shared/mutations';
import {
  blockChannel,
  blockVideo,
  completeOnboarding,
  setEnabled,
  unblockChannel,
  unblockReason,
  unblockVideo,
} from '../src/shared/rules-service';
import { requestMutation } from '../src/shared/runtime';
import { loadState, readState, saveState, seedState } from '../src/shared/state';
import type { BlockerState } from '../src/shared/types';

function stubStorage(overrides: {
  get?: () => Promise<Record<string, unknown>>;
  set?: (values: Record<string, unknown>) => Promise<void>;
}): { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> } {
  const get = vi.fn(overrides.get ?? (async () => ({})));
  const set = vi.fn(overrides.set ?? (async () => undefined));
  vi.stubGlobal('browser', { storage: { local: { get, set } } });
  return { get, set };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('state', () => {
  it('reads and normalizes stored state', async () => {
    stubStorage({
      get: async () => ({ state: { rules: { videos: [{ id: 'abc' }] } } }),
    });
    const state = await readState();
    expect(state?.rules.videos).toEqual([{ id: 'abc', title: '' }]);
  });

  it('returns undefined when the key is absent', async () => {
    stubStorage({});
    await expect(readState()).resolves.toBeUndefined();
  });

  it('falls back to defaults when reading keeps failing', async () => {
    vi.useFakeTimers();
    stubStorage({
      get: async () => {
        throw new Error('storage unavailable');
      },
    });
    const assertion = loadState();
    await vi.runAllTimersAsync();
    await expect(assertion).resolves.toEqual(defaultState());
  });

  it('seeds defaults only when the key is absent', async () => {
    const absent = stubStorage({});
    await seedState();
    expect(absent.set).toHaveBeenCalledWith({ state: defaultState() });

    const present = stubStorage({ get: async () => ({ state: defaultState() }) });
    await seedState();
    expect(present.set).not.toHaveBeenCalled();
  });

  it('saves the state under the state key', async () => {
    const { set } = stubStorage({});
    const state = defaultState();
    await saveState(state);
    expect(set).toHaveBeenCalledWith({ state });
  });
});

describe('requestMutation', () => {
  it('sends the mutation to the worker and returns the saved state', async () => {
    const saved = defaultState();
    saved.settings.enabled = false;
    const sendMessage = vi.fn(async () => saved);
    vi.stubGlobal('browser', { runtime: { sendMessage } });

    await expect(requestMutation({ kind: 'setEnabled', enabled: false })).resolves.toBe(saved);
    expect(sendMessage).toHaveBeenCalledWith({
      type: MUTATE_REQUEST,
      mutation: { kind: 'setEnabled', enabled: false },
    });
  });

  it('returns null when the message cannot be delivered', async () => {
    vi.stubGlobal('browser', {
      runtime: {
        sendMessage: async () => {
          throw new Error('worker gone');
        },
      },
    });
    await expect(requestMutation({ kind: 'completeOnboarding' })).resolves.toBeNull();
  });
});

describe('rules-service', () => {
  const cases: Array<{
    name: string;
    call: () => Promise<BlockerState | null>;
    mutation: Mutation;
  }> = [
    {
      name: 'setEnabled',
      call: () => setEnabled(false),
      mutation: { kind: 'setEnabled', enabled: false },
    },
    {
      name: 'completeOnboarding',
      call: () => completeOnboarding(),
      mutation: { kind: 'completeOnboarding' },
    },
    {
      name: 'blockVideo',
      call: () => blockVideo({ id: 'abc', title: '' }),
      mutation: { kind: 'blockVideo', entry: { id: 'abc', title: '' } },
    },
    {
      name: 'unblockVideo',
      call: () => unblockVideo('abc'),
      mutation: { kind: 'unblockVideo', videoId: 'abc' },
    },
    {
      name: 'blockChannel',
      call: () => blockChannel({ id: 'UC1', name: '', handle: 'foo' }),
      mutation: { kind: 'blockChannel', entry: { id: 'UC1', name: '', handle: 'foo' } },
    },
    {
      name: 'unblockChannel',
      call: () => unblockChannel({ id: 'UC1' }),
      mutation: { kind: 'unblockChannel', lookup: { id: 'UC1' } },
    },
    {
      name: 'unblockReason',
      call: () => unblockReason({ kind: 'video', value: 'abc' }),
      mutation: { kind: 'unblockReason', reason: { kind: 'video', value: 'abc' } },
    },
  ];

  for (const { name, call, mutation } of cases) {
    it(`maps ${name} to its mutation`, async () => {
      const sendMessage = vi.fn(async () => null);
      vi.stubGlobal('browser', { runtime: { sendMessage } });
      await call();
      expect(sendMessage).toHaveBeenCalledWith({ type: MUTATE_REQUEST, mutation });
    });
  }

  it('does not send an unblock for a null reason', async () => {
    const sendMessage = vi.fn(async () => null);
    vi.stubGlobal('browser', { runtime: { sendMessage } });
    await expect(unblockReason(null)).resolves.toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
