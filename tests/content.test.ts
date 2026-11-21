import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBatcher } from '../src/content/batch';
import { createChannelCache } from '../src/content/menu/channel-cache';
import { createPlaybackGuard } from '../src/content/playback';
import { applyDecision } from '../src/content/store';
import { defaultState } from '../src/shared/defaults';

const { resolveVideoChannel } = vi.hoisted(() => ({ resolveVideoChannel: vi.fn() }));

vi.mock('../src/shared/resolve', () => ({ resolveVideoChannel }));

describe('applyDecision', () => {
  it('rescans on the first state', () => {
    expect(applyDecision(null, defaultState())).toEqual({ rescans: true, rulesEqual: false });
  });

  it('skips the rescan when only non-filtering settings change', () => {
    const previous = defaultState();
    const next = structuredClone(previous);
    next.settings.theme = 'dark';
    expect(applyDecision(previous, next)).toEqual({ rescans: false, rulesEqual: true });
  });

  it('rescans when the rules change', () => {
    const previous = defaultState();
    const next = structuredClone(previous);
    next.rules.videos.push({ id: 'abcdefghijk', title: '' });
    expect(applyDecision(previous, next)).toEqual({ rescans: true, rulesEqual: false });
  });

  it('rescans when an area or the enabled flag changes', () => {
    const previous = defaultState();
    const areas = structuredClone(previous);
    areas.areas.trendingPage = true;
    expect(applyDecision(previous, areas).rescans).toBe(true);

    const disabled = structuredClone(previous);
    disabled.settings.enabled = false;
    expect(applyDecision(previous, disabled).rescans).toBe(true);
  });
});

describe('createBatcher', () => {
  it('dedupes a microtask batch and flushes it once', async () => {
    const flush = vi.fn();
    const batcher = createBatcher<Element>(flush);
    const first = {} as Element;
    const second = {} as Element;

    batcher.add(first);
    batcher.add(second);
    batcher.add(first);
    await Promise.resolve();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([first, second]);
  });

  it('coalesces timed calls into one flush', () => {
    vi.useFakeTimers();
    try {
      const flush = vi.fn();
      const batcher = createBatcher<number>(flush, { delayMs: 50 });
      batcher.add(1);
      batcher.add(2);
      expect(flush).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(flush).toHaveBeenCalledWith([1, 2]);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createPlaybackGuard', () => {
  const listeners = new Map<string, EventListener>();
  const addEventListener = vi.fn((type: string, listener: EventListener) => {
    listeners.set(type, listener);
  });
  const removeEventListener = vi.fn((type: string) => {
    listeners.delete(type);
  });
  const querySelectorAll = vi.fn(() => [] as unknown as NodeListOf<HTMLVideoElement>);

  beforeEach(() => {
    listeners.clear();
    addEventListener.mockClear();
    removeEventListener.mockClear();
    querySelectorAll.mockClear();
    vi.stubGlobal('document', { addEventListener, removeEventListener, querySelectorAll });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('engages once and stays engaged while a lease is held', () => {
    const guard = createPlaybackGuard();
    const first = guard.acquire();
    const second = guard.acquire();
    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(querySelectorAll).toHaveBeenCalledTimes(1);

    first.release();
    expect(removeEventListener).not.toHaveBeenCalled();

    second.release();
    expect(removeEventListener).toHaveBeenCalledTimes(1);

    first.release();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });
});

describe('createChannelCache', () => {
  beforeEach(() => {
    resolveVideoChannel.mockReset();
  });

  it('caps concurrent lookups and keeps the queue moving', async () => {
    const resolvers = new Map<
      string,
      (meta: { id: string; name: string; handle: string }) => void
    >();
    resolveVideoChannel.mockImplementation(
      (videoId: string) => new Promise((resolve) => resolvers.set(videoId, resolve)),
    );
    const cache = createChannelCache();

    for (let index = 0; index < 8; index += 1) void cache.request(`video${index}`);
    expect(resolveVideoChannel).toHaveBeenCalledTimes(4);

    resolvers.get('video0')?.({ id: 'UCa', name: 'A', handle: '' });
    await vi.waitFor(() => expect(resolveVideoChannel).toHaveBeenCalledTimes(5));

    for (const [videoId, resolve] of resolvers) {
      resolve({ id: `UC${videoId}`, name: videoId, handle: '' });
    }
    await vi.waitFor(() =>
      expect(cache.get('video0')).toEqual({ id: 'UCa', name: 'A', handle: '' }),
    );
  });
});
