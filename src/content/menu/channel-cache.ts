import { type ChannelMeta, resolveVideoChannel } from '../../shared/resolve';

export interface ChannelCache {
  get(videoId: string): ChannelMeta | undefined;
  request(videoId: string): Promise<void> | null;
}

const MAX_ENTRIES = 100;
const EMPTY_TTL_MS = 60_000;

export function createChannelCache(): ChannelCache {
  const cache = new Map<string, ChannelMeta>();
  const pending = new Map<string, Promise<void>>();
  const retryAfter = new Map<string, number>();

  function evictExcess<K, V>(map: Map<K, V>): void {
    if (map.size <= MAX_ENTRIES) return;
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }

  function store(videoId: string, meta: ChannelMeta): void {
    retryAfter.delete(videoId);
    cache.delete(videoId);
    cache.set(videoId, meta);
    evictExcess(cache);
  }

  function markEmpty(videoId: string): void {
    retryAfter.delete(videoId);
    retryAfter.set(videoId, Date.now() + EMPTY_TTL_MS);
    evictExcess(retryAfter);
  }

  function isBackedOff(videoId: string): boolean {
    const until = retryAfter.get(videoId);
    if (until === undefined) return false;
    if (until > Date.now()) return true;
    retryAfter.delete(videoId);
    return false;
  }

  return {
    get(videoId) {
      const meta = cache.get(videoId);
      if (meta) store(videoId, meta);
      return meta;
    },
    request(videoId) {
      if (cache.has(videoId) || isBackedOff(videoId)) return null;
      const inFlight = pending.get(videoId);
      if (inFlight) return inFlight;

      const promise = resolveVideoChannel(videoId)
        .then((meta) => {
          if (meta.id || meta.handle || meta.name) store(videoId, meta);
          else markEmpty(videoId);
        })
        .catch(() => {
          markEmpty(videoId);
        })
        .finally(() => {
          pending.delete(videoId);
        });

      pending.set(videoId, promise);
      return promise;
    },
  };
}
