import { type ChannelMeta, resolveVideoChannel } from '../../shared/resolve';

export interface ChannelCache {
  get(videoId: string): ChannelMeta | undefined;
  request(videoId: string): Promise<void> | null;
}

const MAX_ENTRIES = 100;

export function createChannelCache(): ChannelCache {
  const cache = new Map<string, ChannelMeta>();
  const pending = new Map<string, Promise<void>>();

  function store(videoId: string, meta: ChannelMeta): void {
    cache.delete(videoId);
    cache.set(videoId, meta);
    if (cache.size <= MAX_ENTRIES) return;
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  return {
    get(videoId) {
      const meta = cache.get(videoId);
      if (meta) store(videoId, meta);
      return meta;
    },
    request(videoId) {
      if (cache.has(videoId)) return null;
      const inFlight = pending.get(videoId);
      if (inFlight) return inFlight;

      const promise = resolveVideoChannel(videoId)
        .then((meta) => {
          if (meta.id || meta.handle || meta.name) store(videoId, meta);
        })
        .catch(() => undefined)
        .finally(() => {
          pending.delete(videoId);
        });

      pending.set(videoId, promise);
      return promise;
    },
  };
}
