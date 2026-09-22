import { type ChannelMeta, resolveVideoChannel } from '../../shared/resolve';

export interface ChannelCache {
  get(videoId: string): ChannelMeta | undefined;
  request(videoId: string): Promise<void> | null;
}

export function createChannelCache(): ChannelCache {
  const cache = new Map<string, ChannelMeta>();

  return {
    get(videoId) {
      return cache.get(videoId);
    },
    request(videoId) {
      if (cache.has(videoId)) return null;
      cache.set(videoId, { id: '', name: '', handle: '' });
      return resolveVideoChannel(videoId)
        .then((meta) => {
          cache.set(videoId, meta);
        })
        .catch(() => undefined);
    },
  };
}
