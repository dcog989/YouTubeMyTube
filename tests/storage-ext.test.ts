import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStored } from '../src/shared/storage-ext';

function stubStorage(get: () => Promise<Record<string, unknown>>): void {
  vi.stubGlobal('browser', { storage: { local: { get } } });
}

describe('getStored', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns immediately when the key is absent', async () => {
    const get = vi.fn(async () => ({}));
    stubStorage(get);

    await expect(getStored('state')).resolves.toBeUndefined();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('returns the stored value', async () => {
    stubStorage(async () => ({ state: { rules: 'stored' } }));

    await expect(getStored('state')).resolves.toEqual({ rules: 'stored' });
  });

  it('retries a throwing storage API and then rethrows', async () => {
    vi.useFakeTimers();
    const get = vi.fn(async (): Promise<Record<string, unknown>> => {
      throw new Error('storage unavailable');
    });
    stubStorage(get);

    const assertion = expect(getStored('state')).rejects.toThrow('storage unavailable');
    await vi.runAllTimersAsync();
    await assertion;
    expect(get).toHaveBeenCalledTimes(8);
  });
});
